/** Point de tracé : longitude, latitude, altitude (null si inconnue) */
export type Coord = [lon: number, lat: number, ele: number | null]

export interface LatLon {
  lat: number
  lon: number
}

/**
 * Calcule un itinéraire pédestre entre deux points avec BRouter (profil randonnée).
 * Serveur public pour l'instant : https://brouter.de — à remplacer par une instance
 * auto-hébergée sur le VPS si le volume augmente.
 */
export function routeLeg(a: LatLon, b: LatLon, signal?: AbortSignal): Promise<Coord[]> {
  return routeVia([a, b], signal)
}

/** Itinéraire pédestre passant par tous les points, dans l'ordre (une seule requête) */
export async function routeVia(points: LatLon[], signal?: AbortSignal): Promise<Coord[]> {
  const lonlats = points.map(p => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join('|')
  const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=hiking-mountain&alternativeidx=0&format=geojson`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`BRouter : ${res.status}`)
  const data = await res.json()
  const coords = data?.features?.[0]?.geometry?.coordinates as number[][] | undefined
  if (!coords || coords.length < 2) throw new Error('Aucun chemin trouvé')
  return coords.map(c => [c[0]!, c[1]!, c[2] ?? null])
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
