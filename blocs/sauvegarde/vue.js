// Synchronisation (fichier partagé), sauvegardes et exports.

import * as store from '../../socle/store.js';
import { aller, rafraichir } from '../../socle/router.js';
import { h, bouton, champ, saisie, fenetre, notifier, confirmer } from '../../socle/ui.js';
import { icone } from '../../socle/icones.js';
import { chiffrer } from '../../socle/crypto.js';
import { telecharger, choisirFichierLocal, lireOctets } from '../../socle/fichiers.js';
import { aujourdhui } from '../../socle/dates.js';
import { ACCES_DIRECT, lireEtat, ecouterSync, synchroniser, choisirFichier, oublierFichier,
  lireFichierExterne, fusionner } from '../../socle/sync.js';
import { ajouterSection } from '../parametres/vue.js';
import { TYPES } from '../enveloppes/enveloppes.js';

// --- Bouton de l'en-tête ----------------------------------------------------------

const libelle = h('span', { class: 'texte-sync' });
const boutonSync = h('button', { type: 'button', onclick: () => {
  if (store.lireAppareil().fichier) synchroniser(true);
  else aller('#/reglages/synchro');
} }, icone('sync', 18), libelle);
document.getElementById('actions-entete').prepend(boutonSync);

function majBouton({ etat, message, fichier }) {
  boutonSync.className = etat;
  boutonSync.title = message || (fichier ? `Synchroniser avec ${fichier}` : 'Configurer la synchronisation');
  libelle.textContent = !fichier ? 'Synchro' : etat === 'erreur' ? 'Erreur' : etat === 'en-cours' ? '…' : 'Synchro';
}
let sectionAffichee = null;   // { zone, redessiner } de la section Réglages, si elle est à l'écran
ecouterSync(etat => {
  majBouton(etat);
  if (etat.etat === 'erreur') notifier(etat.message, 'danger');
  if (sectionAffichee?.zone.isConnected) sectionAffichee.redessiner();
});
majBouton(lireEtat());

// Synchronisation à l'ouverture
window.addEventListener('deverrouille', () => synchroniser(false));
window.addEventListener('application-prete', () => { if (store.estOuvert()) synchroniser(false); });

// --- Réglages -------------------------------------------------------------------

ajouterSection('synchro', 'Synchronisation et sauvegardes', (zone, redessiner) => {
  const { etat, message, fichier } = lireEtat();
  sectionAffichee = { zone, redessiner };

  if (ACCES_DIRECT) {
    zone.append(
      h('p', {}, fichier
        ? h('span', {}, 'Fichier : ', h('strong', {}, fichier), message ? h('span', { class: 'doux' }, ` · ${message}`) : null)
        : 'Aucun fichier de synchronisation. Placez-le dans un dossier partagé (Nextcloud, Syncthing, Drive…).'),
      etat === 'erreur' ? h('p', { style: { color: 'var(--danger)' } }, message) : null,
      h('div', { class: 'ligne' },
        bouton(fichier ? 'Changer de fichier' : 'Créer le fichier…', () => choisirFichier('enregistrer').catch(ignorerAnnulation), fichier ? 'secondaire' : 'principal'),
        bouton('Utiliser un fichier existant…', () => choisirFichier('ouvrir').catch(ignorerAnnulation), 'secondaire'),
        fichier ? bouton('Synchroniser maintenant', () => synchroniser(true)) : null,
        fichier ? bouton('Ne plus synchroniser', async () => { await oublierFichier(); redessiner(); }, 'lien') : null));
  } else {
    zone.append(h('p', { class: 'doux' }, 'Ce navigateur ne peut pas écrire directement dans un fichier. '
      + 'Exportez le fichier chiffré dans votre dossier partagé, et fusionnez celui reçu de l\'autre appareil.'));
  }

  zone.append(
    h('h3', { style: { marginTop: '10px' } }, 'Sauvegardes'),
    h('div', { class: 'ligne' },
      bouton('Exporter (fichier chiffré)', exporterChiffre, 'secondaire'),
      bouton('Fusionner un fichier .enveloppes', fusionnerFichier, 'secondaire'),
      bouton('Exporter les mouvements (CSV)', exporterCsv, 'secondaire'),
      bouton('Exporter en clair (JSON)', exporterJson, 'lien')),
    h('p', { class: 'doux petit' }, 'Le fichier chiffré se rouvre avec le mot de passe. Les exports CSV et JSON sont lisibles par tous : à garder en lieu sûr.'));
}, 75);

function ignorerAnnulation(erreur) {
  if (erreur.name !== 'AbortError') notifier(erreur.message, 'danger');
}

async function exporterChiffre() {
  telecharger(`enveloppes-${aujourdhui()}.enveloppes`, await chiffrer(store.lire(), store.lireCle(), store.lireSelActuel()));
}

async function exporterJson() {
  if (!(await confirmer('Ce fichier contiendra toutes vos données EN CLAIR. Continuer ?', 'Exporter'))) return;
  telecharger(`enveloppes-${aujourdhui()}.json`, JSON.stringify(store.lire(), null, 1), 'application/json');
}

function exporterCsv() {
  const nom = id => store.trouver('enveloppes', id)?.nom || '';
  const cellule = texte => `"${String(texte ?? '').replace(/"/g, '""')}"`;
  const lignes = [['Date', 'Enveloppe', 'Type', 'Vers', 'Montant', 'Note', 'Annulé']];
  for (const m of store.liste('mouvements').sort((a, b) => a.date.localeCompare(b.date))) {
    const montant = (m.type === 'versement' ? m.montant : -m.montant) / 100;
    lignes.push([m.date, nom(m.enveloppe), TYPES[m.type], nom(m.vers), montant.toFixed(2).replace('.', ','), m.note, m.annule ? 'oui' : '']);
  }
  const csv = '﻿' + lignes.map(l => l.map(cellule).join(';')).join('\r\n');
  telecharger(`mouvements-${aujourdhui()}.csv`, csv, 'text/csv');
}

async function fusionnerFichier() {
  const fichier = await choisirFichierLocal('.enveloppes');
  if (!fichier) return;
  const octets = await lireOctets(fichier);
  const mdp = saisie({ type: 'password', autofocus: true });
  fenetre('Fusionner un fichier', h('div', { class: 'pile' },
    champ('Mot de passe de ce fichier', mdp),
    h('p', { class: 'doux petit' }, 'Les données du fichier sont ajoutées aux vôtres. Pour un même élément, la version la plus récente est gardée.')),
  [['Annuler'], ['Fusionner', async () => {
    try {
      const { donnees } = await lireFichierExterne(octets, mdp.value);
      store.remplacer(fusionner(store.lire(), donnees));
      await store.sauver();
      notifier('Fichier fusionné');
      rafraichir();
    } catch {
      notifier('Mot de passe incorrect ou fichier abîmé', 'danger');
      return false;
    }
  }]]);
}
