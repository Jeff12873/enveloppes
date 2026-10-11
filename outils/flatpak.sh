#!/bin/sh
# Fabrique le Flatpak d'Enveloppes et l'installe pour l'utilisateur courant.
#
# Usage, depuis le dossier du projet :
#     sh outils/flatpak.sh
#
# Publication (utilisé par GitHub Actions, voir .github/workflows/flatpak.yml) :
#     PUBLIER=1 sh outils/flatpak.sh
#   → fabrique Enveloppes.flatpak sans l'installer. Le dépôt FlatKein le signe et le distribue.
#
# Prérequis (une seule fois) :
#     flatpak install --user flathub org.electronjs.Electron2.BaseApp//25.08
#     npm install
#
# Étapes : application de bureau (electron-builder) → dossier Flatpak → dépôt local → Enveloppes.flatpak → installation.

set -e

ID=fr.enveloppes.Enveloppes
VERSION_BASE=25.08
CONSTRUCTION=dist/flatpak/construction
DEPOT=dist/flatpak/depot

echo "1/5  Application de bureau"
npx electron-builder --linux dir > /dev/null

echo "2/5  Dossier Flatpak"
rm -rf "$CONSTRUCTION"
flatpak build-init --base=org.electronjs.Electron2.BaseApp --base-version=$VERSION_BASE \
  "$CONSTRUCTION" $ID org.freedesktop.Platform org.freedesktop.Platform $VERSION_BASE

FICHIERS="$CONSTRUCTION/files"
mkdir -p "$FICHIERS/bin" "$FICHIERS/share/applications" "$FICHIERS/share/metainfo" \
  "$FICHIERS/share/icons/hicolor/512x512/apps"
cp -r dist/linux-unpacked "$FICHIERS/enveloppes"
rm -f "$FICHIERS/enveloppes/chrome-sandbox"          # inutile : zypak s'en charge
install -m 755 bureau/flatpak/lanceur.sh "$FICHIERS/bin/enveloppes"
install -m 644 bureau/flatpak/$ID.desktop "$FICHIERS/share/applications/"
install -m 644 bureau/flatpak/$ID.metainfo.xml "$FICHIERS/share/metainfo/"
install -m 644 bureau/icone.png "$FICHIERS/share/icons/hicolor/512x512/apps/$ID.png"

echo "3/5  Permissions"
# Pour « Commencer avec mes données » : le Flatpak local saura où trouver le fichier importé
DONNEES=""
if [ -f prive/donnees-initiales.json ] && [ -z "$PUBLIER" ]; then
  DONNEES="--env=ENVELOPPES_DONNEES=$(pwd)/prive/donnees-initiales.json"
fi

# Pas de réseau : l'application n'en a pas besoin.
# Dossier personnel : pour lire et écrire le fichier .enveloppes où qu'il soit (Nextcloud, Syncthing…).
flatpak build-finish "$CONSTRUCTION" \
  --command=enveloppes \
  --socket=wayland --socket=fallback-x11 --share=ipc --device=dri \
  --filesystem=home \
  --talk-name=org.freedesktop.Notifications \
  --env=ELECTRON_OZONE_PLATFORM_HINT=auto $DONNEES > /dev/null


echo "4/5  Dépôt local et fichier Enveloppes.flatpak"
rm -rf "$DEPOT"
flatpak build-export "$DEPOT" "$CONSTRUCTION" > /dev/null
flatpak build-bundle "$DEPOT" Enveloppes.flatpak $ID

if [ -n "$PUBLIER" ]; then
  echo "Prêt à publier : Enveloppes.flatpak"
  exit 0
fi

echo "5/5  Installation"
flatpak install --user -y --noninteractive --reinstall Enveloppes.flatpak

echo "Terminé : Enveloppes est dans le menu des applications et dans Warehouse."
