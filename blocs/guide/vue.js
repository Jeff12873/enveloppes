// Guide du premier lancement. Les étapes 3 à 8 réutilisent les sections des Réglages.

import * as store from '../../socle/store.js';
import { route, aller, rafraichir } from '../../socle/router.js';
import { h, carte, bouton, champ, saisie, titre, tableau, alerte, remplir, notifier } from '../../socle/ui.js';
import { euros, pourcent } from '../../socle/argent.js';
import { moisCourt } from '../../socle/dates.js';
import { icone } from '../../socle/icones.js';
import { choisirFichierLocal, lireOctets } from '../../socle/fichiers.js';
import { lireFichierExterne, ACCES_DIRECT } from '../../socle/sync.js';
import { ajouterSection, section, carteSection } from '../parametres/vue.js';
import { parStatut, etat } from '../enveloppes/enveloppes.js';
import { formulaireEnveloppe } from '../enveloppes/vue.js';
import { totalPourcentages } from '../reevaluation/reevaluation.js';

// Les étapes après le mot de passe : [titre, clés des sections à afficher]
const ETAPES_REGLAGES = [
  ['Les personnes', ['personnes']],
  ['Revenus et prorata', ['revenus', 'part-perso']],
  ['Enveloppes exceptionnelles', ['exceptionnelles']],
  ['Enveloppes projets', []],
  ['Synchronisation', ['synchro']],
];
const TOTAL = 2 + ETAPES_REGLAGES.length + 1;

let etape = 0;
let brouillon = null;   // données choisies avant la création du mot de passe

route('#/guide', zone => {
  if (store.estOuvert() && etape < 2) etape = 2;
  const entete = h('div', { class: 'etapes' }, Array.from({ length: TOTAL }, (_, i) => h('span', { class: i <= etape ? 'faite' : '' })));
  const contenu = etape === 0 ? bienvenue() : etape === 1 ? motDePasse() : etape < TOTAL - 1 ? reglages() : recapitulatif();
  zone.append(h('div', { class: 'ecran-centre large' }, entete, contenu));
});

function suivant() { etape++; rafraichir(); }
function precedent() { etape--; rafraichir(); }

function navigation(texteSuivant = 'Suivant', action = suivant) {
  return h('div', { class: 'navigation-etapes' },
    etape > 2 ? bouton('Retour', precedent, 'secondaire') : h('span'),
    bouton(texteSuivant, action));
}

// --- 1. Bienvenue ------------------------------------------------------------------

function bienvenue() {
  const choixCarte = (icon, texte, detail, action) => h('button', { class: 'carte cliquable choix-guide', onclick: action },
    icone(icon, 28), h('span', {}, h('strong', {}, texte), h('br'), h('small', { class: 'doux' }, detail)));

  return h('div', { class: 'pile' },
    titre('Bienvenue', 'Épargnez à deux, en enveloppes, au prorata de vos revenus.'),
    carte(h('ol', { class: 'principe' },
      h('li', {}, 'Vos salaires nets fixent un prorata, recalculé chaque mois.'),
      h('li', {}, 'Chaque mois, le reste du plus petit salaire détermine ce que verse le plus gros.'),
      h('li', {}, 'L\'épargne commune se répartit dans vos enveloppes projets.'))),
    choixCarte('enveloppe', 'Commencer avec mes données', 'Reprend le tableur importé (prive/donnees-initiales.json)', commencerAvecMesDonnees),
    choixCarte('sync', 'Ouvrir un fichier .enveloppes', 'Pour un deuxième appareil', ouvrirFichierExistant),
    choixCarte('plus', 'Partir de zéro', 'Tout se règle en quelques étapes', () => { brouillon = store.donneesVides(); suivant(); }));
}

async function commencerAvecMesDonnees() {
  let texte = await window.bureau?.donneesInitiales();
  if (!texte && location.protocol.startsWith('http')) {
    // Lancée depuis un serveur local dans le dossier du projet
    texte = await fetch('prive/donnees-initiales.json').then(r => (r.ok ? r.text() : null)).catch(() => null);
  }
  if (!texte) {
    notifier('Choisissez le fichier donnees-initiales.json');
    const fichier = await choisirFichierLocal('.json,application/json');
    if (!fichier) return;
    texte = await fichier.text();
  }
  try {
    brouillon = JSON.parse(texte);
    if (!brouillon.enveloppes) throw new Error();
  } catch {
    return notifier('Ce fichier n\'est pas un fichier de données Enveloppes', 'danger');
  }
  suivant();
}

async function ouvrirFichierExistant() {
  let octets, fichierSync = null;
  try {
    if (window.bureau) {
      fichierSync = await window.bureau.choisirFichier('ouvrir');
      if (!fichierSync) return;
      octets = await window.bureau.lire(fichierSync);
    } else if (window.showOpenFilePicker) {
      [fichierSync] = await window.showOpenFilePicker();
      octets = await lireOctets(await fichierSync.getFile());
    } else {
      const fichier = await choisirFichierLocal('.enveloppes');
      if (!fichier) return;
      octets = await lireOctets(fichier);
    }
  } catch (erreur) {
    if (erreur.name !== 'AbortError') notifier(erreur.message, 'danger');
    return;
  }

  const zone = document.querySelector('.ecran-centre');
  const mdp = saisie({ type: 'password', autofocus: true });
  const memoriser = h('input', { type: 'checkbox', checked: true });
  const message = h('p', { class: 'petit', style: { color: 'var(--danger)' } });
  remplir(zone, titre('Ouvrir le fichier'), carte(h('div', { class: 'pile' },
    champ('Mot de passe du fichier', mdp),
    h('label', { class: 'case' }, memoriser, 'Se souvenir sur cet appareil'),
    message,
    h('div', { class: 'ligne' },
      bouton('Retour', () => rafraichir(), 'secondaire'),
      bouton('Ouvrir', async () => {
        message.textContent = 'Ouverture…';
        try {
          const { donnees, sel } = await lireFichierExterne(octets, mdp.value);
          await store.creer(donnees, mdp.value, memoriser.checked, sel);
          await store.changerAppareil({ fichier: ACCES_DIRECT ? fichierSync : null, guideFait: true });
          window.dispatchEvent(new Event('deverrouille'));
          aller('#/accueil');
        } catch {
          message.textContent = 'Mot de passe incorrect ou fichier abîmé.';
        }
      })))));
}

// --- 2. Mot de passe ---------------------------------------------------------------

function motDePasse() {
  const mdp = saisie({ type: 'password', autocomplete: 'new-password', autofocus: true });
  const encore = saisie({ type: 'password', autocomplete: 'new-password' });
  const memoriser = h('input', { type: 'checkbox', checked: true });
  return h('div', { class: 'pile' },
    titre('Mot de passe', 'Il chiffre vos données sur cet appareil et dans le fichier de synchronisation.'),
    carte(h('div', { class: 'pile' },
      champ('Mot de passe', mdp, '8 caractères minimum. Le même sur tous vos appareils.'),
      champ('Encore une fois', encore),
      h('label', { class: 'case' }, memoriser, 'Se souvenir sur cet appareil (pas de saisie à chaque ouverture)'),
      alerte('Sans ce mot de passe, les données sont irrécupérables. Notez-le en lieu sûr.', 'danger'))),
    h('div', { class: 'navigation-etapes' },
      bouton('Retour', () => { etape = 0; rafraichir(); }, 'secondaire'),
      bouton('Créer', async () => {
        if (mdp.value.length < 8) return notifier('8 caractères minimum', 'danger');
        if (mdp.value !== encore.value) return notifier('Les deux saisies diffèrent', 'danger');
        await store.creer(brouillon, mdp.value, memoriser.checked);
        brouillon = null;
        suivant();
      })));
}

// --- 3 à 7. Réglages ----------------------------------------------------------------

function reglages() {
  const [titreEtape, cles] = ETAPES_REGLAGES[etape - 2];
  const contenu = cles.length ? cles.map(cle => carteSection(section(cle))) : [enveloppesProjets()];
  return h('div', { class: 'pile' },
    titre(titreEtape, `Étape ${etape + 1} sur ${TOTAL}. Tout reste modifiable plus tard dans les Réglages.`),
    contenu,
    navigation());
}

function enveloppesProjets() {
  const ouvertes = parStatut('ouvert');
  const total = totalPourcentages();
  return carte(h('div', { class: 'pile' },
    h('p', { class: 'doux' }, 'Chaque enveloppe a un objectif, une échéance et une part de l\'épargne commune (%).'),
    ouvertes.length ? tableau(['Enveloppe', 'Objectif', 'Échéance', '%', ''], ouvertes.map(e => [
      e.nom, euros(etat(e).objectif), moisCourt(e.echeance), pourcent(e.pourcentage),
      bouton('Modifier', () => formulaireEnveloppe(e), 'lien')])) : null,
    ouvertes.length ? h('p', { class: 'petit', style: { color: Math.abs(total - 100) > 0.05 ? 'var(--danger)' : 'var(--succes)' } },
      `Total des % : ${pourcent(total)}`) : null,
    bouton('Nouvelle enveloppe', () => formulaireEnveloppe(), 'secondaire')));
}

// --- 8. Récapitulatif -----------------------------------------------------------------

function recapitulatif() {
  const donnees = store.lire();
  const controle = donnees._controleImport;
  let contenu;
  if (controle) {
    const lignes = Object.entries(controle).map(([id, soldeTableur]) => {
      const e = store.trouver('enveloppes', id);
      const solde = etat(e).solde;
      return [e.nom, soldeTableur === null ? 'absente' : euros(soldeTableur), euros(solde),
        soldeTableur === null || soldeTableur === solde ? h('span', { style: { color: 'var(--succes)' } }, '✓')
          : h('span', { style: { color: 'var(--danger)' } }, '≠')];
    });
    contenu = carte(h('div', { class: 'pile' },
      h('p', {}, 'Contrôle de l\'import : solde de chaque enveloppe dans le tableur et dans l\'application.'),
      tableau(['Enveloppe', 'Tableur', 'Application', ''], lignes),
      donnees._rapportImport?.length ? alerte(donnees._rapportImport.join(' '), 'info') : null));
  } else {
    contenu = carte(h('p', {}, `${parStatut('ouvert').length} enveloppe(s) ouverte(s). Vous pouvez commencer.`));
  }
  return h('div', { class: 'pile' },
    titre('C\'est prêt', 'Prochaine étape : la clôture du mois, depuis l\'onglet Mois.'),
    contenu,
    navigation('Terminer', terminer));
}

async function terminer() {
  const donnees = store.lire();
  delete donnees._controleImport;
  delete donnees._rapportImport;
  await store.sauver();
  await store.changerAppareil({ guideFait: true });
  etape = 0;
  window.dispatchEvent(new Event('deverrouille'));
  aller('#/accueil');
}

// --- Réglages : relancer le guide ---------------------------------------------------

ajouterSection('guide', 'Guide', zone => {
  zone.append(bouton('Relancer le guide', async () => {
    await store.changerAppareil({ guideFait: false });
    etape = 2;
    aller('#/guide');
  }, 'secondaire'));
}, 90);
