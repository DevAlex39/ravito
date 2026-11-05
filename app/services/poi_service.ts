import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Poi from '#models/poi'
import PoiCell from '#models/poi_cell'

/** Taille d'une case de cache (degrés) : ~5,5 km du nord au sud */
export const CELL = 0.05
/** Un secteur est redemandé à OpenStreetMap au bout de ce délai */
const CELL_TTL_DAYS = 30
const USER_AGENT = 'Alpast/0.1 (https://alpastudio.fr)'
// Serveurs publics essayés dans l'ordre (à remplacer par une instance sur le VPS si le volume augmente)
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export type PoiCategory = 'patrimoine' | 'nature'

export interface PoiDto {
  id: number
  name: string
  lat: number
  lon: number
  kind: string
  category: PoiCategory
  score: number
  /** Pour la fiche du lieu : élément Wikidata (photo, Wikipédia) et objet OpenStreetMap */
  wikidata: string | null
  osmKey: string
}

/** Types naturels gardés sur leur seul nom (une cascade ou une grotte a rarement une page Wikipédia) */
const NATURE_NAMED = /^(waterfall|cave_entrance|peak|arch|gorge|volcano)$/
/** Types naturels trop nombreux sur la carte : gardés seulement s'ils sont documentés (Wikidata) */
const NATURE_DOCUMENTED = /^(spring|rock|stone|cliff|beach|saddle)$/
/** Tout le reste est du patrimoine */
const NATURE_KINDS = new Set(['waterfall', 'cave_entrance', 'peak', 'arch', 'gorge', 'volcano', 'spring', 'rock', 'stone', 'cliff', 'beach', 'saddle', 'viewpoint', 'park', 'garden'])

export function categoryOf(kind: string): PoiCategory {
  return NATURE_KINDS.has(kind) ? 'nature' : 'patrimoine'
}

/**
 * Bonus selon le type de lieu, en plus de la notoriété Wikipédia.
 * Les lieux naturels en ont un plus fort : sans lui, une cascade serait toujours devancée par une église.
 */
const KIND_BONUS: Record<string, number> = {
  waterfall: 2.5,
  cave_entrance: 2,
  gorge: 2,
  arch: 2,
  volcano: 2,
  peak: 1.5,
  spring: 1.5,
  saddle: 1,
  cliff: 1,
  beach: 1,
  rock: 1,
  stone: 1,
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
export async function poisAround(lat: number, lon: number, radius: number, category?: PoiCategory, kinds?: string[]): Promise<PoiDto[]> {
  const dLat = radius / 111_320
  const dLon = radius / (111_320 * Math.cos(lat * Math.PI / 180))
  const bbox: Bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon]

  try {
    await fillCells(bbox)
  }
  catch (error) {
    // Cases hors de l'import (souvent de l'autre côté d'une frontière) et OpenStreetMap injoignable :
    // on rend quand même les lieux déjà en base plutôt que de priver la boucle de tous ses lieux
    logger.warn({ bbox, error: (error as Error).message }, 'lieux : OpenStreetMap injoignable, réponse avec la base seule')
  }

  const best = (cat: PoiCategory, limit: number) => Poi.query()
    .whereBetween('lat', [bbox[0], bbox[2]])
    .whereBetween('lon', [bbox[1], bbox[3]])
    .where('category', cat)
    .orderBy('score', 'desc')
    .limit(limit)

  // Types choisis (« Plus de choix ») : seulement ceux-là ; sans filtre, chaque catégorie a sa part,
  // sinon le patrimoine, mieux noté sur Wikipédia, prendrait toute la place
  const rows = kinds?.length
    ? await Poi.query()
      .whereBetween('lat', [bbox[0], bbox[2]])
      .whereBetween('lon', [bbox[1], bbox[3]])
      .whereIn('kind', kinds)
      .orderBy('score', 'desc')
      .limit(400)
    : category
      ? await best(category, 400)
      : (await Promise.all([best('patrimoine', 250), best('nature', 150)])).flat()

  return rows.map(p => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    kind: p.kind,
    category: p.category as PoiCategory,
    score: p.score,
    wikidata: p.wikidata,
    osmKey: p.osmKey,
  }))
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
  let elements: OverpassElement[]
  try {
    elements = await fetchOverpass(area)
  }
  catch (error) {
    // Échec retenu : ces cases ne seront redemandées que dans un jour, les visiteurs suivants n'attendent pas
    const retryAt = DateTime.now().minus({ days: CELL_TTL_DAYS - 1 })
    await PoiCell.updateOrCreateMany('cell', missing.map(c => ({ cell: c.key, fetchedAt: retryAt, source: 'overpass' })))
    throw error
  }
  const count = await savePois(elements.map(toPoi).filter(p => p != null))
  await PoiCell.updateOrCreateMany('cell', missing.map(c => ({ cell: c.key, fetchedAt: DateTime.now(), source: 'overpass' })))
  logger.info({ area, count }, 'lieux importés depuis OpenStreetMap')
}

export interface SaveOptions {
  onProgress?: (done: number, total: number) => void
  /** Redemande la notoriété de tous les lieux, même ceux déjà connus en base */
  refreshWikidata?: boolean
  /** Notoriété déjà connue par l'appelant (import Wikidata) : pas besoin de la redemander */
  sitelinks?: Map<string, number>
  /** Pays des lieux importés (fr, jp…) ; absent pour le cache Overpass, qui ne touche alors pas à la colonne */
  country?: string
}

/**
 * Enregistre des lieux (Overpass ou import d'un extrait OSM) : notoriété Wikidata, score,
 * puis insertion ou mise à jour par identifiant OSM. Renvoie le nombre de lieux gardés.
 * La notoriété déjà connue en base est réutilisée (elle bouge peu) : seuls les nouveaux lieux interrogent Wikidata.
 */
export async function savePois(candidates: NewPoi[], { onProgress, refreshWikidata = false, sitelinks: given, country }: SaveOptions = {}): Promise<number> {
  const pois = dedupe(candidates)
  const ids = [...new Set(pois.map(p => p.wikidata).filter(q => q != null))]
  const known = refreshWikidata ? new Map<string, Known>() : await knownWikidata(ids)
  const sitelinks = given ?? new Map([...known].map(([q, k]) => [q, k.sitelinks]))
  const fetched = await fetchSitelinks(ids.filter(q => !sitelinks.has(q)), onProgress)
  for (const [q, n] of fetched) sitelinks.set(q, n)
  // Noms français et anglais, et « est-ce une personne ? », une fois par élément (mémorisés dans wikidata_fr / _en)
  const labels = new Map([...known].filter(([, k]) => k.fr != null && k.en != null).map(([q, k]) => [q, { fr: k.fr!, en: k.en! }]))
  for (const [q, info] of await fetchLabels(ids.filter(q => !labels.has(q)))) {
    // Tombe, buste, plaque… reliés à la fiche de la personne : ni son nom ni sa célébrité ne sont ceux du lieu
    labels.set(q, info.person ? { fr: '', en: '' } : info)
    if (info.person) sitelinks.set(q, 0)
  }
  for (const p of pois) {
    p.sitelinks = p.wikidata ? sitelinks.get(p.wikidata) ?? 0 : 0
    p.score = score(p.kind, p.sitelinks, p.wikidata != null, p.heritage)
    const label = p.wikidata ? labels.get(p.wikidata) : undefined
    p.wikidataFr = label?.fr ?? null
    p.wikidataEn = label?.en ?? null
    if (p.localName && country && country !== 'fr') p.name = localName(p.name, label)
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
      category: categoryOf(p.kind),
      wikidata: p.wikidata,
      sitelinks: p.sitelinks,
      wikidata_fr: p.wikidataFr?.slice(0, 255) ?? null,
      wikidata_en: p.wikidataEn?.slice(0, 255) ?? null,
      score: p.score,
      ...(country ? { country } : {}),
      created_at: now,
      updated_at: now,
    }))
    const merged = ['name', 'lat', 'lon', 'kind', 'category', 'wikidata', 'sitelinks', 'wikidata_fr', 'wikidata_en', 'score', 'updated_at', ...(country ? ['country'] : [])]
    await knex.table('pois').insert(rows).onConflict('osm_key').merge(merged)
  }
  return pois.length
}

interface Known { sitelinks: number, fr: string | null, en: string | null }

/** Notoriété et noms déjà enregistrés pour ces éléments Wikidata */
async function knownWikidata(ids: string[]): Promise<Map<string, Known>> {
  const result = new Map<string, Known>()
  for (let k = 0; k < ids.length; k += 1000) {
    const rows = await db.from('pois').select('wikidata', 'sitelinks', 'wikidata_fr', 'wikidata_en').whereIn('wikidata', ids.slice(k, k + 1000))
    for (const r of rows as { wikidata: string, sitelinks: number, wikidata_fr: string | null, wikidata_en: string | null }[]) {
      // Un même élément sur plusieurs lieux : on garde la ligne qui connaît déjà les noms
      if (!result.has(r.wikidata) || r.wikidata_en != null) result.set(r.wikidata, { sitelinks: r.sitelinks, fr: r.wikidata_fr, en: r.wikidata_en })
    }
  }
  return result
}

async function fetchOverpass([s, w, n, e]: Bbox): Promise<OverpassElement[]> {
  const b = `(${s},${w},${n},${e})`
  const query = `[out:json][timeout:45];
(
  nwr["tourism"~"^(attraction|viewpoint|museum|gallery)$"]["name"]${b};
  nwr["tourism"="viewpoint"]${b};
  nwr["historic"~"^(castle|monument|ruins|city_gate|fort|archaeological_site|manor|tower|church|cathedral|palace|building|memorial)$"]["name"]["wikidata"]${b};
  nwr["amenity"="place_of_worship"]["name"]["wikidata"]${b};
  nwr["leisure"~"^(park|garden)$"]["name"]["wikidata"]${b};
  nwr["tourism"="artwork"]["name"]["wikidata"]${b};
  nwr["man_made"~"^(tower|lighthouse|bridge)$"]["name"]["wikidata"]${b};
  nwr["place"="square"]["name"]["wikidata"]${b};
  nwr["natural"~"^(waterfall|cave_entrance|peak|arch|gorge|volcano)$"]["name"]${b};
  nwr["waterway"="waterfall"]["name"]${b};
  nwr["natural"~"^(spring|rock|stone|cliff|beach|saddle)$"]["name"]["wikidata"]${b};
  nwr["heritage"~"^[123]$"]["name"]${b};
  nwr["ref:mhs"]["name"]${b};
  nwr["historic"]["name"]["wikidata"]${b};
  nwr["historic"="lavoir"]["name"]${b};
  nwr["amenity"~"^(lavoir|fountain)$"]["name"]${b};
  nwr["place"="square"]["highway"="pedestrian"]["name"]${b};
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
  /** Bonus Monument historique : classé 2,5 ; inscrit 1,5 ; 0 sinon */
  heritage: number
  sitelinks: number
  score: number
  /** Nom local (pas de name:fr) : remplacé par le nom français de Wikidata hors de France */
  localName: boolean
  wikidataFr?: string | null
  wikidataEn?: string | null
}

/**
 * Nom affiché d'un lieu hors de France sans name:fr : le nom français de Wikidata ; sinon, si le nom local est
 * illisible pour nous, le nom anglais de Wikidata, puis une transcription (grec, cyrillique) ; sinon le nom local.
 */
function localName(name: string, label?: { fr: string, en: string }): string {
  if (label?.fr) return capitalize(label.fr)
  if (!NON_LATIN.test(name)) return name
  if (label?.en) return capitalize(label.en)
  return transliterate(name)
}

/** Transcription lettre à lettre du grec et du cyrillique (les autres écritures restent telles quelles) */
const LETTERS: Record<string, string> = Object.fromEntries([
  ...'α:a β:v γ:g δ:d ε:e ζ:z η:i θ:th ι:i κ:k λ:l μ:m ν:n ξ:x ο:o π:p ρ:r σ:s ς:s τ:t υ:y φ:f χ:ch ψ:ps ω:o ά:a έ:e ή:i ί:i ό:o ύ:y ώ:o ϊ:i ϋ:y ΐ:i ΰ:y'.split(' '),
  ...'а:a б:b в:v г:g ґ:g д:d ђ:dj е:e ё:io є:ie ж:zh з:z ѕ:dz и:i і:i ї:i й:i ј:j к:k л:l љ:lj м:m н:n њ:nj о:o п:p р:r с:s т:t ћ:c ќ:kj у:u ў:u ф:f х:kh ц:ts ч:ch џ:dzh ш:sh щ:shch ъ:a ы:y ь: э:e ю:iu я:ia ѓ:gj'.split(' '),
].map(pair => pair.split(':') as [string, string]))

function transliterate(text: string): string {
  return [...text].map((ch) => {
    const low = ch.toLowerCase()
    const out = LETTERS[low]
    if (out === undefined) return ch
    return ch === low ? out : capitalize(out)
  }).join('')
}

/** Écritures que le promeneur ne lit pas (grec, cyrillique, hébreu, arabe, thaï, japonais, chinois, coréen) */
const NON_LATIN = /[\u0370-\u03FF\u0400-\u04FF\u0590-\u06FF\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u9FFF\uAC00-\uD7AF]/

/** Nom local lisible : en écriture non latine, sa transcription ou le nom anglais s'il y en a un */
function readableName(t: Record<string, string>): string | undefined {
  if (!t.name || !NON_LATIN.test(t.name)) return t.name
  const latn = Object.entries(t).find(([k]) => /^name:[a-z]{2,3}[-_](Latn|rm)$/.test(k))?.[1]
  return t['name:en'] ?? latn ?? t.int_name ?? t.name
}

/** Belvédère sans nom : son altitude quand elle est connue (« Point de vue (812 m) ») */
function viewpointName(t: Record<string, string>): string {
  const ele = Number.parseFloat((t.ele ?? '').replace(',', '.'))
  return Number.isFinite(ele) && ele > 0 && ele < 9000 ? `Point de vue (${Math.round(ele)} m)` : 'Point de vue'
}

/** Plusieurs noms séparés par « ; » : le premier ; un nom tout en capitales (« HARRIET BACKER ») : en minuscules */
function cleanName(name: string): string {
  const first = name.split(';')[0]!.trim()
  if (/\s/.test(first) && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return first.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
  }
  return first
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Monument historique (base Mérimée, reprise dans OpenStreetMap) : bonus de note */
function heritageBonus(t: Record<string, string>): number {
  if (/^[12]$/.test(t.heritage ?? '')) return 2.5
  if (t.heritage === '3' || t['ref:mhs']) return 1.5
  return 0
}

/** Bâtiments classés mais devenus école, clinique… : pas un but de balade (sauf s'ils sont signalés comme patrimoine) */
const NOT_A_VISIT = /^(school|college|university|kindergarten|clinic|doctors|hospital|social_facility|police|prison|bank|pharmacy)$/

/** Éléments historiques trop petits ou trop nombreux pour être un but de sortie */
const MINOR_HISTORIC = /^(boundary_stone|milestone|marker|benchmark|cannon|tree_shrine)$/

/** Noms qui ne disent rien du lieu (« Demeure », « Maison ») : rien à annoncer au promeneur */
const GENERIC_NAME = /^(demeure|maison|immeuble|bâtiment|batiment|édifice|edifice|logis|hôtel|hotel|ferme|bâtisse|grange)$/i

/** Mêmes critères que la requête Overpass : utilisés tels quels pour l'import d'un extrait OSM */
function isWanted(t: Record<string, string>): boolean {
  // Belvédères : la plupart n'ont pas de nom dans OpenStreetMap (surtout hors des Alpes), ils restent un vrai but
  if (t.tourism === 'viewpoint' && !t.name) return true
  if (!t.name || GENERIC_NAME.test(t.name.trim())) return false
  if (/^(attraction|viewpoint|museum|gallery)$/.test(t.tourism ?? '')) return true
  if (NATURE_NAMED.test(t.natural ?? '') || t.waterway === 'waterfall') return true
  // Lavoirs et places piétonnes : le charme des vieux centres et des villages, même sans fiche
  if (t.historic === 'lavoir' || t.amenity === 'lavoir') return true
  if (t.place === 'square' && t.highway === 'pedestrian') return true
  const historic = t.historic && !MINOR_HISTORIC.test(t.historic) ? t.historic : null
  // Monuments historiques : tous, sauf ceux devenus une école ou un établissement de santé
  if (heritageBonus(t) && !t.highway && (historic || !NOT_A_VISIT.test(t.amenity ?? ''))) return true
  if (!/^Q\d+$/.test(t.wikidata ?? '')) return false
  if (historic) return true
  if (t.amenity === 'fountain') return true
  return /^(castle|monument|ruins|city_gate|fort|archaeological_site|manor|tower|church|cathedral|palace|building|memorial)$/.test(t.historic ?? '')
    || t.amenity === 'place_of_worship'
    || /^(park|garden)$/.test(t.leisure ?? '')
    || t.tourism === 'artwork'
    || /^(tower|lighthouse|bridge)$/.test(t.man_made ?? '')
    || t.place === 'square'
    || NATURE_DOCUMENTED.test(t.natural ?? '')
}

/** Type naturel d'un objet (une cascade peut être un point « natural » ou un tronçon de cours d'eau) */
function naturalKind(t: Record<string, string>): string | null {
  if (t.waterway === 'waterfall') return 'waterfall'
  const n = t.natural ?? ''
  return NATURE_NAMED.test(n) || NATURE_DOCUMENTED.test(n) ? n : null
}

export function toPoi(el: OverpassElement): NewPoi | null {
  const t = el.tags ?? {}
  if (!isWanted(t)) return null
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  // Seul un belvédère peut être sans nom (voir isWanted)
  const raw = t['name:fr'] ?? readableName(t) ?? (t.tourism === 'viewpoint' ? viewpointName(t) : null)
  const name = raw ? cleanName(raw) : ''
  if (!name || lat == null || lon == null) return null
  const heritage = heritageBonus(t)
  const kind = (t.historic && !/^(building|church|yes)$/.test(t.historic) ? t.historic : null)
    ?? naturalKind(t)
    ?? (t.amenity === 'place_of_worship' || /^(church|chapel|cathedral)$/.test(t.building ?? '')
      ? (t.building === 'cathedral' ? 'cathedral' : 'place_of_worship')
      : null)
    ?? (/^(fountain|lavoir|townhall|theatre)$/.test(t.amenity ?? '') ? t.amenity : null)
    ?? t.tourism ?? t.leisure ?? t.man_made ?? t.place
    // Bâtiment remarquable sans autre précision : « Monument historique » s'il est protégé
    ?? (heritage ? 'heritage' : null)
  return {
    // Les étiquettes OSM sont du texte libre : une valeur saisie à la main (« Ruine du château de … ») devient « lieu »
    kind: kind && /^[a-z_:]{1,40}$/.test(kind) ? kind : 'lieu',
    heritage,
    osmKey: `${el.type[0]}${el.id}`,
    name,
    lat,
    lon,
    wikidata: /^Q\d+$/.test(t.wikidata ?? '') ? t.wikidata! : null,
    sitelinks: 0,
    score: 0,
    localName: !t['name:fr'] && !!t.name,
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
    // Wikidata répond « trop de requêtes » (429) quand d'autres imports tournent en même temps : on attend et on réessaie
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=sitelinks&format=json&maxlag=5`, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(30_000),
        })
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as { error?: { code: string }, entities?: Record<string, { sitelinks?: Record<string, unknown> }> }
        if (json.error?.code === 'maxlag') throw new Error('maxlag')
        for (const [id, entity] of Object.entries(json.entities ?? {})) result.set(id, Object.keys(entity.sitelinks ?? {}).length)
        break
      }
      catch (e) {
        if (attempt < 6) {
          await new Promise(r => setTimeout(r, 5_000 * attempt))
          continue
        }
        // Sans Wikidata, les lieux restent classés par type : moins fin, mais utilisable
        logger.warn({ err: String(e) }, 'Wikidata indisponible')
        break
      }
    }
    await new Promise(r => setTimeout(r, 200))
    onProgress?.(Math.min(k + 50, ids.length), ids.length)
  }
  return result
}

/**
 * Noms français et anglais et nature (personne ou non) des éléments Wikidata, par paquets de 250 (une requête SPARQL).
 * Personne : humain ou famille. Les éléments sans réponse (service indisponible) seront redemandés au prochain import.
 */
async function fetchLabels(ids: string[]): Promise<Map<string, { fr: string, en: string, person: boolean }>> {
  const result = new Map<string, { fr: string, en: string, person: boolean }>()
  for (let k = 0; k < ids.length; k += 250) {
    const batch = ids.slice(k, k + 250)
    const query = `SELECT ?item ?fr ?en ?person WHERE {
  VALUES ?item { ${batch.map(q => `wd:${q}`).join(' ')} }
  OPTIONAL { ?item rdfs:label ?fr FILTER(LANG(?fr) = "fr") }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  BIND(EXISTS { ?item wdt:P31 ?c . VALUES ?c { wd:Q5 wd:Q8436 wd:Q13417114 } } AS ?person)
}`
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch('https://query.wikidata.org/sparql', {
          method: 'POST',
          body: new URLSearchParams({ query }),
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/sparql-results+json' },
          signal: AbortSignal.timeout(60_000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        type Value = { value: string }
        const json = await res.json() as { results: { bindings: { item: Value, fr?: Value, en?: Value, person: Value }[] } }
        for (const b of json.results.bindings) {
          const q = b.item.value.split('/').pop()!
          result.set(q, { fr: b.fr?.value.trim() ?? '', en: b.en?.value.trim() ?? '', person: b.person.value === 'true' })
        }
        break
      }
      catch (e) {
        if (attempt < 6) {
          await new Promise(r => setTimeout(r, 5_000 * attempt))
          continue
        }
        logger.warn({ err: String(e) }, 'Wikidata (noms des lieux) indisponible')
        break
      }
    }
    await new Promise(r => setTimeout(r, 300))
  }
  return result
}

function score(kind: string, sitelinks: number, hasWikidata: boolean, heritage = 0) {
  return Math.round((1 + (hasWikidata ? 1 : 0) + 2 * Math.log2(1 + sitelinks) + (KIND_BONUS[kind] ?? 0) + heritage) * 10) / 10
}
