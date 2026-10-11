// Réévaluation des % selon le temps restant, et alerte de faisabilité.
// Règles : docs/CALCULS.md § 2d et § 5.

import * as store from '../../socle/store.js';
import { moisCourant, moisEntre, ajouterMois } from '../../socle/dates.js';
import { parStatut, etat } from '../enveloppes/enveloppes.js';

/** Ramène des % à un total de 100, proportionnellement. { id: % } → { id: % } */
export function normaliser(pourcentages) {
  const ids = Object.keys(pourcentages);
  const somme = ids.reduce((t, id) => t + pourcentages[id], 0);
  if (!somme) return { ...pourcentages };
  const resultat = {};
  for (const id of ids) resultat[id] = arrondi(pourcentages[id] * 100 / somme);
  return corrigerTotal(resultat, 100);
}

/** Somme des % des enveloppes ouvertes. */
export function totalPourcentages() {
  return arrondi(parStatut('ouvert').reduce((t, e) => t + e.pourcentage, 0));
}

/** Besoin mensuel de chaque enveloppe ouverte pour tenir son échéance. */
export function besoins(mois = moisCourant()) {
  return parStatut('ouvert').map(e => {
    const { reste, atteint } = etat(e);
    const moisRestants = e.echeance ? Math.max(1, moisEntre(mois, e.echeance)) : null;
    return {
      enveloppe: e, reste, atteint, moisRestants,
      besoin: moisRestants && !atteint ? Math.round(reste / moisRestants) : 0,
    };
  });
}

/**
 * Propose de nouveaux % (somme 100) selon les besoins et les réglages.
 * Renvoie { id: % } pour toutes les enveloppes ouvertes.
 */
export function proposer(mois = moisCourant()) {
  const { variationMax } = store.lire().reglages.reevaluation;
  const liste = besoins(mois);
  const proposition = {};

  // Enveloppes fixes : verrouillées ou sans échéance. Pleines : 0 %.
  const fixes = liste.filter(b => b.enveloppe.verrouille || !b.moisRestants);
  const mobiles = liste.filter(b => !fixes.includes(b));
  for (const b of fixes) proposition[b.enveloppe.id] = b.atteint ? 0 : b.enveloppe.pourcentage;

  const disponible = 100 - fixes.reduce((t, b) => t + proposition[b.enveloppe.id], 0);
  const sommeBesoins = mobiles.reduce((t, b) => t + b.besoin, 0);
  if (!mobiles.length) return proposition;

  const brut = {};
  for (const b of mobiles) {
    const actuel = b.enveloppe.pourcentage;
    let p = sommeBesoins ? b.besoin * disponible / sommeBesoins : actuel;
    if (variationMax > 0) p = Math.min(actuel + variationMax, Math.max(actuel - variationMax, p));
    if (!b.atteint) p = Math.max(p, b.enveloppe.plancher || 0);
    brut[b.enveloppe.id] = b.atteint ? 0 : p;
  }

  const total = Object.values(brut).reduce((t, p) => t + p, 0);
  for (const id of Object.keys(brut)) proposition[id] = total ? arrondi(brut[id] * disponible / total) : 0;
  return corrigerTotal(proposition, 100);
}

/** La réévaluation est-elle due ce mois-ci, selon la fréquence choisie ? */
export function reevaluationDue(mois = moisCourant()) {
  const { mode, frequence, derniere } = store.lire().reglages.reevaluation;
  if (mode === 'manuel') return false;
  if (!derniere || frequence === 'mensuelle') return true;
  return moisEntre(derniere, mois) >= 3;
}

export function noterReevaluation(mois) {
  const r = store.lire().reglages.reevaluation;
  store.changerReglages({ reevaluation: { ...r, derniere: mois } });
}

/** Épargne commune moyenne des 3 dernières clôtures. */
export function epargneMoyenne() {
  const dernieres = store.liste('clotures').filter(c => !c.annulee)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  if (!dernieres.length) return 0;
  const total = dernieres.reduce((t, c) => t + c.commun.p1 + c.commun.p2, 0);
  return Math.round(total / dernieres.length);
}

/**
 * Peut-on tenir les échéances ? Renvoie la couverture (%) et, pour chaque
 * enveloppe, la date réaliste au rythme actuel.
 */
export function faisabilite(mois = moisCourant()) {
  const moyenne = epargneMoyenne();
  const liste = besoins(mois);
  const sommeBesoins = liste.reduce((t, b) => t + b.besoin, 0);
  const couverture = sommeBesoins ? Math.round(moyenne * 100 / sommeBesoins) : 100;

  const details = liste.map(b => {
    const parMois = Math.round(moyenne * b.enveloppe.pourcentage / 100);
    const moisNecessaires = b.reste > 0 && parMois > 0 ? Math.ceil(b.reste / parMois) : (b.reste > 0 ? null : 0);
    const dateRealiste = moisNecessaires === null ? null : ajouterMois(mois, moisNecessaires);
    const enRetard = Boolean(b.enveloppe.echeance && b.reste > 0
      && (dateRealiste === null || dateRealiste > b.enveloppe.echeance));
    return { ...b, parMois, dateRealiste, enRetard };
  });
  return { moyenne, sommeBesoins, couverture, details };
}

function arrondi(x) {
  return Math.round(x * 10) / 10;
}

/** Corrige l'écart d'arrondi sur le plus gros % pour tomber pile sur « cible ». */
function corrigerTotal(pourcentages, cible) {
  const ids = Object.keys(pourcentages).filter(id => pourcentages[id] > 0);
  if (!ids.length) return pourcentages;
  const ecart = arrondi(cible - Object.values(pourcentages).reduce((t, p) => t + p, 0));
  const plusGros = ids.reduce((a, b) => (pourcentages[a] >= pourcentages[b] ? a : b));
  pourcentages[plusGros] = arrondi(pourcentages[plusGros] + ecart);
  return pourcentages;
}
