import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import type { Knex } from 'knex'
import { CELL, savePois, toPoi, type NewPoi } from '#services/poi_service'
import { saveAmenities, toAmenity, type NewAmenity } from '#services/amenity_service'

type Ring = [lon: number, lat: number][]

/**
 * Importe les lieux remarquables d'un extrait OpenStreetMap (ex. la France entière) dans la base,
 * puis marque les cases couvertes : elles ne seront plus jamais demandées aux serveurs Overpass publics.
 *
 * Préparation du fichier (voir README) :
 *   osmium tags-filter … -o lieux.osm.pbf
 *   osmium export lieux.osm.pbf -f geojsonseq -x print_record_separator=false -a type,id -o lieux.geojsonseq
 */
export default class ImportLieux extends BaseCommand {
  static commandName = 'import:lieux'
  static description = 'Importe les lieux remarquables d\'un extrait OSM (GeoJSON Seq) et marque les secteurs couverts'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Fichier GeoJSON Seq produit par « osmium export »' })
  declare file: string

  @args.string({ description: 'Contour de la zone couverte, au format .poly de Geofabrik' })
  declare poly: string

  @flags.boolean({ description: 'Redemande à Wikidata la notoriété de tous les lieux (sinon seulement des nouveaux)' })
  declare rafraichirWikidata: boolean

  @flags.string({ description: 'Code du pays importé (fr, jp…), enregistré sur chaque lieu', default: 'fr' })
  declare pays: string

  async run() {
    const startedAt = new Date()
    const zone = toZone(parsePoly(await readFile(this.poly, 'utf8')))
    const { candidates, amenities } = await this.readCandidates()
    this.logger.info(`${await saveAmenities(amenities)} points d'eau et toilettes enregistrés`)
    this.logger.info(`${candidates.length} lieux retenus, récupération de la notoriété des nouveaux lieux sur Wikidata…`)

    let lastShown = 0
    const count = await savePois(candidates, {
      refreshWikidata: this.rafraichirWikidata,
      country: this.pays,
      onProgress: (done, total) => {
        if (done - lastShown >= 5000 || done === total) {
          lastShown = done
          this.logger.info(`Wikidata : ${done} / ${total}`)
        }
      },
    })
    this.logger.success(`${count} lieux enregistrés`)

    const cells = await this.markCells(zone)
    this.logger.success(`${cells} secteurs marqués comme couverts par l'import`)

    await this.deleteStale(zone, startedAt, count)
    await this.deleteStaleAmenities(zone, startedAt, amenities.length)
  }

  /** Points d'eau et toilettes disparus de la carte, dans la zone importée seulement (même garde-fou que pour les lieux) */
  private async deleteStaleAmenities(zone: Zone, startedAt: Date, imported: number) {
    const knex = db.connection().getWriteClient()
    const rows = await inZone(zone, knex.from('amenities').select('id', 'lat', 'lon', 'updated_at'))
    if (imported < rows.length * 0.7) {
      this.logger.warning(`Seulement ${imported} points d'eau et toilettes pour ${rows.length} en base dans la zone : suppression annulée par prudence`)
      return
    }
    const removed = await deleteIds(knex, 'amenities', rows.filter(r => r.updated_at < startedAt).map(r => r.id))
    this.logger.success(`${removed} points d'eau et toilettes disparus supprimés`)
  }

  /**
   * Lieux des secteurs importés qui n'apparaissent plus dans l'extrait (supprimés ou modifiés dans OSM).
   * Seulement dans la zone de l'import : un autre pays déjà en base n'est jamais touché.
   * Garde-fou : si l'import paraît incomplet (fichier tronqué…), on ne supprime rien.
   */
  private async deleteStale(zone: Zone, startedAt: Date, imported: number) {
    const knex = db.connection().getWriteClient()
    // Lieux OpenStreetMap seulement : ceux de l'IGN (« ign:… ») et de Wikidata (« wd:… ») ont leur propre import
    const rows = await inZone(zone, knex.from('pois as p')
      .join('poi_cells as c', 'c.cell', knex.raw(`CONCAT(FLOOR(p.lat / ?), ':', FLOOR(p.lon / ?))`, [CELL, CELL]))
      .where('c.source', 'import')
      .whereNot('p.osm_key', 'like', '%:%')
      .select('p.id', 'p.lat', 'p.lon', 'p.updated_at'))
    if (imported < rows.length * 0.7) {
      this.logger.warning(`Seulement ${imported} lieux importés pour ${rows.length} en base dans la zone : suppression des anciens lieux annulée par prudence`)
      return
    }
    const removed = await deleteIds(knex, 'pois', rows.filter(r => r.updated_at < startedAt).map(r => r.id))
    this.logger.success(`${removed} lieux disparus de la carte supprimés`)
  }

  /** Lit le fichier ligne par ligne (une entité GeoJSON par ligne) : lieux voulus, points d'eau et toilettes */
  private async readCandidates(): Promise<{ candidates: NewPoi[], amenities: NewAmenity[] }> {
    const result: NewPoi[] = []
    const amenities: NewAmenity[] = []
    let read = 0
    for await (const line of readLines(this.file)) {
      if (!line.trim()) continue
      read++
      const feature = JSON.parse(line) as { geometry: { coordinates: unknown }, properties: Record<string, string> }
      const { '@type': type, '@id': id, ...tags } = feature.properties
      const center = bboxCenter(feature.geometry.coordinates)
      if (!center || (type !== 'node' && type !== 'way' && type !== 'relation')) continue
      const el = { type, id: Number(id), lat: center[1], lon: center[0], tags } as const
      const poi = toPoi(el)
      if (poi) result.push(poi)
      const amenity = toAmenity(el)
      if (amenity) amenities.push(amenity)
    }
    this.logger.info(`${read} objets lus dans ${this.file}`)
    return { candidates: result, amenities }
  }

  /** Marque les cases entièrement à l'intérieur du contour (celles à cheval sur la frontière restent à Overpass) */
  private async markCells({ minLon, maxLon, minLat, maxLat, inside }: Zone): Promise<number> {
    const knex = db.connection().getWriteClient()
    const now = new Date()
    let batch: { cell: string, fetched_at: Date, source: string }[] = []
    let total = 0
    const flush = async () => {
      if (!batch.length) return
      await knex.table('poi_cells').insert(batch).onConflict('cell').merge(['fetched_at', 'source'])
      total += batch.length
      batch = []
    }
    for (let i = Math.floor(minLat / CELL); i <= Math.floor(maxLat / CELL); i++) {
      for (let j = Math.floor(minLon / CELL); j <= Math.floor(maxLon / CELL); j++) {
        const [s, w, n, e] = [i * CELL, j * CELL, (i + 1) * CELL, (j + 1) * CELL]
        if (inside(w, s) && inside(e, s) && inside(w, n) && inside(e, n)) {
          batch.push({ cell: `${i}:${j}`, fetched_at: now, source: 'import' })
          if (batch.length >= 1000) await flush()
        }
      }
    }
    await flush()
    return total
  }
}

/**
 * Lignes séparées par « \n » uniquement : readline coupe aussi sur U+2028, présent dans certains tags OSM,
 * ce qui casserait le JSON en deux.
 */
async function* readLines(file: string): AsyncGenerator<string> {
  let rest = ''
  for await (const chunk of createReadStream(file, 'utf8')) {
    const parts = (rest + chunk).split('\n')
    rest = parts.pop()!
    yield* parts
  }
  if (rest) yield rest
}

/** Centre du rectangle englobant d'une géométrie GeoJSON (point, ligne, polygone…) */
function bboxCenter(coords: unknown): [number, number] | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      minX = Math.min(minX, c[0])
      maxX = Math.max(maxX, c[0])
      minY = Math.min(minY, c[1] as number)
      maxY = Math.max(maxY, c[1] as number)
    }
    else if (Array.isArray(c)) c.forEach(walk)
  }
  walk(coords)
  return Number.isFinite(minX) ? [(minX + maxX) / 2, (minY + maxY) / 2] : null
}

/** Zone couverte par un import : contour du pays et rectangle englobant (pour filtrer d'abord en base) */
type Zone = { minLon: number, maxLon: number, minLat: number, maxLat: number, inside: (lon: number, lat: number) => boolean }

function toZone(rings: Ring[]): Zone {
  let [minLon, maxLon, minLat, maxLat] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const [lon, lat] of rings.flat()) {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  return { minLon, maxLon, minLat, maxLat, inside: (lon, lat) => rings.some(r => pointInRing(lon, lat, r)) }
}

type Located = { id: number, lat: number, lon: number, updated_at: Date }

/** Lignes de la requête situées dans la zone : rectangle englobant en base, puis contour exact */
async function inZone(zone: Zone, query: Knex.QueryBuilder): Promise<Located[]> {
  const rows = await query
    .whereBetween('lat', [zone.minLat, zone.maxLat])
    .whereBetween('lon', [zone.minLon, zone.maxLon]) as Located[]
  return rows.filter(r => zone.inside(Number(r.lon), Number(r.lat)))
}

/** Suppression par paquets (une liste de plusieurs dizaines de milliers d'identifiants ne tient pas en une requête) */
async function deleteIds(knex: Knex, table: string, ids: number[]): Promise<number> {
  let removed = 0
  for (let i = 0; i < ids.length; i += 5000) {
    removed += await knex.from(table).whereIn('id', ids.slice(i, i + 5000)).delete()
  }
  return removed
}

/** Format .poly (Osmosis/Geofabrik) : anneaux extérieurs uniquement, les trous (« !… ») sont ignorés */
function parsePoly(text: string): Ring[] {
  const rings: Ring[] = []
  let current: Ring | null = null
  let skip = false
  for (const raw of text.split(/\r?\n/).slice(1)) {
    const line = raw.trim()
    if (!line) continue
    if (line === 'END') {
      if (current && !skip) rings.push(current)
      current = null
      continue
    }
    if (!current) {
      current = []
      skip = line.startsWith('!')
      continue
    }
    const [lon, lat] = line.split(/\s+/).map(Number)
    if (Number.isFinite(lon) && Number.isFinite(lat)) current.push([lon!, lat!])
  }
  return rings
}

/** Test du rayon : le point est-il à l'intérieur de l'anneau ? */
function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
