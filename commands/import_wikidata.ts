import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import type { Knex } from 'knex'
import { savePois, type NewPoi } from '#services/poi_service'
import { Grid, keepNew, type Place } from '#services/place_twins'
import { countryNamed } from '#services/countries'

/**
 * QLever (université de Fribourg) : même contenu que le service officiel de Wikidata, mais il répond
 * en quelques secondes là où l'officiel coupe au bout de 60 s pour toute la France
 */
const QLEVER = 'https://qlever.cs.uni-freiburg.de/api/wikidata'
const USER_AGENT = 'Alpast/0.1 (https://alpastudio.fr; contact@alpastudio.fr)'

/**
 * Types Wikidata recherchés (avec tous leurs sous-types) et type de lieu Alpast correspondant.
 * Un élément de plusieurs types prend le premier de la liste : les plus précis d'abord, « monument » en dernier.
 */
const TYPES: [qid: string, kind: string][] = [
  ['Q34038', 'waterfall'], // chute d'eau
  ['Q35509', 'cave_entrance'], // grotte
  ['Q2232001', 'cave_entrance'], // grotte touristique
  ['Q150784', 'gorge'], // gorge
  ['Q124714', 'spring'], // source
  ['Q6017969', 'viewpoint'], // point de vue panoramique
  ['Q39715', 'lighthouse'], // phare
  ['Q23413', 'castle'], // château fort
  ['Q751876', 'castle'], // château
  ['Q160742', 'place_of_worship'], // abbaye
  ['Q44613', 'place_of_worship'], // monastère
  ['Q16970', 'place_of_worship'], // église
  ['Q108325', 'place_of_worship'], // chapelle
  ['Q33506', 'museum'], // musée
  ['Q839954', 'archaeological_site'], // site archéologique
  ['Q109607', 'ruins'], // ruine
  ['Q57821', 'fort'], // fortification
  ['Q12280', 'bridge'], // pont
  ['Q483453', 'fountain'], // fontaine
  ['Q12518', 'tower'], // tour
  ['Q22698', 'park'], // parc
  ['Q1107656', 'garden'], // jardin
  ['Q8502', 'peak'], // montagne
  ['Q133056', 'saddle'], // col
  ['Q4989906', 'monument'], // monument
]
const KIND = new Map(TYPES)
const RANK = new Map(TYPES.map(([q], i) => [q, i]))

/** Types très nombreux et souvent anodins (plaques, ponts routiers…) : gardés s'ils sont protégés ou ont un article Wikipédia */
const NEEDS_FAME = new Set(['monument', 'fountain', 'bridge', 'tower'])

/** Monument historique classé / inscrit : même bonus que pour OpenStreetMap */
const CLASSE = 'Q10387684'
const INSCRIT = 'Q10387575'

/** Service officiel : plus lent (coupe à 60 s), en secours quand QLever refuse ou ne répond pas */
const WDQS = 'https://query.wikidata.org/sparql'

interface Row { item: string, type: string, label: string, coord: string, sl?: string, h?: string }

interface Candidate extends NewPoi, Place {}

/**
 * Complète les lieux avec Wikidata (CC0) : châteaux, chapelles, musées, cascades… qui ont une fiche Wikidata
 * mais ne sont pas (ou pas reliés) dans OpenStreetMap. À lancer après import:lieux et import:ign, chaque mois.
 */
export default class ImportWikidata extends BaseCommand {
  static commandName = 'import:wikidata'
  static description = 'Complète les lieux avec Wikidata (châteaux, chapelles, musées, cascades…) absents d\'OpenStreetMap et de l\'IGN'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Pays à importer, tel que nommé dans config/pays.json (france, japon…)', default: 'france' })
  declare pays: string

  async run() {
    const country = countryNamed(this.pays)
    if (!country) {
      this.logger.error(`Pays inconnu : ${this.pays} (voir config/pays.json)`)
      this.exitCode = 1
      return
    }
    if (!country.wikidata) {
      this.logger.info(`${this.pays} : lieux Wikidata déjà couverts par un autre pays, rien à faire`)
      return
    }
    // France : nom français obligatoire (comme avant) ; ailleurs, la première langue disponible
    const pays = { qid: country.wikidata, code: country.code, langs: country.code === 'fr' ? ['fr'] : country.langues }
    const startedAt = new Date()
    const rows = await this.query(pays)
    this.logger.info(`${rows.length} réponses de Wikidata`)

    const { candidates, sitelinks } = toCandidates(rows)
    this.logger.info(`${candidates.length} lieux Wikidata (${this.pays})`)

    const { grid, wikidata } = await this.knownPlaces()
    // Déjà en base par son identifiant Wikidata (lieu OpenStreetMap relié à Wikidata) : rien à ajouter
    const unlinked = candidates.filter(c => !wikidata.has(c.wikidata!))
    const kept = keepNew(unlinked, grid)
    this.logger.info(`${candidates.length - unlinked.length} déjà reliés à un lieu en base, ${unlinked.length - kept.length} doublons proches, ${kept.length} nouveaux`)

    const count = await savePois(kept, { sitelinks, country: pays.code })
    this.logger.success(`${count} lieux Wikidata enregistrés`)
    // Garde-fou contre une réponse tronquée : on compare tout ce que Wikidata a renvoyé (pas seulement les nouveaux,
    // sinon les anciens lieux devenus doublons d'un lieu OpenStreetMap ne seraient jamais retirés)
    await this.deleteStale(pays.code, startedAt, candidates.length)
  }

  /** Une seule requête pour tout le pays : chaque élément, son type, son nom, sa position, sa notoriété */
  private async query({ qid, langs }: { qid: string, langs: string[] }): Promise<Row[]> {
    // Une seule langue : nom obligatoire dans cette langue ; plusieurs : la première disponible
    const label = langs.length === 1
      ? `?item rdfs:label ?label . FILTER(LANG(?label) = "${langs[0]}")`
      : langs.map((l, i) => `OPTIONAL { ?item rdfs:label ?l${i} . FILTER(LANG(?l${i}) = "${l}") }`).join('\n  ')
        + `\n  BIND(COALESCE(${langs.map((_, i) => `?l${i}`).join(', ')}) AS ?label)\n  FILTER(BOUND(?label))`
    const query = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?item ?type ?label ?coord ?sl ?h WHERE {
  VALUES ?type { ${TYPES.map(([q]) => `wd:${q}`).join(' ')} }
  ?item wdt:P31/wdt:P279* ?type .
  ?item wdt:P17 wd:${qid} ; wdt:P625 ?coord .
  ${label}
  OPTIONAL { ?item wikibase:sitelinks ?sl }
  MINUS { ?item wdt:P31 wd:Q575759 }
  MINUS { ?item wdt:P576 ?gone }
  # Villes et villages aussi classés « site archéologique » (Calais…) : ce ne sont pas des lieux à voir
  MINUS { ?item wdt:P31/wdt:P279* wd:Q486972 }
  MINUS { ?item wdt:P31/wdt:P279* wd:Q56061 }
  OPTIONAL { ?item wdt:P1435 ?h . FILTER(?h IN (wd:${CLASSE}, wd:${INSCRIT})) }
}`
    let lastError: unknown
    for (let attempt = 1; attempt <= 4; attempt++) {
      // Essais 1 et 3 : QLever ; 2 et 4 : service officiel
      const endpoint = attempt % 2 ? QLEVER : WDQS
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ query }),
          signal: AbortSignal.timeout(300_000),
        })
        if (!res.ok) throw new Error(`${endpoint === QLEVER ? 'QLever' : 'Wikidata'} ${res.status}`)
        const json = await res.json() as { results: { bindings: Record<keyof Row, { value: string } | undefined>[] } }
        return json.results.bindings.map(b => ({
          item: b.item!.value,
          type: b.type!.value,
          label: b.label!.value,
          coord: b.coord!.value,
          sl: b.sl?.value,
          h: b.h?.value,
        }))
      }
      catch (e) {
        lastError = e
        this.logger.warning(`Wikidata indisponible (essai ${attempt}/4) : ${String(e)}`)
        await new Promise(r => setTimeout(r, attempt * 30_000))
      }
    }
    throw lastError
  }

  /** Lieux déjà en base hors Wikidata (OpenStreetMap, IGN), et identifiants Wikidata déjà reliés */
  private async knownPlaces(): Promise<{ grid: Grid, wikidata: Set<string> }> {
    const rows = await db.from('pois').select('lat', 'lon', 'kind', 'name', 'wikidata').whereNot('osm_key', 'like', 'wd:%') as (Place & { wikidata: string | null })[]
    const grid = new Grid()
    const wikidata = new Set<string>()
    for (const r of rows) {
      grid.add(r)
      if (r.wikidata) wikidata.add(r.wikidata)
    }
    this.logger.info(`${rows.length} lieux OpenStreetMap et IGN en base pour écarter les doublons`)
    return { grid, wikidata }
  }

  /**
   * Lieux Wikidata du pays disparus, ou désormais reliés à un lieu OpenStreetMap (même garde-fou que les autres imports).
   * Les lieux importés avant la colonne « country » (sans pays) sont tous français.
   */
  private async deleteStale(code: string, startedAt: Date, found: number) {
    const knex = db.connection().getWriteClient()
    const ofCountry = (q: Knex.QueryBuilder) => q.where('osm_key', 'like', 'wd:%')
      .where(w => code === 'fr' ? w.where('country', code).orWhereNull('country') : w.where('country', code))
    const [{ total }] = await ofCountry(knex.from('pois')).count({ total: '*' }) as { total: number }[]
    if (found < Number(total) * 0.7) {
      this.logger.warning(`Seulement ${found} lieux renvoyés par Wikidata pour ${total} en base : suppression des anciens annulée par prudence`)
      return
    }
    const removed = await ofCountry(knex.from('pois')).where('updated_at', '<', startedAt).delete()
    this.logger.success(`${removed} lieux Wikidata retirés (disparus ou repris par OpenStreetMap)`)
  }
}

/** Un lieu par élément Wikidata (une ligne par type, position ou protection dans la réponse) */
function toCandidates(rows: Row[]): { candidates: Candidate[], sitelinks: Map<string, number> } {
  const byItem = new Map<string, { row: Row, rank: number, heritage: number }>()
  for (const r of rows) {
    const qid = r.item.split('/').pop()!
    const rank = RANK.get(r.type.split('/').pop()!) ?? 99
    const heritage = r.h?.endsWith(CLASSE) ? 2.5 : r.h?.endsWith(INSCRIT) ? 1.5 : 0
    const seen = byItem.get(qid)
    if (!seen) byItem.set(qid, { row: r, rank, heritage })
    else {
      if (rank < seen.rank) Object.assign(seen, { row: r, rank })
      seen.heritage = Math.max(seen.heritage, heritage)
    }
  }

  const candidates: Candidate[] = []
  const sitelinks = new Map<string, number>()
  for (const [qid, { row, heritage }] of byItem) {
    const kind = KIND.get(row.type.split('/').pop()!)
    const point = /Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(row.coord)
    const name = row.label.trim()
    if (!kind || !point || !name || /^Q\d+$/.test(name)) continue
    const fame = Number(row.sl ?? 0)
    if (NEEDS_FAME.has(kind) && !heritage && fame < 1) continue
    sitelinks.set(qid, fame)
    candidates.push({
      // « wd: » + identifiant Wikidata : distingue ces lieux de ceux d'OpenStreetMap et de l'IGN
      osmKey: `wd:${qid}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      lat: Number(point[2]),
      lon: Number(point[1]),
      kind,
      wikidata: qid,
      heritage,
      sitelinks: fame,
      score: 0,
    })
  }
  return { candidates, sitelinks }
}
