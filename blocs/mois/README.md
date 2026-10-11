# Bloc Clôture du mois

Assistant `#/mois` en 6 étapes : salaires du mois et exceptionnelles, reste du mois, perso / commun, pourcentages, répartition, récapitulatif. Rien n'est enregistré avant la confirmation.

## Fichiers

- `mois.js` : `calculer(saisie)` (sans effet), `repartirEpargne()` (plafonne chaque enveloppe à son reste, gère le surplus), `enregistrer()`, `annuler()`, `moisAClore()`.
- `vue.js` : l'assistant et l'alerte « clôture à faire ».

## Données

Écrit `clotures` et les `mouvements` de versement. Modifie le % des enveloppes si on l'a changé à l'étape 4.
