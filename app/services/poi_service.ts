import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Poi from '#models/poi'
import PoiCell from '#models/poi_cell'

/** Taille d'une case de cache (degrés) : ~5,5 km du nord au sud */
export const CELL = 0.05
/** Un secteur est redemandé à OpenStreetMap au bout de ce délai */
const CELL_TTL_DAYS = 30
const USER_AGENT = 'AlpaS/0.1 (https://alpastudio.fr)'
// Serveurs publics essayés dans l'ordre (à remplacer par une instance sur le VPS si le volume augmente)
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export interface PoiDto {
  id: number
  name: string
  lat: number
  lon: number
  kind: string
  score: number
}

/** Bonus selon le type de lieu, en plus de la notoriété Wikipédia */
const KIND_BONUS: Record<string, number> = {
  attraction: 1.5,
  museum: 1.5,
  viewpoint: 1.5,
  castle: 2,
  cathedral: 2,
  palace: 2,
  city_gate: 1.5,
  fort: 1.5,
  ruins: 1,
  monument: 1,
  archaeological_site: 1,
  place_of_worship: 0.5,
  park: 0.5,
  garden: 0.5,
  tower: 1,
  lighthouse: 1.5,
  bridge: 1,
  square: 0.5,
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number, lon: number }
  tags?: Record<string, string>
}

type Bbox = [south: number, west: number, north: number, east: number]

/**
 * Lieux remarquables autour d'un point. Les secteurs jamais vus (ou trop anciens) sont d'abord
 * demandés à OpenStreetMap puis enregistrés : les recherches suivantes ne touchent que la base.
 */
export async function poisAround(lat: number, lon: number, radius: number): Promise<PoiDto[]> {
  const dLat = radius / 111_320
  const dLon = radius / (111_320 * Math.cos(lat * Math.PI / 180))
  const bbox: Bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon]

  await fillCells(bbox)

  const rows = await Poi.query()
    .whereBetween('lat', [bbox[0], bbox[2]])
    .whereBetween('lon', [bbox[1], bbox[3]])
    .orderBy('score', 'desc')
    .limit(400)

  return rows.map(p => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, kind: p.kind, score: p.score }))
}

async function fillCells(bbox: Bbox) {
  const cells: { key: string, i: number, j: number }[] = []
  for (let i = Math.floor(bbox[0] / CELL); i <= Math.floor(bbox[2] / CELL); i++) {
    for (let j = Math.floor(bbox[1] / CELL); j <= Math.floor(bbox[3] / CELL); j++) cells.push({ key: `${i}:${j}`, i, j })
  }
  // Cases couvertes par l'import de la carte de France : jamais redemandées à Overpass
  const fresh = await PoiCell.query()
    .whereIn('cell', cells.map(c => c.key))
    .where(q => q.where('source', 'import').orWhere('fetchedAt', '>', DateTime.now().minus({ days: CELL_TTL_DAYS }).toSQL()!))
  const known = new Set(fresh.map(c => c.cell))
  const missing = cells.filter(c => !known.has(c.key))
  if (!missing.length) return

  // Une seule requête pour le rectangle qui englobe toutes les cases manquantes
  const area: Bbox = [
    Math.min(...missing.map(c => c.i)) * CELL,
    Math.min(...missing.map(c => c.j)) * CELL,
    (Math.max(...missing.map(c => c.i)) + 1) * CELL,
    (Math.max(...missing.map(c => c.j)) + 1) * CELL,
  ]
  const elements = await fetchOverpass(area)
  const count = await savePois(elements.map(toPoi).filter(p => p != null))
  await PoiCell.updateOrCreateMany('cell', missing.map(c => ({ cell: c.key, fetchedAt: DateTime.now(), source: 'overpass' })))
  logger.info({ area, count }, 'lieux importés depuis OpenStreetMap')
}

/**
 * Enregistre des lieux (Overpass ou import d'un extrait OSM) : notoriété Wikidata, score,
 * puis insertion ou mise à jour par identifiant OSM. Renvoie le nombre de lieux gardés.
 */
export async function savePois(candidates: NewPoi[], onProgress?: (done: number, total: number) => void): Promise<number> {
  const pois = dedupe(candidates)
  const sitelinks = await fetchSitelinks(pois.map(p => p.wikidata).filter(q => q != null), onProgress)
  for (const p of pois) {
    p.sitelinks = p.wikidata ? sitelinks.get(p.wikidata) ?? 0 : 0
    p.score = score(p.kind, p.sitelinks, p.wikidata != null)
  }
  const knex = db.connection().getWriteClient()
  const now = new Date()
  for (let k = 0; k < pois.length; k += 500) {
    const rows = pois.slice(k, k + 500).map(p => ({
      osm_key: p.osmKey,
      name: p.name.slice(0, 255),
      lat: p.lat,
      lon: p.lon,
      kind: p.kind,
      wikidata: p.wikidata,
      sitelinks: p.sitelinks,
      score: p.score,
      created_at: now,
      updated_at: now,
    }))
    await knex.table('pois').insert(rows).onConflict('osm_key').merge(['name', 'lat', 'lon', 'kind', 'wikidata', 'sitelinks', 'score', 'updated_at'])
  }
  return pois.length
}

async function fetchOverpass([s, w, n, e]: Bbox): Promise<OverpassElement[]> {
  const b = `(${s},${w},${n},${e})`
  const query = `[out:json][timeout:45];
(
  nwr["tourism"~"^(attraction|viewpoint|museum|gallery)$"]["name"]${b};
  nwr["historic"~"^(castle|monument|ruins|city_gate|fort|archaeological_site|manor|tower|church|cathedral|palace|building|memorial)$"]["name"]["wikidata"]${b};
  nwr["amenity"="place_of_worship"]["name"]["wikidata"]${b};
  nwr["leisure"~"^(park|garden)$"]["name"]["wikidata"]${b};
  nwr["tourism"="artwork"]["name"]["wikidata"]${b};
  nwr["man_made"~"^(tower|lighthouse|bridge)$"]["name"]["wikidata"]${b};
  nwr["place"="square"]["name"]["wikidata"]${b};
);
out center tags;`
  let lastError: unknown
  // Le visiteur attend : on ne dépasse pas ~80 s au total, tous serveurs confondus
  const deadline = Date.now() + 80_000
  for (const url of OVERPASS) {
    const left = deadline - Date.now()
    if (left < 10_000) break
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(Math.min(50_000, left)),
      })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      const json = await res.json() as { elements?: OverpassElement[] }
      return json.elements ?? []
    }
    catch (e) {
      lastError = e
      logger.warn({ url, err: String(e) }, 'Overpass indisponible, essai suivant')
    }
  }
  throw lastError
}

export interface NewPoi {
  osmKey: string
  name: string
  lat: number
  lon: number
  kind: string
  wikidata: string | null
  sitelinks: number
  score: number
}

/** Mêmes critères que la requête Overpass : utilisés tels quels pour l'import d'un extrait OSM */
function isWanted(t: Record<string, string>): boolean {
  if (!t.name) return false
  if (/^(attraction|viewpoint|museum|gallery)$/.test(t.tourism ?? '')) return true
  if (!/^Q\d+$/.test(t.wikidata ?? '')) return false
  return /^(castle|monument|ruins|city_gate|fort|archaeological_site|manor|tower|church|cathedral|palace|building|memorial)$/.test(t.historic ?? '')
    || t.amenity === 'place_of_worship'
    || /^(park|garden)$/.test(t.leisure ?? '')
    || t.tourism === 'artwork'
    || /^(tower|lighthouse|bridge)$/.test(t.man_made ?? '')
    || t.place === 'square'
}

export function toPoi(el: OverpassElement): NewPoi | null {
  const t = el.tags ?? {}
  if (!isWanted(t)) return null
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (!t.name || lat == null || lon == null) return null
  const kind = (t.historic && t.historic !== 'building' && t.historic !== 'church' ? t.historic : null)
    ?? (t.amenity === 'place_of_worship' ? (t.building === 'cathedral' ? 'cathedral' : 'place_of_worship') : null)
    ?? t.tourism ?? t.leisure ?? t.man_made ?? t.place ?? t.historic
  return {
    kind: !kind || kind === 'yes' || kind === 'building' ? 'lieu' : kind,
    osmKey: `${el.type[0]}${el.id}`,
    name: t['name:fr'] ?? t.name,
    lat,
    lon,
    wikidata: /^Q\d+$/.test(t.wikidata ?? '') ? t.wikidata! : null,
    sitelinks: 0,
    score: 0,
  }
}

/** Un même lieu est souvent cartographié deux fois (bâtiment + point) : on garde un exemplaire */
function dedupe(pois: NewPoi[]): NewPoi[] {
  const seen = new Set<string>()
  return pois.filter((p) => {
    const key = p.wikidata ?? `${p.name}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Nombre d'articles Wikipédia par élément Wikidata (par paquets de 50, limite de l'API) */
async function fetchSitelinks(ids: string[], onProgress?: (done: number, total: number) => void): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  for (let k = 0; k < ids.length; k += 50) {
    const batch = ids.slice(k, k + 50)
    try {
      const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=sitelinks&format=json`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      })
      const json = await res.json() as { entities?: Record<string, { sitelinks?: Record<string, unknown> }> }
      for (const [id, entity] of Object.entries(json.entities ?? {})) result.set(id, Object.keys(entity.sitelinks ?? {}).length)
    }
    catch (e) {
      // Sans Wikidata, les lieux restent classés par type : moins fin, mais utilisable
      logger.warn({ err: String(e) }, 'Wikidata indisponible')
    }
    onProgress?.(Math.min(k + 50, ids.length), ids.length)
  }
  return result
}

function score(kind: string, sitelinks: number, hasWikidata: boolean) {
  return Math.round((1 + (hasWikidata ? 1 : 0) + 2 * Math.log2(1 + sitelinks) + (KIND_BONUS[kind] ?? 0)) * 10) / 10
}
