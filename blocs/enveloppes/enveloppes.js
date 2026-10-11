// Enveloppes projets et leurs mouvements. Règles : docs/CALCULS.md § 3 et 4.

import * as store from '../../socle/store.js';
import { aujourdhui } from '../../socle/dates.js';

export const STATUTS = {
  ouvert: 'Ouvert',
  pause: 'En pause',
  ferme: 'Fermé',
  archive: 'Archivé',
};

export const TYPES = {
  versement: 'Versement',
  depense: 'Dépense projet',
  emprunt: 'Emprunt',
  transfert: 'Transfert',
};

/** Enveloppes non supprimées, Tampon compris. */
export function toutes() {
  return store.liste('enveloppes');
}

/** Enveloppes projets (sans le Tampon) ayant un des statuts demandés. */
export function parStatut(...statuts) {
  return toutes().filter(e => !e.special && statuts.includes(e.statut));
}

export function tampon() {
  return toutes().find(e => e.special === 'tampon');
}

export function mouvementsDe(id) {
  return store.liste('mouvements')
    .filter(m => !m.annule && (m.enveloppe === id || m.vers === id))
    .sort((a, b) => b.date.localeCompare(a.date) || b.modifieLe.localeCompare(a.modifieLe));
}

/** Effet d'un mouvement sur le solde d'une enveloppe (centimes, signé). */
export function effet(m, id) {
  if (m.type === 'transfert') return m.vers === id ? m.montant : -m.montant;
  return m.type === 'versement' ? m.montant : -m.montant;
}

/** Solde, objectif courant, reste à épargner et progression d'une enveloppe. */
export function etat(enveloppe) {
  const mouvements = mouvementsDe(enveloppe.id);
  const solde = mouvements.reduce((total, m) => total + effet(m, enveloppe.id), 0);
  const depenses = mouvements
    .filter(m => m.type === 'depense' && m.enveloppe === enveloppe.id)
    .reduce((total, m) => total + m.montant, 0);
  const objectif = enveloppe.objectifInitial - depenses;
  const reste = Math.max(0, objectif - solde);
  const progression = objectif > 0 ? solde * 100 / objectif : (solde > 0 ? 100 : 0);
  return { solde, objectif, reste, progression, atteint: objectif > 0 && solde >= objectif };
}

export function totalEpargne() {
  return toutes().filter(e => e.statut !== 'archive').reduce((t, e) => t + etat(e).solde, 0);
}

export function creer(champs) {
  return store.ajouter('enveloppes', {
    categorie: null, nom: '', objectifInitial: 0, echeance: null, pourcentage: 0,
    statut: 'ouvert', plancher: 0, verrouille: false, recurrente: false, ...champs,
  });
}

/**
 * Modifier l'objectif affiché : on ajuste l'objectif initial pour que
 * l'objectif courant (initial − dépenses) vaille la nouvelle valeur.
 */
export function changerObjectif(enveloppe, nouvelObjectif) {
  const ecart = nouvelObjectif - etat(enveloppe).objectif;
  store.mettreAJour('enveloppes', enveloppe.id, { objectifInitial: enveloppe.objectifInitial + ecart });
}

export function mouvement({ enveloppe, type, montant, vers = null, note = '', date = aujourdhui(), cloture = null }) {
  if (!(montant > 0)) throw new Error('Le montant doit être positif.');
  if (type === 'transfert' && (!vers || vers === enveloppe)) throw new Error('Choisissez une autre enveloppe de destination.');
  return store.ajouter('mouvements', { date, enveloppe, type, montant, vers, note, cloture, annule: false });
}

export function annulerMouvement(id) {
  store.mettreAJour('mouvements', id, { annule: true });
}

/**
 * Enveloppe récurrente vidée après son objectif : elle repart pour un an
 * avec le même objectif initial.
 */
export function relancerRecurrente(enveloppe, objectif) {
  const prochaine = enveloppe.echeance
    ? `${Number(enveloppe.echeance.slice(0, 4)) + 1}${enveloppe.echeance.slice(4)}` : null;
  changerObjectif(enveloppe, objectif);
  store.mettreAJour('enveloppes', enveloppe.id, { echeance: prochaine, statut: 'ouvert' });
}

export function categorie(id) {
  return store.liste('categories').find(c => c.id === id);
}
