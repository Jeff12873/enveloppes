# Bloc Enveloppes

Accueil (`#/accueil`), détail d'une enveloppe (`#/enveloppe/<id>`), formulaires d'enveloppe et de mouvement, section Catégories.

## Fichiers

- `enveloppes.js` : `etat(enveloppe)` (solde, objectif courant, reste, progression), `mouvement()`, `annulerMouvement()`, `changerObjectif()`, `creer()`.
- `vue.js` : écrans, `formulaireEnveloppe()`, `formulaireMouvement()`, alertes (objectif atteint, échéance dépassée).

## Données

Lit et écrit `enveloppes`, `mouvements`, `categories`.
