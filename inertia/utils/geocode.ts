/**
 * Recherche d'adresses pour le choix du départ.
 * - France : Base Adresse Nationale (Géoplateforme de l'IGN) : villes, adresses, codes postaux,
 *   gratuite, sans clé, pensée pour l'auto-complétion ;
 * - ailleurs : Nominatim (OpenStreetMap), seulement à la validation (ses conditions interdisent
 *   l'auto-complétion).
 */

export interface PlaceSuggestion {
  /** Texte affiché et remis dans le champ (ex. « Gredisans (39290) », « 12 Rue de Besançon 39100 Dole ») */
  label: string
  /** Précision sous le libellé (ex. « Jura, Bourgogne-Franche-Comté ») */
  detail: string
  /** Nom court du départ (ville ou rue) */
  name: string
  lat: number
  lon: number
  /** Commune : son point dans la BAN est le milieu du territoire, pas le centre-ville (voir townCenter) */
  town?: { name: string }
}

const BAN_URL = 'https://data.geopf.fr/geocodage/search'

interface BanFeature {
  geometry: { coordinates: [number, number] }
  properties: { label: string, name: string, type: string, postcode?: string, city?: string, context?: string, score: number }
}

function fromBan(f: BanFeature): PlaceSuggestion {
  const p = f.properties
  const [lon, lat] = f.geometry.coordinates
  // Le contexte commence par le numéro de département, déjà donné par le code postal
  const detail = (p.context ?? '').replace(/^\d+[AB]?, /, '')
  if (p.type === 'municipality') {
    return { label: p.postcode ? `${p.name} (${p.postcode})` : p.name, detail, name: p.name, lat, lon, town: { name: p.name } }
  }
  return { label: p.label, detail, name: p.city ? `${p.name}, ${p.city}` : p.name, lat, lon }
}

/** Suggestions pendant la frappe (France uniquement), au moins 3 caractères */
export async function suggestPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const search = async (filter: string, limit: number) => {
    const res = await fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&autocomplete=1&limit=${limit}${filter}`, { signal })
    return res.ok ? ((await res.json()) as { features?: BanFeature[] }).features ?? [] : []
  }
  // Les communes d'abord (« dol » → Dole, « besan » → Besançon : la recherche générale les noie parmi
  // les rues), sauf quand on tape une adresse (« 12 rue… »)
  const isAddress = /^\d+\s*\D/.test(q)
  const [towns, all] = await Promise.all([isAddress ? [] : search('&type=municipality', 3), search('', 6)])
  const seen = new Set<string>()
  return [...towns, ...all].map(fromBan).filter((p) => {
    if (seen.has(p.label)) return false
    seen.add(p.label)
    return true
  }).slice(0, 6)
}

/**
 * Lieu tapé puis validé sans choisir de suggestion : la meilleure adresse française si elle est
 * convaincante, sinon Nominatim (lieux à l'étranger, noms de sites…).
 */
export async function searchPlace(query: string): Promise<PlaceSuggestion | null> {
  const q = query.trim()
  try {
    const res = await fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=1`)
    const [first] = res.ok ? ((await res.json()) as { features?: BanFeature[] }).features ?? [] : []
    if (first && first.properties.score >= 0.6) return townCenter(fromBan(first))
  }
  catch {
    // Géoplateforme indisponible : Nominatim prend le relais
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=fr&q=${encodeURIComponent(q)}`)
  if (!res.ok) return null
  const [found] = await res.json() as { display_name: string, lat: string, lon: string }[]
  if (!found) return null
  const name = found.display_name.split(',')[0]!.trim()
  return { label: found.display_name, detail: '', name, lat: Number(found.lat), lon: Number(found.lon) }
}

/**
 * Centre-ville d'une commune : la BAN donne le milieu de son territoire (à Dole, 1,6 km au sud du
 * vieux centre), OpenStreetMap le cœur de la ville. Une seule requête, au moment du choix.
 * On garde le point de la BAN si OpenStreetMap ne répond pas ou trouve une homonyme (à plus de 8 km).
 */
export async function townCenter(place: PlaceSuggestion): Promise<PlaceSuggestion> {
  if (!place.town) return place
  try {
    const params = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'fr', city: place.town.name })
    // Sans le code postal : il couvre parfois une ancienne commune et décale le point (Annecy)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: AbortSignal.timeout(4000) })
    const [found] = res.ok ? await res.json() as { lat: string, lon: string }[] : []
    if (!found) return place
    const lat = Number(found.lat)
    const lon = Number(found.lon)
    const km = Math.hypot((lat - place.lat) * 111, (lon - place.lon) * 111 * Math.cos((lat * Math.PI) / 180))
    return km < 8 ? { ...place, lat, lon } : place
  }
  catch {
    return place
  }
}
