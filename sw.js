// Service worker : garde les fichiers de l'application en cache pour le hors-ligne.
// Changer VERSION après une mise à jour force le rechargement des fichiers.

const VERSION = 'enveloppes-1';

self.addEventListener('install', evenement => {
  self.skipWaiting();
  evenement.waitUntil(caches.open(VERSION));
});

self.addEventListener('activate', evenement => {
  evenement.waitUntil(caches.keys().then(noms =>
    Promise.all(noms.filter(n => n !== VERSION).map(n => caches.delete(n)))));
});

// Réseau d'abord (pour avoir la dernière version), cache si hors ligne
self.addEventListener('fetch', evenement => {
  if (evenement.request.method !== 'GET' || !evenement.request.url.startsWith(self.location.origin)) return;
  evenement.respondWith(
    fetch(evenement.request)
      .then(reponse => {
        const copie = reponse.clone();
        caches.open(VERSION).then(cache => cache.put(evenement.request, copie));
        return reponse;
      })
      .catch(() => caches.match(evenement.request)));
});
