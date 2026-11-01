/**
 * Version publique d'un GPX partagé : la trace seule, sans ce qui en dit trop sur son auteur.
 *  - ni heures de passage, ni fréquence cardiaque / cadence (extensions), ni auteur, ni points d'intérêt perso ;
 *  - le nom du fichier remplacé par celui du parcours ;
 *  - les premiers et derniers mètres retirés : un départ de chez soi ne dévoile pas l'adresse.
 * Le propriétaire, lui, garde son fichier complet.
 */

/** Longueur masquée au départ et à l'arrivée (m), comme les « zones de confidentialité » des applis de sport */
export const PRIVACY_ZONE = 250

type Point = { lat: number, lon: number, ele: number | null }

export function publicGpx(gpxText: string, name: string): { gpx: string, trimmed: boolean } {
  const points = readPoints(gpxText)
  const total = length(points)
  // Trop court pour masquer les deux bouts sans tout effacer : on garde la trace entière
  const trimmed = total > PRIVACY_ZONE * 6
  const kept = trimmed ? cut(points, PRIVACY_ZONE, total - PRIVACY_ZONE) : points
  return { gpx: writeGpx(kept, name), trimmed }
}

/** Points de trace (ou de route, pour un GPX d'itinéraire), dans l'ordre */
function readPoints(text: string): Point[] {
  const out: Point[] = []
  // Un fichier qui a à la fois une trace et une route : la trace suffit
  const tag = /<trkpt\b/.test(text) ? /<(trkpt)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g : /<(rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/rtept>)/g
  for (const m of text.matchAll(tag)) {
    const lat = Number(m[2]!.match(/\blat\s*=\s*["']([^"']+)/)?.[1])
    const lon = Number(m[2]!.match(/\blon\s*=\s*["']([^"']+)/)?.[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const ele = Number(m[3]?.match(/<ele>\s*([^<\s]+)/)?.[1])
    out.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null })
  }
  return out
}

function distance(a: Point, b: Point) {
  const rad = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

function length(points: Point[]) {
  let d = 0
  for (let i = 1; i < points.length; i++) d += distance(points[i - 1]!, points[i]!)
  return d
}

/** Points situés entre deux distances depuis le départ */
function cut(points: Point[], from: number, to: number): Point[] {
  const out: Point[] = []
  let d = 0
  for (let i = 0; i < points.length; i++) {
    if (i) d += distance(points[i - 1]!, points[i]!)
    if (d >= from && d <= to) out.push(points[i]!)
  }
  return out
}

function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&apos;' })[c]!)
}

function writeGpx(points: Point[], name: string) {
  const pts = points
    .map(p => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${p.ele == null ? '' : `<ele>${p.ele.toFixed(1)}</ele>`}</trkpt>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Alpast" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`
}
