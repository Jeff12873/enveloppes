// Réglages : les deux personnes du foyer (pseudo et couleur).

import * as store from '../../socle/store.js';
import { h, champ, saisie } from '../../socle/ui.js';
import { ajouterSection } from '../parametres/vue.js';

ajouterSection('personnes', 'Personnes', zone => {
  for (const p of store.lire().personnes) {
    zone.append(h('div', { class: 'ligne', style: { alignItems: 'flex-end' } },
      h('input', { type: 'color', value: p.couleur, class: 'pastille-couleur', title: 'Couleur',
        onchange: ev => store.mettreAJour('personnes', p.id, { couleur: ev.target.value }) }),
      h('div', { style: { flex: 1 } }, champ(p.id === 'p1' ? 'Première personne' : 'Seconde personne',
        saisie({ value: p.pseudo, maxLength: 24,
          onchange: ev => store.mettreAJour('personnes', p.id, { pseudo: ev.target.value.trim() || p.pseudo }) })))));
  }
}, 10, 'Des pseudos suffisent : ils s\'affichent partout dans l\'application.');
