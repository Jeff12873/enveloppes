// Assistant « Clôturer le mois » en 6 étapes. Rien n'est enregistré avant la dernière.

import * as store from '../../socle/store.js';
import { route, aller } from '../../socle/router.js';
import { h, carte, bouton, champ, saisie, saisieMontant, choix, alerte, titre, tableau, remplir, notifier } from '../../socle/ui.js';
import { euros, versCentimes, versTexte, pourcent } from '../../socle/argent.js';
import { nomMois, deMois } from '../../socle/dates.js';
import { ajouterAlertes } from '../../socle/alertes.js';
import { parStatut, etat } from '../enveloppes/enveloppes.js';
import { nomsPersonnes } from '../enveloppes/vue.js';
import { normaliser, totalPourcentages, proposer, reevaluationDue, noterReevaluation, faisabilite } from '../reevaluation/reevaluation.js';
import { moisAClore, etatCloture, personnes, partageExceptionnelle, calculer, enregistrer,
  prorataDuMois, avecSalairesDuMois } from './mois.js';

const ETAPES = ['Salaires et exceptionnelles', 'Reste du mois', 'Perso / commun', 'Pourcentages', 'Répartition', 'Récapitulatif'];

let saisie_ = null;   // saisie en cours, gardée tant qu'on reste dans l'assistant
let etape = 0;

route('#/mois', zone => {
  saisie_ = nouvelleSaisie();
  etape = 0;
  dessiner(zone);
}, { menu: 'Mois', icone: 'mois', ordre: 2 });

function nouvelleSaisie() {
  const derniers = store.lire().reglages.derniersSalaires;
  return {
    mois: moisAClore(),
    salaires: avecSalairesDuMois() ? { p1: derniers?.p1 || 0, p2: derniers?.p2 || 0 } : null,
    reste: null,
    exceptionnelles: store.liste('exceptionnelles').filter(x => x.actif)
      .map(x => ({ id: x.id, montant: 0, payeur: x.payeur || 'p1' })),
    pourcentages: Object.fromEntries(parStatut('ouvert').map(e => [e.id, e.pourcentage])),
    choixPourcentages: 'actuels',
  };
}

function dessiner(zone) {
  const pr = prorataDuMois(saisie_);
  remplir(zone, titre('Clôturer le mois', `Étape ${etape + 1} sur ${ETAPES.length} : ${ETAPES[etape]}`),
    h('div', { class: 'etapes' }, ETAPES.map((_, i) => h('span', { class: i <= etape ? 'faite' : '' }))));

  if (!pr && !saisie_.salaires) {
    zone.append(alerte('Le prorata ne peut pas être calculé : renseignez les revenus de l\'année.', 'danger',
      ['Ouvrir les réglages', () => aller('#/reglages/revenus')]));
    return;
  }

  const contenu = [etapeExceptionnelles, etapeReste, etapePersoCommun, etapePourcentages, etapeRepartition, etapeRecapitulatif][etape](pr);
  const peutContinuer = Boolean(pr) && (etape !== 1 || saisie_.reste > 0);
  zone.append(carte(contenu),
    h('div', { class: 'navigation-etapes' },
      etape > 0 ? bouton('Retour', () => { etape--; dessiner(zone); }, 'secondaire') : h('span'),
      etape < ETAPES.length - 1
        ? h('button', { class: 'bouton principal', disabled: !peutContinuer, id: 'suivant',
          onclick: () => { etape++; dessiner(zone); } }, 'Suivant')
        : bouton('Confirmer et enregistrer', confirmerCloture)));
}

// --- Étape 1 : mois, salaires du mois, dépenses exceptionnelles -------------------

function etapeExceptionnelles(pr) {
  const noms = nomsPersonnes();
  const majExceptionnelles = [];
  const champMois = saisie({ type: 'month', value: saisie_.mois, style: { maxWidth: '220px' },
    onchange: ev => { if (ev.target.value) saisie_.mois = ev.target.value; } });

  const lignes = saisie_.exceptionnelles.map(x => {
    const definition = store.trouver('exceptionnelles', x.id);
    const resultat = h('p', { class: 'petit doux' });
    const maj = () => {
      const prActuel = prorataDuMois(saisie_);
      if (!prActuel && definition.mode !== 'fixe') {
        resultat.textContent = 'Saisissez les salaires du mois pour calculer le partage.';
        return;
      }
      const r = partageExceptionnelle(definition, x.montant, x.payeur, prActuel);
      resultat.textContent = x.montant > 0
        ? `→ ${noms[r.de]} rembourse ${euros(r.montant)} à ${noms[r.a]}`
        : 'Rien ce mois-ci.';
    };
    maj();
    majExceptionnelles.push(maj);
    return h('div', { class: 'pile' },
      h('h3', {}, definition.nom, h('span', { class: 'doux petit' },
        definition.mode === 'fixe' ? `  · ${noms.p1} ${definition.parts.p1} % / ${noms.p2} ${definition.parts.p2} %` : '  · au prorata')),
      h('div', { class: 'formulaire' },
        champ('Montant du mois (€)', saisieMontant(x.montant ? versTexte(x.montant) : '', {
          oninput: ev => { x.montant = versCentimes(ev.target.value) || 0; maj(); } })),
        champ('Payé par', choix([['p1', noms.p1], ['p2', noms.p2]], x.payeur, {
          onchange: ev => { x.payeur = ev.target.value; maj(); } }))),
      resultat);
  });

  return h('div', { class: 'pile' },
    champ('Mois clôturé', champMois),
    saisie_.salaires ? salairesDuMois(noms, () => majExceptionnelles.forEach(f => f())) : null,
    lignes.length ? h('h3', { style: { marginTop: '8px' } }, 'Dépenses exceptionnelles') : null,
    lignes.length ? lignes : h('p', { class: 'doux' }, 'Aucune enveloppe exceptionnelle active. Vous pouvez en créer dans les réglages.'));
}

/** Saisie des salaires nets du mois : le prorata se recalcule en direct. */
function salairesDuMois(noms, apresChangement) {
  const apercu = h('div', { class: 'bandeau info' });
  const maj = () => {
    const pr = prorataDuMois(saisie_);
    remplir(apercu, h('span', {}, pr
      ? `Prorata de ce mois : ${noms.p1} ${pourcent(pr.p1)} · ${noms.p2} ${pourcent(pr.p2)}`
      : 'Saisissez les deux salaires pour calculer le prorata.'));
    const suivant = document.getElementById('suivant');
    if (suivant) suivant.disabled = !pr;
    apresChangement();
  };
  const champs = ['p1', 'p2'].map(p => champ(`Salaire net de ${noms[p]} (€)`,
    saisieMontant(saisie_.salaires[p] ? versTexte(saisie_.salaires[p]) : '', {
      oninput: ev => { saisie_.salaires[p] = versCentimes(ev.target.value) || 0; maj(); } })));
  setTimeout(maj, 0);
  return h('div', { class: 'pile' },
    h('h3', { style: { margin: 0 } }, 'Salaires du mois'),
    h('div', { class: 'formulaire' }, champs),
    h('p', { class: 'doux petit', style: { margin: 0 } }, 'Le net perçu ce mois-ci, pré-rempli avec le mois précédent.'),
    apercu);
}

// --- Étape 2 : reste du plus petit revenu ---------------------------------------

function etapeReste(pr) {
  const noms = nomsPersonnes();
  const { petit, gros } = personnes(pr);
  const resultat = h('div', { class: 'bandeau info' });
  const maj = () => {
    const reste = saisie_.reste || 0;
    remplir(resultat, h('span', {}, `${noms[gros]} verse au prorata : `,
      h('strong', { class: 'chiffre' }, euros(Math.round(reste * pr[gros] / pr[petit])))));
    const suivant = document.getElementById('suivant');
    if (suivant) suivant.disabled = !(reste > 0);
  };
  maj();
  return h('div', { class: 'pile' },
    h('p', {}, `Prorata : ${noms.p1} ${pourcent(pr.p1)} · ${noms.p2} ${pourcent(pr.p2)}.`),
    champ(`Reste du mois de ${noms[petit]} (€)`,
      saisieMontant(saisie_.reste ? versTexte(saisie_.reste) : '', {
        autofocus: true, oninput: ev => { saisie_.reste = versCentimes(ev.target.value); maj(); } }),
      'Ce qu\'il reste sur le compte à la fin du mois, avant épargne.'),
    resultat);
}

// --- Étape 3 : perso / commun -------------------------------------------------------

function etapePersoCommun() {
  const c = calculer(saisie_);
  const noms = nomsPersonnes();
  const parts = store.lire().reglages.partPerso;
  return h('div', { class: 'pile' },
    tableau(['', 'Reste', `Livret perso`, 'Livret commun'], ['p1', 'p2'].map(p => [
      h('strong', {}, noms[p]), euros(c.reste[p]), `${euros(c.perso[p])} (${pourcent(parts[p])})`, euros(c.commun[p])])),
    h('div', { class: 'ligne entre' },
      h('span', {}, 'Épargne commune du mois'),
      h('strong', { class: 'chiffre grand' }, euros(c.epargne))));
}

// --- Étape 4 : pourcentages ------------------------------------------------------

function etapePourcentages() {
  const ouvertes = parStatut('ouvert');
  const actuels = Object.fromEntries(ouvertes.map(e => [e.id, e.pourcentage]));
  const options = { actuels: ['Garder les % actuels', actuels] };
  if (Math.abs(totalPourcentages() - 100) > 0.05) options.normalises = ['Ramener à 100 %', normaliser(actuels)];
  const { mode } = store.lire().reglages.reevaluation;
  if (mode !== 'manuel' && reevaluationDue(saisie_.mois)) {
    options.reevalues = ['Réévaluer selon le temps restant', proposer()];
    if (mode === 'auto' && saisie_.choixPourcentages === 'actuels') {
      saisie_.choixPourcentages = 'reevalues';
      saisie_.pourcentages = { ...options.reevalues[1] };
    }
  }

  const total = h('strong', { class: 'chiffre' });
  const champs = {};
  const majTotal = () => {
    const t = Object.values(saisie_.pourcentages).reduce((a, b) => a + (Number(b) || 0), 0);
    total.textContent = pourcent(t);
    total.style.color = Math.abs(t - 100) > 0.05 ? 'var(--danger)' : 'var(--succes)';
  };
  const appliquer = cle => {
    saisie_.choixPourcentages = cle;
    saisie_.pourcentages = { ...options[cle][1] };
    for (const id of Object.keys(champs)) champs[id].value = saisie_.pourcentages[id] ?? 0;
    majTotal();
  };

  const lignes = ouvertes.map(e => {
    champs[e.id] = saisie({ type: 'number', step: 0.1, min: 0, max: 100, value: saisie_.pourcentages[e.id] ?? 0,
      style: { width: '90px', textAlign: 'right' },
      oninput: ev => { saisie_.pourcentages[e.id] = Number(ev.target.value) || 0; saisie_.choixPourcentages = 'manuel'; majTotal(); } });
    const s = etat(e);
    return [e.nom, euros(s.reste), pourcent(e.pourcentage),
      options.reevalues ? pourcent(options.reevalues[1][e.id]) : null, champs[e.id]].filter(c => c !== null);
  });
  majTotal();

  const f = faisabilite(saisie_.mois);
  return h('div', { class: 'pile' },
    f.couverture < store.lire().reglages.seuilAlerte
      ? alerte(`Au rythme actuel (${euros(f.moyenne)}/mois), vous couvrez ${f.couverture} % du besoin (${euros(f.sommeBesoins)}/mois) pour tenir toutes les échéances.`, 'alerte')
      : null,
    h('div', { class: 'onglets' }, Object.entries(options).map(([cle, [libelle]]) =>
      h('button', { class: saisie_.choixPourcentages === cle ? 'actif' : '', onclick: ev => {
        ev.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('actif'));
        ev.currentTarget.classList.add('actif');
        appliquer(cle);
      } }, libelle))),
    tableau(['Enveloppe', 'Reste', 'Actuel', options.reevalues ? 'Proposé' : null, 'Ce mois'].filter(Boolean), lignes),
    h('div', { class: 'ligne entre' }, h('span', {}, 'Total'), total),
    h('p', { class: 'doux petit' }, 'Les % retenus seront enregistrés dans les enveloppes. Si le total n\'est pas 100 %, la répartition reste proportionnelle.'));
}

// --- Étape 5 : répartition ----------------------------------------------------------

function etapeRepartition() {
  const c = calculer(saisie_);
  const lignes = c.versements.map(v => {
    const e = store.trouver('enveloppes', v.enveloppe);
    const s = etat(e);
    return [e.nom, pourcent(v.pourcentage), h('strong', { class: 'chiffre' }, euros(v.montant)),
      `${euros(s.solde + v.montant)} / ${euros(s.objectif)}`];
  });
  if (c.versementTampon) lignes.push(['Tampon (surplus)', '—', h('strong', { class: 'chiffre' }, euros(c.versementTampon)), '']);
  return h('div', { class: 'pile' },
    h('p', {}, `${euros(c.epargne)} à répartir. Une enveloppe ne reçoit jamais plus que ce qui lui manque.`),
    tableau(['Enveloppe', '%', 'Versement', 'Après'], lignes));
}

// --- Étape 6 : récapitulatif ------------------------------------------------------

function etapeRecapitulatif() {
  const c = calculer(saisie_);
  const noms = nomsPersonnes();
  const virements = c.exceptionnelles.map(x => [
    `${store.trouver('exceptionnelles', x.id).nom}`, `${noms[x.remboursement.de]} → ${noms[x.remboursement.a]}`, euros(x.remboursement.montant)]);
  for (const p of ['p1', 'p2']) {
    virements.push([`${noms[p]} : livret perso`, noms[p], euros(c.perso[p])]);
    virements.push([`${noms[p]} : livret commun`, noms[p], euros(c.commun[p])]);
  }
  return h('div', { class: 'pile' },
    h('p', {}, `Clôture ${deMois(c.mois)}. Virements à faire :`),
    tableau(['Virement', 'Qui', 'Montant'], virements.map(v => [v[0], v[1], h('strong', { class: 'chiffre' }, v[2])])),
    h('div', { class: 'ligne entre' }, h('span', {}, 'Total vers le livret commun'), h('strong', { class: 'chiffre grand' }, euros(c.epargne))),
    store.liste('clotures').some(k => !k.annulee && k.mois === c.mois)
      ? alerte(`${nomMois(c.mois)} est déjà clôturé. Une seconde clôture s'ajoutera à la première.`, 'alerte') : null);
}

function confirmerCloture() {
  for (const [id, p] of Object.entries(saisie_.pourcentages)) {
    if (store.trouver('enveloppes', id).pourcentage !== p) store.mettreAJour('enveloppes', id, { pourcentage: Number(p) });
  }
  if (saisie_.choixPourcentages === 'reevalues') noterReevaluation(saisie_.mois);
  enregistrer(calculer(saisie_));
  notifier(`${nomMois(saisie_.mois)} clôturé`);
  aller('#/accueil');
}

// --- Alerte sur l'accueil -----------------------------------------------------------

ajouterAlertes(() => {
  const statut = etatCloture();
  if (statut === 'ok') return [];
  const texte = statut === 'retard'
    ? `La clôture ${deMois(moisAClore())} est à faire.`
    : `Fin du mois : pensez à clôturer ${nomMois(moisAClore())}.`;
  return [{ texte, genre: statut === 'retard' ? 'alerte' : 'info', action: ['Clôturer', () => aller('#/mois')] }];
});

