// Icônes en SVG, dessinées en traits (24 × 24). Ajouter une icône = ajouter une ligne.

const TRACES = {
  accueil: 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  mois: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  historique: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2',
  reglages: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  plus: 'M12 5v14M5 12h14',
  sync: 'M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4',
  verrou: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  enveloppe: 'M3 6h18v12H3zM3 6l9 7 9-7',
  fleche: 'M9 6l6 6-6 6',
  retour: 'M15 6l-6 6 6 6',
  alerte: 'M12 4 2 20h20zM12 10v4M12 17v.5',
  coche: 'M5 12l5 5 9-10',
  balance: 'M12 4v16M5 20h14M4 8h16M7 8l-3 6h6zM17 8l-3 6h6z',
};

export function icone(nom, taille = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', taille);
  svg.setAttribute('height', taille);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'svg-icone');
  const trace = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trace.setAttribute('d', TRACES[nom] || '');
  svg.append(trace);
  return svg;
}
