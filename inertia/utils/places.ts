import type { Poi } from '~/utils/loops'
import type { IconName } from '~/utils/icons'

/** Pictogramme (utils/icons.ts) et nom français de chaque type de lieu (valeurs « kind » de la base) */
const KINDS: Record<string, { icon: IconName, label: string }> = {
  // Patrimoine
  castle: { icon: 'castle', label: 'Château' },
  fort: { icon: 'castle', label: 'Fort' },
  manor: { icon: 'house', label: 'Manoir' },
  palace: { icon: 'castle', label: 'Palais' },
  city_gate: { icon: 'landmark', label: 'Porte de ville' },
  monument: { icon: 'monument', label: 'Monument' },
  memorial: { icon: 'monument', label: 'Mémorial' },
  ruins: { icon: 'ruins', label: 'Ruines' },
  archaeological_site: { icon: 'ruins', label: 'Site archéologique' },
  tomb: { icon: 'monument', label: 'Tombeau' },
  tower: { icon: 'tower', label: 'Tour' },
  cathedral: { icon: 'church', label: 'Cathédrale' },
  place_of_worship: { icon: 'church', label: 'Édifice religieux' },
  church: { icon: 'church', label: 'Église' },
  museum: { icon: 'museum', label: 'Musée' },
  gallery: { icon: 'museum', label: 'Galerie' },
  artwork: { icon: 'artwork', label: 'Œuvre d\'art' },
  attraction: { icon: 'star', label: 'Curiosité' },
  lighthouse: { icon: 'tower', label: 'Phare' },
  bridge: { icon: 'bridge', label: 'Pont' },
  square: { icon: 'square', label: 'Place' },
  heritage: { icon: 'landmark', label: 'Monument historique' },
  fountain: { icon: 'fountain', label: 'Fontaine' },
  lavoir: { icon: 'droplet', label: 'Lavoir' },
  townhall: { icon: 'landmark', label: 'Hôtel de ville' },
  theatre: { icon: 'theatre', label: 'Théâtre' },
  hospital: { icon: 'landmark', label: 'Ancien hôpital' },
  citywalls: { icon: 'castle', label: 'Remparts' },
  wayside_cross: { icon: 'cross', label: 'Croix' },
  wayside_shrine: { icon: 'church', label: 'Oratoire' },
  mill: { icon: 'mill', label: 'Moulin' },
  watermill: { icon: 'mill', label: 'Moulin à eau' },
  windmill: { icon: 'mill', label: 'Moulin à vent' },
  // Nature
  waterfall: { icon: 'waterfall', label: 'Cascade' },
  cave_entrance: { icon: 'cave', label: 'Grotte' },
  peak: { icon: 'mountain', label: 'Sommet' },
  saddle: { icon: 'mountain', label: 'Col' },
  arch: { icon: 'rock', label: 'Arche naturelle' },
  gorge: { icon: 'rock', label: 'Gorges' },
  volcano: { icon: 'mountain', label: 'Volcan' },
  spring: { icon: 'droplet', label: 'Source' },
  rock: { icon: 'rock', label: 'Rocher' },
  stone: { icon: 'rock', label: 'Pierre remarquable' },
  cliff: { icon: 'rock', label: 'Falaise' },
  beach: { icon: 'beach', label: 'Plage' },
  viewpoint: { icon: 'viewpoint', label: 'Point de vue' },
  park: { icon: 'tree', label: 'Parc' },
  garden: { icon: 'flower', label: 'Jardin' },
}

/** Familles proposées dans « Plus de choix » : quelques cases simples plutôt que 35 types */
export interface KindGroup {
  id: string
  category: 'patrimoine' | 'nature'
  icon: IconName
  label: string
  kinds: string[]
}

export const KIND_GROUPS: KindGroup[] = [
  { id: 'chateaux', category: 'patrimoine', icon: 'castle', label: 'Châteaux et forts', kinds: ['castle', 'fort', 'manor', 'palace', 'city_gate'] },
  { id: 'religieux', category: 'patrimoine', icon: 'church', label: 'Églises et chapelles', kinds: ['place_of_worship', 'cathedral', 'church'] },
  { id: 'vestiges', category: 'patrimoine', icon: 'ruins', label: 'Ruines et vestiges', kinds: ['ruins', 'archaeological_site', 'tomb'] },
  { id: 'monuments', category: 'patrimoine', icon: 'monument', label: 'Monuments et bâtiments', kinds: ['monument', 'memorial', 'tower', 'lighthouse', 'artwork', 'heritage', 'townhall', 'theatre', 'hospital', 'citywalls', 'mill', 'watermill', 'windmill'] },
  { id: 'fontaines', category: 'patrimoine', icon: 'fountain', label: 'Fontaines et lavoirs', kinds: ['fountain', 'lavoir'] },
  { id: 'musees', category: 'patrimoine', icon: 'museum', label: 'Musées', kinds: ['museum', 'gallery'] },
  { id: 'ponts', category: 'patrimoine', icon: 'bridge', label: 'Ponts et places', kinds: ['bridge', 'square'] },
  { id: 'eau', category: 'nature', icon: 'waterfall', label: 'Cascades et sources', kinds: ['waterfall', 'spring'] },
  { id: 'grottes', category: 'nature', icon: 'cave', label: 'Grottes', kinds: ['cave_entrance'] },
  { id: 'sommets', category: 'nature', icon: 'mountain', label: 'Sommets et cols', kinds: ['peak', 'saddle', 'volcano'] },
  { id: 'roches', category: 'nature', icon: 'rock', label: 'Gorges et rochers', kinds: ['gorge', 'arch', 'cliff', 'rock', 'stone'] },
  { id: 'vues', category: 'nature', icon: 'viewpoint', label: 'Points de vue', kinds: ['viewpoint'] },
  { id: 'parcs', category: 'nature', icon: 'tree', label: 'Parcs et jardins', kinds: ['park', 'garden'] },
  { id: 'plages', category: 'nature', icon: 'beach', label: 'Plages', kinds: ['beach'] },
]

export function kindOf(poi: Pick<Poi, 'kind' | 'category'>): { icon: IconName, label: string } {
  return KINDS[poi.kind] ?? (poi.category === 'nature' ? { icon: 'leaf', label: 'Site naturel' } : { icon: 'pin', label: 'Lieu à voir' })
}

/** Fiche d'un lieu, complétée par Wikipédia (résumé, photo) ou à défaut Wikidata */
export interface PlaceDetails {
  description: string | null
  /** Miniature (Wikimedia Commons) */
  image: string | null
  /** Auteur et licence de la photo, à afficher avec elle (obligation des licences Creative Commons) */
  credit: PhotoCredit | null
  /** Le texte vient du résumé Wikipédia (licence CC BY-SA, à citer) */
  fromWikipedia: boolean
  wikipedia: string | null
  /** Lien vers l'objet OpenStreetMap ; null pour un lieu venu de l'IGN ou de Wikidata */
  osm: string | null
  /** Lieu venu de la BD TOPO de l'IGN (à créditer) */
  fromIgn: boolean
}

export interface PhotoCredit {
  author: string | null
  license: string | null
  /** Page du fichier sur Wikimedia Commons (auteur complet, licence, original) */
  page: string
}

/** Nom du fichier Commons d'une miniature (« …/thumb/a/ab/Pont.jpg/320px-Pont.jpg » → « Pont.jpg ») */
function commonsFile(url: string): string | null {
  const m = url.match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/)
  return m ? decodeURIComponent(m[1]!) : null
}

/** Auteur et licence d'un fichier Commons ; sans réponse, le lien vers sa page suffit à créditer */
async function photoCredit(file: string): Promise<PhotoCredit> {
  const title = `File:${file.replace(/ /g, '_')}`
  const credit: PhotoCredit = { author: null, license: null, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}` }
  try {
    const json = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`)
      .then(r => r.json()) as { query?: { pages?: Record<string, { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] }> } }
    const meta = Object.values(json.query?.pages ?? {})[0]?.imageinfo?.[0]?.extmetadata
    // L'auteur est souvent un lien HTML : on n'en garde que le texte
    const text = (html?: string) => {
      if (!html) return null
      const doc = new DOMParser().parseFromString(html, 'text/html')
      return doc.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || null
    }
    credit.author = text(meta?.Artist?.value)
    credit.license = text(meta?.LicenseShortName?.value)
  }
  catch {
    // Commons injoignable : on garde le lien vers la page du fichier
  }
  return credit
}

const cache = new Map<string, Promise<PlaceDetails>>()

/** Récupère la fiche une seule fois par lieu ; sans réseau ou sans Wikidata, seul le lien OpenStreetMap reste */
export function placeDetails(poi: Pick<Poi, 'wikidata' | 'osmKey'>): Promise<PlaceDetails> {
  const key = poi.wikidata ?? poi.osmKey
  if (!cache.has(key)) cache.set(key, loadDetails(poi))
  return cache.get(key)!
}

function osmUrl(osmKey: string) {
  // « ign:… », « wd:… » : lieux venus d'ailleurs, pas d'objet OpenStreetMap à montrer
  if (osmKey.includes(':')) return null
  const type = { n: 'node', w: 'way', r: 'relation' }[osmKey[0]!] ?? 'node'
  return `https://www.openstreetmap.org/${type}/${osmKey.slice(1)}`
}

async function loadDetails({ wikidata, osmKey }: Pick<Poi, 'wikidata' | 'osmKey'>): Promise<PlaceDetails> {
  const details: PlaceDetails = { description: null, image: null, credit: null, fromWikipedia: false, wikipedia: null, osm: osmUrl(osmKey), fromIgn: osmKey.startsWith('ign:') }
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
    let photoFile: string | null = file ?? null
    if (file) details.image = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`

    const article = entity?.sitelinks?.frwiki
    if (article) {
      details.wikipedia = article.url
      // Le résumé de l'article est plus parlant que la courte description Wikidata
      const summary = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.title)}`)
        .then(r => (r.ok ? r.json() : null)) as { extract?: string, thumbnail?: { source: string } } | null
      if (summary?.extract) {
        details.description = summary.extract
        details.fromWikipedia = true
      }
      if (!details.image && summary?.thumbnail?.source) {
        details.image = summary.thumbnail.source
        photoFile = commonsFile(summary.thumbnail.source)
      }
    }
    // Photo sans fichier Commons identifiable (rare) : on ne l'affiche pas faute de pouvoir la créditer
    if (details.image && !photoFile) details.image = null
    if (photoFile) details.credit = await photoCredit(photoFile)
  }
  catch {
    // Wikipédia injoignable : la fiche garde le nom, le type et le lien OpenStreetMap
  }
  return details
}
