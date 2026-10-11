// Navigation entre écrans, par l'adresse : #/accueil, #/enveloppe/e3…
//
// Un bloc déclare ses écrans avec route(). Ceux qui ont un « menu » apparaissent
// dans la barre de navigation, triés par « ordre ».

import { h, remplir, zoneSure } from './ui.js';
import { icone } from './icones.js';

const routes = [];
let garde = null;

/**
 * route('#/mois', afficher, { menu: 'Mois', icone: 'mois', ordre: 2 })
 * « afficher(zone, parametre) » remplit la zone. Le paramètre est la partie
 * après le chemin : pour « #/enveloppe/e3 », c'est « e3 ».
 */
export function route(chemin, afficher, options = {}) {
  routes.push({ chemin, afficher, ...options });
}

/** Fonction appelée avant chaque écran : peut rediriger (verrou, guide). */
export function definirGarde(fonction) {
  garde = fonction;
}

export function aller(chemin) {
  if (location.hash === chemin) afficherEcran();
  else location.hash = chemin;
}

export function rafraichir() {
  afficherEcran();
}

export function afficherEcran() {
  const adresse = location.hash || '#/accueil';
  const redirection = garde && garde(adresse);
  if (redirection && redirection !== adresse) return aller(redirection);

  const trouvee = routes
    .filter(r => adresse === r.chemin || adresse.startsWith(r.chemin + '/'))
    .sort((a, b) => b.chemin.length - a.chemin.length)[0] || routes.find(r => r.chemin === '#/accueil');
  const parametre = decodeURIComponent(adresse.slice(trouvee.chemin.length + 1));

  const zone = zoneSure(document.getElementById('vue'));
  remplir(zone);
  trouvee.afficher(zone, parametre);
  document.body.dataset.ecran = trouvee.chemin.slice(2);
  dessinerMenu(trouvee.chemin);
  window.scrollTo(0, 0);
}

function dessinerMenu(actif) {
  const menu = document.getElementById('menu');
  remplir(menu, routes.filter(r => r.menu).sort((a, b) => a.ordre - b.ordre).map(r =>
    h('a', { href: r.chemin, class: r.chemin === actif ? 'actif' : '' },
      icone(r.icone),
      h('span', {}, r.menu))));
}

window.addEventListener('hashchange', afficherEcran);
