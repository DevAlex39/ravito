/**
 * Diagnostic des lieux d'une série de boucles (rapport JSON d'un audit) : pour chaque départ, combien de
 * lieux la base connaît dans la zone, de quels types, et combien la boucle en frôle sans les annoncer.
 *   node --import ./scripts/audit-boucles/register.mjs scripts/audit-boucles/diag-lieux.mts <rapport.json>
 */
import fs from 'node:fs'
import { generateLoops, searchRadius, type Poi } from '~/utils/loops'
import type { Terrain } from '~/utils/routing'
import { haversine } from '~/utils/gpx'

const [file] = process.argv.slice(2)
const report = JSON.parse(fs.readFileSync(file!, 'utf8')) as { reports: { place: string, km: number, terrain: Terrain, link: string }[] }
const starts = new Map(report.reports.map(r => [r.place, r]))

const kinds = new Map<string, number>()
let sumPlanned = 0, sumZone = 0, sumDoc = 0, sumStops = 0, sumNear = 0, loopsN = 0, empty = 0
for (const r of starts.values()) {
  const url = new URL(r.link)
  const start = { lat: Number(url.searchParams.get('lat')), lon: Number(url.searchParams.get('lon')) }
  const pois = ((await (await fetch(`https://alpas.alpastudio.fr/lieux?lat=${start.lat}&lon=${start.lon}&rayon=${searchRadius(r.km * 1000)}`, { headers: { Accept: 'application/json', 'User-Agent': 'AlpastAudit/1.0' } })).json()) as { lieux: Poi[] }).lieux
  for (const p of pois) kinds.set(p.kind, (kinds.get(p.kind) ?? 0) + 1)
  const documented = pois.filter(p => p.score >= 3).length
  const loops = await generateLoops(start, r.km * 1000, pois, 3, { terrain: r.terrain })
  const line: string[] = []
  for (const loop of loops) {
    // Lieux à moins de 100 m du tracé (échantillonné) mais pas annoncés comme étapes
    const near = pois.filter(p => !loop.stops.some(s => s.id === p.id)
      && loop.coords.some((c, i) => i % 3 === 0 && haversine({ lon: c[0], lat: c[1] }, p) < 100))
    const planned = (loop.via ?? []).filter(w => pois.some(p => p.lat === w.lat && p.lon === w.lon)).length
    sumPlanned += planned
    line.push(`${planned}→${loop.stops.length} lieux (+${near.length} frôlés)`)
    sumStops += loop.stops.length
    sumNear += near.length
    loopsN++
    if (!loop.stops.length) empty++
  }
  sumZone += pois.length
  sumDoc += documented
  console.log(`${r.place.padEnd(34)} ${String(r.km).padStart(2)} km · zone ${String(pois.length).padStart(3)} lieux (${documented} documentés) · ${line.join(', ')}`)
}
const n = starts.size
console.log(`\nMoyenne par départ : ${(sumZone / n).toFixed(1)} lieux dans la zone, ${(sumDoc / n).toFixed(1)} documentés`)
console.log(`Moyenne par boucle : ${(sumPlanned / loopsN).toFixed(1)} lieux prévus, ${(sumStops / loopsN).toFixed(1)} lieux annoncés, ${(sumNear / loopsN).toFixed(1)} frôlés non annoncés ; ${empty} boucles sans lieu`)
console.log('Types les plus présents :', [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k} ${v}`).join(', '))
