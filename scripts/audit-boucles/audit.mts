/**
 * Audit des boucles découverte : génère des boucles avec le vrai code du site (inertia/utils/loops.ts),
 * sur le BRouter et la base de lieux de production, et mesure ce qui compte pour la fiabilité :
 * - chemin inexistant : bout de tracé qui n'est pas un itinéraire BRouter (raccord de coupe > 25 m) ;
 * - grands axes : mètres sur nationales / grandes départementales (trunk, primary, secondary) ;
 * - allers-retours : mètres parcourus deux fois, et surtout ceux faits sur un grand axe (interdits) ;
 * - écart à la distance demandée, nombre de lieux.
 *
 * Lancement (depuis la racine du projet) :
 *   node --import ./scripts/audit-boucles/register.mjs scripts/audit-boucles/audit.mts [--rapide] [--ville Dole]
 * Rapport : scripts/audit-boucles/rapports/<date>.md (+ .json pour comparer deux audits)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateLoops, searchRadius, type Loop, type Poi } from '~/utils/loops'
import { routeVia, type Priority, type Terrain } from '~/utils/routing'
import { haversine } from '~/utils/gpx'

const SITE = 'https://alpas.alpastudio.fr'
const HERE = path.dirname(fileURLToPath(import.meta.url))

/** Départs variés : centres historiques, villes, montagne, campagne */
const PLACES: [string, number, number][] = [
  ['Dole', 47.0779, 5.4937], ['Besançon', 47.2378, 6.0241], ['Annecy', 45.899, 6.129], ['Arbois', 46.903, 5.774],
  ['Lons-le-Saunier', 46.674, 5.554], ['Salins-les-Bains', 46.938, 5.878], ['Pontarlier', 46.904, 6.355], ['Champagnole', 46.747, 5.907],
  ['Baume-les-Messieurs', 46.709, 5.644], ['Ornans', 47.104, 6.144], ['Saint-Claude', 46.387, 5.864], ['Mouthe', 46.71, 6.193],
  ['Dijon', 47.322, 5.041], ['Lyon', 45.762, 4.827], ['Paris Montmartre', 48.8867, 2.3431], ['Grenoble', 45.1885, 5.7245],
  ['Chamonix', 45.9237, 6.8694], ['Bordeaux', 44.8378, -0.5792], ['Nantes', 47.2184, -1.5536], ['Strasbourg', 48.5819, 7.7507],
  ['Clermont-Ferrand', 45.7772, 3.087], ['Marseille', 43.2951, 5.375], ['Toulouse', 43.6045, 1.444], ['Lille', 50.6372, 3.0633],
  ['Rennes', 48.1113, -1.68], ['Montpellier', 43.6108, 3.8767], ['Nancy', 48.6921, 6.1844], ['Colmar', 48.079, 7.3585],
]
/** Réglages tournants, pour couvrir distances et terrains de façon reproductible d'un audit à l'autre */
const KMS = [10, 15, 8, 21]
const TERRAINS: Terrain[] = ['mixte', 'mixte', 'sentiers', 'route']

/** Seuils de ce qui est inacceptable */
const PHANTOM_MIN = 25
const BUSY_SPUR_MAX = 40
const BUSY_SHARE_MAX = 0.1
/** Autour du départ (m) : repartir et revenir par la même rue est inévitable, ce n'est pas compté comme aller-retour */
const START_ZONE = 150

const args = process.argv.slice(2)
const quick = args.includes('--rapide')
const only = args.includes('--ville') ? args[args.indexOf('--ville') + 1]?.toLowerCase() : null
const priority: Priority = args.includes('--denivele') ? 'denivele' : 'distance'

type Pt = { lat: number, lon: number }
const pt = (c: number[]): Pt => ({ lon: c[0]!, lat: c[1]! })
const key = (a: number[], b: number[]) => `${a[0]},${a[1]}|${b[0]},${b[1]}`

interface LoopReport {
  place: string
  km: number
  terrain: Terrain
  index: number
  distance: number
  stops: number
  phantom: number[]
  busy: number
  doubled: number
  busyDoubled: number
  link: string
  problems: string[]
}

/** Analyse d'une boucle : on recalcule l'itinéraire brut par ses points de passage (BRouter est déterministe) */
async function inspect(loop: Loop, place: string, start: Pt, km: number, terrain: Terrain, index: number): Promise<LoopReport> {
  const raw = await routeVia(loop.via ?? loop.waypoints, { terrain, priority })
  const real = new Map<string, boolean>()
  for (let i = 0; i < raw.coords.length - 1; i++) {
    real.set(key(raw.coords[i]!, raw.coords[i + 1]!), raw.busy[i]!)
    real.set(key(raw.coords[i + 1]!, raw.coords[i]!), raw.busy[i]!)
  }
  const c = loop.coords
  const seen = new Map<string, number>()
  for (let i = 0; i < c.length - 1; i++) {
    const k = key(c[i]!, c[i + 1]!)
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  const phantom: number[] = []
  let busy = 0
  let doubled = 0
  let busyDoubled = 0
  /** Distance au départ (m) de chaque bout de grand axe fait en aller-retour */
  const spots: number[] = []
  for (let i = 0; i < c.length - 1; i++) {
    const len = haversine(pt(c[i]!), pt(c[i + 1]!))
    const k = key(c[i]!, c[i + 1]!)
    const onBusy = real.get(k)
    if (onBusy === undefined) {
      if (len > PHANTOM_MIN) phantom.push(Math.round(len))
      continue
    }
    if (onBusy) busy += len
    // Bout parcouru aussi dans l'autre sens (ou deux fois) : aller-retour ; compté une fois par passage
    const twice = (seen.get(key(c[i + 1]!, c[i]!)) ?? 0) > 0 || (seen.get(k) ?? 0) > 1
    if (twice) {
      doubled += len
      const away = haversine(pt(c[i]!), start)
      if (onBusy && away > START_ZONE) {
        busyDoubled += len
        spots.push(Math.round(away))
      }
    }
  }
  const p = new URLSearchParams({ lat: start.lat.toFixed(5), lon: start.lon.toFixed(5), km: String(km), n: '1', chemins: terrain, nom: place })
  if (priority !== 'distance') p.set('priorite', priority)
  p.set('via', (loop.via ?? loop.waypoints).map(w => `${w.lat.toFixed(5)},${w.lon.toFixed(5)}`).join('_'))
  if (loop.stops.length) p.set('lieux', loop.stops.map(s => s.id).join(','))
  const problems: string[] = []
  if (phantom.length) problems.push(`chemin inexistant (${phantom.join(', ')} m)`)
  if (busyDoubled / 2 > BUSY_SPUR_MAX) problems.push(`aller-retour sur grand axe (${Math.round(busyDoubled / 2)} m, à ${Math.min(...spots)}-${Math.max(...spots)} m du départ)`)
  if (busy / loop.distance > BUSY_SHARE_MAX) problems.push(`${Math.round((100 * busy) / loop.distance)} % sur grands axes`)
  return { place, km, terrain, index, distance: loop.distance, stops: loop.stops.length, phantom, busy, doubled, busyDoubled, link: `${SITE}/boucles?${p}`, problems }
}

async function fetchPois(start: Pt, target: number): Promise<Poi[]> {
  const res = await fetch(`${SITE}/lieux?lat=${start.lat.toFixed(5)}&lon=${start.lon.toFixed(5)}&rayon=${searchRadius(target)}`, { headers: { Accept: 'application/json', 'User-Agent': 'AlpastAudit/1.0' } })
  if (!res.ok) throw new Error(`lieux : ${res.status}`)
  return ((await res.json()) as { lieux: Poi[] }).lieux
}

// Chaque départ garde son rang (donc sa distance et son terrain) même quand on n'en teste qu'une partie
const places = PLACES.map((p, rank) => ({ p, rank })).filter(({ p }) => !only || p[0].toLowerCase().includes(only)).slice(0, quick ? 8 : undefined)
const partial = places.length < PLACES.length
const reports: LoopReport[] = []
const failures: string[] = []
const t0 = Date.now()
for (const { p: [place, lat, lon], rank: n } of places) {
  const km = KMS[n % KMS.length]!
  const terrain = TERRAINS[n % TERRAINS.length]!
  const start = { lat, lon }
  try {
    const pois = await fetchPois(start, km * 1000)
    const loops = await generateLoops(start, km * 1000, pois, 3, { terrain, priority })
    for (const [i, loop] of loops.entries()) reports.push(await inspect(loop, place, start, km, terrain, i + 1))
    const mine = reports.filter(r => r.place === place)
    console.log(`${place.padEnd(20)} ${String(km).padStart(2)} km ${terrain.padEnd(8)} ${mine.map(r => (r.problems.length ? '✗' : '✓')).join('')} ${mine.flatMap(r => r.problems).join(' ; ')}`)
  }
  catch (error) {
    failures.push(`${place} : ${(error as Error).message}`)
    console.log(`${place.padEnd(20)} ÉCHEC ${(error as Error).message}`)
  }
}

// --- Synthèse ---
const total = reports.reduce((a, r) => a + r.distance, 0)
const sum = (f: (r: LoopReport) => number) => reports.reduce((a, r) => a + f(r), 0)
const summary = {
  date: new Date().toISOString(),
  priority,
  boucles: reports.length,
  echecs: failures.length,
  sansProbleme: reports.filter(r => !r.problems.length).length,
  cheminInexistant: reports.filter(r => r.phantom.length).length,
  allerRetourGrandAxe: reports.filter(r => r.busyDoubled / 2 > BUSY_SPUR_MAX).length,
  partGrandsAxes: total ? sum(r => r.busy) / total : 0,
  partAllersRetours: total ? sum(r => r.doubled) / total : 0,
  ecartDistanceMoyen: reports.length ? sum(r => Math.abs(r.distance - r.km * 1000) / (r.km * 1000)) / reports.length : 0,
  lieuxMoyens: reports.length ? sum(r => r.stops) / reports.length : 0,
}
const pct = (x: number) => `${(100 * x).toFixed(1)} %`

const dir = path.join(HERE, 'rapports')
fs.mkdirSync(dir, { recursive: true })
// Audit partiel (--rapide, --ville) : gardé à part, il ne sert jamais de référence pour comparer
const stamp = summary.date.slice(0, 19).replace(/[:T]/g, '-') + (partial ? '-partiel' : '')
const previous = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.includes('partiel')).sort().pop()
fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify({ summary, reports, failures }, null, 1))

const prev = previous ? (JSON.parse(fs.readFileSync(path.join(dir, previous), 'utf8')).summary as typeof summary) : null
const delta = (now: number, before: number | undefined, fmt: (x: number) => string) => (before === undefined ? fmt(now) : `${fmt(now)} (avant ${fmt(before)})`)
const lines = [
  `# Audit des boucles — ${summary.date.slice(0, 16).replace('T', ' ')}`,
  '',
  `${places.length} départs, ${summary.boucles} boucles, priorité ${priority}, ${Math.round((Date.now() - t0) / 1000)} s.${previous ? ` Comparé à ${previous}.` : ''}`,
  '',
  '| Indicateur | Valeur |',
  '|---|---|',
  `| Boucles sans problème | ${delta(summary.sansProbleme / Math.max(1, summary.boucles), prev ? prev.sansProbleme / Math.max(1, prev.boucles) : undefined, pct)} |`,
  `| Avec chemin inexistant | ${delta(summary.cheminInexistant, prev?.cheminInexistant, String)} |`,
  `| Avec aller-retour sur grand axe | ${delta(summary.allerRetourGrandAxe, prev?.allerRetourGrandAxe, String)} |`,
  `| Part sur grands axes | ${delta(summary.partGrandsAxes, prev?.partGrandsAxes, pct)} |`,
  `| Part faite en aller-retour | ${delta(summary.partAllersRetours, prev?.partAllersRetours, pct)} |`,
  `| Écart moyen à la distance | ${delta(summary.ecartDistanceMoyen, prev?.ecartDistanceMoyen, pct)} |`,
  `| Lieux par boucle | ${delta(summary.lieuxMoyens, prev?.lieuxMoyens, x => x.toFixed(1))} |`,
  `| Départs en échec | ${summary.echecs} |`,
  '',
  '## Boucles à problème',
  '',
  ...reports.filter(r => r.problems.length).map(r => `- **${r.place}** ${r.km} km ${r.terrain}, boucle ${r.index} : ${r.problems.join(' ; ')} — [voir](${r.link})`),
  ...(failures.length ? ['', '## Échecs', '', ...failures.map(f => `- ${f}`)] : []),
  '',
]
fs.writeFileSync(path.join(dir, `${stamp}.md`), lines.join('\n'))
console.log(`\n${lines.slice(4, 14).join('\n')}\n\nRapport : scripts/audit-boucles/rapports/${stamp}.md`)
