// Fichiers locaux : télécharger un export, choisir un fichier à importer.

/** Propose d'enregistrer un fichier (octets ou texte). */
export function telecharger(nom, contenu, type = 'application/octet-stream') {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
}

/** Ouvre le sélecteur de fichiers. Renvoie un File, ou null si annulé. */
export function choisirFichierLocal(accept = '') {
  return new Promise(reponse => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = accept;
    champ.onchange = () => reponse(champ.files[0] || null);
    champ.oncancel = () => reponse(null);
    champ.click();
  });
}

export async function lireOctets(fichier) {
  return new Uint8Array(await fichier.arrayBuffer());
}
