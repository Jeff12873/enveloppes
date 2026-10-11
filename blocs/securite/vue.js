// Sécurité : écran de verrouillage, mot de passe, code PIN, apparence, effacement.

import * as store from '../../socle/store.js';
import { route, aller } from '../../socle/router.js';
import { h, carte, bouton, champ, saisie, choix, fenetre, confirmer, notifier } from '../../socle/ui.js';
import { icone } from '../../socle/icones.js';
import { empreinte } from '../../socle/crypto.js';
import { appliquerTheme } from '../../socle/apparence.js';
import { ecraserFichier } from '../../socle/sync.js';
import { ajouterSection } from '../parametres/vue.js';

const ESSAIS_PIN = 5;

// --- Écran de verrouillage ------------------------------------------------------

route('#/verrou', zone => {
  const appareil = store.lireAppareil();
  const avecPin = Boolean(appareil.pin && appareil.cle);
  const message = h('p', { class: 'petit', style: { color: 'var(--danger)', minHeight: '1.4em' } });

  const entrer = async () => {
    window.dispatchEvent(new Event('deverrouille'));
    aller(store.lireAppareil().guideFait ? '#/accueil' : '#/guide');
  };

  let formulaire;
  if (avecPin) {
    const champPin = saisie({ type: 'password', inputMode: 'numeric', autocomplete: 'off', placeholder: '••••', autofocus: true,
      style: { textAlign: 'center', fontSize: '1.6rem', letterSpacing: '.4em' } });
    const valider = async () => {
      if ((await empreinte(champPin.value)) === appareil.pin) {
        await store.changerAppareil({ essaisPin: 0 });
        await store.ouvrirAvecCleMemorisee();
        return entrer();
      }
      const essais = (appareil.essaisPin || 0) + 1;
      if (essais >= ESSAIS_PIN) {
        await store.changerAppareil({ cle: null, essaisPin: 0 });
        notifier('Trop d\'essais : saisissez le mot de passe', 'danger');
        return aller('#/verrou');
      }
      await store.changerAppareil({ essaisPin: essais });
      message.textContent = `Code incorrect (${ESSAIS_PIN - essais} essai(s) restant(s)).`;
      champPin.value = '';
    };
    champPin.onkeydown = ev => { if (ev.key === 'Enter') valider(); };
    formulaire = [champ('Code PIN', champPin), message, bouton('Déverrouiller', valider),
      bouton('Utiliser le mot de passe', async () => { await store.changerAppareil({ cle: null }); aller('#/verrou'); }, 'lien')];
  } else {
    const champMdp = saisie({ type: 'password', autocomplete: 'current-password', autofocus: true });
    const memoriser = h('input', { type: 'checkbox', checked: true });
    const valider = async () => {
      message.textContent = 'Ouverture…';
      try {
        await store.ouvrir(champMdp.value, memoriser.checked);
        return entrer();
      } catch {
        message.textContent = 'Mot de passe incorrect.';
      }
    };
    champMdp.onkeydown = ev => { if (ev.key === 'Enter') valider(); };
    formulaire = [champ('Mot de passe', champMdp),
      h('label', { class: 'case' }, memoriser, 'Se souvenir sur cet appareil'),
      message, bouton('Déverrouiller', valider)];
  }

  zone.append(h('div', { class: 'ecran-centre' }, carte(
    h('div', { class: 'ligne', style: { justifyContent: 'center', color: 'var(--accent)' } }, icone('verrou', 44)),
    h('h1', { style: { textAlign: 'center' } }, 'Enveloppes'),
    h('p', { class: 'doux', style: { textAlign: 'center' } }, 'Vos données sont chiffrées sur cet appareil.'),
    h('div', { class: 'pile' }, formulaire))));
});

// Bouton « verrouiller » dans l'en-tête
const boutonVerrou = h('button', { type: 'button', title: 'Verrouiller', onclick: async () => {
  await store.verrouiller();
  aller('#/verrou');
} }, icone('verrou', 18));
document.getElementById('actions-entete').append(boutonVerrou);

// --- Réglages : sécurité -------------------------------------------------------

ajouterSection('securite', 'Sécurité', (zone, redessiner) => {
  const appareil = store.lireAppareil();
  zone.append(
    h('label', { class: 'case' },
      h('input', { type: 'checkbox', checked: Boolean(appareil.cle), onchange: async ev => {
        await store.changerAppareil({ cle: ev.target.checked ? store.lireCle() : null, pin: ev.target.checked ? appareil.pin : null });
        redessiner();
      } }),
      'Se souvenir du mot de passe sur cet appareil'),
    h('div', { class: 'ligne' },
      bouton('Changer le mot de passe', changerMotDePasse, 'secondaire'),
      appareil.pin
        ? bouton('Retirer le code PIN', async () => { await store.changerAppareil({ pin: null }); notifier('Code PIN retiré'); redessiner(); }, 'secondaire')
        : bouton('Définir un code PIN', () => definirPin(redessiner), 'secondaire')),
    h('p', { class: 'doux petit' }, 'Le code PIN verrouille l\'application sur cet appareil. Le mot de passe protège le fichier : '
      + 's\'il est perdu, les données sont irrécupérables.'),
    h('hr', { style: { border: 0, borderTop: '1px solid var(--bordure)' } }),
    bouton('Effacer les données de cet appareil', async () => {
      if (!(await confirmer('Effacer toutes les données de CET appareil ? Le fichier de synchronisation n\'est pas touché.', 'Tout effacer'))) return;
      await store.toutEffacer();
      location.hash = '';
      location.reload();
    }, 'danger'));
}, 70);

function changerMotDePasse() {
  const nouveau = saisie({ type: 'password', autocomplete: 'new-password' });
  const encore = saisie({ type: 'password', autocomplete: 'new-password' });
  fenetre('Changer le mot de passe', h('div', { class: 'pile' },
    champ('Nouveau mot de passe', nouveau, '8 caractères minimum'),
    champ('Encore une fois', encore),
    h('p', { class: 'doux petit' }, 'Le fichier de synchronisation sera réécrit. Les autres appareils devront le rouvrir avec le nouveau mot de passe.')),
  [['Annuler'], ['Changer', async () => {
    if (nouveau.value.length < 8) { notifier('8 caractères minimum', 'danger'); return false; }
    if (nouveau.value !== encore.value) { notifier('Les deux saisies diffèrent', 'danger'); return false; }
    await store.changerMotDePasse(nouveau.value);
    await ecraserFichier();
    notifier('Mot de passe changé');
  }]]);
}

function definirPin(redessiner) {
  if (!store.lireAppareil().cle) {
    notifier('Activez d\'abord « Se souvenir du mot de passe »', 'danger');
    return;
  }
  const pin = saisie({ type: 'password', inputMode: 'numeric', autocomplete: 'off' });
  fenetre('Code PIN', champ('Code (4 à 8 chiffres)', pin), [['Annuler'], ['Enregistrer', async () => {
    if (!/^\d{4,8}$/.test(pin.value)) { notifier('4 à 8 chiffres', 'danger'); return false; }
    await store.changerAppareil({ pin: await empreinte(pin.value), essaisPin: 0 });
    notifier('Code PIN défini');
    redessiner();
  }]]);
}

// --- Réglages : apparence ----------------------------------------------------------

ajouterSection('apparence', 'Apparence', (zone, redessiner) => {
  zone.append(champ('Thème', choix([['', 'Comme le système'], ['clair', 'Clair'], ['sombre', 'Sombre']], store.lireAppareil().theme || '', {
    onchange: async ev => { await store.changerAppareil({ theme: ev.target.value || null }); appliquerTheme(); redessiner(); },
  })));
}, 80);
