// Réglages : enveloppes exceptionnelles (dépenses partagées ponctuelles, ex. vétérinaire).
// Leur partage se calcule à la clôture du mois (blocs/mois/mois.js).

import * as store from '../../socle/store.js';
import { h, champ, saisie, choix, bouton, confirmer } from '../../socle/ui.js';
import { ajouterSection } from '../parametres/vue.js';
import { nomsPersonnes } from '../enveloppes/vue.js';

ajouterSection('exceptionnelles', 'Enveloppes exceptionnelles', (zone, redessiner) => {
  const noms = nomsPersonnes();
  const liste = store.liste('exceptionnelles');
  const changer = (x, champs) => { store.mettreAJour('exceptionnelles', x.id, champs); redessiner(); };

  for (const x of liste) {
    const parts = h('div', { class: x.mode === 'fixe' ? 'formulaire large' : 'cache' },
      champ(`Part de ${noms.p1} (%)`, saisie({ type: 'number', min: 0, max: 100, step: 1, value: x.parts.p1,
        onchange: ev => {
          const p1 = Math.min(100, Math.max(0, Number(ev.target.value) || 0));
          changer(x, { parts: { p1, p2: 100 - p1 } });
        } })),
      champ(`Part de ${noms.p2} (%)`, saisie({ value: x.parts.p2, disabled: true })));

    zone.append(h('div', { class: 'carte', style: { boxShadow: 'none', background: 'var(--surface-2)' } },
      h('div', { class: 'formulaire' },
        champ('Nom', saisie({ value: x.nom, onchange: ev => changer(x, { nom: ev.target.value.trim() || x.nom }) })),
        champ('Partage', choix([['prorata', 'Au prorata des revenus'], ['fixe', 'Parts fixes']], x.mode,
          { onchange: ev => changer(x, { mode: ev.target.value }) })),
        champ('Payé d\'habitude par', choix([['p1', noms.p1], ['p2', noms.p2]], x.payeur || 'p1',
          { onchange: ev => changer(x, { payeur: ev.target.value }) })),
        parts,
        h('div', { class: 'ligne entre large' },
          h('label', { class: 'case' }, h('input', { type: 'checkbox', checked: x.actif, onchange: ev => changer(x, { actif: ev.target.checked }) }),
            'Active (proposée à chaque clôture)'),
          bouton('Supprimer', async () => {
            if (await confirmer(`Supprimer « ${x.nom} » ? Les clôtures passées gardent leurs montants.`, 'Supprimer')) {
              store.supprimer('exceptionnelles', x.id);
              redessiner();
            }
          }, 'lien')))));
  }

  zone.append(bouton('Ajouter une enveloppe exceptionnelle', () => {
    store.ajouter('exceptionnelles', { nom: 'Nouvelle dépense', actif: true, mode: 'prorata', parts: { p1: 50, p2: 50 }, payeur: 'p1' });
    redessiner();
  }, 'secondaire'));
}, 30, 'Dépenses partagées qui ne passent pas par le compte commun. À la clôture, l\'application calcule qui rembourse qui.');
