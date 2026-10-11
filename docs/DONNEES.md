# Données

Tous les montants sont en **centimes** (entiers) : `12345` = 123,45 €.
Les dates sont au format ISO : `2026-10-04` pour un jour, `2027-01` pour un mois.
Chaque enregistrement a un `id` unique et une date `modifieLe` (utile pour la synchronisation).
Un élément supprimé reste présent avec `supprime: true`.

Les réglages propres à un appareil (clé mémorisée, code PIN, fichier de synchro, thème)
sont stockés à part, en local, et ne sont jamais synchronisés.

## Schéma

```js
{
  version: 1,

  // Les deux personnes du foyer. Le pseudo s'affiche partout.
  personnes: [
    { id: "p1", pseudo: "Alex", couleur: "#C084FC" },
    { id: "p2", pseudo: "Sam",  couleur: "#6D4AFF" }
  ],

  // Revenus par année : base du prorata. L'impôt juste est calculé, pas stocké.
  revenus: {
    "2026": {
      p1: { brut: 0, netImposable: 2400000, impotSeul: 140000 },
      p2: { brut: 0, netImposable: 3200000, impotSeul: 320000 },
      impotCouple: 310000,
      estime: true                           // à corriger avec l'avis d'imposition
    }
  },

  reglages: {
    methodeProrata: "net-mensuel",           // "net-mensuel" | "brut" | "net-imposable" | "net-impot-juste" | "manuel"
    derniersSalaires: { p1: 150000, p2: 250000 },  // nets du dernier mois, pré-remplis à la clôture suivante
    prorataManuel: { p1: 50, p2: 50 },       // utilisé en mode "manuel"
    partPerso: { p1: 20, p2: 20 },           // % du reste qui va au livret perso
    reevaluation: {
      mode: "suggestion",                    // "manuel" | "suggestion" | "auto"
      frequence: "mensuelle",                // "mensuelle" | "trimestrielle"
      variationMax: 10                       // points de % max par réévaluation
    },
    surplus: "redistribuer",                 // ou "tampon"
    seuilAlerte: 100                         // alerte si la couverture des besoins passe sous ce %
  },

  categories: [
    { id: "c1", nom: "Vacances", couleur: "#A78BFA" }
  ],

  // Dépenses partagées ponctuelles (ex. vétérinaire)
  exceptionnelles: [
    {
      id: "x1", nom: "Vétérinaire", actif: true,
      mode: "fixe",                          // ou "prorata"
      parts: { p1: 80, p2: 20 },             // utilisé seulement en mode "fixe"
      payeur: "p1"                           // qui paie d'habitude (modifiable à chaque clôture)
    }
  ],

  // Enveloppes projets
  enveloppes: [
    {
      id: "e1", categorie: "c1", nom: "Vacances",
      objectifInitial: 100000,               // l'objectif courant se calcule (voir CALCULS.md)
      echeance: "2027-01",
      pourcentage: 30,
      statut: "ouvert",                      // "ouvert" | "pause" | "ferme" | "archive"
      plancher: 0,                           // % minimum lors d'une réévaluation
      verrouille: false,                     // % jamais réévalué
      recurrente: false                      // repart pour un an une fois l'objectif atteint
    },
    // Enveloppe spéciale, toujours présente : surplus, arrondis, corrections
    { id: "tampon", nom: "Tampon", special: "tampon", statut: "ouvert", verrouille: true, … }
  ],

  // Journal des mouvements : on ajoute, on ne modifie jamais
  mouvements: [
    {
      id: "m1", date: "2026-10-04", enveloppe: "e1",
      type: "versement",                     // "versement" | "depense" | "emprunt" | "transfert"
      montant: 12000,                        // toujours positif, le type donne le sens
      vers: null,                            // enveloppe cible pour un transfert
      note: "",
      cloture: "k12",                        // clôture d'origine, si le mouvement en vient
      annule: false
    }
  ],

  // Une clôture par mois : ce qui a été saisi et calculé
  clotures: [
    {
      id: "k12", date: "2026-10-04", mois: "2026-10",
      prorata: { p1: 37.5, p2: 62.5 },
      salaires: { p1: 150000, p2: 250000 },  // avec la méthode « net-mensuel », sinon null
      reste:   { p1: 24000, p2: 40000 },
      perso:   { p1: 4800,  p2: 8000 },
      commun:  { p1: 19200, p2: 32000 },
      exceptionnelles: [
        { id: "x1", montant: 15000, payeur: "p1", remboursement: { de: "p2", a: "p1", montant: 3000 } }
      ],
      annulee: false
    }
  ],

  // Comparaisons avec le solde réel du livret commun
  controles: [
    { id: "r1", date: "2026-10-11", soldeReel: 520000, totalEnveloppes: 520000 }
  ]
}
```

## Import du tableur

Le script `outils/import-ods.py` (Python, sans dépendance) lit le `.ods` **une seule fois** et produit `prive/donnees-initiales.json`.
Au premier lancement, le guide propose de charger ce fichier, puis le chiffre avec ton mot de passe. Le JSON en clair peut ensuite être supprimé.

### Correspondance

| Tableur | Application |
|---|---|
| Home › Calcul des Budgets (C9, D9) | `personnes` (pseudos réglés en tête du script) et `reglages.derniersSalaires` |
| Impots › salaires et impôt juste | `revenus["2025"]` (réel) et `revenus["2026"]` (estimé) |
| Home › % perso (C11, D11) | `reglages.partPerso` |
| Home › Vétérinaire (80 / 20) | `exceptionnelles` : Vétérinaire, mode fixe |
| Home › Définition des Budgets | `enveloppes` + `categories` |
| Data (une ligne par mois) | `clotures` |
| Data_Details (une ligne par mouvement) | `mouvements` |
| Data_Epargne | non repris (total de l'épargne perso, pas du livret commun) |
| Epargne Perso, PEE, Impots (détails) | plus tard : bloc Patrimoine |

### Corrections faites à l'import

| Problème dans le tableur | Traitement |
|---|---|
| Lien enveloppe ↔ mouvement par le **nom** | Chaque nom est rattaché à un `id` d'enveloppe |
| Dates `04-10-2026` et `04/10/2026` | Tout en `2026-10-04` |
| % écrits `20`, `20%`, `0,2` | Tout en nombre : `20` |
| Montants à 13 décimales | Arrondis au centime |
| Mouvement négatif | `depense` par défaut ; `transfert` si un mouvement de même montant, de signe opposé, existe le même jour |
| Objectifs réduits à la main dans une formule | `objectifInitial` est recalculé pour que l'objectif courant soit **identique** au tableur |
| Deux clôtures pour le même mois | Importées toutes les deux, signalées pour vérification |
| Mouvements rattachés à un nom absent du tableau des budgets | Enveloppe recréée sous ce nom, **en pause** |
| Montants à 13 décimales cumulés | Arrondi cumulé : chaque solde retombe exactement sur celui du tableur |

Le fichier contient aussi `_controleImport` (soldes du tableur) et `_rapportImport` : le guide affiche
un **récapitulatif de contrôle**, puis les efface.
