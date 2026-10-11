// Clôture du mois : reprend les macros du tableur. Règles : docs/CALCULS.md § 2.

import * as store from '../../socle/store.js';
import { repartir } from '../../socle/argent.js';
import { aujourdhui, moisCourant, ajouterMois } from '../../socle/dates.js';
import { prorata } from '../revenus/revenus.js';
import { parStatut, etat, tampon, mouvement } from '../enveloppes/enveloppes.js';

export function cloturesValides() {
  return store.liste('clotures').filter(c => !c.annulee).sort((a, b) => a.date.localeCompare(b.date));
}

/** Le prochain mois à clôturer. */
export function moisAClore() {
  const dernier = cloturesValides().map(c => c.mois).sort().pop();
  return dernier ? ajouterMois(dernier, 1) : ajouterMois(moisCourant(), -1);
}

/** « retard » si un mois terminé n'est pas clôturé, « bientot » en fin de mois. */
export function etatCloture() {
  const mois = moisAClore();
  if (mois < moisCourant()) return 'retard';
  if (mois === moisCourant() && Number(aujourdhui().slice(8)) >= 25) return 'bientot';
  return 'ok';
}

/** Prorata de la clôture : salaires nets du mois saisis, ou méthode annuelle. */
export function prorataDuMois(saisie) {
  return prorata(saisie.mois.slice(0, 4), null, saisie.salaires);
}

/** La méthode choisie demande-t-elle les salaires du mois ? */
export function avecSalairesDuMois() {
  return store.lire().reglages.methodeProrata === 'net-mensuel';
}

/** Qui a le plus petit revenu (c'est lui qui saisit son reste du mois). */
export function personnes(pr) {
  return pr.p1 <= pr.p2 ? { petit: 'p1', gros: 'p2' } : { petit: 'p2', gros: 'p1' };
}

/** Partage d'une dépense exceptionnelle : qui rembourse qui. */
export function partageExceptionnelle(exceptionnelle, montant, payeur, pr) {
  const parts = exceptionnelle.mode === 'fixe' ? exceptionnelle.parts : { p1: pr.p1, p2: pr.p2 };
  const autre = payeur === 'p1' ? 'p2' : 'p1';
  return { de: autre, a: payeur, montant: Math.round(montant * parts[autre] / 100) };
}

/**
 * Calcule toute la clôture sans rien enregistrer.
 * saisie = { mois, salaires: { p1, p2 } (méthode « net-mensuel »), reste (centimes du plus petit revenu),
 *            exceptionnelles: [{ id, montant, payeur }], pourcentages: { idEnveloppe: % } }
 */
export function calculer(saisie) {
  const pr = prorataDuMois(saisie);
  if (!pr) throw new Error('Renseignez les revenus dans les réglages.');
  const { petit, gros } = personnes(pr);
  const { partPerso, surplus } = store.lire().reglages;

  const reste = { [petit]: saisie.reste, [gros]: Math.round(saisie.reste * pr[gros] / pr[petit]) };
  const perso = {}, commun = {};
  for (const p of ['p1', 'p2']) {
    perso[p] = Math.round(reste[p] * partPerso[p] / 100);
    commun[p] = reste[p] - perso[p];
  }
  const epargne = commun.p1 + commun.p2;

  const exceptionnelles = saisie.exceptionnelles
    .filter(x => x.montant > 0)
    .map(x => ({ ...x, remboursement: partageExceptionnelle(store.trouver('exceptionnelles', x.id), x.montant, x.payeur, pr) }));

  const { versements, versementTampon } = repartirEpargne(epargne, saisie.pourcentages, surplus);
  return { mois: saisie.mois, prorata: { p1: pr.p1, p2: pr.p2 }, salaires: saisie.salaires || null, petit, gros, reste, perso, commun,
    epargne, exceptionnelles, versements, versementTampon };
}

/**
 * Répartit l'épargne selon les %. Une enveloppe ne reçoit jamais plus que son
 * reste à épargner : le surplus va aux autres (ou au Tampon selon le réglage).
 */
export function repartirEpargne(epargne, pourcentages, surplus = 'redistribuer') {
  const candidates = parStatut('ouvert')
    .map(e => ({ e, reste: etat(e).reste, aPlafond: etat(e).objectif > 0, p: pourcentages[e.id] ?? e.pourcentage }))
    .filter(c => c.p > 0 && !(c.aPlafond && c.reste <= 0));

  const recu = new Map(candidates.map(c => [c.e.id, 0]));
  let aDistribuer = epargne;
  let enLice = candidates;
  let versementTampon = 0;

  while (aDistribuer > 0 && enLice.length) {
    const parts = repartir(aDistribuer, enLice.map(c => c.p));
    aDistribuer = 0;
    const pleines = [];
    enLice.forEach((c, i) => {
      const place = c.aPlafond ? c.reste - recu.get(c.e.id) : Infinity;
      const donne = Math.min(parts[i], place);
      recu.set(c.e.id, recu.get(c.e.id) + donne);
      aDistribuer += parts[i] - donne;
      if (donne < parts[i] || donne === place) pleines.push(c);
    });
    enLice = enLice.filter(c => !pleines.includes(c));
    if (surplus !== 'redistribuer') break;
  }
  versementTampon += aDistribuer;

  const versements = candidates.map(c => ({ enveloppe: c.e.id, montant: recu.get(c.e.id), pourcentage: c.p }))
    .filter(v => v.montant > 0);
  return { versements, versementTampon };
}

/** Enregistre la clôture et ses versements. */
export function enregistrer(calcul) {
  const date = aujourdhui();
  const cloture = store.ajouter('clotures', {
    date, mois: calcul.mois, prorata: calcul.prorata, salaires: calcul.salaires, reste: calcul.reste,
    perso: calcul.perso, commun: calcul.commun,
    exceptionnelles: calcul.exceptionnelles.map(({ id, montant, payeur, remboursement }) => ({ id, montant, payeur, remboursement })),
    annulee: false,
  });
  for (const v of calcul.versements) {
    mouvement({ enveloppe: v.enveloppe, type: 'versement', montant: v.montant, date, cloture: cloture.id });
  }
  if (calcul.salaires) store.changerReglages({ derniersSalaires: calcul.salaires });
  if (calcul.versementTampon > 0) {
    mouvement({ enveloppe: tampon().id, type: 'versement', montant: calcul.versementTampon, date, cloture: cloture.id, note: 'Surplus' });
  }
  return cloture;
}

/** Annule une clôture : elle et ses versements restent visibles mais ne comptent plus. */
export function annuler(id) {
  store.mettreAJour('clotures', id, { annulee: true });
  for (const m of store.liste('mouvements').filter(m => m.cloture === id && !m.annule)) {
    store.mettreAJour('mouvements', m.id, { annule: true });
  }
}
