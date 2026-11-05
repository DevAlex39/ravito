import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'

/** Une suggestion de lieu, même forme que PlaceSuggestion côté navigateur (inertia/utils/geocode.ts) */
interface Suggestion {
  label: string
  detail: string
  name: string
  lat: number
  lon: number
  country: string
  /** Ville, village… (et pas une rue ou un monument) */
  isTown: boolean
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    housenumber?: string
    street?: string
    postcode?: string
    city?: string
    county?: string
    state?: string
    country?: string
    countrycode?: string
    osm_key?: string
    osm_value?: string
    type?: string
  }
}

const TOWN = /^(city|town|village|hamlet|municipality|suburb|locality)$/

function toSuggestion(f: PhotonFeature): Suggestion | null {
  const p = f.properties
  const [lon, lat] = f.geometry.coordinates
  const street = p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : null
  const name = p.name ?? street
  if (!name) return null
  const isTown = p.osm_key === 'place' && TOWN.test(p.osm_value ?? '')
  // « Temple Kiyomizu, Kyoto » ; « 10 Rue de la Paix, Paris » ; une ville seule garde son nom
  const where = isTown ? null : (p.city && p.city !== name ? p.city : null)
  // La rue seulement pour une adresse sans nom de lieu (« Temple Kiyomizu, Kyoto » plutôt que « …, Pente de Kiyomizu, Kyoto »)
  const label = [name, where].filter(Boolean).join(', ')
  const detail = [isTown ? p.state ?? p.county : p.state, p.country].filter((v, i, all) => v && all.indexOf(v) === i).join(', ')
  return { label, detail, name: where ? `${name}, ${where}` : name, lat, lon, country: (p.countrycode ?? '').toLowerCase(), isTown }
}

/**
 * Recherche d'adresses et de lieux dans notre Photon (base OpenStreetMap auto-hébergée, voir scripts/labo/photon.sh).
 * Contrairement à Nominatim, on peut l'interroger à chaque frappe. Sans Photon configuré (PHOTON_URL), répond une
 * liste vide : le navigateur garde alors ses autres sources.
 */
export default class AddressesController {
  async search({ request, response }: HttpContext) {
    const q = String(request.qs().q ?? '').trim()
    const photon = env.get('PHOTON_URL')
    if (!photon || q.length < 2 || q.length > 120) return []
    const params = new URLSearchParams({ q, lang: 'fr', limit: request.qs().villes ? '10' : '8' })
    // Biais vers la position connue (carte affichée) : à nom égal, le lieu le plus proche passe devant
    const lat = Number(request.qs().lat)
    const lon = Number(request.qs().lon)
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      params.set('lat', String(lat))
      params.set('lon', String(lon))
    }
    // Villes seulement (centre-ville d'une commune)
    if (request.qs().villes) for (const v of ['city', 'town', 'village']) params.append('osm_tag', `place:${v}`)
    try {
      const res = await fetch(`${photon.replace(/\/$/, '')}/api?${params}`, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) return []
      const { features = [] } = await res.json() as { features?: PhotonFeature[] }
      const seen = new Set<string>()
      const list = features.map(toSuggestion).filter((s): s is Suggestion => {
        if (!s || seen.has(s.label + s.detail)) return false
        seen.add(s.label + s.detail)
        return true
      })
      response.header('Cache-Control', 'public, max-age=3600')
      return list.slice(0, 6)
    }
    catch {
      return []
    }
  }
}
