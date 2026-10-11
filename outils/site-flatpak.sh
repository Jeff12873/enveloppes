#!/bin/sh
# Prépare le site GitHub Pages qui sert de dépôt Flatpak : dist/site/
#   repo/                      le dépôt signé (fabriqué par outils/flatpak.sh en mode PUBLIER)
#   enveloppes.flatpakrepo     pour ajouter le dépôt (Warehouse › Remotes, ou flatpak remote-add)
#   enveloppes.flatpakref      pour installer l'application en une commande
#   index.html                 page d'explication
#
# Usage : CLE_GPG=<identifiant> ADRESSE=https://<compte>.github.io/<depot> sh outils/site-flatpak.sh

set -e

SITE=dist/site
CLE=$(gpg --export "$CLE_GPG" | base64 -w0)

rm -rf "$SITE"
mkdir -p "$SITE"
cp -r dist/flatpak/depot "$SITE/repo"

cat > "$SITE/enveloppes.flatpakrepo" <<FIN
[Flatpak Repo]
Title=Enveloppes
Url=$ADRESSE/repo/
Homepage=$ADRESSE/
Comment=Épargne de couple en enveloppes
GPGKey=$CLE
FIN

cat > "$SITE/enveloppes.flatpakref" <<FIN
[Flatpak Ref]
Name=fr.enveloppes.Enveloppes
Branch=master
Title=Enveloppes
Url=$ADRESSE/repo/
SuggestRemoteName=enveloppes
RuntimeRepo=https://dl.flathub.org/repo/flathub.flatpakrepo
IsRuntime=false
GPGKey=$CLE
FIN

cat > "$SITE/index.html" <<FIN
<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Enveloppes</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.5}
code,pre{background:#f1edff;border-radius:8px;padding:2px 6px}pre{padding:12px;overflow-x:auto}</style>
<h1>Enveloppes</h1>
<p>Dépôt Flatpak de l'application Enveloppes : épargne de couple en enveloppes, au prorata des revenus.</p>
<h2>Installer</h2>
<pre>flatpak install --user $ADRESSE/enveloppes.flatpakref</pre>
<h2>Ou ajouter le dépôt (Warehouse › Remotes)</h2>
<pre>$ADRESSE/enveloppes.flatpakrepo</pre>
<p>Les mises à jour arrivent ensuite comme pour les autres applications Flatpak.</p>
</html>
FIN

echo "Site prêt : $SITE"
