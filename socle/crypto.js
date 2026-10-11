// Chiffrement des données avec WebCrypto, intégré au navigateur.
//
// Format d'un fichier .enveloppes :
//   « ENV1 » (4 octets) | sel (16) | iv (12) | données JSON compressées puis chiffrées (AES-GCM)
//
// La clé est dérivée du mot de passe (PBKDF2). Elle n'est jamais exportable.

const SIGNATURE = new TextEncoder().encode('ENV1');
const ITERATIONS = 600000;

export function nouveauSel() {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriverCle(motDePasse, sel) {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations: ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function chiffrer(donnees, cle, sel) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clair = await compresser(new TextEncoder().encode(JSON.stringify(donnees)));
  const secret = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, clair));
  return concatener(SIGNATURE, sel, iv, secret);
}

/** Lève une erreur si le mot de passe (la clé) est faux ou le fichier abîmé. */
export async function dechiffrer(octets, cle) {
  verifierSignature(octets);
  const iv = octets.slice(20, 32);
  const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cle, octets.slice(32));
  return JSON.parse(new TextDecoder().decode(await decompresser(new Uint8Array(clair))));
}

/** Le sel est lisible sans mot de passe : il sert à dériver la clé. */
export function lireSel(octets) {
  verifierSignature(octets);
  return octets.slice(4, 20);
}

/** Empreinte d'un code PIN, pour le comparer sans le stocker en clair. */
export async function empreinte(texte) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('enveloppes:' + texte));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function verifierSignature(octets) {
  if (!SIGNATURE.every((b, i) => octets[i] === b)) throw new Error("Ce n'est pas un fichier Enveloppes.");
}

function concatener(...morceaux) {
  const total = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
  let position = 0;
  for (const m of morceaux) { total.set(m, position); position += m.length; }
  return total;
}

async function compresser(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

async function decompresser(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
