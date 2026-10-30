import { haversine, type Track } from '~/utils/gpx'
import { routeVia, type Coord, type LatLon, type Route, type RouteOptions, type Surface } from '~/utils/routing'

export interface Poi extends LatLon {
  id: number
  name: string
  kind: string
  category: 'patrimoine' | 'nature'
  score: number
  wikidata: string | null
  /** Objet OpenStreetMap : n = nœud, w = chemin, r = relation (ex. « w123456 ») */
  osmKey: string
  /** Score rapporté au meilleur lieu de la même catégorie (0 à 1) : sert à mélanger patrimoine et nature */
  weight?: number
}

export interface Loop {
  /** Départ, lieux visités dans l'ordre, retour au départ */
  waypoints: LatLon[]
  stops: Poi[]
  /** Tracé de chaque tronçon entre deux points de passage */
  legs: Coord[][]
  coords: Coord[]
  distance: number
  /** Part de sentiers et de grandes routes */
  surface: Surface
}

/** Rapport moyen entre la distance à pied et la distance à vol d'oiseau en ville */
const DETOUR = 1.3
/** Écart accepté avec la distance demandée */
const TOLERANCE = 0.1

/** Projection locale en mètres autour du départ (suffisante à l'échelle d'une boucle) */
function projector(origin: LatLon) {
  const k = Math.cos(origin.lat * Math.PI / 180) * 111_320
  return {
    toXY: (p: LatLon) => ({ x: (p.lon - origin.lon) * k, y: (p.lat - origin.lat) * 111_320 }),
    toLatLon: (x: number, y: number): LatLon => ({ lat: origin.lat + y / 111_320, lon: origin.lon + x / k }),
  }
}

/** Point de passage du tour : un lieu, ou un point de forme qui sert à régler la longueur */
interface Mark {
  /** Position sur le tour, de 0 à 2π depuis le départ */
  t: number
  poi?: Poi
}

interface Candidate {
  start: LatLon
  direction: number
  radius: number
  marks: Mark[]
  stops: Poi[]
  /** Somme des notoriétés des lieux visités */
  quality: number
}

function pathLength(points: LatLon[]) {
  let d = 0
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1]!, points[i]!)
  return d
}

/**
 * Points de passage du tour. Les lieux restent fixes ; les points de forme sont placés à
 * `rho` × rayon du centre : c'est le seul réglage de la longueur, qui varie ainsi en douceur.
 */
function waypointsOf(c: Candidate, rho = 1): LatLon[] {
  const { toLatLon } = projector(c.start)
  const cx = c.radius * Math.cos(c.direction)
  const cy = c.radius * Math.sin(c.direction)
  const startAngle = c.direction + Math.PI
  const points = c.marks.map((m) => {
    if (m.poi) return m.poi
    const a = startAngle + m.t
    return toLatLon(cx + rho * c.radius * Math.cos(a), cy + rho * c.radius * Math.sin(a))
  })
  return [c.start, ...points, c.start]
}

/**
 * Boucle « en cercle » partant du départ dans une direction : on retient les lieux les plus connus
 * situés près du cercle, bien répartis, puis on les visite dans l'ordre du tour.
 */
function candidate(start: LatLon, pois: Poi[], target: number, direction: number, radius: number): Candidate {
  const { toXY } = projector(start)
  const cx = radius * Math.cos(direction)
  const cy = radius * Math.sin(direction)
  const startAngle = direction + Math.PI
  const maxStops = Math.min(9, Math.max(3, Math.round(target / 1500)))
  const minGap = (2 * Math.PI) / (maxStops * 2.2)

  // Position de chaque lieu sur le tour, s'il est assez près du cercle
  const near = pois.flatMap((p) => {
    const { x, y } = toXY(p)
    const dist = Math.hypot(x - cx, y - cy)
    if (Math.abs(dist - radius) > 0.35 * radius) return []
    let t = Math.atan2(y - cy, x - cx) - startAngle
    t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    if (t < 0.25 || t > 2 * Math.PI - 0.25) return []
    return [{ p, t }]
  })

  const chosen: { p: Poi, t: number }[] = []
  for (const c of [...near].sort((a, b) => (b.p.weight ?? b.p.score) - (a.p.weight ?? a.p.score))) {
    if (chosen.length >= maxStops) break
    if (chosen.every(o => Math.abs(o.t - c.t) >= minGap)) chosen.push(c)
  }

  // Points de forme dans les grands vides du tour (au moins un, pour pouvoir régler la longueur)
  const marks: Mark[] = chosen.map(c => ({ t: c.t, poi: c.p }))
  const bounds = [0, ...chosen.map(c => c.t).sort((a, b) => a - b), 2 * Math.PI]
  let largest = { from: 0, gap: 0 }
  for (let k = 1; k < bounds.length; k++) {
    const from = bounds[k - 1]!
    const gap = bounds[k]! - from
    if (gap > largest.gap) largest = { from, gap }
    const n = Math.ceil(gap / (Math.PI / 2)) - 1
    for (let s = 1; s <= n; s++) marks.push({ t: from + (gap * s) / (n + 1) })
  }
  if (marks.every(m => m.poi)) marks.push({ t: largest.from + largest.gap / 2 })
  marks.sort((a, b) => a.t - b.t)

  return {
    start,
    direction,
    radius,
    marks,
    stops: marks.flatMap(m => (m.poi ? [m.poi] : [])),
    quality: chosen.reduce((acc, c) => acc + (c.p.weight ?? c.p.score), 0),
  }
}

/** Ajuste le rayon jusqu'à ce que la distance estimée (vol d'oiseau × détour) corresponde à la cible */
function fitCandidate(start: LatLon, pois: Poi[], target: number, direction: number, detour = DETOUR, radius = target / (2 * Math.PI * 1.15)) {
  let c = candidate(start, pois, target, direction, radius)
  for (let i = 0; i < 6; i++) {
    const estimate = pathLength(waypointsOf(c)) * detour
    if (Math.abs(estimate - target) / target < 0.04) break
    c = candidate(start, pois, target, direction, c.radius * Math.min(1.6, Math.max(0.6, target / estimate)))
  }
  return c
}

/**
 * Lieux retenus pour composer les boucles, catégorie par catégorie :
 * - patrimoine : les lieux documentés (Wikidata) d'abord, les autres seulement là où il y a peu de choix
 *   (écarte les petites chapelles anonymes) ;
 * - nature : tout est gardé, un sommet ou un belvédère nommé est un vrai but de sortie même sans fiche Wikipédia ;
 * - chaque lieu est noté par rapport au meilleur de sa catégorie, pour qu'une belle cascade
 *   pèse autant qu'un beau monument (le patrimoine a des scores Wikipédia bien plus élevés).
 */
function balance(allPois: Poi[]): Poi[] {
  return (['patrimoine', 'nature'] as const).flatMap((category) => {
    const all = allPois.filter(p => p.category === category)
    const documented = all.filter(p => p.score >= 3)
    const kept = category === 'nature' || documented.length < 5 ? all : documented
    const best = Math.max(...kept.map(p => p.score), 1)
    return kept.map(p => ({ ...p, weight: p.score / best }))
  })
}

function angleGap(a: number, b: number) {
  const d = Math.abs(a - b) % (2 * Math.PI)
  return Math.min(d, 2 * Math.PI - d)
}

/** Découpe l'itinéraire complet en tronçons, au plus près de chaque point de passage */
function splitLegs(coords: Coord[], waypoints: LatLon[]): Coord[][] {
  const legs: Coord[][] = []
  let from = 0
  for (let w = 1; w < waypoints.length; w++) {
    let to = coords.length - 1
    if (w < waypoints.length - 1) {
      let best = Infinity
      for (let i = from + 1; i < coords.length - 1; i++) {
        const d = haversine({ lon: coords[i]![0], lat: coords[i]![1] }, waypoints[w]!)
        if (d < best) {
          best = d
          to = i
        }
      }
    }
    legs.push(coords.slice(from, to + 1))
    from = to
  }
  return legs
}

async function routeOnce(waypoints: LatLon[], stops: Poi[], opts: RouteOptions): Promise<Loop> {
  let route: Route
  try {
    route = await routeVia(waypoints, opts)
  }
  catch {
    // Une requête peut échouer ponctuellement (serveur chargé) : une seconde chance après une pause
    await new Promise(r => setTimeout(r, 1500))
    route = await routeVia(waypoints, opts)
  }
  const { coords, surface } = route
  let distance = 0
  for (let i = 1; i < coords.length; i++) {
    distance += haversine({ lon: coords[i - 1]![0], lat: coords[i - 1]![1] }, { lon: coords[i]![0], lat: coords[i]![1] })
  }
  return { waypoints, stops, legs: splitLegs(coords, waypoints), coords, distance, surface }
}

/**
 * Calcule l'itinéraire réel puis règle sa longueur : les lieux ne bougent pas, seuls les points
 * de forme s'écartent ou se rapprochent du centre (méthode de la sécante, quelques essais).
 */
async function routeCandidate(target: number, first: Candidate, pois: Poi[], opts: RouteOptions): Promise<Loop> {
  let c = first
  let best: Loop | null = null
  let tries: { rho: number, distance: number }[] = []
  let rho = 1
  for (let attempt = 0; attempt < 6; attempt++) {
    const loop = await routeOnce(waypointsOf(c, rho), c.stops, opts)
    if (!best || Math.abs(loop.distance - target) < Math.abs(best.distance - target)) best = loop
    if (Math.abs(loop.distance - target) / target <= TOLERANCE * 0.8) break
    tries.push({ rho, distance: loop.distance })

    if (rho <= 0.05 && loop.distance > target) {
      // Même ramassée au maximum, la boucle reste trop longue : les lieux sont trop loin, on resserre le cercle
      const detour = Math.min(3, Math.max(1, loop.distance / pathLength(loop.waypoints)))
      c = fitCandidate(c.start, pois, target, c.direction, detour, c.radius * Math.max(0.5, target / loop.distance))
      tries = []
      rho = 1
      continue
    }
    const [a, b] = tries.slice(-2)
    rho = b && a && b.distance !== a.distance
      ? b.rho + ((target - b.distance) * (b.rho - a.rho)) / (b.distance - a.distance)
      : rho * (1 + 2 * (target - loop.distance) / loop.distance)
    rho = Math.min(3, Math.max(0, rho))
  }
  return best!
}

/**
 * Propose jusqu'à `count` boucles différentes d'environ `target` mètres depuis `start`,
 * en passant par les lieux les plus remarquables, sur le terrain demandé (`opts.terrain`).
 */
export async function generateLoops(start: LatLon, target: number, allPois: Poi[], count = 3, opts: RouteOptions = {}): Promise<Loop[]> {
  const pois = balance(allPois)
  const remaining = Array.from({ length: 12 }, (_, i) => fitCandidate(start, pois, target, (i * Math.PI) / 6))
    .sort((a, b) => b.quality - a.quality)

  // Écart minimal entre deux directions de départ : 75° pour 3 boucles, resserré quand on en demande plus
  const minGap = Math.min((Math.PI * 5) / 12, ((Math.PI * 2) / count) * 0.8)
  const loops: { direction: number, loop: Loop }[] = []
  // Boucles trop éloignées de la distance demandée : gardées seulement à défaut de mieux
  const weak: { direction: number, loop: Loop }[] = []
  let lastError: unknown
  // Une direction peut échouer (point de forme dans un lac, zone sans chemin) : on essaie alors la suivante
  for (let round = 0; round < 3 && loops.length < count && remaining.length; round++) {
    // Des boucles qui partent dans des directions vraiment différentes
    const picked: Candidate[] = []
    for (const c of [...remaining]) {
      if (loops.length + picked.length >= count) break
      const taken = [...loops.map(l => l.direction), ...picked.map(p => p.direction)]
      if (taken.every(d => angleGap(d, c.direction) >= minGap)) {
        picked.push(c)
        remaining.splice(remaining.indexOf(c), 1)
      }
    }
    if (!picked.length) break
    const results = await Promise.allSettled(picked.map(c => routeCandidate(target, c, pois, opts)))
    results.forEach((r, i) => {
      if (r.status === 'rejected') lastError = r.reason
      else if (Math.abs(r.value.distance - target) / target > TOLERANCE * 1.5) weak.push({ direction: picked[i]!.direction, loop: r.value })
      else loops.push({ direction: picked[i]!.direction, loop: r.value })
    })
  }
  weak.sort((a, b) => Math.abs(a.loop.distance - target) - Math.abs(b.loop.distance - target))
  for (const w of weak) {
    if (loops.length >= count) break
    if (loops.every(l => angleGap(l.direction, w.direction) >= minGap)) loops.push(w)
  }
  if (!loops.length) throw lastError ?? new Error('Aucune boucle trouvée')
  return loops.map(l => l.loop)
}

/** Rayon de recherche des lieux pour une boucle de `target` mètres */
export function searchRadius(target: number) {
  return Math.min(9000, Math.round(target * 0.45 + 300))
}

/** Trace exploitable (profil, GPX, plan) à partir d'une boucle ; altitudes manquantes reprises de la voisine */
export function loopTrack(loop: Loop, name: string): Track {
  const known = loop.coords.find(c => c[2] != null)?.[2] ?? 0
  let ele = known
  let d = 0
  const points = loop.coords.map((c, i) => {
    if (i > 0) d += haversine({ lon: loop.coords[i - 1]![0], lat: loop.coords[i - 1]![1] }, { lon: c[0], lat: c[1] })
    if (c[2] != null) ele = c[2]
    return { lat: c[1], lon: c[0], ele, d }
  })
  return { name, points, distance: d }
}
