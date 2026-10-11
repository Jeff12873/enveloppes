// Écran Historique : clôtures, mouvements, enveloppes archivées.

import * as store from '../../socle/store.js';
import { route, rafraichir } from '../../socle/router.js';
import { h, carte, bouton, choix, pastille, titre, tableau, remplir, fenetre, confirmer, notifier } from '../../socle/ui.js';
import { euros, pourcent } from '../../socle/argent.js';
import { dateCourte, nomMois, deMois, moisCourt } from '../../socle/dates.js';
import { TYPES, parStatut, etat } from '../enveloppes/enveloppes.js';
import { nomsPersonnes } from '../enveloppes/vue.js';
import { annuler } from '../mois/mois.js';

const ONGLETS = { clotures: 'Clôtures', mouvements: 'Mouvements', archives: 'Archivées' };
let onglet = 'clotures';

route('#/historique', zone => {
  const contenu = h('div');
  zone.append(
    titre('Historique'),
    h('div', { class: 'onglets', style: { marginBottom: '16px' } }, Object.entries(ONGLETS).map(([cle, libelle]) =>
      h('button', { class: cle === onglet ? 'actif' : '', onclick: ev => {
        onglet = cle;
        ev.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('actif', b === ev.currentTarget));
        afficherOnglet(contenu);
      } }, libelle))),
    contenu);
  afficherOnglet(contenu);
}, { menu: 'Historique', icone: 'historique', ordre: 3 });

function afficherOnglet(contenu) {
  remplir(contenu, { clotures, mouvements, archives }[onglet]());
}

// --- Clôtures -----------------------------------------------------------------

function clotures() {
  const noms = nomsPersonnes();
  const liste = store.liste('clotures').sort((a, b) => b.date.localeCompare(a.date));
  if (!liste.length) return carte(h('p', { class: 'doux' }, 'Aucune clôture pour l\'instant.'));
  const table = tableau(['Mois', 'Date', `Reste ${noms.p1}`, `Reste ${noms.p2}`, 'Épargne commune', ''],
    liste.map(k => [
      h('span', {}, nomMois(k.mois), k.annulee ? pastille('annulée', 'neutre') : null),
      dateCourte(k.date), euros(k.reste.p1), euros(k.reste.p2),
      h('strong', { class: 'chiffre' }, euros(k.commun.p1 + k.commun.p2)),
      h('span', { class: 'ligne', style: { justifyContent: 'flex-end' } },
        bouton('Détail', () => detailCloture(k), 'lien'),
        k.annulee ? null : bouton('Annuler', async () => {
          if (!(await confirmer(`Annuler la clôture ${deMois(k.mois)} ? Ses versements ne compteront plus (ils restent visibles, barrés).`, 'Annuler la clôture'))) return;
          annuler(k.id);
          notifier('Clôture annulée');
          rafraichir();
        }, 'lien')),
    ]));
  liste.forEach((k, i) => { if (k.annulee) table.querySelectorAll('tbody tr')[i].classList.add('barre-texte'); });
  return carte(table);
}

function detailCloture(k) {
  const noms = nomsPersonnes();
  const versements = store.liste('mouvements').filter(m => m.cloture === k.id);
  fenetre(`Clôture ${deMois(k.mois)}`, h('div', { class: 'pile' },
    h('p', { class: 'doux' }, `Faite le ${dateCourte(k.date)} · prorata ${noms.p1} ${pourcent(k.prorata.p1)} / ${noms.p2} ${pourcent(k.prorata.p2)}`),
    tableau(['', k.salaires ? 'Salaire net' : null, 'Reste', 'Perso', 'Commun'].filter(c => c !== null),
      ['p1', 'p2'].map(p => [noms[p], k.salaires ? euros(k.salaires[p]) : null, euros(k.reste[p]), euros(k.perso[p]), euros(k.commun[p])].filter(c => c !== null))),
    k.exceptionnelles.length ? tableau(['Exceptionnelle', 'Montant', 'Remboursement'], k.exceptionnelles.map(x => [
      store.trouver('exceptionnelles', x.id)?.nom || '?', euros(x.montant),
      `${noms[x.remboursement.de]} → ${noms[x.remboursement.a]} : ${euros(x.remboursement.montant)}`])) : null,
    versements.length ? tableau(['Enveloppe', 'Versement'], versements.map(m => [
      store.trouver('enveloppes', m.enveloppe)?.nom || '?', euros(m.montant)])) : null));
}

// --- Mouvements ---------------------------------------------------------------

let filtreEnveloppe = '';
let filtreType = '';

function mouvements() {
  const enveloppes = store.liste('enveloppes');
  const resultat = h('div');
  const dessiner = () => {
    const liste = store.liste('mouvements')
      .filter(m => !filtreEnveloppe || m.enveloppe === filtreEnveloppe || m.vers === filtreEnveloppe)
      .filter(m => !filtreType || m.type === filtreType)
      .sort((a, b) => b.date.localeCompare(a.date));
    const table = tableau(['Date', 'Enveloppe', 'Type', 'Note', 'Montant'], liste.map(m => [
      dateCourte(m.date),
      h('a', { href: `#/enveloppe/${m.enveloppe}` }, store.trouver('enveloppes', m.enveloppe)?.nom || '?'),
      m.type === 'transfert' ? `Transfert → ${store.trouver('enveloppes', m.vers)?.nom || '?'}` : TYPES[m.type],
      h('span', { class: 'doux' }, m.note || ''),
      h('span', { class: 'chiffre' }, euros(m.type === 'versement' ? m.montant : -m.montant)),
    ]));
    liste.forEach((m, i) => { if (m.annule) table.querySelectorAll('tbody tr')[i].classList.add('barre-texte'); });
    remplir(resultat, h('p', { class: 'doux petit' }, `${liste.length} mouvements`), table);
  };
  dessiner();
  return carte(
    h('div', { class: 'formulaire', style: { marginBottom: '14px' } },
      choix([['', 'Toutes les enveloppes'], ...enveloppes.map(e => [e.id, e.nom])], filtreEnveloppe,
        { onchange: ev => { filtreEnveloppe = ev.target.value; dessiner(); } }),
      choix([['', 'Tous les types'], ...Object.entries(TYPES)], filtreType,
        { onchange: ev => { filtreType = ev.target.value; dessiner(); } })),
    resultat);
}

// --- Archivées ------------------------------------------------------------------

function archives() {
  const liste = parStatut('archive');
  if (!liste.length) return carte(h('p', { class: 'doux' }, 'Aucune enveloppe archivée.'));
  return carte(tableau(['Enveloppe', 'Échéance', 'Solde', 'Objectif'], liste.map(e => {
    const s = etat(e);
    return [h('a', { href: `#/enveloppe/${e.id}` }, e.nom), moisCourt(e.echeance), euros(s.solde), euros(s.objectif)];
  })));
}

