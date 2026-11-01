import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { savePois, type NewPoi } from '#services/poi_service'

const WFS = 'https://data.geopf.fr/wfs/ows'
const USER_AGENT = 'Alpast/0.1 (https://alpastudio.fr)'
const PAGE = 5000

interface IgnFeature {
  geometry: { coordinates: unknown } | null
  properties: Record<string, string | boolean | null>
}

/** Ce qu'on demande à l'IGN : couche de la BD TOPO, filtre, et traduction en lieu Alpast */
interface IgnQuery {
  layer: string
  filter: string
  kind: (p: IgnFeature['properties']) => string
  /** Tri supplémentaire, quand le filtre de l'IGN ne suffit pas */
  keep?: (p: IgnFeature['properties']) => boolean
  /** Nom affiché quand l'IGN n'en donne pas (seulement pour les filtres qui acceptent les lieux sans nom) */
  fallbackName?: (p: IgnFeature['properties']) => string
}

/**
 * La BD TOPO appelle « sommet » toute butte qui porte un nom de lieu-dit (« les Rangs », « la Grillette ») :
 * on ne garde que les noms de vrais sommets, ou ceux que l'IGN juge importants (1 à 3 sur 6)
 */
const SUMMIT_NAME = /^(l[ae]s? |l')?(mont|monts|montagne|pic|puy|puech|pech|suc|cr[eê]te?|signal|roc|roche|rocher|dent|aiguille|grosse? t[eê]te|t[eê]te|ballon|sommet|pointe|cimes?|piton|truc|serre|tuc|mourre|molard|becca|grand mont)\b/i
const isSummit = (p: IgnFeature['properties']) => SUMMIT_NAME.test(String(p.toponyme ?? '')) || Number(p.importance) <= 3

const ZONE = 'BDTOPO_V3:zone_d_activite_ou_d_interet'
const RELIEF = 'BDTOPO_V3:detail_orographique'
const EAU = 'BDTOPO_V3:detail_hydrographique'

/**
 * Lieux de la BD TOPO gardés. Comme pour OpenStreetMap, un lieu sans nom n'est gardé que s'il reste
 * un vrai but de sortie : belvédère, mégalithe, lavoir.
 */
const QUERIES: IgnQuery[] = [
  {
    layer: ZONE,
    filter: `nature='Point de vue' AND nature_detaillee<>'Observatoire ornithologique'`,
    kind: () => 'viewpoint',
    fallbackName: p => (p.nature_detaillee === 'Belvédère' || p.nature_detaillee === 'Table d\'orientation' ? p.nature_detaillee : 'Point de vue'),
  },
  {
    layer: ZONE,
    filter: `nature='Mégalithe'`,
    kind: () => 'archaeological_site',
    fallbackName: p => (typeof p.nature_detaillee === 'string' && p.nature_detaillee ? p.nature_detaillee : 'Mégalithe'),
  },
  { layer: ZONE, filter: `nature='Vestige archéologique' AND toponyme IS NOT NULL`, kind: () => 'archaeological_site' },
  { layer: ZONE, filter: `nature IN ('Musée','Ecomusée') AND toponyme IS NOT NULL`, kind: () => 'museum' },
  { layer: ZONE, filter: `nature='Monument' AND nature_detaillee<>'Monument aux morts' AND toponyme IS NOT NULL`, kind: () => 'monument' },
  { layer: RELIEF, filter: `nature IN ('Grotte','Gouffre') AND toponyme IS NOT NULL`, kind: () => 'cave_entrance' },
  { layer: RELIEF, filter: `nature IN ('Sommet','Pic') AND toponyme IS NOT NULL`, kind: () => 'peak', keep: isSummit },
  { layer: RELIEF, filter: `nature IN ('Gorge','Cirque') AND toponyme IS NOT NULL`, kind: () => 'gorge' },
  { layer: EAU, filter: `nature='Cascade' AND toponyme IS NOT NULL`, kind: () => 'waterfall' },
  { layer: EAU, filter: `nature IN ('Source','Résurgence') AND toponyme IS NOT NULL`, kind: () => 'spring' },
  { layer: EAU, filter: `nature='Lavoir'`, kind: () => 'lavoir', fallbackName: () => 'Lavoir' },
]

/** Types qui désignent le même genre de lieu : un lieu IGN proche d'un lieu OSM de la même famille est un doublon */
const FAMILY: Record<string, string> = {
  viewpoint: 'vue',
  peak: 'sommet', saddle: 'sommet', volcano: 'sommet',
  cave_entrance: 'grotte',
  waterfall: 'eau', spring: 'eau',
  gorge: 'roche', arch: 'roche', cliff: 'roche', rock: 'roche',
  lavoir: 'fontaine', fountain: 'fontaine',
  archaeological_site: 'vestige', ruins: 'vestige', tomb: 'vestige', stone: 'vestige',
  museum: 'musee', gallery: 'musee',
  monument: 'monument', memorial: 'monument',
}
/** Distance sous laquelle deux lieux de la même famille sont le même lieu (mètres) */
const SAME_PLACE = 150
/** Les sommets sont placés moins précisément d'une source à l'autre */
const SAME_PEAK = 250
/** Même nom à moins de 500 m : même lieu, quel que soit le type */
const SAME_NAME = 500

/**
 * Complète les lieux OpenStreetMap avec la BD TOPO de l'IGN (Licence Ouverte 2.0) : belvédères, mégalithes,
 * grottes, cascades… absents de la carte collaborative. À lancer après import:lieux, chaque mois.
 * Les lieux déjà connus d'OpenStreetMap ne sont pas repris ; ceux ajoutés depuis à OpenStreetMap disparaissent ici.
 */
export default class ImportIgn extends BaseCommand {
  static commandName = 'import:ign'
  static description = 'Complète les lieux avec la BD TOPO de l\'IGN (belvédères, mégalithes, grottes…) absents d\'OpenStreetMap'
  static options: CommandOptions = { startApp: true }

  async run() {
    const startedAt = new Date()
    const known = await this.knownPlaces()
    this.logger.info(`${known.size} lieux OpenStreetMap en base pour écarter les doublons`)

    const candidates: NewPoi[] = []
    for (const q of QUERIES) {
      let read = 0
      for await (const f of this.features(q)) {
        read++
        const poi = toPoi(f, q)
        if (poi) candidates.push(poi)
      }
      this.logger.info(`${q.layer.split(':')[1]} · ${q.filter} : ${read} objets`)
    }

    const kept = keepNew(candidates, known)
    this.logger.info(`${candidates.length} lieux IGN lus, ${kept.length} absents d'OpenStreetMap`)
    const count = await savePois(kept)
    this.logger.success(`${count} lieux IGN enregistrés`)
    await this.deleteStale(startedAt, count)
  }

  /** Lieux non IGN en base, rangés par case d'environ 1 km pour chercher vite les voisins */
  private async knownPlaces(): Promise<Grid> {
    const rows = await db.from('pois').select('lat', 'lon', 'kind', 'name').whereNot('osm_key', 'like', 'ign:%') as Place[]
    const grid = new Grid()
    for (const r of rows) grid.add(r)
    return grid
  }

  /** Objets d'une requête, page par page (5 000 par appel, ordre stable grâce au tri par identifiant) */
  private async *features(q: IgnQuery): AsyncGenerator<IgnFeature> {
    for (let start = 0; ; start += PAGE) {
      const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: q.layer,
        outputFormat: 'application/json',
        sortBy: 'cleabs',
        count: String(PAGE),
        startIndex: String(start),
        cql_filter: q.filter,
      })
      const page = await this.fetchPage(`${WFS}?${params}`)
      yield* page
      if (page.length < PAGE) return
    }
  }

  private async fetchPage(url: string): Promise<IgnFeature[]> {
    let lastError: unknown
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120_000) })
        if (!res.ok) throw new Error(`IGN ${res.status}`)
        const json = await res.json() as { features?: IgnFeature[] }
        if (!json.features) throw new Error('Réponse IGN sans objets')
        return json.features
      }
      catch (e) {
        lastError = e
        this.logger.warning(`IGN indisponible (essai ${attempt}/4) : ${String(e)}`)
        await new Promise(r => setTimeout(r, attempt * 15_000))
      }
    }
    throw lastError
  }

  /** Lieux IGN qui ne sont plus dans la BD TOPO, ou désormais connus d'OpenStreetMap (même garde-fou que import:lieux) */
  private async deleteStale(startedAt: Date, imported: number) {
    const knex = db.connection().getWriteClient()
    const [{ total }] = await knex.from('pois').where('osm_key', 'like', 'ign:%').count({ total: '*' }) as { total: number }[]
    if (imported < Number(total) * 0.7) {
      this.logger.warning(`Seulement ${imported} lieux IGN pour ${total} en base : suppression des anciens annulée par prudence`)
      return
    }
    const removed = await knex.from('pois').where('osm_key', 'like', 'ign:%').where('updated_at', '<', startedAt).delete()
    this.logger.success(`${removed} lieux IGN retirés (disparus de la BD TOPO ou ajoutés à OpenStreetMap)`)
  }
}

function toPoi(f: IgnFeature, q: IgnQuery): NewPoi | null {
  const p = f.properties
  // Lieux pas encore ouverts ou fermés (« fictif » ne veut dire que « contour approximatif » : on le garde)
  if (typeof p.etat_de_l_objet === 'string' && p.etat_de_l_objet !== 'En service') return null
  if (q.keep && !q.keep(p)) return null
  const center = f.geometry ? bboxCenter(f.geometry.coordinates) : null
  const name = (typeof p.toponyme === 'string' && p.toponyme.trim()) || q.fallbackName?.(p)
  if (!center || !name || typeof p.cleabs !== 'string') return null
  return {
    // Identifiant IGN (24 caractères) : « ign: » le distingue des lieux OpenStreetMap
    osmKey: `ign:${p.cleabs}`,
    name,
    lat: center[1],
    lon: center[0],
    kind: q.kind(p),
    wikidata: null,
    heritage: 0,
    sitelinks: 0,
    score: 0,
  }
}

/** Garde les lieux IGN qu'OpenStreetMap n'a pas déjà (ni l'IGN deux fois) */
function keepNew(candidates: NewPoi[], known: Grid): NewPoi[] {
  const kept: NewPoi[] = []
  for (const c of candidates) {
    if (known.hasTwin(c)) continue
    kept.push(c)
    known.add(c)
  }
  return kept
}

interface Place { lat: number, lon: number, kind: string, name: string }

/** Lieux rangés par case de 0,01° (~1 km) : on ne compare un lieu qu'à ses voisins */
class Grid {
  private cells = new Map<string, Place[]>()

  get size() {
    let n = 0
    for (const list of this.cells.values()) n += list.length
    return n
  }

  add(p: Place) {
    const key = `${Math.floor(p.lat * 100)}:${Math.floor(p.lon * 100)}`
    const list = this.cells.get(key)
    if (list) list.push(p)
    else this.cells.set(key, [p])
  }

  /** Un lieu déjà là : même famille tout près, ou même nom à moins de 500 m */
  hasTwin(c: Place): boolean {
    const family = FAMILY[c.kind]
    const name = normalize(c.name)
    const i = Math.floor(c.lat * 100)
    const j = Math.floor(c.lon * 100)
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const p of this.cells.get(`${i + di}:${j + dj}`) ?? []) {
          const d = distance(c, p)
          if (family && FAMILY[p.kind] === family && d < (family === 'sommet' ? SAME_PEAK : SAME_PLACE)) return true
          if (d < SAME_NAME && normalize(p.name) === name) return true
        }
      }
    }
    return false
  }
}

function normalize(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function distance(a: { lat: number, lon: number }, b: { lat: number, lon: number }): number {
  const dLat = (a.lat - b.lat) * 111_320
  const dLon = (a.lon - b.lon) * 111_320 * Math.cos(a.lat * Math.PI / 180)
  return Math.hypot(dLat, dLon)
}

/** Centre du rectangle englobant une géométrie GeoJSON (point, ligne ou surface) */
function bboxCenter(coords: unknown): [number, number] | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const walk = (c: unknown) => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      minX = Math.min(minX, c[0])
      maxX = Math.max(maxX, c[0])
      minY = Math.min(minY, c[1])
      maxY = Math.max(maxY, c[1])
      return
    }
    for (const sub of c) walk(sub)
  }
  walk(coords)
  return Number.isFinite(minX) ? [(minX + maxX) / 2, (minY + maxY) / 2] : null
}
