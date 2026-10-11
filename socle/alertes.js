// Alertes affichées sur l'accueil. Chaque bloc peut en fournir.
//
//   ajouterAlertes(() => [{ texte: '…', genre: 'alerte', action: ['Voir', () => aller('#/mois')] }])
//
// genre : « info », « alerte » ou « danger ».

const fournisseurs = [];

export function ajouterAlertes(fournisseur) {
  fournisseurs.push(fournisseur);
}

export function toutesLesAlertes() {
  return fournisseurs.flatMap(f => {
    try {
      return f() || [];
    } catch (erreur) {
      console.error(erreur);
      return [];
    }
  });
}
