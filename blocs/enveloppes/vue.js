// Écrans des enveloppes : accueil, détail, formulaires, catégories.

import * as store from '../../socle/store.js';
import { route, aller, rafraichir } from '../../socle/router.js';
import { h, carte, bouton, champ, saisie, saisieMontant, choix, barre, pastille, alerte,
  titre, tableau, fenetre, confirmer, notifier } from '../../socle/ui.js';
import { euros, versCentimes, versTexte, pourcent } from '../../socle/argent.js';
import { aujourdhui, dateCourte, moisCourt, moisCourant } from '../../socle/dates.js';
import { icone } from '../../socle/icones.js';
import { toutesLesAlertes, ajouterAlertes } from '../../socle/alertes.js';
import { ajouterSection } from '../parametres/vue.js';
import { prorata } from '../revenus/revenus.js';
import { faisabilite } from '../reevaluation/reevaluation.js';
import { STATUTS, TYPES, toutes, parStatut, tampon, etat, mouvementsDe, effet, totalEpargne,
  creer, changerObjectif, mouvement, annulerMouvement, categorie, relancerRecurrente } from './enveloppes.js';

// --- Accueil -------------------------------------------------------------------

route('#/accueil', zone => {
  const pr = prorata();
  const noms = nomsPersonnes();
  const ouvertes = parStatut('ouvert');
  const retards = new Map(faisabilite().details.map(d => [d.enveloppe.id, d]));

  zone.append(
    carte(
      h('div', { class: 'ligne entre' },
        h('div', {},
          h('div', { class: 'doux petit' }, 'Épargne commune'),
          h('div', { class: 'gros-chiffre' }, euros(totalEpargne()))),
        h('div', { class: 'petit doux', style: { textAlign: 'right' } },
          `${ouvertes.length} enveloppes ouvertes`, h('br'),
          pr ? `Prorata ${noms.p1} ${pourcent(pr.p1)} · ${noms.p2} ${pourcent(pr.p2)}` : 'Prorata à définir')),
    ),
    h('div', { class: 'bandeaux', style: { marginTop: '16px' } },
      toutesLesAlertes().map(a => alerte(a.texte, a.genre, a.action))),
    h('h2', {}, 'Enveloppes ouvertes'),
    ouvertes.length
      ? h('div', { class: 'grille' }, ouvertes.map(e => carteEnveloppe(e, retards.get(e.id))))
      : h('p', { class: 'doux' }, 'Aucune enveloppe ouverte.'),
  );
  zone.firstChild.classList.add('vedette');

  const t = tampon();
  if (etat(t).solde !== 0) {
    zone.append(h('h2', { style: { marginTop: '24px' } }, 'Non affecté'),
      h('div', { class: 'grille' }, carteEnveloppe(t)));
  }

  for (const [statut, libelle] of [['pause', 'En pause'], ['ferme', 'Fermées']]) {
    const liste = parStatut(statut);
    if (liste.length) {
      zone.append(h('details', { class: 'repli' },
        h('summary', {}, `${libelle} (${liste.length})`),
        h('div', { class: 'grille' }, liste.map(e => carteEnveloppe(e)))));
    }
  }

  zone.append(h('button', { class: 'bouton flottant', title: 'Ajouter', 'aria-label': 'Ajouter', onclick: menuAjout }, icone('plus', 28)));
}, { menu: 'Accueil', icone: 'accueil', ordre: 1 });

function carteEnveloppe(e, retard) {
  const s = etat(e);
  const cat = categorie(e.categorie);
  const etiquettes = [];
  if (e.special) etiquettes.push(pastille('Surplus, arrondis', 'neutre'));
  else if (s.atteint) etiquettes.push(pastille('Objectif atteint', 'succes'));
  else if (retard?.enRetard) etiquettes.push(pastille(`Prévu ${moisCourt(retard.dateRealiste)}`, 'alerte'));
  if (e.statut !== 'ouvert') etiquettes.push(pastille(STATUTS[e.statut], 'neutre'));

  return h('article', { class: 'carte cliquable enveloppe', onclick: () => aller(`#/enveloppe/${e.id}`) },
    h('div', { class: 'ligne entre' },
      h('div', { class: 'ligne' },
        h('span', { class: 'puce', style: { background: cat?.couleur || 'var(--accent)' } }),
        h('strong', {}, e.nom)),
      h('div', { class: 'ligne' }, etiquettes)),
    h('div', { class: 'ligne entre montants' },
      h('span', { class: 'chiffre grand' }, euros(s.solde)),
      s.objectif ? h('span', { class: 'doux' }, `sur ${euros(s.objectif)}`) : null),
    s.objectif ? barre(s.progression, cat?.couleur) : null,
    e.special ? null : h('div', { class: 'ligne entre petit doux' },
      h('span', {}, s.reste ? `Reste ${euros(s.reste)}` : '—'),
      h('span', {}, `${pourcent(e.pourcentage)} · ${moisCourt(e.echeance)}`)));
}

function menuAjout() {
  const fermer = fenetre('Ajouter', h('div', { class: 'pile' },
    bouton('Un mouvement (versement, dépense…)', () => { fermer(); formulaireMouvement(); }, 'secondaire'),
    bouton('Une nouvelle enveloppe', () => { fermer(); formulaireEnveloppe(); }, 'secondaire')),
  [['Fermer']]);
}

// --- Détail d'une enveloppe -------------------------------------------------------

route('#/enveloppe', (zone, id) => {
  const e = store.trouver('enveloppes', id);
  if (!e || e.supprime) return aller('#/accueil');
  const s = etat(e);
  const cat = categorie(e.categorie);
  const prevision = faisabilite().details.find(d => d.enveloppe.id === e.id);

  zone.append(
    h('a', { href: '#/accueil', class: 'ligne petit', style: { textDecoration: 'none', marginBottom: '8px' } }, icone('retour', 16), 'Accueil'),
    h('div', { class: 'ligne entre' },
      titre(e.nom, cat ? cat.nom : (e.special ? 'Argent non affecté : surplus, arrondis' : '')),
      e.special ? null : choix(Object.entries(STATUTS), e.statut, {
        style: { width: 'auto' },
        onchange: ev => { store.mettreAJour('enveloppes', e.id, { statut: ev.target.value }); notifier('Statut modifié'); rafraichir(); },
      })),
    carte(
      h('div', { class: 'grille chiffres-cles' },
        chiffreCle('Solde', euros(s.solde)),
        e.special ? null : chiffreCle('Objectif', euros(s.objectif)),
        e.special ? null : chiffreCle('Reste à épargner', euros(s.reste)),
        e.special ? null : chiffreCle('Part de l\'épargne', pourcent(e.pourcentage)),
        e.special ? null : chiffreCle('Échéance', moisCourt(e.echeance)),
        prevision && s.reste > 0 ? chiffreCle('Au rythme actuel', prevision.dateRealiste ? moisCourt(prevision.dateRealiste) : 'jamais',
          prevision.enRetard ? 'alerte' : 'succes') : null),
      s.objectif ? h('div', { style: { marginTop: '14px' } }, barre(s.progression, cat?.couleur)) : null,
      h('div', { class: 'ligne', style: { marginTop: '18px' } },
        bouton('Ajouter', () => formulaireMouvement(e.id, 'versement')),
        bouton('Dépense projet', () => formulaireMouvement(e.id, 'depense'), 'secondaire'),
        bouton('Emprunt', () => formulaireMouvement(e.id, 'emprunt'), 'secondaire'),
        bouton('Transfert', () => formulaireMouvement(e.id, 'transfert'), 'secondaire'),
        e.special ? null : bouton('Modifier', () => formulaireEnveloppe(e), 'secondaire'),
        e.recurrente && s.atteint ? bouton('Relancer pour un an', () => {
          relancerRecurrente(e, s.objectif + mouvementsDe(e.id).filter(m => m.type === 'depense').reduce((t, m) => t + m.montant, 0));
          rafraichir();
        }, 'secondaire') : null)),
    h('h2', { style: { marginTop: '24px' } }, 'Historique'),
    carte(historique(e)));
});

function chiffreCle(libelle, valeur, genre) {
  return h('div', {},
    h('div', { class: 'doux petit' }, libelle),
    h('div', { class: `chiffre grand ${genre || ''}` }, valeur));
}

function historique(e) {
  const mouvements = store.liste('mouvements')
    .filter(m => m.enveloppe === e.id || m.vers === e.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.modifieLe.localeCompare(a.modifieLe));
  if (!mouvements.length) return h('p', { class: 'doux' }, 'Aucun mouvement.');

  const lignes = mouvements.map(m => {
    const montant = effet(m, e.id);
    const autre = m.type === 'transfert' ? store.trouver('enveloppes', m.vers === e.id ? m.enveloppe : m.vers) : null;
    const libelle = m.type === 'transfert' ? `${montant > 0 ? 'Depuis' : 'Vers'} ${autre?.nom || '?'}` : TYPES[m.type];
    return [
      dateCourte(m.date),
      h('span', {}, libelle, m.cloture ? h('span', { class: 'doux' }, ' · clôture') : null, m.annule ? pastille('annulé', 'neutre') : null),
      h('span', { class: 'doux' }, m.note || ''),
      h('span', { class: `chiffre ${montant >= 0 ? 'positif' : 'negatif'}` }, (montant > 0 ? '+' : '') + euros(montant)),
      m.annule || m.cloture ? '' : bouton('Annuler', async () => {
        if (await confirmer('Annuler ce mouvement ? Il restera visible, barré, dans l\'historique.', 'Annuler le mouvement')) {
          annulerMouvement(m.id);
          rafraichir();
        }
      }, 'lien'),
    ];
  });
  const table = tableau(['Date', 'Type', 'Note', 'Montant', ''], lignes);
  mouvements.forEach((m, i) => { if (m.annule) table.querySelectorAll('tbody tr')[i].classList.add('barre-texte'); });
  return table;
}

// --- Formulaires -----------------------------------------------------------------

const EXPLICATIONS = {
  versement: 'Ajoute de l\'argent dans l\'enveloppe.',
  depense: 'Vous avez dépensé pour le projet : le solde ET l\'objectif baissent du même montant. Le reste à épargner ne change pas.',
  emprunt: 'Argent pris pour autre chose : le solde baisse, l\'objectif reste. Il faudra le ré-épargner.',
  transfert: 'Déplace de l\'argent vers une autre enveloppe. Les objectifs ne changent pas.',
};

export function formulaireMouvement(idEnveloppe, type = 'versement') {
  const disponibles = toutes().filter(e => e.statut !== 'archive');
  const options = disponibles.map(e => [e.id, e.nom]);
  const champEnveloppe = choix(options, idEnveloppe || disponibles[0]?.id);
  const champType = choix(Object.entries(TYPES), type);
  const champMontant = saisieMontant('', { autofocus: true });
  const champDate = saisie({ type: 'date', value: aujourdhui() });
  const champVers = choix(options, '');
  const champNote = saisie({ placeholder: 'Facultatif' });
  const explication = h('p', { class: 'doux petit' });
  const blocVers = champ('Vers l\'enveloppe', champVers);

  const majType = () => {
    explication.textContent = EXPLICATIONS[champType.value];
    blocVers.classList.toggle('cache', champType.value !== 'transfert');
  };
  champType.onchange = majType;
  majType();

  fenetre('Nouveau mouvement', h('div', { class: 'formulaire' },
    champ('Enveloppe', champEnveloppe),
    champ('Type', champType),
    h('div', { class: 'large' }, explication),
    champ('Montant (€)', champMontant),
    champ('Date', champDate),
    blocVers,
    h('div', { class: 'large' }, champ('Note', champNote))),
  [['Annuler'], ['Enregistrer', () => {
    try {
      mouvement({
        enveloppe: champEnveloppe.value, type: champType.value, montant: versCentimes(champMontant.value),
        vers: champType.value === 'transfert' ? champVers.value : null, note: champNote.value.trim(),
        date: champDate.value || aujourdhui(),
      });
    } catch (erreur) {
      notifier(erreur.message, 'danger');
      return false;
    }
    notifier('Mouvement enregistré');
    rafraichir();
  }]]);
}

export function formulaireEnveloppe(e) {
  const s = e ? etat(e) : null;
  const categories = store.liste('categories');
  const f = {
    nom: saisie({ value: e?.nom || '', placeholder: 'Ex. Voyage été' }),
    categorie: choix([['', '—'], ...categories.map(c => [c.id, c.nom])], e?.categorie || categories[0]?.id || ''),
    objectif: saisieMontant(s ? versTexte(s.objectif) : ''),
    echeance: saisie({ type: 'month', value: e?.echeance || '' }),
    pourcentage: saisie({ type: 'number', min: 0, max: 100, step: 0.1, value: e?.pourcentage ?? 0 }),
    statut: choix(Object.entries(STATUTS), e?.statut || 'ouvert'),
    plancher: saisie({ type: 'number', min: 0, max: 100, step: 0.5, value: e?.plancher ?? 0 }),
    verrouille: h('input', { type: 'checkbox', checked: Boolean(e?.verrouille) }),
    recurrente: h('input', { type: 'checkbox', checked: Boolean(e?.recurrente) }),
  };

  fenetre(e ? `Modifier « ${e.nom} »` : 'Nouvelle enveloppe', h('div', { class: 'formulaire' },
    h('div', { class: 'large' }, champ('Nom', f.nom)),
    champ('Catégorie', f.categorie),
    champ('Objectif (€)', f.objectif, e ? 'Objectif actuel, dépenses déjà déduites' : null),
    champ('Échéance', f.echeance),
    champ('Part de l\'épargne (%)', f.pourcentage),
    champ('Statut', f.statut),
    champ('% minimum', f.plancher, 'Plancher lors des réévaluations'),
    h('label', { class: 'case large' }, f.verrouille, 'Verrouiller le % (jamais réévalué)'),
    h('label', { class: 'case large' }, f.recurrente, 'Récurrente : repart pour un an une fois l\'objectif atteint')),
  [
    e ? ['Supprimer', async () => {
      if (!(await confirmer(`Supprimer « ${e.nom} » ? Pour la garder dans l'historique, préférez le statut Archivé.`, 'Supprimer'))) return false;
      store.supprimer('enveloppes', e.id);
      aller('#/accueil');
    }, 'danger'] : null,
    ['Annuler'],
    ['Enregistrer', () => {
      const nom = f.nom.value.trim();
      const objectif = versCentimes(f.objectif.value) ?? 0;
      if (!nom) { notifier('Donnez un nom à l\'enveloppe', 'danger'); return false; }
      const champs = {
        nom, categorie: f.categorie.value || null, echeance: f.echeance.value || null,
        pourcentage: Number(f.pourcentage.value) || 0, statut: f.statut.value,
        plancher: Number(f.plancher.value) || 0, verrouille: f.verrouille.checked, recurrente: f.recurrente.checked,
      };
      if (e) {
        store.mettreAJour('enveloppes', e.id, champs);
        changerObjectif(store.trouver('enveloppes', e.id), objectif);
      } else {
        creer({ ...champs, objectifInitial: objectif });
      }
      notifier('Enveloppe enregistrée');
      rafraichir();
    }],
  ].filter(Boolean));
}

// --- Alertes ---------------------------------------------------------------------

ajouterAlertes(() => {
  const alertes = [];
  for (const e of parStatut('ouvert')) {
    const s = etat(e);
    if (s.atteint) {
      alertes.push({ texte: `« ${e.nom} » a atteint son objectif : elle ne reçoit plus rien, sa part va aux autres.`, genre: 'info',
        action: ['Voir', () => aller(`#/enveloppe/${e.id}`)] });
    } else if (e.echeance && e.echeance < moisCourant() && s.reste > 0) {
      alertes.push({ texte: `« ${e.nom} » : échéance dépassée (${moisCourt(e.echeance)}), il manque ${euros(s.reste)}.`, genre: 'danger',
        action: ['Modifier', () => formulaireEnveloppe(e)] });
    }
  }
  return alertes;
});

// --- Réglages : catégories --------------------------------------------------------

ajouterSection('categories', 'Catégories', (zone, redessiner) => {
  for (const c of store.liste('categories')) {
    const utilisee = toutes().some(e => e.categorie === c.id);
    zone.append(h('div', { class: 'ligne' },
      h('input', { type: 'color', value: c.couleur, class: 'pastille-couleur',
        onchange: ev => store.mettreAJour('categories', c.id, { couleur: ev.target.value }) }),
      saisie({ value: c.nom, style: { flex: 1 }, onchange: ev => store.mettreAJour('categories', c.id, { nom: ev.target.value.trim() || c.nom }) }),
      utilisee ? null : bouton('Supprimer', () => { store.supprimer('categories', c.id); redessiner(); }, 'lien')));
  }
  zone.append(bouton('Ajouter une catégorie', () => {
    store.ajouter('categories', { nom: 'Nouvelle', couleur: '#a78bfa' });
    redessiner();
  }, 'secondaire'));
}, 60);

// --- Outils ------------------------------------------------------------------------

export function nomsPersonnes() {
  const noms = {};
  for (const p of store.lire().personnes) noms[p.id] = p.pseudo;
  return noms;
}
