// Écran Réglages : il rassemble les sections fournies par les autres blocs.
//
//   ajouterSection('personnes', 'Personnes', zone => { … }, 10)
//
// Le guide du premier lancement réutilise ces mêmes sections, par leur clé.

import { route } from '../../socle/router.js';
import { h, carte, titre, zoneSure } from '../../socle/ui.js';

const sections = [];

export function ajouterSection(cle, titreSection, afficher, ordre = 50, description = '') {
  sections.push({ cle, titre: titreSection, afficher, ordre, description });
}

export function section(cle) {
  return sections.find(s => s.cle === cle);
}

/** Dessine une section dans une carte. Elle se redessine elle-même via « redessiner ». */
export function carteSection(s) {
  const zone = zoneSure(h('div', { class: 'pile' }));
  const redessiner = () => { zone.replaceChildren(); s.afficher(zone, redessiner); };
  redessiner();
  return carte(
    h('h2', {}, s.titre),
    s.description ? h('p', { class: 'doux petit' }, s.description) : null,
    zone);
}

route('#/reglages', zone => {
  const liste = [...sections].sort((a, b) => a.ordre - b.ordre);
  zone.append(
    titre('Réglages', 'Tout se modifie ici, à tout moment.'),
    h('nav', { class: 'ligne', style: { marginBottom: '16px' } },
      liste.map(s => h('a', { href: `#/reglages/${s.cle}`, class: 'pastille' }, s.titre))),
    h('div', { class: 'pile' }, liste.map(s => {
      const c = carteSection(s);
      c.id = `section-${s.cle}`;
      return c;
    })));
}, { menu: 'Réglages', icone: 'reglages', ordre: 4 });

// #/reglages/revenus : ouvre les réglages et descend jusqu'à la section
window.addEventListener('hashchange', descendre);
window.addEventListener('application-prete', descendre);

function descendre() {
  const [, cle] = location.hash.match(/^#\/reglages\/(.+)$/) || [];
  if (cle) setTimeout(() => document.getElementById(`section-${cle}`)?.scrollIntoView({ behavior: 'smooth' }), 50);
}
