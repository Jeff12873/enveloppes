// Réglages : revenus annuels, méthode du prorata, part perso.

import * as store from '../../socle/store.js';
import { h, champ, saisie, saisieMontant, choix, bouton, tableau, fenetre } from '../../socle/ui.js';
import { euros, versCentimes, versTexte, pourcent } from '../../socle/argent.js';
import { anneeCourante } from '../../socle/dates.js';
import { ajouterSection } from '../parametres/vue.js';
import { nomsPersonnes } from '../enveloppes/vue.js';
import { METHODES, prorata, impotsJustes, revenusVides, estimerAnnuel } from './revenus.js';

let anneeAffichee = anneeCourante();

ajouterSection('revenus', 'Revenus et prorata', (zone, redessiner) => {
  const reglages = store.lire().reglages;
  const noms = nomsPersonnes();
  const annees = [...new Set([...Object.keys(store.lire().revenus), anneeCourante()])].sort().reverse();
  const r = structuredClone(store.lire().revenus[anneeAffichee] || revenusVides());

  const enregistrer = () => { store.changerRevenus(anneeAffichee, r); redessiner(); };
  const montant = (objet, cle) => saisieMontant(objet[cle] ? versTexte(objet[cle]) : '', {
    onchange: ev => { objet[cle] = versCentimes(ev.target.value) || 0; enregistrer(); } });

  // Méthode
  zone.append(champ('Méthode de calcul', choix(Object.entries(METHODES), reglages.methodeProrata, {
    onchange: ev => { store.changerReglages({ methodeProrata: ev.target.value }); redessiner(); } }),
  'Avec fiscalité : chacun garde ce qu\'il paierait seul, moins sa part de l\'économie due à l\'imposition commune.'));

  if (reglages.methodeProrata === 'manuel') {
    zone.append(h('div', { class: 'formulaire' },
      champ(`Part de ${noms.p1} (%)`, saisie({ type: 'number', min: 0, max: 100, step: 0.1, value: reglages.prorataManuel.p1,
        onchange: ev => {
          const p1 = Math.min(100, Math.max(0, Number(ev.target.value) || 0));
          store.changerReglages({ prorataManuel: { p1, p2: 100 - p1 } });
          redessiner();
        } })),
      champ(`Part de ${noms.p2} (%)`, saisie({ value: 100 - reglages.prorataManuel.p1, disabled: true }))));
  }

  if (reglages.methodeProrata === 'net-mensuel') {
    const derniers = reglages.derniersSalaires || { p1: 0, p2: 0 };
    zone.append(
      h('p', { class: 'doux petit' }, 'Les salaires nets sont demandés à chaque clôture du mois : le prorata suit les variations '
        + '(primes, heures sup., absences). Ceux-ci servent de point de départ et d\'affichage.'),
      h('div', { class: 'formulaire' }, ['p1', 'p2'].map(p => champ(`Dernier salaire net de ${noms[p]} (€)`,
        saisieMontant(derniers[p] ? versTexte(derniers[p]) : '', {
          onchange: ev => {
            store.changerReglages({ derniersSalaires: { ...derniers, [p]: versCentimes(ev.target.value) || 0 } });
            redessiner();
          } })))));
  }

  // Revenus de l'année
  zone.append(
    h('div', { class: 'ligne entre' },
      h('h3', { style: { margin: 0 } }, 'Revenus annuels', reglages.methodeProrata === 'net-mensuel'
        ? h('small', { class: 'doux' }, ' (pour l\'impôt juste et les autres méthodes)') : null),
      h('div', { class: 'ligne' },
        choix(annees.map(a => [a, a]), anneeAffichee, { style: { width: 'auto' }, onchange: ev => { anneeAffichee = ev.target.value; redessiner(); } }),
        bouton('Autre année', () => {
          const champAnnee = saisie({ type: 'number', min: 2000, max: 2100, value: Number(anneeCourante()) + 1 });
          fenetre('Autre année', champ('Année', champAnnee), [['Annuler'], ['Afficher', () => {
            if (!/^\d{4}$/.test(champAnnee.value)) return false;
            anneeAffichee = champAnnee.value;
            redessiner();
          }]]);
        }, 'lien'))),
    h('div', { class: 'tableau-defile' }, h('table', { class: 'tableau saisies' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, noms.p1), h('th', {}, noms.p2))),
      h('tbody', {},
        h('tr', {}, h('td', {}, 'Salaire brut annuel'), h('td', {}, montant(r.p1, 'brut')), h('td', {}, montant(r.p2, 'brut'))),
        h('tr', {}, h('td', {}, 'Net imposable annuel', h('br'), h('small', { class: 'doux' }, 'primes et 13e mois compris')),
          h('td', {}, montant(r.p1, 'netImposable')), h('td', {}, montant(r.p2, 'netImposable'))),
        h('tr', {}, h('td', {}, 'Impôt si imposé seul'), h('td', {}, montant(r.p1, 'impotSeul')), h('td', {}, montant(r.p2, 'impotSeul'))),
        h('tr', {}, h('td', {}, 'Impôt du couple'), h('td', { colSpan: 2 }, montant(r, 'impotCouple'))),
      ))),
    h('div', { class: 'ligne entre' },
      h('label', { class: 'case' }, h('input', { type: 'checkbox', checked: r.estime, onchange: ev => { r.estime = ev.target.checked; enregistrer(); } }),
        'Montants estimés (à corriger avec l\'avis d\'imposition)'),
      bouton('Estimer depuis le salaire mensuel', () => estimer(r, noms, enregistrer), 'lien')),
    h('p', { class: 'doux petit' }, 'L\'impôt « seul » et celui du couple se trouvent sur l\'avis d\'imposition ou le simulateur de impots.gouv.fr.'),
  );

  // Comparaison des méthodes
  const justes = r.p1.netImposable ? impotsJustes(r) : null;
  const lignes = Object.entries(METHODES).map(([cle, libelle]) => {
    const pr = prorata(anneeAffichee, cle);
    const actif = cle === reglages.methodeProrata;
    return [h(actif ? 'strong' : 'span', {}, libelle, actif ? ' ✓' : ''),
      pr ? pourcent(pr.p1) : '—', pr ? pourcent(pr.p2) : '—'];
  });
  zone.append(
    h('h3', {}, `Prorata ${anneeAffichee} selon la méthode`),
    tableau(['Méthode', noms.p1, noms.p2], lignes),
    justes ? h('p', { class: 'doux petit' },
      `Impôt juste : ${noms.p1} ${euros(justes.p1)} · ${noms.p2} ${euros(justes.p2)} (économie du mariage : ${euros(justes.gain)}).`) : null);
}, 20, 'Le prorata répartit les efforts selon les revenus : chaque mois avec les salaires nets, ou par année selon la méthode.');

function estimer(r, noms, enregistrer) {
  const champs = {};
  for (const p of ['p1', 'p2']) {
    champs[p] = { mensuel: saisieMontant(''), primes: saisieMontant('') };
  }
  fenetre('Estimer le net imposable annuel', h('div', { class: 'formulaire' },
    ['p1', 'p2'].map(p => [
      champ(`${noms[p]} : net imposable mensuel`, champs[p].mensuel),
      champ(`${noms[p]} : primes, 13e mois`, champs[p].primes)])),
  [['Annuler'], ['Calculer', () => {
    for (const p of ['p1', 'p2']) {
      const mensuel = versCentimes(champs[p].mensuel.value);
      if (mensuel) r[p].netImposable = estimerAnnuel(mensuel, versCentimes(champs[p].primes.value) || 0);
    }
    r.estime = true;
    enregistrer();
  }]]);
}

ajouterSection('part-perso', 'Part livret perso', (zone, redessiner) => {
  const { partPerso } = store.lire().reglages;
  const noms = nomsPersonnes();
  zone.append(h('div', { class: 'formulaire' }, ['p1', 'p2'].map(p =>
    champ(`${noms[p]} (%)`, saisie({ type: 'number', min: 0, max: 100, step: 1, value: partPerso[p],
      onchange: ev => {
        store.changerReglages({ partPerso: { ...partPerso, [p]: Math.min(100, Math.max(0, Number(ev.target.value) || 0)) } });
        redessiner();
      } })))));
}, 25, 'Part du reste du mois qui va sur le livret personnel de chacun. Le reste va au livret commun.');
