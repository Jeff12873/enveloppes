// Revenus annuels et prorata. Règles détaillées : docs/CALCULS.md § 1.

import * as store from '../../socle/store.js';

export const METHODES = {
  'net-mensuel': 'Salaire net du mois (recalculé à chaque clôture)',
  'brut': 'Salaire brut annuel',
  'net-imposable': 'Net imposable (sans fiscalité)',
  'net-impot-juste': 'Net imposable − impôt juste (avec fiscalité)',
  'manuel': 'Pourcentages fixés à la main',
};

/** Revenus de l'année demandée, ou à défaut de la plus récente connue. */
export function revenusDe(annee) {
  const revenus = store.lire().revenus;
  if (revenus[annee]) return { annee, ...revenus[annee] };
  const connue = Object.keys(revenus).filter(a => a <= annee).sort().pop()
    || Object.keys(revenus).sort().pop();
  return connue ? { annee: connue, ...revenus[connue] } : null;
}

/**
 * Impôt « juste » : chacun paie ce qu'il paierait seul, moins sa part de
 * l'économie due à l'imposition commune (au prorata du net imposable).
 */
export function impotsJustes(r) {
  const seul = r.p1.impotSeul + r.p2.impotSeul;
  const gain = seul - r.impotCouple;
  const total = r.p1.netImposable + r.p2.netImposable;
  if (!total) return { p1: 0, p2: 0, gain: 0 };
  const p1 = Math.round(r.p1.impotSeul - gain * r.p1.netImposable / total);
  return { p1, p2: r.impotCouple - p1, gain };
}

/** Base de calcul de chaque personne, en centimes, selon la méthode. */
export function bases(r, methode) {
  if (!r) return null;
  if (methode === 'brut') return { p1: r.p1.brut || 0, p2: r.p2.brut || 0 };
  if (methode === 'net-imposable') return { p1: r.p1.netImposable, p2: r.p2.netImposable };
  const justes = impotsJustes(r);
  return { p1: r.p1.netImposable - justes.p1, p2: r.p2.netImposable - justes.p2 };
}

/**
 * Prorata de chacun, en % (somme = 100). Renvoie aussi d'où il vient,
 * et null s'il manque des données.
 * « salaires » : nets du mois { p1, p2 } en centimes, pour la méthode « net-mensuel ».
 * Sans eux, on prend les derniers salaires saisis.
 */
export function prorata(annee = String(new Date().getFullYear()), methode, salaires) {
  const reglages = store.lire().reglages;
  methode = methode || reglages.methodeProrata;
  if (methode === 'manuel') {
    const m = reglages.prorataManuel;
    return { p1: m.p1, p2: 100 - m.p1, methode, annee: null };
  }
  if (methode === 'net-mensuel') {
    const resultat = pourcentages(salaires || reglages.derniersSalaires);
    return resultat && { ...resultat, methode, annee: null };
  }
  const r = revenusDe(annee);
  const resultat = pourcentages(bases(r, methode));
  return resultat && { ...resultat, methode, annee: r.annee, estime: r.estime };
}

/** { p1: 1500, p2: 2500 } → { p1: 37.5, p2: 62.5 }. 4 décimales : pas d'écart d'arrondi visible. */
function pourcentages(b) {
  if (!b || !(b.p1 > 0) || !(b.p2 > 0)) return null;
  const p1 = Math.round(b.p1 * 1e6 / (b.p1 + b.p2)) / 1e4;
  return { p1, p2: Math.round((100 - p1) * 1e4) / 1e4 };
}

/** Estimation d'un net imposable annuel à partir du mensuel et des primes. */
export function estimerAnnuel(mensuel, primes) {
  return mensuel * 12 + (primes || 0);
}

export function revenusVides() {
  const personne = () => ({ brut: 0, netImposable: 0, impotSeul: 0 });
  return { p1: personne(), p2: personne(), impotCouple: 0, estime: true };
}
