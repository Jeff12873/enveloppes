// Réglages de la réévaluation des %, aperçu, et alertes de faisabilité.

import * as store from '../../socle/store.js';
import { aller } from '../../socle/router.js';
import { h, champ, saisie, choix, bouton, tableau, fenetre, notifier } from '../../socle/ui.js';
import { euros, pourcent } from '../../socle/argent.js';
import { moisCourt, moisCourant } from '../../socle/dates.js';
import { ajouterAlertes } from '../../socle/alertes.js';
import { ajouterSection } from '../parametres/vue.js';
import { proposer, faisabilite, totalPourcentages, normaliser, noterReevaluation } from './reevaluation.js';
import { parStatut } from '../enveloppes/enveloppes.js';

const MODES = {
  manuel: 'Manuel : les % ne bougent que si je les change',
  suggestion: 'Suggestion : proposée à la clôture, je valide',
  auto: 'Automatique : appliquée à la clôture (modifiable)',
};

ajouterSection('reevaluation', 'Réévaluation des %', (zone, redessiner) => {
  const reglages = store.lire().reglages;
  const r = reglages.reevaluation;
  const changer = champs => { store.changerReglages({ reevaluation: { ...r, ...champs } }); redessiner(); };

  zone.append(
    h('div', { class: 'formulaire' },
      h('div', { class: 'large' }, champ('Mode', choix(Object.entries(MODES), r.mode, { onchange: ev => changer({ mode: ev.target.value }) }))),
      champ('Fréquence', choix([['mensuelle', 'Chaque mois'], ['trimestrielle', 'Chaque trimestre']], r.frequence,
        { onchange: ev => changer({ frequence: ev.target.value }) })),
      champ('Variation max (points)', saisie({ type: 'number', min: 0, max: 100, value: r.variationMax,
        onchange: ev => changer({ variationMax: Math.max(0, Number(ev.target.value) || 0) }) }), '0 = pas de limite'),
      champ('Surplus d\'une enveloppe pleine', choix([['redistribuer', 'Redistribué aux autres'], ['tampon', 'Mis dans le Tampon']], reglages.surplus,
        { onchange: ev => { store.changerReglages({ surplus: ev.target.value }); redessiner(); } })),
      champ('Alerte si couverture sous (%)', saisie({ type: 'number', min: 0, max: 200, value: reglages.seuilAlerte,
        onchange: ev => { store.changerReglages({ seuilAlerte: Number(ev.target.value) || 0 }); redessiner(); } }))),
    h('p', { class: 'doux petit' }, 'Chaque enveloppe reçoit un % proportionnel à son besoin mensuel : ce qui lui manque divisé par les mois restants avant l\'échéance. '
      + 'Les enveloppes verrouillées ou sans échéance gardent leur %.'),
    bouton('Voir la proposition maintenant', () => apercu(redessiner), 'secondaire'));
}, 40);

function apercu(redessiner) {
  const proposition = proposer();
  const f = faisabilite();
  const lignes = f.details.map(d => [
    d.enveloppe.nom, euros(d.reste), d.moisRestants ?? '—', euros(d.besoin),
    pourcent(d.enveloppe.pourcentage), h('strong', {}, pourcent(proposition[d.enveloppe.id] ?? 0)),
  ]);
  fenetre('Proposition de réévaluation', h('div', { class: 'pile' },
    tableau(['Enveloppe', 'Reste', 'Mois', 'Besoin/mois', 'Actuel', 'Proposé'], lignes),
    h('p', { class: 'doux petit' }, `Besoin total ${euros(f.sommeBesoins)}/mois · épargne moyenne ${euros(f.moyenne)}/mois · couverture ${f.couverture} %.`)),
  [['Fermer'], ['Appliquer', () => {
    for (const [id, p] of Object.entries(proposition)) store.mettreAJour('enveloppes', id, { pourcentage: p });
    noterReevaluation(moisCourant());
    notifier('Nouveaux % appliqués');
    redessiner?.();
  }]]);
}

function detailsFaisabilite() {
  const f = faisabilite();
  fenetre('Échéances au rythme actuel', h('div', { class: 'pile' },
    h('p', {}, `Épargne moyenne : ${euros(f.moyenne)}/mois. Il faudrait ${euros(f.sommeBesoins)}/mois pour tout tenir (${f.couverture} %).`),
    tableau(['Enveloppe', 'Échéance', 'Besoin/mois', 'Reçoit/mois', 'Prévu'], f.details.map(d => [
      d.enveloppe.nom, moisCourt(d.enveloppe.echeance), euros(d.besoin), euros(d.parMois),
      h('span', { style: { color: d.enRetard ? 'var(--alerte)' : 'var(--succes)', fontWeight: 650 } },
        d.reste <= 0 ? 'atteint' : d.dateRealiste ? moisCourt(d.dateRealiste) : 'jamais'),
    ])),
    h('p', { class: 'doux petit' }, 'Pistes : repousser des échéances, réduire des objectifs, mettre en pause un projet, ou réévaluer les %.')),
  [['Fermer'], ['Réévaluer les %', () => { setTimeout(() => apercu(), 0); }]]);
}

// --- Alertes ------------------------------------------------------------------

ajouterAlertes(() => {
  const alertes = [];
  if (!parStatut('ouvert').length) return alertes;

  const total = totalPourcentages();
  if (Math.abs(total - 100) > 0.05) {
    alertes.push({ texte: `Les % des enveloppes ouvertes font ${pourcent(total)} au lieu de 100 %.`, genre: 'alerte',
      action: ['Ramener à 100 %', () => {
        const actuels = Object.fromEntries(parStatut('ouvert').map(e => [e.id, e.pourcentage]));
        for (const [id, p] of Object.entries(normaliser(actuels))) store.mettreAJour('enveloppes', id, { pourcentage: p });
        notifier('% ramenés à 100');
        aller('#/accueil');
      }] });
  }

  const f = faisabilite();
  if (f.moyenne && f.couverture < store.lire().reglages.seuilAlerte) {
    const retards = f.details.filter(d => d.enRetard).length;
    alertes.push({
      texte: `Échéances difficiles : l'épargne couvre ${f.couverture} % du besoin (${euros(f.moyenne)} sur ${euros(f.sommeBesoins)} par mois). ${retards} enveloppe(s) en retard au rythme actuel.`,
      genre: 'alerte', action: ['Détails', detailsFaisabilite],
    });
  }
  return alertes;
});
