# Architecture

## Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Multi-plateforme | Application web (PWA) + AppImage Electron pour Linux | Un seul code pour le navigateur, le téléphone et le bureau |
| Code lisible sans outil | HTML + CSS + JS « vanilla », modules ES | Pas de compilation : on modifie un fichier, on recharge |
| Stockage local | IndexedDB, données chiffrées | Intégré au navigateur, fonctionne hors ligne |
| Chiffrement | WebCrypto (AES-GCM 256, clé PBKDF2 600 000 itérations) | Intégré au navigateur, aucune bibliothèque |
| Montants | Entiers en **centimes** | Pas d'erreurs d'arrondi (`0,1 + 0,2`) |

Aucune dépendance dans l'application. Electron ne sert qu'à l'emballage pour le bureau.

## Arborescence

```
Envellopes/
├── index.html              Point d'entrée : une ligne par bloc
├── app.js                  Démarrage : verrou, guide, premier écran
├── theme.css               Couleurs, polices, arrondis, ombres (le thème entier)
├── manifest.json, sw.js    PWA : installation et hors-ligne (navigateur)
├── icone.svg
│
├── socle/                  Code partagé par tous les blocs
│   ├── store.js            Données : ouverture, chiffrement local, modifications
│   ├── crypto.js           Chiffrer / déchiffrer (format .enveloppes)
│   ├── sync.js             Fichier partagé : lecture, fusion, écriture
│   ├── argent.js           Centimes, formatage « 1 234,56 € », répartition sans perte
│   ├── dates.js            Mois, échéances, noms de mois
│   ├── router.js           Navigation (#/accueil, #/enveloppe/e3…) et menu
│   ├── ui.js               Composants : h(), carte, bouton, champ, fenêtre, notification
│   ├── alertes.js          Alertes de l'accueil, fournies par les blocs
│   ├── icones.js           Icônes SVG
│   ├── fichiers.js         Télécharger un export, choisir un fichier
│   ├── apparence.js        Thème clair / sombre
│   └── base.css            Mise en page et composants
│
├── blocs/                  Une fonction par dossier, chacun avec son README.md
│   ├── parametres/         Écran Réglages (assemble les sections des autres blocs)
│   ├── enveloppes/         Accueil, détail, mouvements, catégories
│   ├── mois/               Clôture du mois
│   ├── historique/         Clôtures, mouvements, archivées
│   ├── personnes/          Pseudos, couleurs
│   ├── revenus/            Revenus annuels, prorata, part perso
│   ├── exceptionnelles/    Dépenses partagées ponctuelles (véto…)
│   ├── reevaluation/       % selon le temps restant, alertes de faisabilité
│   ├── controle/           Comparaison avec le solde réel du livret
│   ├── securite/           Verrou, mot de passe, code PIN, apparence
│   ├── sauvegarde/         Synchronisation, exports
│   └── guide/              Premier lancement
│
├── bureau/                 Application de bureau (Electron)
│   ├── main.js             Fenêtre, protocole app://, accès disque limité aux .enveloppes
│   ├── preload.js          Pont window.bureau (4 fonctions)
│   └── icone.png
├── package.json            Emballage AppImage (electron-builder)
│
├── outils/import-ods.py    Conversion unique du tableur
├── prive/                  Données personnelles, JAMAIS partagées avec le code
└── docs/
```

## Un bloc

```
blocs/enveloppes/
├── README.md         Ce que fait le bloc, ses fichiers, ses données
├── enveloppes.js     Logique : calculs, lecture / écriture via store.js
├── vue.js            Affichage : écrans, sections de réglages, alertes
└── enveloppes.css    Styles propres au bloc (facultatif)
```

Un bloc s'enregistre lui-même au chargement :
- `route('#/chemin', afficher, { menu, icone, ordre })` pour un écran ;
- `ajouterSection(cle, titre, afficher, ordre)` pour une section des Réglages (réutilisée par le guide) ;
- `ajouterAlertes(() => [...])` pour des alertes sur l'accueil.

Règles :
- On passe **toujours** par `socle/store.js` pour lire ou écrire les données.
- La **logique** (`<bloc>.js`, sans affichage) est séparée de la **vue** (`vue.js`).
- Retirer un bloc : supprimer sa ligne dans `index.html`. Attention, certains blocs s'appuient sur la logique d'un autre (voir les `import` en tête de fichier).

## Flux des données

```
  écran (vue.js)
       │  action de l'utilisateur
       ▼
  logique du bloc ──► store.js ──► IndexedDB : « coffre » chiffré (cet appareil)
                           │
                           └──► sync.js ──► crypto.js ──► fichier .enveloppes (dossier partagé)
```

`store.js` regroupe les modifications rapprochées (150 ms) puis chiffre et enregistre.
`sync.js` synchronise 3 secondes après la dernière modification, et à chaque ouverture.

## Synchronisation

- Le fichier `.enveloppes` contient toutes les données, chiffrées avec le mot de passe du couple.
- Chaque élément (enveloppe, mouvement, clôture…) a un `id` unique et une date `modifieLe`.
- **Fusion** : pour chaque `id`, on garde la version la plus récente. Les mouvements ne sont jamais modifiés, seulement ajoutés ou annulés. Les suppressions sont « douces » (`supprime: true`) pour qu'une synchro ne les fasse pas revenir.
- **Accès au fichier** :
  - application de bureau : lecture et écriture directes, écriture atomique (fichier temporaire puis renommage) ;
  - Chrome / Edge : File System Access (le navigateur demande l'autorisation) ;
  - Firefox, téléphone : exporter / fusionner à la main, dans Réglages › Synchronisation.

## Sécurité

- Le mot de passe n'est jamais stocké. « Se souvenir sur cet appareil » garde la **clé**, non exportable, dans IndexedDB.
- Le **code PIN** (facultatif) verrouille l'ouverture. Après 5 erreurs, le mot de passe est exigé.
- Application de bureau : isolation du contexte, bac à sable, navigation externe bloquée ; le pont `window.bureau` ne lit ou n'écrit que des fichiers `.enveloppes` (plus `prive/donnees-initiales.json`, en lecture).
- **Si le mot de passe est perdu, les données sont irrécupérables.**

## Tester l'application de bureau

`ENVELOPPES_CAPTURE=/tmp/ecran.png ./Enveloppes.AppImage` lance l'application sans fenêtre visible, enregistre une capture de l'écran d'accueil, puis quitte.
