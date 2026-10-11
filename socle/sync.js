// Synchronisation avec un fichier chiffré .enveloppes posé dans un dossier partagé
// (Nextcloud, Syncthing, Drive…).
//
// Trois façons d'accéder au fichier, selon l'environnement :
//   1. application de bureau (AppImage) : window.bureau, lecture / écriture directes ;
//   2. navigateur Chromium : File System Access (le navigateur demande l'autorisation) ;
//   3. autres (Firefox, mobile) : export / import manuels, voir le bloc Sauvegarde.

import { chiffrer, dechiffrer, lireSel } from './crypto.js';
import * as store from './store.js';

export const ACCES_DIRECT = Boolean(window.bureau || window.showSaveFilePicker);

let etat = 'aucun';   // aucun | ok | en-cours | erreur
let message = '';
const auditeurs = new Set();

export const lireEtat = () => ({ etat, message, fichier: nomFichier() });

export function ecouterSync(fonction) {
  auditeurs.add(fonction);
}

function annoncer(nouvelEtat, texte = '') {
  etat = nouvelEtat;
  message = texte;
  auditeurs.forEach(f => f(lireEtat()));
}

function nomFichier() {
  const f = store.lireAppareil().fichier;
  if (!f) return '';
  return typeof f === 'string' ? f.split(/[\\/]/).pop() : f.name;
}

// --- Choix du fichier -------------------------------------------------------

/** Choisit (ou crée) le fichier de synchronisation, puis synchronise. */
export async function choisirFichier(mode = 'enregistrer') {
  let fichier;
  if (window.bureau) {
    fichier = await window.bureau.choisirFichier(mode);
  } else if (mode === 'ouvrir') {
    [fichier] = await window.showOpenFilePicker({ types: [typeEnveloppes()] });
  } else {
    fichier = await window.showSaveFilePicker({ suggestedName: 'budget.enveloppes', types: [typeEnveloppes()] });
  }
  if (!fichier) return false;
  await store.changerAppareil({ fichier });
  await synchroniser(true);
  return true;
}

export async function oublierFichier() {
  await store.changerAppareil({ fichier: null });
  annoncer('aucun');
}

const typeEnveloppes = () => ({
  description: 'Données Enveloppes', accept: { 'application/octet-stream': ['.enveloppes'] },
});

// --- Lecture / écriture brute ----------------------------------------------

async function lireFichier(fichier, geste) {
  if (window.bureau) return window.bureau.lire(fichier);
  if (!(await autorise(fichier, geste))) throw new Error('Autorisation nécessaire : cliquez sur « Synchroniser ».');
  const contenu = await (await fichier.getFile()).arrayBuffer();
  return contenu.byteLength ? new Uint8Array(contenu) : null;
}

async function ecrireFichier(fichier, octets) {
  if (window.bureau) return window.bureau.ecrire(fichier, octets);
  const flux = await fichier.createWritable();
  await flux.write(octets);
  await flux.close();
}

async function autorise(fichier, geste) {
  const options = { mode: 'readwrite' };
  if ((await fichier.queryPermission(options)) === 'granted') return true;
  return geste && (await fichier.requestPermission(options)) === 'granted';
}

// --- Synchronisation ----------------------------------------------------------

/**
 * Lit le fichier partagé, fusionne avec les données locales, réécrit le résultat.
 * « geste » indique un clic de l'utilisateur (nécessaire pour demander une autorisation).
 */
export async function synchroniser(geste = false) {
  const fichier = store.lireAppareil().fichier;
  if (!fichier || !store.estOuvert() || etat === 'en-cours') return;
  annoncer('en-cours');
  try {
    const octets = await lireFichier(fichier, geste);
    let resultat = store.lire();
    if (octets) {
      if (!memeSel(lireSel(octets), store.lireSelActuel())) {
        throw new Error('Ce fichier a un autre mot de passe. Ouvrez-le depuis le guide ou les réglages.');
      }
      const distant = await dechiffrer(octets, store.lireCle());
      resultat = fusionner(store.lire(), distant);
      if (JSON.stringify(resultat) !== JSON.stringify(store.lire())) {
        store.remplacer(resultat);
        await store.sauver();
        window.dispatchEvent(new Event('donnees-synchronisees'));
      }
    }
    await ecrireFichier(fichier, await chiffrer(resultat, store.lireCle(), store.lireSelActuel()));
    annoncer('ok', `Synchronisé à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
  } catch (erreur) {
    annoncer('erreur', erreur.message);
  }
}

/** Réécrit le fichier sans fusion (après un changement de mot de passe). */
export async function ecraserFichier() {
  const fichier = store.lireAppareil().fichier;
  if (!fichier) return;
  try {
    if (!window.bureau && !(await autorise(fichier, true))) throw new Error('Autorisation refusée.');
    await ecrireFichier(fichier, await chiffrer(store.lire(), store.lireCle(), store.lireSelActuel()));
    annoncer('ok', 'Fichier réécrit avec le nouveau mot de passe');
  } catch (erreur) {
    annoncer('erreur', erreur.message);
  }
}

/** Lit un fichier .enveloppes avec un mot de passe (deuxième appareil). Renvoie { donnees, sel }. */
export async function lireFichierExterne(octets, motDePasse) {
  const { deriverCle } = await import('./crypto.js');
  const sel = lireSel(octets);
  const cle = await deriverCle(motDePasse, sel);
  return { donnees: await dechiffrer(octets, cle), sel };
}

function memeSel(a, b) {
  return a.length === b.length && a.every((octet, i) => octet === b[i]);
}

// --- Fusion -------------------------------------------------------------------

/**
 * Fusionne deux versions des données : pour chaque élément (même id),
 * on garde la version modifiée le plus récemment. Rien n'est jamais perdu.
 */
export function fusionner(a, b) {
  const plusRecent = (x, y) => (!y || (x && x.modifieLe >= y.modifieLe) ? x : y);
  const resultat = { ...a, version: Math.max(a.version || 1, b.version || 1) };

  for (const collection of ['personnes', 'categories', 'exceptionnelles', 'enveloppes',
    'mouvements', 'clotures', 'controles']) {
    const parId = new Map();
    for (const element of [...(a[collection] || []), ...(b[collection] || [])]) {
      parId.set(element.id, plusRecent(parId.get(element.id), element));
    }
    resultat[collection] = [...parId.values()];
  }

  resultat.reglages = plusRecent(a.reglages, b.reglages);
  resultat.revenus = { ...a.revenus };
  for (const [annee, revenus] of Object.entries(b.revenus || {})) {
    resultat.revenus[annee] = plusRecent(resultat.revenus[annee], revenus);
  }
  return resultat;
}

// Synchronisation automatique quelques secondes après chaque modification
let minuterie = null;
store.ecouter(() => {
  if (!ACCES_DIRECT || !store.lireAppareil().fichier) return;
  clearTimeout(minuterie);
  minuterie = setTimeout(() => synchroniser(false), 3000);
});
