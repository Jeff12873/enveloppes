# Enveloppes

Application d'épargne en enveloppes pour un couple.
Elle remplace le tableur `Gestion épargne mensuelle.ods`.

- Le **prorata** suit les salaires nets saisis à chaque clôture du mois (ou, au choix, une base annuelle avec ou sans fiscalité, ou des % fixes).
- Chaque mois, le reste du plus petit salaire détermine ce que verse le plus gros.
- L'épargne commune est répartie dans des **enveloppes projets** (objectif, échéance, %).
- Les dépenses partagées ponctuelles (ex. vétérinaire) passent par des **enveloppes exceptionnelles**.

## Lancer

**Sur Linux, depuis le dépôt Flatpak FlatKein** (mises à jour automatiques, visible dans Warehouse) :

    flatpak install --user https://jeff12873.github.io/FlatKein/fr.enveloppes.Enveloppes.flatpakref

Chaque envoi sur la branche `main` fabrique `Enveloppes.flatpak` et le publie dans les Releases
(`.github/workflows/flatpak.yml`). Le dépôt [FlatKein](https://github.com/Jeff12873/FlatKein) le signe
et le distribue ; Warehouse le propose ensuite comme mise à jour.

**Sur Linux, en Flatpak fabriqué localement** : `sh outils/flatpak.sh` fabrique `Enveloppes.flatpak`
et l'installe. Ensuite, l'application est dans le menu. Relancer la même commande après une modification
du code met à jour l'application installée. Le Flatpak n'a pas accès à Internet.

**Sur Linux, en AppImage** : double-cliquer sur `Enveloppes.AppImage`.

- Au premier lancement, AppImageLauncher (installé sur ce PC) propose d'intégrer l'application au menu : accepter.
- Le guide propose « Commencer avec mes données » : il lit `prive/donnees-initiales.json`, **placé à côté de l'AppImage**.

**Dans un navigateur** (ou sur téléphone, via un hébergement) : servir le dossier, par exemple

    python3 -m http.server 8000

puis ouvrir http://localhost:8000.

## Principes

- **Privé** : données chiffrées sur l'appareil (AES-GCM). Pas de serveur, pas de compte, pas de pistage.
- **Synchronisé** par un seul fichier chiffré (`.enveloppes`) posé dans un dossier partagé.
- **Léger** : HTML, CSS et JavaScript sans framework ni compilation, environ 150 Ko (48 Ko compressés).
- **En blocs** : chaque fonction vit dans son dossier `blocs/…`, avec son `README.md`.

## Commandes utiles

| Commande | Effet |
|---|---|
| `python3 outils/import-ods.py "Gestion épargne mensuelle.ods" prive/donnees-initiales.json Pseudo1 Pseudo2` | Refait l'import du tableur |
| `npm install` | Installe Electron et l'outil d'emballage (une seule fois) |
| `npm run demarrer` | Lance l'application de bureau sans l'emballer |
| `npm run appimage` | Fabrique `dist/Enveloppes-<version>.AppImage` |
| `sh outils/flatpak.sh` | Fabrique `Enveloppes.flatpak` et l'installe (prérequis en tête du script) |

## Documentation

| Fichier | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Organisation du code, blocs, stockage, synchronisation |
| [docs/DONNEES.md](docs/DONNEES.md) | Schéma des données et import du tableur |
| [docs/CALCULS.md](docs/CALCULS.md) | Toutes les règles de calcul, avec exemples chiffrés |
| [docs/ECRANS.md](docs/ECRANS.md) | Déroulé de chaque écran, dont le guide du premier lancement |
| [docs/AJOUTER-UN-BLOC.md](docs/AJOUTER-UN-BLOC.md) | Comment ajouter ou retirer une fonction |

## Ce qui n'est jamais publié

`prive/` (données importées, clé de signature du dépôt FlatKein), le tableur, les fichiers `.enveloppes`, les AppImage et
`.flatpak` sont exclus par `.gitignore`. Le dépôt ne contient que le code et la documentation.
