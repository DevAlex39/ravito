/**
 * Diagnostic des allers-retours d'une série de boucles (rapport JSON d'un audit) : pour les pires,
 * régénère la boucle et dit d'où vient chaque bout fait deux fois (lieu, point de forme, départ, autre).
 *   node --import ./scripts/audit-boucles/register.mjs scripts/audit-boucles/diag-ar.mts <rapport.json> [nombre]
 */
import fs from 'node:fs'
import { generateLoops, searchRadius, type Poi } from '~/utils/loops'
import type { Terrain } from '~/utils/routing'
import { haversine } from '~/utils/gpx'

type Coord = [number, number, number?]
const [file, countArg] = process.argv.slice(2)
const report = JSON.parse(fs.readFileSync(file!, 'utf8')) as { reports: { place: string, km: number, terrain: Terrain, index: number, distance: number, doubled: number, link: string }[] }
const worst = [...report.reports].sort((a, b) => b.doubled / b.distance - a.doubled / a.distance).slice(0, Number(countArg ?? 12))
const pt = (c: Coord) => ({ lon: c[0], lat: c[1] })
const key = (a: Coord, b: Coord) => `${a[0].toFixed(6)},${a[1].toFixed(6)}>${b[0].toFixed(6)},${b[1].toFixed(6)}`

const totals: Record<string, number> = {}
for (const r of worst) {
  const url = new URL(r.link)
  const start = { lat: Number(url.searchParams.get('lat')), lon: Number(url.searchParams.get('lon')) }
  const pois = ((await (await fetch(`https://alpas.alpastudio.fr/lieux?lat=${start.lat}&lon=${start.lon}&rayon=${searchRadius(r.km * 1000)}`, { headers: { Accept: 'application/json', 'User-Agent': 'AlpastAudit/1.0' } })).json()) as { lieux: Poi[] }).lieux
  const loops = await generateLoops(start, r.km * 1000, pois, 3, { terrain: r.terrain })
  const loop = loops[r.index - 1]
  if (!loop) continue
  const c = loop.coords as Coord[]
  const later = new Map<string, number>()
  for (let i = 0; i < c.length - 1; i++) later.set(key(c[i + 1]!, c[i]!), i)
  // Bouts de l'aller refaits plus tard dans l'autre sens : [début, fin] sur l'aller
  const runs: { from: number, to: number, len: number }[] = []
  for (let i = 0; i < c.length - 1; i++) {
    const back = later.get(key(c[i]!, c[i + 1]!))
    if (back === undefined || back <= i) continue
    const len = haversine(pt(c[i]!), pt(c[i + 1]!))
    const last = runs[runs.length - 1]
    if (last && last.to === i) {
      last.to = i + 1
      last.len += len
    }
    else runs.push({ from: i, to: i + 1, len })
  }
  const via = loop.via ?? loop.waypoints
  const lines: string[] = []
  for (const run of runs.filter(x => x.len >= 50)) {
    const tip = pt(c[run.to]!)
    const base = pt(c[run.from]!)
    const near = via.slice(1, -1).map(w => ({ w, d: haversine(w, tip) })).sort((a, b) => a.d - b.d)[0]
    const isPoi = near && pois.some(p => Math.abs(p.lat - near.w.lat) < 1e-6 && Math.abs(p.lon - near.w.lon) < 1e-6)
    const fromStart = Math.min(haversine(base, start), haversine(tip, start))
    const cause = fromStart < 600 ? 'départ' : near && near.d < 300 ? (isPoi ? 'lieu' : 'point de forme') : 'autre'
    totals[cause] = (totals[cause] ?? 0) + run.len
    lines.push(`    ${Math.round(run.len)} m · ${cause}${near ? ` (point à ${Math.round(near.d)} m de la pointe)` : ''} · base à ${Math.round(haversine(base, start))} m du départ`)
  }
  console.log(`${r.place} ${r.km} km ${r.terrain} #${r.index} : ${Math.round((100 * r.doubled) / r.distance)} % AR, ${loop.stops.length} lieux`)
  console.log(lines.join('\n') || '    (rien de plus de 50 m)')
}
console.log('\nTotal par cause (m, une seule fois) :', totals)
