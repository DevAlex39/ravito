/** Point de tracé : longitude, latitude, altitude (null si inconnue) */
export type Coord = [lon: number, lat: number, ele: number | null]

export interface LatLon {
  lat: number
  lon: number
}

/**
 * BRouter du VPS : même origine en production (VITE_BROUTER_URL=/brouter, servi par Nginx),
 * appelé directement en développement (le profil « alpas » n'existe que là).
 */
const BROUTER_URL = import.meta.env.VITE_BROUTER_URL || 'https://alpas.alpastudio.fr/brouter'

/** Type de chemins recherché */
export type Terrain = 'route' | 'mixte' | 'sentiers'

/** Réglages du profil BRouter « alpas » (brouter/alpas.brf) selon le terrain : tous évitent les routes à circulation */
const TERRAIN_PARAMS: Record<Terrain, string> = {
  // Bitume privilégié (allure régulière), chemins de terre pénalisés
  route: '&profile:path_preference=0&profile:Offroad_factor=-0.5',
  // Réglages par défaut du profil : léger penchant pour les chemins
  mixte: '',
  // Rues et pistes goudronnées fortement pénalisées : la boucle cherche les sentiers, quitte à s'allonger
  sentiers: '&profile:road_avoidance=3.5&profile:path_preference=4',
}

export interface RouteOptions {
  signal?: AbortSignal
  terrain?: Terrain
}

/** Répartition d'un itinéraire, en mètres */
export interface Surface {
  total: number
  /** Sentiers, chemins et pistes non revêtus */
  trail: number
  /** Routes à circulation (nationales, départementales) */
  bigRoad: number
}

export interface Route {
  coords: Coord[]
  surface: Surface
}

/** Calcule un itinéraire pédestre entre deux points avec BRouter */
export async function routeLeg(a: LatLon, b: LatLon, signal?: AbortSignal): Promise<Coord[]> {
  return (await routeVia([a, b], { signal })).coords
}

/** Itinéraire pédestre passant par tous les points, dans l'ordre (une seule requête) */
export async function routeVia(points: LatLon[], { signal, terrain = 'mixte' }: RouteOptions = {}): Promise<Route> {
  const lonlats = points.map(p => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join('|')
  const url = `${BROUTER_URL}?lonlats=${lonlats}&profile=alpas${TERRAIN_PARAMS[terrain]}&alternativeidx=0&format=geojson`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`BRouter : ${res.status}`)
  const data = await res.json()
  const feature = data?.features?.[0]
  const coords = feature?.geometry?.coordinates as number[][] | undefined
  if (!coords || coords.length < 2) throw new Error('Aucun chemin trouvé')
  return {
    coords: coords.map(c => [c[0]!, c[1]!, c[2] ?? null]),
    surface: surfaceOf(feature?.properties?.messages),
  }
}

const BIG_ROAD = /\bhighway=(trunk|primary|secondary|tertiary)(_link)?\b/
const TRAIL = /\bhighway=(path|footway|track|bridleway|steps)\b/
/** Trottoirs et passages piétons cartographiés à part : ce ne sont pas des sentiers */
const SIDEWALK = /\bfootway=(sidewalk|crossing)\b/
const PAVED = /\bsurface=(asphalt|paved|concrete|paving_stones|sett)\b/

/** Répartition à partir du détail des tronçons de BRouter (une ligne par tronçon : distance, étiquettes OSM…) */
function surfaceOf(messages: unknown): Surface {
  const surface: Surface = { total: 0, trail: 0, bigRoad: 0 }
  if (!Array.isArray(messages) || messages.length < 2) return surface
  const header = messages[0] as string[]
  const iDist = header.indexOf('Distance')
  const iTags = header.indexOf('WayTags')
  for (const row of messages.slice(1) as string[][]) {
    const d = Number(row[iDist]) || 0
    const tags = row[iTags] ?? ''
    surface.total += d
    if (BIG_ROAD.test(tags)) surface.bigRoad += d
    else if (TRAIL.test(tags) && !PAVED.test(tags) && !SIDEWALK.test(tags)) surface.trail += d
  }
  return surface
}

export interface Place {
  name: string
  lat: number
  lon: number
}

/** Recherche d'une ville ou d'un lieu (Nominatim / OpenStreetMap) */
export async function searchPlace(query: string): Promise<Place | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=fr&q=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const [first] = await res.json() as { display_name: string, lat: string, lon: string }[]
  return first ? { name: first.display_name, lat: Number(first.lat), lon: Number(first.lon) } : null
}
