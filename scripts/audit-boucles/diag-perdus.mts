/**
 * Pourquoi des lieux prévus dans une boucle disparaissent au calcul : pour chaque lieu prévu non annoncé,
 * distance du lieu à l'itinéraire brut (avant coupe des allers-retours) et au tracé final.
 *   node --import ./scripts/audit-boucles/register.mjs scripts/audit-boucles/diag-perdus.mts <rapport.json>
 */
import fs from 'node:fs'
import { generateLoops, searchRadius, type Poi } from '~/utils/loops'
import { routeVia, type Terrain } from '~/utils/routing'
import { haversine } from '~/utils/gpx'

const [file] = process.argv.slice(2)
const report = JSON.parse(fs.readFileSync(file!, 'utf8')) as { reports: { place: string, km: number, terrain: Terrain, link: string }[] }
const starts = new Map(report.reports.map(r => [r.place, r]))
const minDist = (coords: number[][], p: Poi) => Math.min(...coords.map(c => haversine({ lon: c[0]!, lat: c[1]! }, p)))

const causes: Record<string, number> = {}
const byKind: Record<string, number> = {}
for (const r of starts.values()) {
  const url = new URL(r.link)
  const start = { lat: Number(url.searchParams.get('lat')), lon: Number(url.searchParams.get('lon')) }
  const pois = ((await (await fetch(`https://alpas.alpastudio.fr/lieux?lat=${start.lat}&lon=${start.lon}&rayon=${searchRadius(r.km * 1000)}`, { headers: { Accept: 'application/json', 'User-Agent': 'AlpastAudit/1.0' } })).json()) as { lieux: Poi[] }).lieux
  const loops = await generateLoops(start, r.km * 1000, pois, 3, { terrain: r.terrain })
  for (const loop of loops) {
    const via = loop.via ?? []
    const planned = pois.filter(p => via.some(w => w.lat === p.lat && w.lon === p.lon))
    const lost = planned.filter(p => !loop.stops.some(s => s.id === p.id))
    if (!lost.length) continue
    const raw = await routeVia(via, { terrain: r.terrain })
    for (const p of lost) {
      const dRaw = minDist(raw.coords, p)
      const dFinal = minDist(loop.coords, p)
      // Itinéraire brut au lieu mais tracé final loin : l'aller-retour pour l'atteindre a été coupé
      const cause = dRaw > 200 ? 'aucun chemin jusqu\'au lieu' : dFinal > 200 ? 'impasse coupée (> 300 m ou grand axe)' : 'autre'
      causes[cause] = (causes[cause] ?? 0) + 1
      byKind[`${p.category}/${p.kind}`] = (byKind[`${p.category}/${p.kind}`] ?? 0) + 1
      console.log(`${r.place.padEnd(32)} ${p.name.slice(0, 34).padEnd(34)} ${p.kind.padEnd(18)} brut ${String(Math.round(dRaw)).padStart(4)} m · final ${String(Math.round(dFinal)).padStart(4)} m · ${cause}`)
    }
  }
}
console.log('\nCauses :', causes)
console.log('Types perdus :', Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
