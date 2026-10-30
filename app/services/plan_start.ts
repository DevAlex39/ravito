/** Premier point de la trace d'un plan enregistré (texte JSON contenant le GPX) */
export function startOfPlan(data: string): { lat: number, lon: number } | null {
  let gpx: unknown
  try {
    gpx = JSON.parse(data).gpxText
  }
  catch {
    return null
  }
  if (typeof gpx !== 'string') return null
  // Les attributs lat et lon peuvent venir dans n'importe quel ordre
  const tag = gpx.match(/<(?:\w+:)?(?:trkpt|rtept)\b[^>]*>/)?.[0]
  const lat = Number(tag?.match(/\blat\s*=\s*["']([-\d.]+)/)?.[1])
  const lon = Number(tag?.match(/\blon\s*=\s*["']([-\d.]+)/)?.[1])
  return tag && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}
