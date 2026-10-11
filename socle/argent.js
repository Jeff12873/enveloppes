// Montants : toujours des entiers en centimes. 12345 = 123,45 €.

const format = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** 12345 → « 123,45 € » */
export function euros(centimes) {
  return format.format((centimes || 0) / 100);
}

/** « 123,45 », « 123.45 » ou « 1 234 » → 12345. Renvoie null si illisible. */
export function versCentimes(texte) {
  if (typeof texte === 'number') return Math.round(texte * 100);
  const propre = String(texte ?? '').replace(/\s|€/g, '').replace(',', '.');
  if (propre === '' || isNaN(propre)) return null;
  return Math.round(parseFloat(propre) * 100);
}

/** 12345 → « 123,45 » (pour pré-remplir un champ) */
export function versTexte(centimes) {
  return ((centimes || 0) / 100).toFixed(2).replace('.', ',');
}

/** Pourcentage lisible : 56.234 → « 56,2 % » */
export function pourcent(valeur, decimales = 1) {
  return `${(valeur || 0).toLocaleString('fr-FR', { maximumFractionDigits: decimales })} %`;
}

/**
 * Répartit un total (centimes) selon des poids, sans perdre de centime.
 * L'écart d'arrondi va au poids le plus élevé.
 * repartir(1000, [1, 1, 1]) → [334, 333, 333]
 */
export function repartir(total, poids) {
  const somme = poids.reduce((a, b) => a + b, 0);
  if (!somme) return poids.map(() => 0);
  const parts = poids.map(p => Math.round(total * p / somme));
  const ecart = total - parts.reduce((a, b) => a + b, 0);
  parts[poids.indexOf(Math.max(...poids))] += ecart;
  return parts;
}
