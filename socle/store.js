// Données de l'application : chargement, enregistrement chiffré, modifications.
//
// Toutes les données vivent dans un seul objet (voir docs/DONNEES.md).
// Les blocs le lisent avec lire() et le modifient avec les fonctions ci-dessous,
// qui posent la date « modifieLe » utile à la synchronisation puis enregistrent.

import { chiffrer, dechiffrer, deriverCle, nouveauSel, lireSel } from './crypto.js';

let donnees = null;   // données en clair, en mémoire uniquement
let cle = null;       // clé AES dérivée du mot de passe
let sel = null;       // sel de dérivation, partagé par tous les appareils
let appareil = {};    // réglages propres à cet appareil (non synchronisés)
const auditeurs = new Set();

// --- Base locale IndexedDB : une simple table clé → valeur --------------------

const base = new Promise((ok, ko) => {
  const demande = indexedDB.open('enveloppes', 1);
  demande.onupgradeneeded = () => demande.result.createObjectStore('kv');
  demande.onsuccess = () => ok(demande.result);
  demande.onerror = () => ko(demande.error);
});

async function lireLocal(nom) {
  const db = await base;
  return new Promise((ok, ko) => {
    const demande = db.transaction('kv').objectStore('kv').get(nom);
    demande.onsuccess = () => ok(demande.result);
    demande.onerror = () => ko(demande.error);
  });
}

async function ecrireLocal(nom, valeur) {
  const db = await base;
  return new Promise((ok, ko) => {
    const transaction = db.transaction('kv', 'readwrite');
    transaction.objectStore('kv').put(valeur, nom);
    transaction.oncomplete = () => ok();
    transaction.onerror = () => ko(transaction.error);
  });
}

async function effacerLocal(nom) {
  const db = await base;
  return new Promise(ok => {
    const transaction = db.transaction('kv', 'readwrite');
    transaction.objectStore('kv').delete(nom);
    transaction.oncomplete = () => ok();
  });
}

// --- Démarrage, verrouillage ---------------------------------------------------

/** À appeler au lancement. Renvoie « vide », « verrouille » ou « ouvert ». */
export async function demarrer() {
  appareil = (await lireLocal('appareil')) || {};
  const coffre = await lireLocal('coffre');
  if (!coffre) return 'vide';
  sel = lireSel(coffre);
  if (appareil.cle && !appareil.pin) {
    try {
      await ouvrirAvecCle(appareil.cle);
      return 'ouvert';
    } catch { /* clé mémorisée invalide : on redemande le mot de passe */ }
  }
  return 'verrouille';
}

/** Ouvre les données locales avec le mot de passe. Lève une erreur s'il est faux. */
export async function ouvrir(motDePasse, memoriser) {
  const candidate = await deriverCle(motDePasse, sel);
  await ouvrirAvecCle(candidate);
  await changerAppareil({ cle: memoriser ? candidate : null });
}

/** Ouvre avec la clé mémorisée (après saisie du code PIN). */
export async function ouvrirAvecCleMemorisee() {
  await ouvrirAvecCle(appareil.cle);
}

async function ouvrirAvecCle(candidate) {
  donnees = completer(await dechiffrer(await lireLocal('coffre'), candidate));
  cle = candidate;
}

/** Premier lancement : installe des données et le mot de passe qui les protège. */
export async function creer(nouvellesDonnees, motDePasse, memoriser, selImpose) {
  sel = selImpose || nouveauSel();
  cle = await deriverCle(motDePasse, sel);
  donnees = completer(nouvellesDonnees);
  await changerAppareil({ cle: memoriser ? cle : null });
  await sauver();
}

export async function changerMotDePasse(motDePasse) {
  sel = nouveauSel();
  cle = await deriverCle(motDePasse, sel);
  if (appareil.cle) await changerAppareil({ cle });
  await sauver();
}

/** Referme les données (elles restent chiffrées sur l'appareil). */
export async function verrouiller() {
  await sauver();
  donnees = null;
  cle = null;
}

export async function toutEffacer() {
  await effacerLocal('coffre');
  await effacerLocal('appareil');
  donnees = null; cle = null; sel = null; appareil = {};
}

export const estOuvert = () => donnees !== null;
export const lireCle = () => cle;
export const lireSelActuel = () => sel;

// --- Lecture ------------------------------------------------------------------

/** Les données complètes. À ne modifier qu'avec les fonctions de ce fichier. */
export const lire = () => donnees;

/** Les éléments d'une collection, sans ceux qui ont été supprimés. */
export function liste(collection) {
  return donnees[collection].filter(e => !e.supprime);
}

export function trouver(collection, id) {
  return donnees[collection].find(e => e.id === id);
}

export const lireAppareil = () => appareil;

// --- Modification -------------------------------------------------------------

export function nouvelId(prefixe) {
  return prefixe + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const horodatage = () => new Date().toISOString();

export function ajouter(collection, element) {
  const nouveau = { id: nouvelId(collection[0]), ...element, modifieLe: horodatage() };
  donnees[collection].push(nouveau);
  planifier();
  return nouveau;
}

export function mettreAJour(collection, id, champs) {
  const element = trouver(collection, id);
  Object.assign(element, champs, { modifieLe: horodatage() });
  planifier();
  return element;
}

/** Suppression « douce » : l'élément reste marqué pour que la synchro ne le ressuscite pas. */
export function supprimer(collection, id) {
  mettreAJour(collection, id, { supprime: true });
}

export function changerReglages(champs) {
  Object.assign(donnees.reglages, champs, { modifieLe: horodatage() });
  planifier();
}

export function changerRevenus(annee, revenus) {
  donnees.revenus[annee] = { ...revenus, modifieLe: horodatage() };
  planifier();
}

/** Remplace toutes les données (après une synchronisation). */
export function remplacer(nouvellesDonnees) {
  donnees = completer(nouvellesDonnees);
  planifier();
}

export async function changerAppareil(champs) {
  Object.assign(appareil, champs);
  await ecrireLocal('appareil', appareil);
}

/** Être prévenu après chaque enregistrement (synchro, en-tête…). */
export function ecouter(fonction) {
  auditeurs.add(fonction);
  return () => auditeurs.delete(fonction);
}

// --- Enregistrement -------------------------------------------------------------

let enAttente = null;

/** Regroupe les modifications rapprochées en un seul enregistrement. */
function planifier() {
  clearTimeout(enAttente);
  enAttente = setTimeout(sauver, 150);
}

export async function sauver() {
  clearTimeout(enAttente);
  if (!donnees || !cle) return;
  await ecrireLocal('coffre', await chiffrer(donnees, cle, sel));
  auditeurs.forEach(f => f(donnees));
}

// --- Données par défaut ---------------------------------------------------------

export function donneesVides() {
  const maintenant = horodatage();
  return {
    version: 1,
    personnes: [
      { id: 'p1', pseudo: 'Personne 1', couleur: '#c084fc', modifieLe: maintenant },
      { id: 'p2', pseudo: 'Personne 2', couleur: '#6d4aff', modifieLe: maintenant },
    ],
    revenus: {},
    reglages: {},
    categories: [
      { id: 'c1', nom: 'Vacances', couleur: '#a78bfa', modifieLe: maintenant },
      { id: 'c2', nom: 'Travaux', couleur: '#60a5fa', modifieLe: maintenant },
      { id: 'c3', nom: 'Charges', couleur: '#fbbf24', modifieLe: maintenant },
      { id: 'c4', nom: 'Assurance', couleur: '#f472b6', modifieLe: maintenant },
    ],
    exceptionnelles: [],
    enveloppes: [],
    mouvements: [],
    clotures: [],
    controles: [],
  };
}

const REGLAGES_PAR_DEFAUT = {
  methodeProrata: 'net-mensuel',
  derniersSalaires: null,
  prorataManuel: { p1: 50, p2: 50 },
  partPerso: { p1: 20, p2: 20 },
  reevaluation: { mode: 'suggestion', frequence: 'mensuelle', variationMax: 10 },
  surplus: 'redistribuer',
  seuilAlerte: 100,
};

/** Ajoute ce qui manque (données anciennes ou incomplètes). */
function completer(d) {
  const vide = donneesVides();
  for (const cle of Object.keys(vide)) if (d[cle] === undefined) d[cle] = vide[cle];
  d.reglages = { ...REGLAGES_PAR_DEFAUT, ...d.reglages };
  if (!d.enveloppes.some(e => e.special === 'tampon')) {
    d.enveloppes.push({
      id: 'tampon', nom: 'Tampon', special: 'tampon', categorie: null, objectifInitial: 0,
      echeance: null, pourcentage: 0, statut: 'ouvert', plancher: 0, verrouille: true,
      recurrente: false, modifieLe: '2000-01-01T00:00:00.000Z',
    });
  }
  return d;
}
