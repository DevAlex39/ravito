/**
 * « D'autres boucles » : combien de boucles nouvelles sort chaque tirage, et de quelle qualité.
 * Rejoue la page : premier tirage puis N actualisations avec les boucles déjà vues.
 *   node --import ./scripts/audit-boucles/register.mjs scripts/audit-boucles/diag-actualiser.mts [tirages] [km]
 */
import { generateLoops, retraceShare, searchRadius, type Loop, type Poi } from '~/utils/loops'

const PLACES = [
  { name: 'Dole', lat: 47.0920, lon: 5.4900 },
  { name: 'Ladoye-sur-Seille', lat: 46.7725, lon: 5.6828 },
  { name: 'Annecy', lat: 45.8992, lon: 6.1294 },
  { name: 'Gredisans', lat: 47.1567, lon: 5.5121 },
  { name: 'Lons-le-Saunier', lat: 46.6744, lon: 5.5547 },
]
const draws = Number(process.argv[2] ?? 6)
const km = Number(process.argv[3] ?? 10)
const target = km * 1000

const cells = (l: Loop) => new Set(l.coords.map(c => `${Math.round(c[1] / 0.00045)}:${Math.round(c[0] / 0.00065)}`))
/** Plus forte part du tracé commune avec UNE boucle déjà vue */
function closest(l: Loop, seen: Loop[]): number {
  const mine = cells(l)
  let best = 0
  for (const s of seen) {
    const other = cells(s)
    let n = 0
    for (const c of mine) if (other.has(c)) n++
    best = Math.max(best, n / mine.size)
  }
  return best
}

let all = 0
const quality = { err: 0, busy: 0, retrace: 0, stops: 0, n: 0 }
for (const p of PLACES) {
  const res = await fetch(`https://alpas.alpastudio.fr/lieux?lat=${p.lat}&lon=${p.lon}&rayon=${searchRadius(target)}`, { headers: { Accept: 'application/json', 'User-Agent': 'AlpastAudit/1.0' } })
  const pois = ((await res.json()) as { lieux: Poi[] }).lieux
  const shown: Loop[] = []
  const counts: string[] = []
  for (let v = 0; v < draws; v++) {
    const found = v === 0
      ? await generateLoops(p, target, pois, 3, { terrain: 'mixte', priority: 'distance' })
      : await generateLoops(p, target, pois, 3, { terrain: 'mixte', priority: 'distance' }, { variant: v, shown })
    for (const l of found) {
      quality.err += Math.abs(l.distance - target) / target
      quality.busy += l.surface.busy / l.distance
      quality.retrace += retraceShare(l)
      quality.stops += l.stops.length
      quality.n++
    }
    counts.push(`${found.length}${found.length ? ` (≤${Math.round(100 * Math.max(...found.map(l => closest(l, shown))))} %)` : ''}`)
    shown.push(...found)
  }
  all += shown.length
  console.log(`${p.name.padEnd(18)} ${String(shown.length).padStart(2)} boucles · par tirage : ${counts.join(' | ')}`)
}
const avg = (x: number) => `${(100 * x / quality.n).toFixed(1)} %`
console.log(`\nTotal ${all} boucles · écart distance ${avg(quality.err)} · grands axes ${avg(quality.busy)} · aller-retour ${avg(quality.retrace)} · ${(quality.stops / quality.n).toFixed(1)} lieux/boucle`)
console.log('(≤ X % = plus forte part de tracé commune avec une seule boucle déjà vue)')
