// Application de bureau (Electron) : une fenêtre qui affiche l'application web,
// plus quatre accès au disque pour la synchronisation (voir preload.js).
//
// Les fichiers de l'application sont servis par le protocole app://enveloppes/,
// ce qui donne une origine stable : les données locales (IndexedDB) y sont rattachées.

const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const RACINE = path.join(__dirname, '..');
const EXTENSION = '.enveloppes';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 360,
    minHeight: 500,
    title: 'Enveloppes',
    icon: path.join(__dirname, 'icone.png'),
    backgroundColor: '#f6f3ff',
    autoHideMenuBar: true,
    show: !process.env.ENVELOPPES_CAPTURE,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'application
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetre.webContents.on('will-navigate', (evenement, url) => {
    if (!url.startsWith('app://enveloppes/')) evenement.preventDefault();
  });

  fenetre.loadURL('app://enveloppes/index.html');
  if (process.env.ENVELOPPES_CAPTURE) capturer(fenetre, process.env.ENVELOPPES_CAPTURE);
}

// --- Fichiers de l'application ------------------------------------------------

function servirFichiers() {
  protocol.handle('app', requete => {
    const chemin = decodeURIComponent(new URL(requete.url).pathname);
    const fichier = path.normalize(path.join(RACINE, chemin));
    if (!fichier.startsWith(RACINE + path.sep)) return new Response('Interdit', { status: 403 });
    return net.fetch(pathToFileURL(fichier).toString());
  });
}

// --- Accès au disque, limité aux fichiers .enveloppes ----------------------------

function verifier(chemin) {
  if (typeof chemin !== 'string' || path.extname(chemin) !== EXTENSION) {
    throw new Error(`Seuls les fichiers ${EXTENSION} sont autorisés.`);
  }
  return chemin;
}

ipcMain.handle('choisir-fichier', async (evenement, mode) => {
  const fenetre = BrowserWindow.fromWebContents(evenement.sender);
  const filtres = [{ name: 'Données Enveloppes', extensions: ['enveloppes'] }];
  if (mode === 'ouvrir') {
    const { canceled, filePaths } = await dialog.showOpenDialog(fenetre, { filters: filtres, properties: ['openFile'] });
    return canceled ? null : filePaths[0];
  }
  const { canceled, filePath } = await dialog.showSaveDialog(fenetre, {
    filters: filtres, defaultPath: path.join(app.getPath('home'), 'budget.enveloppes'),
  });
  if (canceled || !filePath) return null;
  return filePath.endsWith(EXTENSION) ? filePath : filePath + EXTENSION;
});

ipcMain.handle('lire', async (evenement, chemin) => {
  try {
    return new Uint8Array(await fs.readFile(verifier(chemin)));
  } catch (erreur) {
    if (erreur.code === 'ENOENT') return null;
    throw erreur;
  }
});

// Écriture « atomique » : fichier temporaire puis renommage, pour ne jamais laisser
// un fichier à moitié écrit dans le dossier synchronisé.
ipcMain.handle('ecrire', async (evenement, chemin, octets) => {
  verifier(chemin);
  const temporaire = `${chemin}.tmp`;
  await fs.writeFile(temporaire, octets);
  await fs.rename(temporaire, chemin);
});

// Données importées du tableur : chemin donné par le Flatpak, sinon à côté de l'AppImage, puis dans le projet
ipcMain.handle('donnees-initiales', async () => {
  if (process.env.ENVELOPPES_DONNEES) {
    try {
      return await fs.readFile(process.env.ENVELOPPES_DONNEES, 'utf8');
    } catch { /* fichier supprimé depuis : on cherche ailleurs */ }
  }
  const dossiers = [
    process.env.APPIMAGE && path.dirname(process.env.APPIMAGE),
    path.dirname(process.execPath),
    RACINE,
    path.join(RACINE, '..'),
  ].filter(Boolean);
  for (const dossier of dossiers) {
    try {
      return await fs.readFile(path.join(dossier, 'prive', 'donnees-initiales.json'), 'utf8');
    } catch { /* fichier absent ici : on essaie le dossier suivant */ }
  }
  return null;
});

// --- Capture pour les tests : ENVELOPPES_CAPTURE=/tmp/ecran.png ---------------------

function capturer(fenetre, sortie) {
  fenetre.webContents.on('console-message', ({ level, message }) => console.log(`[console:${level}] ${message}`));
  fenetre.webContents.on('did-finish-load', () => setTimeout(async () => {
    const image = await fenetre.webContents.capturePage();
    await fs.writeFile(sortie, image.toPNG());
    console.log(`Capture : ${sortie}`);
    app.quit();
  }, 2500));
}

// --- Démarrage ----------------------------------------------------------------

app.setName('Enveloppes');
app.whenReady().then(() => {
  servirFichiers();
  creerFenetre();
});
app.on('window-all-closed', () => app.quit());
