# Règles de calcul

Les exemples utilisent un couple fictif, Alex et Sam, en octobre 2026.
Tous les calculs se font en centimes, avec un arrondi au centime à chaque étape affichée.

## 1. Prorata annuel

Cinq méthodes, au choix dans Réglages › Revenus et prorata :

| Méthode | Base de chacun | Quand |
|---|---|---|
| Salaire net du mois, **par défaut** | net perçu ce mois-ci | recalculé à chaque clôture |
| Salaire brut annuel | brut | une fois par an |
| Net imposable (sans fiscalité) | net imposable annuel | une fois par an |
| Net imposable − impôt juste (avec fiscalité) | net imposable − impôt juste | une fois par an |
| Pourcentages fixés à la main | % saisis | fixe |

### Salaire net du mois

    prorata(personne) = salaire net(personne) / (salaire net(p1) + salaire net(p2))

Les deux salaires se saisissent à la première étape de la clôture, pré-remplis avec ceux du mois
précédent. Une prime, des heures sup. ou une absence changent donc le prorata **de ce mois-là**.
Chaque clôture garde ses salaires et son prorata : l'historique ne bouge pas.

Exemple : Alex 1 500 €, Sam 2 500 € → **37,5 % / 62,5 %**.
Avec un reste de 240 € pour Alex, Sam verse **400 €**.

### Net imposable − impôt juste (annuel)

    revenu disponible = net imposable annuel (primes comprises) − impôt juste
    prorata(personne) = revenu disponible(personne) / somme des revenus disponibles

Exemple : impôt si imposés seuls, Sam 3 200 € et Alex 1 400 € ; impôt du couple 3 100 €.

| | Net imposable | Impôt juste | Disponible | Prorata |
|---|---|---|---|---|
| Sam | 32 000 € | 2 342,86 € | 29 657,14 € | **56,1 %** |
| Alex | 24 000 € | 757,14 € | 23 242,86 € | **43,9 %** |

La méthode « net imposable » ignore l'impôt : 57,1 % / 42,9 %.

Chaque année garde son propre prorata : l'historique ne change pas quand les revenus changent.

### Impôt juste

Repris de l'onglet Impots :

    gain du mariage   = impôt si célibataires (total) − impôt du couple
    impôt juste(p)    = impôt si célibataire(p) − gain du mariage × part des revenus(p)

## 2. Clôture du mois

### a. Enveloppes exceptionnelles actives

    mode prorata : part(p) = montant × prorata(p)
    mode fixe    : part(p) = montant × parts[p] / 100
    remboursement = part de celui qui n'a pas payé, versée à celui qui a payé

Exemple : véto 150 €, payé par Alex, fixe 80 / 20 → Sam rembourse **30 €** à Alex.

### b. Versement du plus gros salaire

Le plus petit revenu saisit son reste du mois. L'autre verse au prorata :

    reste(gros) = reste(petit) × prorata(gros) / prorata(petit)

Exemple, salaires du mois : Alex 240 € → Sam 240 × 62,5 / 37,5 = **400 €**.
(Avec la méthode annuelle « impôt juste », 56,06 % : 306,22 €.) Le prorata est gardé avec 4 décimales.

### c. Perso / commun

    perso(p)  = reste(p) × partPerso(p) / 100
    commun(p) = reste(p) − perso(p)
    épargne commune du mois = commun(p1) + commun(p2)

### d. Vérification des %

Si les % des enveloppes **ouvertes** ne font pas 100, chaque % est réajusté proportionnellement :

    nouveau % = % × 100 / somme des %

L'app montre l'ajustement avant de l'appliquer.

### e. Répartition

    versement(enveloppe) = épargne commune × % / 100

L'écart d'arrondi (quelques centimes) va à l'enveloppe ayant le plus gros %, pour que la somme tombe juste.

## 3. Objectif courant d'une enveloppe

    objectif courant = objectifInitial − somme des dépenses projet
    solde            = versements − dépenses − emprunts ± transferts
    reste à épargner = objectif courant − solde

### Les trois types de sortie

| Type | Solde | Objectif | Reste à épargner |
|---|---|---|---|
| Dépense projet | − X | − X | inchangé |
| Emprunt / dépannage | − X | inchangé | + X |
| Transfert vers une autre enveloppe | − X (et + X sur la cible) | inchangé | + X (et − X sur la cible) |

Exemple : Vacances, objectif 1 000 €, solde 400 €, reste 600 €.
Une dépense projet de 200 € donne : objectif 800 €, solde 200 €, reste **toujours 600 €**.

## 4. Objectif atteint, surplus

Quand `solde ≥ objectif courant` :
- l'enveloppe ne reçoit plus rien (son % passe à 0 tant qu'elle est pleine) ;
- le surplus éventuel est redistribué aux autres enveloppes ouvertes, au prorata de leurs %. S'il n'y en a aucune, il va dans l'enveloppe **Tampon**.

## 5. Réévaluation selon le temps restant

    mois restants = mois entre le mois en cours et l'échéance (au moins 1)
    besoin(e)     = reste à épargner(e) / mois restants
    % proposé(e)  = besoin(e) / somme des besoins × 100

Puis on applique les réglages, dans cet ordre :
1. les enveloppes **verrouillées** gardent leur % ; on répartit ce qui reste ;
2. chaque % ne bouge pas de plus de `variationMax` points ;
3. chaque % respecte son `plancher` ;
4. on ramène le total à 100 (règle 2d).

Exemple en octobre 2026 (ici, la limite de 10 points ne joue pas) :

| Enveloppe | Échéance | Reste | Mois | Besoin | % actuel | % proposé |
|---|---|---|---|---|---|---|
| Vacances | 01/2027 | 600 € | 3 | 200 € | 40 % | 44,5 % |
| Travaux | 08/2027 | 1 500 € | 10 | 150 € | 40 % | 33,3 % |
| Sécurité | 02/2030 | 4 000 € | 40 | 100 € | 20 % | 22,2 % |

### Alerte de faisabilité

    couverture = épargne commune moyenne (3 derniers mois) / somme des besoins

Ici, avec 300 € d'épargne par mois : 300 € / 450 € = **67 %**. Les échéances ne sont pas tenables au rythme actuel.
Pour chaque enveloppe, l'app affiche alors la **date réaliste** :

    date réaliste = aujourd'hui + reste à épargner / (épargne moyenne × % / 100)
