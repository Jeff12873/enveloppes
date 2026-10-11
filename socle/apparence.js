// Thème clair / sombre choisi sur cet appareil (sinon : celui du système).

import { lireAppareil } from './store.js';

export function appliquerTheme() {
  const theme = lireAppareil().theme;
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
