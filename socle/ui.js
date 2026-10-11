// Petits outils d'affichage partagés par tous les blocs.

/**
 * Crée un élément HTML.
 *   h('button', { class: 'bouton', onclick: f }, 'Valider')
 * Les attributs « on… » deviennent des écouteurs, les enfants peuvent être
 * du texte, des éléments, des tableaux ou null (ignoré).
 */
export function h(balise, attributs = {}, ...enfants) {
  const element = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs || {})) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (nom.startsWith('on')) element.addEventListener(nom.slice(2), valeur);
    else if (nom === 'style' && typeof valeur === 'object') Object.assign(element.style, valeur);
    else if (nom in element && nom !== 'list' && nom !== 'form') element[nom] = valeur;
    else element.setAttribute(nom, valeur === true ? '' : valeur);
  }
  ajouterEnfants(element, enfants);
  return element;
}

function ajouterEnfants(element, enfants) {
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    Element.prototype.append.call(element, enfant instanceof Node ? enfant : String(enfant));
  }
}

/**
 * Rend un conteneur tolérant : sa méthode append() ignore null, false et
 * aplatit les tableaux, comme h(). Utilisé pour les zones des écrans et sections.
 */
export function zoneSure(element) {
  element.append = (...enfants) => ajouterEnfants(element, enfants);
  return element;
}

/** Remplace le contenu d'un élément. */
export function remplir(element, ...enfants) {
  element.replaceChildren();
  ajouterEnfants(element, enfants);
  return element;
}

// --- Composants -----------------------------------------------------------------

export function carte(...enfants) {
  return h('section', { class: 'carte' }, ...enfants);
}

export function bouton(texte, action, style = 'principal') {
  return h('button', { type: 'button', class: `bouton ${style}`, onclick: action }, texte);
}

/** Champ de formulaire avec son libellé. « aide » s'affiche en petit dessous. */
export function champ(libelle, controle, aide) {
  return h('label', { class: 'champ' },
    h('span', { class: 'libelle' }, libelle),
    controle,
    aide ? h('small', { class: 'aide' }, aide) : null);
}

export function saisie(attributs = {}) {
  return h('input', { class: 'saisie', ...attributs });
}

export function saisieMontant(valeur, attributs = {}) {
  return h('input', { class: 'saisie montant', inputMode: 'decimal', placeholder: '0,00', value: valeur ?? '', ...attributs });
}

export function choix(options, valeur, attributs = {}) {
  return h('select', { class: 'saisie', ...attributs },
    options.map(([v, texte]) => h('option', { value: v, selected: String(v) === String(valeur) }, texte)));
}

export function barre(progression, couleur) {
  const p = Math.max(0, Math.min(100, progression || 0));
  return h('div', { class: 'barre' }, h('div', { class: 'barre-remplie', style: { width: `${p}%`, background: couleur || null } }));
}

export function pastille(texte, genre = '') {
  return h('span', { class: `pastille ${genre}` }, texte);
}

export function alerte(texte, genre = 'alerte', action) {
  return h('div', { class: `bandeau ${genre}`, role: 'status' },
    h('span', {}, texte),
    action ? bouton(action[0], action[1], 'lien') : null);
}

export function titre(texte, sousTitre) {
  return h('header', { class: 'titre-page' },
    h('h1', {}, texte),
    sousTitre ? h('p', {}, sousTitre) : null);
}

/** Tableau simple : entêtes + lignes (tableaux de cellules). */
export function tableau(entetes, lignes, classe = '') {
  return h('div', { class: 'tableau-defile' },
    h('table', { class: `tableau ${classe}` },
      h('thead', {}, h('tr', {}, entetes.map(e => h('th', {}, e)))),
      h('tbody', {}, lignes.map(l => h('tr', {}, l.map(c => h('td', {}, c)))))));
}

// --- Fenêtres et messages ------------------------------------------------------

/**
 * Ouvre une fenêtre modale. « actions » : [[texte, fonction, style], …].
 * Une action qui renvoie false garde la fenêtre ouverte.
 */
export function fenetre(titreFenetre, contenu, actions = [['Fermer']]) {
  const dialogue = h('dialog', { class: 'fenetre' });
  const fermer = () => { dialogue.close(); dialogue.remove(); };
  remplir(dialogue,
    h('h2', {}, titreFenetre),
    h('div', { class: 'fenetre-contenu' }, contenu),
    h('div', { class: 'fenetre-actions' }, actions.map(([texte, action, style]) =>
      bouton(texte, async () => { if (!action || (await action()) !== false) fermer(); }, style || (action ? 'principal' : 'secondaire')))));
  dialogue.addEventListener('cancel', () => dialogue.remove());
  document.body.append(dialogue);
  dialogue.showModal();
  return fermer;
}

export function confirmer(question, texteOui = 'Confirmer') {
  return new Promise(reponse => {
    fenetre('Confirmation', h('p', {}, question), [
      ['Annuler', () => reponse(false), 'secondaire'],
      [texteOui, () => reponse(true)],
    ]);
  });
}

export function notifier(texte, genre = 'succes') {
  const message = h('div', { class: `notification ${genre}` }, texte);
  document.body.append(message);
  setTimeout(() => message.classList.add('visible'), 10);
  setTimeout(() => { message.classList.remove('visible'); setTimeout(() => message.remove(), 300); }, 2800);
}
