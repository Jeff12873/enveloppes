// Pont entre l'application web et le disque. Seules ces quatre fonctions sont exposées,
// sous window.bureau (utilisées par socle/sync.js et le guide).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bureau', {
  choisirFichier: mode => ipcRenderer.invoke('choisir-fichier', mode),
  lire: chemin => ipcRenderer.invoke('lire', chemin),
  ecrire: (chemin, octets) => ipcRenderer.invoke('ecrire', chemin, octets),
  donneesInitiales: () => ipcRenderer.invoke('donnees-initiales'),
});
