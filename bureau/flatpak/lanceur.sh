#!/bin/sh
# Lance l'application dans le Flatpak. zypak remplace le bac à sable de Chromium,
# qui ne peut pas fonctionner tel quel à l'intérieur d'un Flatpak.
exec zypak-wrapper /app/enveloppes/enveloppes "$@"
