/**
 * Pictogrammes au trait (24 × 24, contour seul, couleur du texte), dessinés dans le style de Lucide.
 * Chaque entrée est le contenu d'un <svg viewBox="0 0 24 24">, utilisé par components/icon.vue et la carte.
 */
export const ICONS = {
  // Lieux : patrimoine
  castle: '<path d="M4 21V9h3V6h2v3h2V5h2v4h2V6h2v3h3v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  landmark: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z"/>',
  church: '<path d="M12 2v4M10 4h4M18 22V10l-6-4-6 4v12M2 22h20M10 22v-4a2 2 0 0 1 4 0v4"/>',
  museum: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
  monument: '<path d="M10 3h4l1 15H9z"/><path d="M6 21h12M8 18h8"/>',
  ruins: '<path d="M3 21h18M5 21V10M9 21V6M13 21v-8M17 21V9M4 10h2M8 6h2M16 9h2"/>',
  tower: '<path d="M8 21V8l4-5 4 5v13M6 21h12M10 12h4"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  artwork: '<path d="M12 2a10 10 0 0 0 0 20c1 0 1.5-.7 1.5-1.5 0-.4-.2-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a6 6 0 0 0 6-6c0-5-4.5-9-10-9z"/><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/>',
  bridge: '<path d="M2 16h20M4 16v4M20 16v4M2 10c4 0 6 6 10 6s6-6 10-6M8 13v3M16 13v3"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>',
  fountain: '<path d="M12 4v6M8 7c0-2 2-3 4-3s4 1 4 3M4 14h16M6 14v2a6 3 0 0 0 12 0v-2M9 21h6M12 19v2"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/>',
  theatre: '<path d="M3 4h10v6a5 5 0 0 1-10 0z"/><path d="M6 8h1M9 8h1M6 11c1 1 3 1 4 0"/><path d="M14 9h7v5a5 5 0 0 1-8.5 3.5"/><path d="M16 12h1M18.5 12h.5"/>',
  house: '<path d="M3 10l9-7 9 7v11H3z"/><path d="M9 21v-6h6v6"/>',
  cross: '<path d="M12 2v20M7 7h10"/>',
  mill: '<path d="M12 11 5 4M12 11l7-7M12 11l-7 7M12 11l7 7"/><path d="M10 22l1-8h2l1 8"/>',
  // Lieux : nature
  waterfall: '<path d="M4 3h16M7 3v10M12 3v14M17 3v10"/><path d="M3 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0"/>',
  cave: '<path d="M2 20h20M4 20C4 11 8 5 12 5s8 6 8 15"/><path d="M9 20c0-4 1.5-7 3-7s3 3 3 7"/>',
  mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  rock: '<path d="M3 19 6 11l4-3 5 2 4 4 2 5z"/>',
  viewpoint: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M10 16h4M4 13V6a2 2 0 0 1 4 0v4M16 10V6a2 2 0 0 1 4 0v7"/>',
  tree: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7M9 22h6"/>',
  flower: '<circle cx="12" cy="8" r="3"/><path d="M12 11v11M12 18c-3 0-5-2-5-4 3 0 5 2 5 4zM12 16c3 0 5-2 5-4-3 0-5 2-5 4z"/>',
  beach: '<path d="M12 12v9M3 12a9 9 0 0 1 18 0z"/><path d="M3 21h18"/>',
  toilets: '<circle cx="7" cy="4" r="2"/><circle cx="17" cy="4" r="2"/><path d="M5 22v-7H4V9h6v6H9v7M15 22v-5h-2l2-8h4l2 8h-2v5"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
  // Interface
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  locate: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  arrow: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  printer: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  sheet: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/>',
  band: '<rect x="3" y="8" width="18" height="8" rx="3"/><path d="M7 12h2M11 12h2M15 12h2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  thumb: '<path d="M7 10v12M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>',
} as const

export type IconName = keyof typeof ICONS

/** SVG complet, pour les endroits hors Vue (infobulles et marqueurs de la carte) */
export function iconSvg(name: IconName, size = 16): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
}
