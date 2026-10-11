// Dates au format ISO : « 2026-10-04 » pour un jour, « 2026-10 » pour un mois.

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

export function moisCourant() {
  return aujourdhui().slice(0, 7);
}

export function anneeCourante() {
  return aujourdhui().slice(0, 4);
}

/** « 2026-10 » + 3 → « 2027-01 » */
export function ajouterMois(mois, n) {
  const [a, m] = mois.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${deux(total % 12 + 1)}`;
}

/** Nombre de mois de « depuis » à « jusqua » (négatif si dépassé). */
export function moisEntre(depuis, jusqua) {
  const [a1, m1] = depuis.split('-').map(Number);
  const [a2, m2] = jusqua.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** « 2026-10-04 » → « 04/10/2026 » */
export function dateCourte(iso) {
  if (!iso) return '';
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

/** « 2026-10 » → « octobre 2026 » */
export function nomMois(mois) {
  if (!mois) return '—';
  const [a, m] = mois.split('-');
  return `${NOMS_MOIS[Number(m) - 1]} ${a}`;
}

/** « 2026-10 » → « d'octobre 2026 », « 2026-03 » → « de mars 2026 » */
export function deMois(mois) {
  const nom = nomMois(mois);
  return /^[aeiouyéè]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

/** « 2027-01 » → « 01/2027 » */
export function moisCourt(mois) {
  if (!mois) return '—';
  const [a, m] = mois.split('-');
  return `${m}/${a}`;
}

function deux(n) {
  return String(n).padStart(2, '0');
}
