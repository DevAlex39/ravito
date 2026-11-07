/**
 * Recherche d'adresses pour le choix du départ.
 * - France : Base Adresse Nationale (Géoplateforme de l'IGN) : villes, adresses, codes postaux,
 *   gratuite, sans clé, pensée pour l'auto-complétion ;
 * - ailleurs : notre Photon (/adresses, OpenStreetMap auto-hébergé), auto-complétion comprise ;
 * - en dernier recours (pas de Photon sur ce serveur) : Nominatim, seulement à la validation
 *   (ses conditions interdisent l'auto-complétion).
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

/** API Découpage administratif : retrouve les communes par le début de leur nom, les plus peuplées d'abord */
const COMMUNES_URL = 'https://geo.api.gouv.fr/communes'

interface Commune {
  nom: string
  codesPostaux?: string[]
  centre?: { coordinates: [number, number] }
  population?: number
  departement?: { nom: string }
  region?: { nom: string }
}

const simplify = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-']/g, ' ')

/**
 * Communes dont le nom commence par la saisie. La BAN rate certains débuts de nom (« annec » ne donne
 * qu'Annequin) ; cette API les trouve, mais en manque d'autres (« chamo » ne donne pas Chamonix) : on combine.
 */
async function communesStartingWith(q: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  try {
    const params = new URLSearchParams({ nom: q, fields: 'nom,codesPostaux,centre,population,departement,region', boost: 'population', limit: '5' })
    const res = await fetch(`${COMMUNES_URL}?${params}`, { signal })
    const list = res.ok ? (await res.json()) as Commune[] : []
    return list
      .filter(c => c.centre && simplify(c.nom).startsWith(simplify(q)))
      .map((c) => {
        const [lon, lat] = c.centre!.coordinates
        const postcode = c.codesPostaux?.[0]
        const detail = [c.departement?.nom, c.region?.nom].filter(Boolean).join(', ')
        return { label: postcode ? `${c.nom} (${postcode})` : c.nom, detail, name: c.nom, lat, lon, town: { name: c.nom } }
      })
  }
  catch {
    // Service indisponible : les suggestions de la BAN suffisent
    return []
  }
}

/** Réponse de /adresses (app/controllers/addresses_controller.ts) */
type PhotonSuggestion = PlaceSuggestion & { country: string, isTown: boolean }

/** Notre Photon, par le serveur du site ; liste vide s'il n'est pas installé ou ne répond pas */
async function photon(q: string, extra: Record<string, string> = {}, signal?: AbortSignal): Promise<PhotonSuggestion[]> {
  try {
    const params = new URLSearchParams({ q, ...extra })
    const res = await fetch(`/adresses?${params}`, { signal, headers: { Accept: 'application/json' } })
    return res.ok ? await res.json() as PhotonSuggestion[] : []
  }
  catch {
    return []
  }
}

const plain = ({ label, detail, name, lat, lon }: PhotonSuggestion): PlaceSuggestion => ({ label, detail, name, lat, lon })

/** Suggestions pendant la frappe, au moins 3 caractères */
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
  const [banTowns, communes, all, abroad] = await Promise.all([
    isAddress ? [] : search('&type=municipality', 3),
    isAddress ? [] : communesStartingWith(q, signal),
    search('', 6),
    photon(q, {}, signal),
  ])
  // Communes sûres de la BAN, puis celles qui commencent par la saisie, puis les moins probables de la BAN
  const sure = banTowns.filter(f => f.properties.score >= 0.6).map(fromBan)
  const unsure = banTowns.filter(f => f.properties.score < 0.6).map(fromBan)
  const seen = new Set<string>()
  const fresh = (p: PlaceSuggestion) => {
    if (seen.has(p.label)) return false
    seen.add(p.label)
    return true
  }
  const towns = [...sure, ...communes, ...unsure].filter(fresh).slice(0, 3)
  const french = [...towns, ...all.map(fromBan).filter(fresh)]
  // Photon : seulement les lieux hors de France (la BAN fait mieux en France)
  const abroadOnly = abroad.filter(p => p.country !== 'fr')
  // Ville étrangère au nom exact (« barcelone ») sans commune française du même nom : en tête,
  // devant Barcelonne (Drôme) et la rue de Barcelone du Var
  const exact = (p: PlaceSuggestion) => simplify(p.name) === simplify(q)
  const exactAbroad = towns.some(exact) ? [] : abroadOnly.filter(p => p.isTown && exact(p)).map(plain).filter(fresh)
  const foreign = abroadOnly.map(plain).filter(fresh)
  // Rien de convaincant en France (« kyoto », « Brandenburger Tor ») : l'étranger passe devant
  const frenchIsSure = sure.length > 0 || communes.length > 0 || all.some(f => f.properties.score >= 0.6)
  return [...exactAbroad, ...(frenchIsSure ? [...french, ...foreign] : [...foreign, ...french])].slice(0, 6)
}

/**
 * Lieu tapé puis validé sans choisir de suggestion (ou départ donné dans l'adresse de la page) :
 * une commune française, sinon une ville à l'étranger de notre Photon, sinon la meilleure adresse
 * française si elle est convaincante, sinon Photon (noms de sites…), sinon Nominatim.
 * La BAN donne toujours un résultat très sûr pour un nom de ville étrangère : « Barcelone » est une rue
 * du Var, « Genève » un lieu-dit de l'Aveyron. Seule une commune française passe donc avant l'étranger.
 */
export async function searchPlace(query: string): Promise<PlaceSuggestion | null> {
  const q = query.trim()
  const ban = async (): Promise<BanFeature | undefined> => {
    try {
      const res = await fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=1`)
      return res.ok ? ((await res.json()) as { features?: BanFeature[] }).features?.[0] : undefined
    }
    catch {
      // Géoplateforme indisponible : Photon ou Nominatim prend le relais
      return undefined
    }
  }
  const [first, hits] = await Promise.all([ban(), photon(q)])
  const sure = first && first.properties.score >= 0.6 ? first : undefined
  if (sure?.properties.type === 'municipality') return townCenter(fromBan(sure))
  const town = hits.find(p => p.isTown)
  if (town && town.country !== 'fr') return plain(town)
  if (sure) return townCenter(fromBan(sure))
  const [hit] = hits
  if (hit) return plain(hit)
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
  const near = (lat: number, lon: number) =>
    Math.hypot((lat - place.lat) * 111, (lon - place.lon) * 111 * Math.cos((lat * Math.PI) / 180)) < 8
  // Notre Photon d'abord (villes seulement, la plus proche du point de la BAN passe devant)
  const [town] = await photon(place.town.name, { villes: '1', lat: String(place.lat), lon: String(place.lon) })
  if (town && town.country === 'fr' && near(town.lat, town.lon)) return { ...place, lat: town.lat, lon: town.lon }
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
