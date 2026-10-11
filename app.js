// Démarrage de l'application. Les blocs se sont déjà déclarés (voir index.html).

import * as store from './socle/store.js';
import { definirGarde, afficherEcran, rafraichir } from './socle/router.js';
import { appliquerTheme } from './socle/apparence.js';

const etatInitial = await store.demarrer();
appliquerTheme();

// Avant chaque écran : verrou, puis guide du premier lancement
definirGarde(adresse => {
  if (!store.estOuvert()) {
    if (etatInitial === 'vide') return adresse.startsWith('#/guide') ? null : '#/guide';
    return '#/verrou';
  }
  if (!store.lireAppareil().guideFait) return adresse.startsWith('#/guide') ? null : '#/guide';
  if (adresse.startsWith('#/verrou')) return '#/accueil';
  return null;
});

// Après une synchronisation qui a apporté des changements, on redessine
window.addEventListener('donnees-synchronisees', rafraichir);

afficherEcran();
window.dispatchEvent(new Event('application-prete'));

if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

