import { APP_NAME } from '~/brand'

export interface TrackPoint {
  lat: number
  lon: number
  ele: number
  /** Distance cumulée depuis le départ, en mètres */
  d: number
}

export interface Track {
  name: string
  points: TrackPoint[]
  /** Distance totale en mètres */
  distance: number
}

const EARTH_RADIUS = 6371000

export function haversine(a: { lat: number, lon: number }, b: { lat: number, lon: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h))
}

function childText(el: Element, name: string): string {
  for (const c of Array.from(el.children)) {
    if (c.localName === name) return c.textContent?.trim() ?? ''
  }
  return ''
}

/** Lit un fichier GPX (traces ou itinéraires). Lève une erreur lisible si le fichier est inexploitable. */
export function parseGpx(text: string): Track {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Ce fichier n\'est pas un GPX valide.')

  let nodes = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'))
  if (nodes.length < 2) nodes = Array.from(doc.getElementsByTagNameNS('*', 'rtept'))
  if (nodes.length < 2) throw new Error('Aucune trace trouvée dans ce fichier.')

  const points: TrackPoint[] = []
  let d = 0
  for (const n of nodes) {
    const lat = parseFloat(n.getAttribute('lat') ?? '')
    const lon = parseFloat(n.getAttribute('lon') ?? '')
    if (!isFinite(lat) || !isFinite(lon)) continue
    const eleTxt = childText(n, 'ele')
    const ele = eleTxt ? parseFloat(eleTxt) : NaN
    const prev = points[points.length - 1]
    if (prev) {
      const step = haversine(prev, { lat, lon })
      if (step < 0.5) continue // points en double (pauses GPS)
      d += step
    }
    points.push({ lat, lon, ele, d })
  }
  if (points.length < 2) throw new Error('La trace contient trop peu de points.')

  // Altitudes manquantes : on recopie la dernière connue
  const firstKnown = points.find(p => isFinite(p.ele))
  if (!firstKnown || points.filter(p => isFinite(p.ele)).length < points.length / 2) {
    throw new Error('Ce GPX ne contient pas d\'altitudes : impossible d\'estimer les temps.')
  }
  let last = firstKnown.ele
  for (const p of points) {
    if (isFinite(p.ele)) last = p.ele
    else p.ele = last
  }

  const container = doc.getElementsByTagNameNS('*', 'trk')[0] ?? doc.getElementsByTagNameNS('*', 'rte')[0]
  const metadata = doc.getElementsByTagNameNS('*', 'metadata')[0]
  const name = (container && childText(container, 'name')) || (metadata && childText(metadata, 'name')) || 'Mon parcours'

  return { name, points, distance: d }
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]!))

/** Construit un fichier GPX 1.1 (une trace) à partir de points */
export function toGpx(name: string, points: { lat: number, lon: number, ele: number }[]): string {
  const pts = points
    .map(p => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(APP_NAME)}" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${escapeXml(name)}</name></metadata>
<trk><name>${escapeXml(name)}</name><trkseg>
${pts}
</trkseg></trk>
</gpx>
`
}

/** Position interpolée sur la trace à la distance `d` (mètres) */
export function pointAt(track: Track, d: number): TrackPoint {
  const pts = track.points
  if (d <= 0) return pts[0]!
  if (d >= track.distance) return pts[pts.length - 1]!
  let lo = 0
  let hi = pts.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (pts[mid]!.d <= d) lo = mid
    else hi = mid
  }
  const a = pts[lo]!
  const b = pts[hi]!
  const t = (d - a.d) / (b.d - a.d)
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, ele: a.ele + (b.ele - a.ele) * t, d }
}
