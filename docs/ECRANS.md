# Écrans

Navigation par une barre en bas (mobile) ou sur le côté (ordinateur) :
**Accueil · Mois · Historique · Réglages**.

## Guide du premier lancement

Il s'affiche une seule fois, et on peut le relancer depuis Réglages. Chaque étape tient sur un écran, avec Retour / Suivant.

1. **Bienvenue** : trois phrases pour expliquer le principe, puis un choix :
   - « Commencer avec mes données » (charge `prive/donnees-initiales.json`, trouvé à côté de l'AppImage, ou à choisir) ;
   - « Ouvrir un fichier .enveloppes existant » (deuxième appareil) ;
   - « Partir de zéro ».
2. **Mot de passe** du fichier, saisi deux fois, avec un avertissement clair : perdu = irrécupérable. Le code PIN se règle ensuite dans Réglages › Sécurité.
3. **Personnes** : pseudo et couleur de chacun (pré-remplis avec les données importées).
4. **Revenus de l'année** : net imposable et impôt juste, ou « estimer à partir du salaire mensuel ». Le prorata s'affiche en direct.
5. **Part livret perso** de chacun.
6. **Enveloppes exceptionnelles** : liste, mode prorata ou fixe, actif ou non.
7. **Enveloppes projets** : liste avec objectif, échéance, % ; total des % affiché.
8. **Fichier de synchronisation** : choisir où enregistrer le `.enveloppes`.
9. **Récapitulatif** : avec des données importées, le tableau de contrôle tableur / app.

Avec l'import, les étapes 3 à 7 sont déjà remplies : on les parcourt pour vérifier.

## Accueil

- En haut : épargne commune totale, et une alerte s'il y en a (clôture à faire, échéances non tenables, écart avec le solde réel).
- Les **enveloppes ouvertes** en cartes : nom, catégorie (couleur), barre de progression, solde / objectif, échéance, date réaliste si elle est en retard.
- Repliés en dessous : En pause, Fermées. Les archivées sont dans Historique.
- Bouton flottant **+** : versement, dépense ou transfert rapide.

## Détail d'une enveloppe

- Objectif, solde, reste à épargner, %, échéance, statut (modifiables).
- Historique des mouvements, du plus récent au plus ancien, avec une note éventuelle.
- Actions : Ajouter · Dépense projet · Emprunt · Transfert · Changer de statut.

## Mois (clôture)

Un assistant en étapes, qui reprend les macros du tableur :

1. **Exceptionnelles** : un montant et un payeur par enveloppe active (0 accepté). Le remboursement s'affiche.
2. **Reste du mois** du plus petit revenu. Le versement de l'autre s'affiche.
3. **Perso / commun** : tableau des 4 virements.
4. **%** : vérification à 100 et, selon le réglage, la proposition de réévaluation (avant / après).
5. **Répartition** dans les enveloppes, avec les surplus éventuels.
6. **Récapitulatif** de tous les virements à faire, puis **Confirmer**. Rien n'est enregistré avant.

Une clôture peut être **annulée** depuis Historique : ses mouvements sont marqués annulés, et non supprimés.

## Historique

- Les clôtures mois par mois, et le détail de chacune.
- Tous les mouvements, filtrables par enveloppe et par type.
- Les enveloppes archivées.

## Contrôle (#/controle)

Depuis l'alerte de l'accueil : on saisit le solde réel du livret commun. L'écart avec le total des enveloppes est affiché, et peut être corrigé par un mouvement sur le Tampon.

## Verrou (#/verrou)

Code PIN si défini, sinon mot de passe. Bouton cadenas dans l'en-tête pour verrouiller.

## Réglages

Personnes · Revenus et prorata · Part livret perso · Enveloppes exceptionnelles · Réévaluation des % (et surplus, seuil d'alerte) · Catégories · Sécurité · Synchronisation et sauvegardes · Apparence · Guide.
