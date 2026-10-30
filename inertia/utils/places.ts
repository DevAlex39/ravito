import type { Poi } from '~/utils/loops'

/** Icône et nom français de chaque type de lieu (valeurs « kind » de la base) */
const KINDS: Record<string, { icon: string, label: string }> = {
  // Patrimoine
  castle: { icon: '🏰', label: 'Château' },
  fort: { icon: '🏰', label: 'Fort' },
  manor: { icon: '🏰', label: 'Manoir' },
  palace: { icon: '🏰', label: 'Palais' },
  city_gate: { icon: '🏛️', label: 'Porte de ville' },
  monument: { icon: '🗿', label: 'Monument' },
  memorial: { icon: '🎖️', label: 'Mémorial' },
  ruins: { icon: '🧱', label: 'Ruines' },
  archaeological_site: { icon: '🏺', label: 'Site archéologique' },
  tomb: { icon: '⚱️', label: 'Tombeau' },
  tower: { icon: '🗼', label: 'Tour' },
  cathedral: { icon: '⛪', label: 'Cathédrale' },
  place_of_worship: { icon: '⛪', label: 'Édifice religieux' },
  church: { icon: '⛪', label: 'Église' },
  museum: { icon: '🖼️', label: 'Musée' },
  gallery: { icon: '🖼️', label: 'Galerie' },
  artwork: { icon: '🎨', label: 'Œuvre d\'art' },
  attraction: { icon: '⭐', label: 'Curiosité' },
  lighthouse: { icon: '🗼', label: 'Phare' },
  bridge: { icon: '🌉', label: 'Pont' },
  square: { icon: '🏙️', label: 'Place' },
  heritage: { icon: '🏛️', label: 'Monument historique' },
  fountain: { icon: '⛲', label: 'Fontaine' },
  lavoir: { icon: '🚰', label: 'Lavoir' },
  townhall: { icon: '🏛️', label: 'Hôtel de ville' },
  theatre: { icon: '🎭', label: 'Théâtre' },
  hospital: { icon: '🏛️', label: 'Ancien hôpital' },
  citywalls: { icon: '🏰', label: 'Remparts' },
  wayside_cross: { icon: '✝️', label: 'Croix' },
  wayside_shrine: { icon: '⛪', label: 'Oratoire' },
  mill: { icon: '🌾', label: 'Moulin' },
  watermill: { icon: '🌾', label: 'Moulin à eau' },
  windmill: { icon: '🌾', label: 'Moulin à vent' },
  // Nature
  waterfall: { icon: '💧', label: 'Cascade' },
  cave_entrance: { icon: '🕳️', label: 'Grotte' },
  peak: { icon: '⛰️', label: 'Sommet' },
  saddle: { icon: '⛰️', label: 'Col' },
  arch: { icon: '🏞️', label: 'Arche naturelle' },
  gorge: { icon: '🏞️', label: 'Gorges' },
  volcano: { icon: '🌋', label: 'Volcan' },
  spring: { icon: '💧', label: 'Source' },
  rock: { icon: '🏞️', label: 'Rocher' },
  stone: { icon: '🏞️', label: 'Pierre remarquable' },
  cliff: { icon: '🧗', label: 'Falaise' },
  beach: { icon: '🏖️', label: 'Plage' },
  viewpoint: { icon: '👀', label: 'Point de vue' },
  park: { icon: '🌳', label: 'Parc' },
  garden: { icon: '🌷', label: 'Jardin' },
}

/** Familles proposées dans « Plus de choix » : quelques cases simples plutôt que 35 types */
export interface KindGroup {
  id: string
  category: 'patrimoine' | 'nature'
  label: string
  kinds: string[]
}

export const KIND_GROUPS: KindGroup[] = [
  { id: 'chateaux', category: 'patrimoine', label: '🏰 Châteaux et forts', kinds: ['castle', 'fort', 'manor', 'palace', 'city_gate'] },
  { id: 'religieux', category: 'patrimoine', label: '⛪ Églises et chapelles', kinds: ['place_of_worship', 'cathedral', 'church'] },
  { id: 'vestiges', category: 'patrimoine', label: '🧱 Ruines et vestiges', kinds: ['ruins', 'archaeological_site', 'tomb'] },
  { id: 'monuments', category: 'patrimoine', label: '🗿 Monuments et bâtiments', kinds: ['monument', 'memorial', 'tower', 'lighthouse', 'artwork', 'heritage', 'townhall', 'theatre', 'hospital', 'citywalls', 'mill', 'watermill', 'windmill'] },
  { id: 'fontaines', category: 'patrimoine', label: '⛲ Fontaines et lavoirs', kinds: ['fountain', 'lavoir'] },
  { id: 'musees', category: 'patrimoine', label: '🖼️ Musées', kinds: ['museum', 'gallery'] },
  { id: 'ponts', category: 'patrimoine', label: '🌉 Ponts et places', kinds: ['bridge', 'square'] },
  { id: 'eau', category: 'nature', label: '💧 Cascades et sources', kinds: ['waterfall', 'spring'] },
  { id: 'grottes', category: 'nature', label: '🕳️ Grottes', kinds: ['cave_entrance'] },
  { id: 'sommets', category: 'nature', label: '⛰️ Sommets et cols', kinds: ['peak', 'saddle', 'volcano'] },
  { id: 'roches', category: 'nature', label: '🏞️ Gorges et rochers', kinds: ['gorge', 'arch', 'cliff', 'rock', 'stone'] },
  { id: 'vues', category: 'nature', label: '👀 Points de vue', kinds: ['viewpoint'] },
  { id: 'parcs', category: 'nature', label: '🌳 Parcs et jardins', kinds: ['park', 'garden'] },
  { id: 'plages', category: 'nature', label: '🏖️ Plages', kinds: ['beach'] },
]

export function kindOf(poi: Pick<Poi, 'kind' | 'category'>): { icon: string, label: string } {
  return KINDS[poi.kind] ?? (poi.category === 'nature' ? { icon: '🌿', label: 'Site naturel' } : { icon: '📍', label: 'Lieu à voir' })
}

/** Fiche d'un lieu, complétée par Wikipédia (résumé, photo) ou à défaut Wikidata */
export interface PlaceDetails {
  description: string | null
  /** Miniature (Wikimedia Commons) */
  image: string | null
  wikipedia: string | null
  osm: string
}

const cache = new Map<string, Promise<PlaceDetails>>()

/** Récupère la fiche une seule fois par lieu ; sans réseau ou sans Wikidata, seul le lien OpenStreetMap reste */
export function placeDetails(poi: Pick<Poi, 'wikidata' | 'osmKey'>): Promise<PlaceDetails> {
  const key = poi.wikidata ?? poi.osmKey
  if (!cache.has(key)) cache.set(key, loadDetails(poi))
  return cache.get(key)!
}

function osmUrl(osmKey: string) {
  const type = { n: 'node', w: 'way', r: 'relation' }[osmKey[0]!] ?? 'node'
  return `https://www.openstreetmap.org/${type}/${osmKey.slice(1)}`
}

async function loadDetails({ wikidata, osmKey }: Pick<Poi, 'wikidata' | 'osmKey'>): Promise<PlaceDetails> {
  const details: PlaceDetails = { description: null, image: null, wikipedia: null, osm: osmUrl(osmKey) }
  if (!wikidata) return details
  try {
    // origin=* : autorise l'appel depuis le navigateur
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidata}&props=descriptions|claims|sitelinks/urls&languages=fr&sitefilter=frwiki&format=json&origin=*`
    const json = await fetch(url).then(r => r.json()) as {
      entities?: Record<string, {
        descriptions?: { fr?: { value: string } }
        claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] }
        sitelinks?: { frwiki?: { title: string, url: string } }
      }>
    }
    const entity = json.entities?.[wikidata]
    details.description = entity?.descriptions?.fr?.value ?? null
    const file = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (file) details.image = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`

    const article = entity?.sitelinks?.frwiki
    if (article) {
      details.wikipedia = article.url
      // Le résumé de l'article est plus parlant que la courte description Wikidata
      const summary = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.title)}`)
        .then(r => (r.ok ? r.json() : null)) as { extract?: string, thumbnail?: { source: string } } | null
      if (summary?.extract) details.description = summary.extract
      details.image ??= summary?.thumbnail?.source ?? null
    }
  }
  catch {
    // Wikipédia injoignable : la fiche garde le nom, le type et le lien OpenStreetMap
  }
  return details
}
