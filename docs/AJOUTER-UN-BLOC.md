# Ajouter ou retirer un bloc

## Ajouter

1. Copier un bloc simple (par ex. `blocs/controle/`) sous un nouveau nom.
   Pour les fichiers de l'application de bureau, rien à faire : `blocs/**` est déjà emballé.
2. Renommer les fichiers et adapter le `README.md` : ce que fait le bloc, ses écrans, les données qu'il lit et écrit.
3. Dans `index.html`, ajouter une ligne :

       <script type="module" src="blocs/mon-bloc/vue.js"></script>

4. Dans `vue.js`, déclarer ce que le bloc apporte :

       route('#/mon-bloc', afficher, { menu: 'Mon bloc', icone: 'mois', ordre: 5 });   // écran (menu facultatif)
       ajouterSection('mon-bloc', 'Mon bloc', afficherReglages, 55);                    // section des Réglages
       ajouterAlertes(() => [{ texte: '…', genre: 'info' }]);                           // alertes de l'accueil

5. Si le bloc stocke des données, ajouter sa collection dans `docs/DONNEES.md`.

## Retirer

1. Supprimer la ligne dans `index.html`.
2. Supprimer le dossier du bloc.

Les données qu'il avait enregistrées restent dans le fichier et sont simplement ignorées.

## Règles à respecter

- Passer par `socle/store.js` pour toute lecture ou écriture.
- Montants en centimes, avec les fonctions de `socle/argent.js`.
- Couleurs et espacements via les variables de `theme.css`, jamais en dur.
- Pas de dépendance externe.
