// Contrôle : comparer le solde réel du livret commun avec la somme des enveloppes.

import * as store from '../../socle/store.js';
import { route, aller, rafraichir } from '../../socle/router.js';
import { h, carte, bouton, champ, saisie, saisieMontant, titre, tableau, alerte, notifier } from '../../socle/ui.js';
import { euros, versCentimes } from '../../socle/argent.js';
import { aujourdhui, dateCourte } from '../../socle/dates.js';
import { ajouterAlertes } from '../../socle/alertes.js';
import { icone } from '../../socle/icones.js';
import { totalEpargne, tampon, mouvement } from '../enveloppes/enveloppes.js';

route('#/controle', zone => {
  const total = totalEpargne();
  const champSolde = saisieMontant('', { autofocus: true });
  const champDate = saisie({ type: 'date', value: aujourdhui() });
  const controles = store.liste('controles').sort((a, b) => b.date.localeCompare(a.date));
  const dernier = controles[0];
  const ecart = dernier ? dernier.soldeReel - dernier.totalEnveloppes : 0;

  zone.append(
    h('a', { href: '#/accueil', class: 'ligne petit', style: { textDecoration: 'none', marginBottom: '8px' } }, icone('retour', 16), 'Accueil'),
    titre('Contrôle du livret commun', 'Le total des enveloppes doit correspondre au solde réel de la banque.'),
    carte(
      h('div', { class: 'ligne entre' },
        h('span', {}, 'Total des enveloppes aujourd\'hui'),
        h('strong', { class: 'chiffre grand' }, euros(total))),
      h('div', { class: 'formulaire', style: { marginTop: '14px' } },
        champ('Solde réel du livret commun (€)', champSolde),
        champ('Date du relevé', champDate)),
      h('div', { class: 'ligne', style: { marginTop: '14px' } },
        bouton('Enregistrer le contrôle', () => {
          const soldeReel = versCentimes(champSolde.value);
          if (soldeReel === null) return notifier('Saisissez le solde réel', 'danger');
          store.ajouter('controles', { date: champDate.value || aujourdhui(), soldeReel, totalEnveloppes: total });
          notifier('Contrôle enregistré');
          rafraichir();
        }))),
    dernier && ecart !== 0 ? h('div', { style: { marginTop: '16px' } },
      alerte(`Écart au ${dateCourte(dernier.date)} : ${euros(ecart)} ${ecart > 0 ? 'de plus sur le livret que dans les enveloppes' : 'de moins sur le livret que dans les enveloppes'}.`,
        'alerte', ['Corriger via le Tampon', () => corriger(ecart)])) : null,
    controles.length ? h('h2', { style: { marginTop: '24px' } }, 'Contrôles précédents') : null,
    controles.length ? carte(tableau(['Date', 'Solde réel', 'Enveloppes', 'Écart'], controles.map(c => [
      dateCourte(c.date), euros(c.soldeReel), euros(c.totalEnveloppes),
      h('strong', { style: { color: c.soldeReel === c.totalEnveloppes ? 'var(--succes)' : 'var(--alerte)' } }, euros(c.soldeReel - c.totalEnveloppes))]))) : null);
});

/** Ajuste le Tampon pour que les enveloppes retombent sur le solde réel. */
function corriger(ecart) {
  mouvement({ enveloppe: tampon().id, type: ecart > 0 ? 'versement' : 'emprunt', montant: Math.abs(ecart), note: 'Correction après contrôle' });
  store.ajouter('controles', { date: aujourdhui(), soldeReel: totalEpargne(), totalEnveloppes: totalEpargne() });
  notifier('Tampon ajusté');
  rafraichir();
}

ajouterAlertes(() => {
  const dernier = store.liste('controles').sort((a, b) => b.date.localeCompare(a.date))[0];
  if (dernier && dernier.soldeReel !== dernier.totalEnveloppes) {
    return [{ texte: `Le dernier contrôle montre un écart de ${euros(dernier.soldeReel - dernier.totalEnveloppes)} avec la banque.`,
      genre: 'danger', action: ['Voir', () => aller('#/controle')] }];
  }
  const ilYa30Jours = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  if (!dernier || dernier.date < ilYa30Jours) {
    return [{ texte: 'Vérifiez que le livret commun correspond bien aux enveloppes.', genre: 'info',
      action: ['Contrôler', () => aller('#/controle')] }];
  }
  return [];
});
