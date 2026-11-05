import { haversine, type Track } from '~/utils/gpx'
import { buildProfile } from '~/utils/profile'
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

/** Point d'eau potable ou toilettes publiques (affichés en option le long de la boucle) */
export interface Amenity extends LatLon {
  id: number
  kind: 'water' | 'toilets'
  name: string | null
}

/** Points d'eau et toilettes à moins de `within` mètres du tracé */
export function amenitiesAlong(loop: Loop, list: Amenity[], within = 60): Amenity[] {
  if (!list.length || !loop.coords.length) return []
  const lats = loop.coords.map(c => c[1])
  const lons = loop.coords.map(c => c[0])
  const mLat = 111_320
  const mLon = 111_320 * Math.cos((lats[0]! * Math.PI) / 180)
  const [south, north] = [Math.min(...lats) - within / mLat, Math.max(...lats) + within / mLat]
  const [west, east] = [Math.min(...lons) - within / mLon, Math.max(...lons) + within / mLon]
  return list.filter((a) => {
    if (a.lat < south || a.lat > north || a.lon < west || a.lon > east) return false
    // Distance aux points du tracé (espacés de quelques mètres) : assez précis pour 60 m
    for (const c of loop.coords) {
      const dx = (c[0] - a.lon) * mLon
      const dy = (c[1] - a.lat) * mLat
      if (dx * dx + dy * dy <= within * within) return true
    }
    return false
  })
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
  /** Points de passage demandés au calcul (avant nettoyage) : les repasser redonne exactement cette boucle */
  via?: LatLon[]
  /** Direction du tour depuis le départ (radians, 0 = est), pour en calculer des variantes */
  direction?: number
}

/** Rapport moyen entre la distance à pied et la distance à vol d'oiseau en ville */
const DETOUR = 1.3
/** Écart accepté avec la distance demandée */
const TOLERANCE = 0.1
/**
 * Aller-retour accepté pour aller voir un lieu (m) : un château au bout d'une petite impasse, oui ;
 * doubler un long chemin, non. Aux points de forme, tout aller-retour est coupé.
 */
const MAX_SPUR_POI = 300
const MIN_SPUR = 30
/**
 * Aller-retour vers un lieu sur une route à fort trafic (m) : au-delà, le lieu est abandonné.
 * Passer par cette route pour continuer le tour ailleurs reste permis : ce n'est pas un aller-retour.
 */
const BUSY_SPUR_MAX = 40
/** Part de grands axes au-delà de laquelle une boucle n'est gardée qu'à défaut d'une autre (voir generateLoops) */
const BUSY_SHARE_MAX = 0.1
const busyShare = (l: Loop) => (l.distance ? l.surface.busy / l.distance : 0)
/**
 * Part de la boucle faite en aller-retour au-delà de laquelle elle n'est gardée qu'à défaut d'une autre.
 * En campagne, c'est surtout la sortie du départ : on part et on revient par la même route sur 1 à 3 km.
 */
const RETRACE_SHARE_MAX = 0.15
/** Autour du départ (m) : repartir et revenir par la même rue est inévitable, ce n'est pas compté */
const RETRACE_FREE = 200
const retraced = new WeakMap<Loop, number>()
/** Part du tracé parcourue dans les deux sens (les deux passages comptent), hors abords du départ */
export function retraceShare(l: Loop): number {
  if (retraced.has(l)) return retraced.get(l)!
  const c = l.coords
  const key = (a: Coord, b: Coord) => `${a[0].toFixed(6)},${a[1].toFixed(6)}>${b[0].toFixed(6)},${b[1].toFixed(6)}`
  const edges = new Set<string>()
  for (let i = 0; i < c.length - 1; i++) edges.add(key(c[i]!, c[i + 1]!))
  let twice = 0
  for (let i = 0; i < c.length - 1; i++) {
    if (!edges.has(key(c[i + 1]!, c[i]!)) || haversine(at(c[i]!), at(c[0]!)) < RETRACE_FREE) continue
    twice += step(c, i)
  }
  const share = l.distance ? twice / l.distance : 0
  retraced.set(l, share)
  return share
}
/** Écart maximal (m) entre les deux bouts raccordés quand on coupe un aller-retour */
const JOIN_MAX = 25
/** Un lieu n'est annoncé que si le tracé passe à moins de cette distance (m) */
const STOP_REACH = 200
/** Autour du départ (m) : lieux visités en début ou en fin de boucle, même loin du cercle */
const START_ZONE = 600
/** Lieux du centre enchaînés au plus, à l'aller comme au retour */
const NEAR_MAX = 3
/** Longueur maximale de chacune des deux promenades dans le centre, en part de la boucle */
const NEAR_BUDGET = 0.08

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

  // Position de chaque lieu sur le tour, s'il est assez près du cercle. Les lieux tout proches du départ
  // (souvent le cœur historique quand on part du centre-ville) sont aussi gardés : on les traverse en
  // début ou en fin de boucle
  const near = pois.flatMap((p) => {
    const { x, y } = toXY(p)
    const fromStart = Math.hypot(x, y)
    if (fromStart < 60) return []
    const dist = Math.hypot(x - cx, y - cy)
    if (Math.abs(dist - radius) > 0.35 * radius && fromStart > START_ZONE) return []
    let t = Math.atan2(y - cy, x - cx) - startAngle
    t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    return [{ p, t, x, y, nearStart: fromStart <= START_ZONE }]
  })

  const byWeight = [...near].sort((a, b) => (b.p.weight ?? b.p.score) - (a.p.weight ?? a.p.score))
  const chosen: typeof near = []
  for (const c of byWeight) {
    if (chosen.length >= maxStops) break
    if (!c.nearStart && chosen.every(o => Math.abs(o.t - c.t) >= minGap)) chosen.push(c)
  }
  // Le centre, autour du départ : une petite promenade à l'aller et une au retour (voir centerWalk),
  // orientée vers le premier lieu plus loin (aller) ou depuis le dernier (retour), sinon vers le cercle
  const far = [...chosen].sort((a, b) => a.t - b.t)
  for (const outward of [true, false]) {
    const side = byWeight.filter(c => c.nearStart && (c.t < Math.PI) === outward)
    const toward = (outward ? far[0] : far[far.length - 1]) ?? { x: cx, y: cy }
    chosen.push(...centerWalk(side, outward, NEAR_BUDGET * target, toward))
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

/**
 * Promenade dans le centre, autour du départ : les lieux les plus connus de ce côté de la boucle
 * (au plus NEAR_MAX, sans doublon à moins de 80 m), enchaînés de proche en proche depuis le départ.
 * À l'aller on s'éloigne du départ de lieu en lieu ; au retour, même chaîne parcourue à l'envers.
 * Leur position sur le tour est réécrite pour garder cet ordre : tout au début, ou tout à la fin.
 */
function centerWalk<T extends { p: Poi, t: number, x: number, y: number }>(side: T[], outward: boolean, budget: number, toward: { x: number, y: number }): T[] {
  // Avancement vers la suite de la boucle : un lieu derrière le départ obligerait à revenir sur ses pas
  const norm = Math.hypot(toward.x, toward.y) || 1
  const ahead = (c: { x: number, y: number }) => (c.x * toward.x + c.y * toward.y) / norm
  const picked: T[] = []
  for (const c of side) {
    if (picked.length >= NEAR_MAX) break
    if (ahead(c) < -100) continue
    if (picked.every(o => Math.hypot(o.x - c.x, o.y - c.y) >= 80)) picked.push(c)
  }
  // Dans l'ordre d'avancement, en s'arrêtant quand la promenade devient trop longue
  const chain: T[] = []
  let at = { x: 0, y: 0 }
  let length = 0
  const left = [...picked].sort((a, b) => ahead(a) - ahead(b))
  while (left.length) {
    const next = left.shift()!
    const step = Math.hypot(next.x - at.x, next.y - at.y)
    if (chain.length && length + step > budget) break
    chain.push(next)
    length += step
    at = next
  }
  const n = chain.length
  return (outward ? chain : chain.reverse()).map((c, k) => ({
    ...c,
    t: outward ? 0.001 * (k + 1) : 2 * Math.PI - 0.001 * (n - k),
  }))
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
 * Buts de sortie naturels (belvédère, sommet, cascade…) : rarement sur Wikipédia, leur note reste basse,
 * mais pour un coureur ils valent le détour autant qu'un monument connu. Leur poids part donc de 0,55.
 */
const GOAL_KINDS = new Set(['viewpoint', 'peak', 'saddle', 'waterfall', 'cave_entrance', 'arch', 'gorge', 'volcano'])

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
    return kept.map(p => ({ ...p, weight: GOAL_KINDS.has(p.kind) ? 0.55 + (0.45 * p.score) / best : p.score / best }))
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

/** Distance d'un point du tronçon au suivant */
function step(coords: Coord[], i: number) {
  return haversine({ lon: coords[i]![0], lat: coords[i]![1] }, { lon: coords[i + 1]![0], lat: coords[i + 1]![1] })
}

/**
 * Points tous les 10 m le long d'un tronçon, à intervalle régulier même quand le tracé est fait de
 * petits bouts de 2-3 m (sinon chaque bout compterait pour 10 m et l'aller-retour serait surestimé)
 */
function sample(coords: Coord[], max: number): LatLon[] {
  const out: LatLon[] = []
  let d = 0
  let next = 0
  for (let i = 0; i < coords.length - 1 && next < max; i++) {
    const a = { lon: coords[i]![0], lat: coords[i]![1] }
    const b = { lon: coords[i + 1]![0], lat: coords[i + 1]![1] }
    const len = step(coords, i)
    for (; next < d + len && next < max; next += 10) {
      const s = next - d
      out.push({ lat: a.lat + ((b.lat - a.lat) * s) / len, lon: a.lon + ((b.lon - a.lon) * s) / len })
    }
    d += len
  }
  return out
}

const at = (c: Coord): LatLon => ({ lon: c[0], lat: c[1] })

/** Index du point situé à `length` mètres avant (dir = -1) ou après (dir = 1) le point i */
function walk(coords: Coord[], i: number, length: number, dir: 1 | -1): number {
  let d = 0
  let j = i
  while (d < length && j + dir >= 0 && j + dir < coords.length) {
    d += haversine(at(coords[j]!), at(coords[j + dir]!))
    j += dir
  }
  return j
}

/** Le tracé repart presque à l'opposé au point i (direction vue à 10 m de part et d'autre) */
function isTurnaround(coords: Coord[], i: number): boolean {
  const { toXY } = projector(at(coords[i]!))
  const p = toXY(at(coords[walk(coords, i, 10, -1)]!))
  const q = toXY(at(coords[walk(coords, i, 10, 1)]!))
  const n1 = Math.hypot(p.x, p.y)
  const n2 = Math.hypot(q.x, q.y)
  // p et q partent tous deux du point i : un demi-tour les fait pointer dans le même sens
  return n1 > 3 && n2 > 3 && (p.x * q.x + p.y * q.y) / (n1 * n2) > 0.7
}

/** Longueur sur laquelle le tracé revient sur ses pas après le point i (à 15 m près) */
function spurLength(coords: Coord[], i: number): number {
  const back = sample(coords.slice(0, i + 1).reverse(), 5000)
  const next = sample(coords.slice(i), 5000)
  let n = 0
  while (n < back.length && n < next.length && haversine(back[n]!, next[n]!) < 15) n++
  return n * 10
}

/** Longueur (m) sur route à fort trafic entre les points `from` et `to` du tracé */
function busyLength(coords: Coord[], busy: boolean[], from: number, to: number): number {
  let d = 0
  for (let k = from; k < to; k++) if (busy[k]) d += step(coords, k)
  return d
}

/**
 * Coupe les allers-retours : quand le tracé va toucher un point de passage puis revient sur ses pas,
 * on retire la partie faite deux fois. Le point de forme disparaît ; un lieu au bout d'un long
 * cul-de-sac est abandonné (mieux vaut une boucle un peu plus courte qu'un aller-retour inutile).
 */
function cutSpurs(coords: Coord[], waypoints: LatLon[], stops: Poi[], busy: boolean[] = []) {
  let kept = waypoints.slice(1, -1)
  for (let guard = 0; guard < 30; guard++) {
    let cut = false
    for (let i = 1; i < coords.length - 1 && !cut; i++) {
      if (!isTurnaround(coords, i)) continue
      const spur = spurLength(coords, i)
      if (spur < MIN_SPUR) continue
      // Point de passage à l'origine du demi-tour (le plus proche de la pointe)
      const tip = at(coords[i]!)
      const near = kept
        .map(w => ({ w, d: haversine(w, tip) }))
        .filter(x => x.d < 250)
        .sort((a, b) => a.d - b.d)[0]?.w
      // Raccord : le point de l'aller le plus loin de la pointe qui se retrouve aussi au retour (à 3 m près).
      // `spur` n'est qu'une estimation (points espacés de 100 m sur une grande route, tolérance de 15 m à la fourche)
      const end = walk(coords, i, spur + 150, 1)
      let from = i
      let to = i
      let join = Infinity
      for (let f = walk(coords, i, spur, -1); f < i && join > 3; f++) {
        for (let k = i + 1; k <= end; k++) {
          const d = haversine(at(coords[k]!), at(coords[f]!))
          if (d < join) {
            join = d
            from = f
            to = k
          }
        }
      }
      // Un lieu au bout d'un court aller-retour est gardé, sauf si l'aller-retour emprunte une route à fort trafic
      if (near && stops.includes(near as Poi) && spur <= MAX_SPUR_POI && busyLength(coords, busy, from, i) < BUSY_SPUR_MAX) continue
      // Garde-fou : les deux bouts raccordés doivent se toucher, sinon la coupe tracerait une ligne droite hors chemin
      if (join > JOIN_MAX) continue
      coords = [...coords.slice(0, from + 1), ...coords.slice(to)]
      busy = [...busy.slice(0, from + 1), ...busy.slice(to)]
      if (near) kept = kept.filter(w => w !== near)
      cut = true
    }
    if (!cut) break
  }
  // Lieu sans chemin jusqu'à lui (sommet en pleine forêt…) : BRouter s'arrête au chemin le plus proche,
  // parfois loin, et l'aller-retour vers ce chemin a pu être coupé. Le tracé ne passe pas au lieu : on ne l'annonce pas.
  const reached = (p: LatLon) => coords.some(c => haversine(at(c), p) < STOP_REACH)
  kept = kept.filter(w => !stops.includes(w as Poi) || reached(w))
  return {
    coords,
    busy,
    waypoints: [waypoints[0]!, ...kept, waypoints[waypoints.length - 1]!],
    stops: stops.filter(p => kept.includes(p)),
  }
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
  const { busy: busyFlags, ...cut } = cutSpurs(route.coords, waypoints, stops, route.busy)
  const { coords } = cut
  let distance = 0
  for (let i = 0; i < coords.length - 1; i++) distance += step(coords, i)
  // Les parts de sentiers et de routes sont données pour tout l'itinéraire : on les ramène au tracé coupé ;
  // les grands axes, eux, sont connus point par point
  const ratio = route.surface.total ? distance / route.surface.total : 1
  const busy = busyFlags.length ? busyLength(coords, busyFlags, 0, coords.length - 1) : route.surface.busy * ratio
  const surface = { total: distance, trail: route.surface.trail * ratio, bigRoad: route.surface.bigRoad * ratio, busy }
  return { ...cut, legs: splitLegs(coords, cut.waypoints), distance, surface, via: waypoints }
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

/** Boucles déjà montrées : « D'autres boucles » doit proposer autre chose */
export interface AvoidOptions {
  /** Numéro du nouveau tirage (1, 2, 3…) : décale les directions de départ */
  variant: number
  /** Boucles déjà proposées depuis ce départ avec ces réglages */
  shown: Loop[]
}

/** Poids gardé par un lieu déjà visité par une boucle montrée : on préfère en découvrir d'autres */
const SEEN_STOP_WEIGHT = 0.3
/** Part du tracé commune avec UNE boucle montrée au-delà de laquelle la nouvelle est jugée « la même » */
const MAX_OVERLAP = 0.6
/**
 * Part du tracé déjà parcourue par l'ensemble des boucles montrées au-delà de laquelle la nouvelle n'apporte rien.
 * Plus large que MAX_OVERLAP : après quelques tirages, presque tous les chemins autour du départ ont été vus,
 * mais une boucle qui les enchaîne autrement reste une nouvelle boucle.
 */
const MAX_OVERLAP_ALL = 0.85
/** Directions de départ essayées : 12 au premier tirage, deux fois plus pour « D'autres boucles » */
const DIRECTIONS = 12

/** Cases d'environ 50 m traversées par un tracé, pour comparer deux boucles */
function cellsOf(coords: Coord[]): Set<string> {
  return new Set(coords.map(c => `${Math.round(c[1] / 0.00045)}:${Math.round(c[0] / 0.00065)}`))
}

/** Part du tracé qui passe par des cases déjà connues */
function overlap(loop: Loop, known: Set<string>): number {
  const cells = cellsOf(loop.coords)
  let seen = 0
  for (const c of cells) if (known.has(c)) seen++
  return cells.size ? seen / cells.size : 0
}

/**
 * Propose jusqu'à `count` boucles différentes d'environ `target` mètres depuis `start`,
 * en passant par les lieux les plus remarquables, sur le terrain demandé (`opts.terrain`).
 * Avec `avoid`, les boucles trop proches de celles déjà montrées sont écartées (peut en rendre moins, voire aucune).
 */
export async function generateLoops(start: LatLon, target: number, allPois: Poi[], count = 3, opts: RouteOptions = {}, avoid?: AvoidOptions): Promise<Loop[]> {
  const seenStops = new Set(avoid?.shown.flatMap(l => l.stops.map(p => p.id)) ?? [])
  const pois = balance(allPois).map(p => (seenStops.has(p.id) ? { ...p, weight: (p.weight ?? 0) * SEEN_STOP_WEIGHT } : p))
  const known = avoid ? cellsOf(avoid.shown.flatMap(l => l.coords)) : null
  const knownEach = avoid ? avoid.shown.map(l => cellsOf(l.coords)) : []
  const tooClose = (l: Loop) => !!known && (overlap(l, known) > MAX_OVERLAP_ALL || knownEach.some(k => overlap(l, k) > MAX_OVERLAP))
  // Nouveau tirage : plus de directions, décalées d'une fraction différente à chaque fois (nombre d'or)
  const directions = avoid ? DIRECTIONS * 2 : DIRECTIONS
  const step = (2 * Math.PI) / directions
  const offset = avoid ? ((avoid.variant * 0.618034) % 1) * step : 0
  const remaining = Array.from({ length: directions }, (_, i) => fitCandidate(start, pois, target, offset + i * step))
    .sort((a, b) => b.quality - a.quality)

  // Moins de dénivelé : on calcule deux fois plus de boucles pour garder celles qui montent le moins
  const lowClimb = opts.priority === 'denivele'
  const wanted = lowClimb ? Math.min(12, count * 2) : count
  // Écart minimal entre deux directions de départ : 75° pour 3 boucles, resserré quand on en demande plus
  const gapFor = (n: number) => Math.min((Math.PI * 5) / 12, ((Math.PI * 2) / n) * 0.8)
  const minGap = gapFor(count)
  const pickGap = gapFor(wanted)
  const loops: { direction: number, loop: Loop }[] = []
  // Boucles trop éloignées de la distance demandée : gardées seulement à défaut de mieux
  const weak: { direction: number, loop: Loop }[] = []
  let lastError: unknown
  // Une direction peut échouer (point de forme dans un lac, zone sans chemin) : on essaie alors la suivante
  // Plus d'essais pour « D'autres boucles » : beaucoup sont écartées, trop proches des boucles déjà vues
  for (let round = 0; round < (avoid ? 5 : 3) && loops.length < wanted && remaining.length; round++) {
    // Des boucles qui partent dans des directions vraiment différentes
    const picked: Candidate[] = []
    for (const c of [...remaining]) {
      if (loops.length + picked.length >= wanted) break
      const taken = [...loops.map(l => l.direction), ...picked.map(p => p.direction)]
      if (taken.every(d => angleGap(d, c.direction) >= pickGap)) {
        picked.push(c)
        remaining.splice(remaining.indexOf(c), 1)
      }
    }
    if (!picked.length) break
    const results = await Promise.allSettled(picked.map(c => routeCandidate(target, c, pois, opts)))
    results.forEach((r, i) => {
      if (r.status === 'rejected') lastError = r.reason
      // Trop semblable à une boucle déjà montrée : on n'en veut pas
      else if (tooClose(r.value)) return
      else if (Math.abs(r.value.distance - target) / target > TOLERANCE * 1.5 || busyShare(r.value) > BUSY_SHARE_MAX || retraceShare(r.value) > RETRACE_SHARE_MAX) weak.push({ direction: picked[i]!.direction, loop: r.value })
      else loops.push({ direction: picked[i]!.direction, loop: r.value })
    })
  }
  // À défaut de mieux : les moins éloignées de la distance demandée, un grand axe pesant lourd, puis les allers-retours
  const penalty = (l: Loop) => Math.abs(l.distance - target) / target + 2 * busyShare(l) + retraceShare(l)
  weak.sort((a, b) => penalty(a.loop) - penalty(b.loop))
  for (const w of weak) {
    if (loops.length >= wanted) break
    if (loops.every(l => angleGap(l.direction, w.direction) >= pickGap)) loops.push(w)
  }
  if (!loops.length && !avoid) throw lastError ?? new Error('Aucune boucle trouvée')
  let kept = loops
  if (lowClimb) {
    // Les moins vallonnées d'abord, toujours dans des directions bien différentes
    kept = []
    for (const l of [...loops].sort((a, b) => loopGain(a.loop) - loopGain(b.loop))) {
      if (kept.length >= count) break
      if (kept.every(k => angleGap(k.direction, l.direction) >= minGap)) kept.push(l)
    }
  }
  return kept.map(l => withPassedPlaces({ ...l.loop, direction: l.direction }, pois))
}

/** D+ de la boucle, calculé comme sur la page (profil lissé) */
export function loopGain(loop: Loop): number {
  return buildProfile(loopTrack(loop, '')).gain
}

/** Direction du tour vue du départ : celle du calcul, sinon celle du centre des points de passage */
function directionOf(loop: Loop, start: LatLon): number {
  if (loop.direction != null) return loop.direction
  const { toXY } = projector(start)
  const pts = (loop.via ?? loop.waypoints).map(toXY)
  return Math.atan2(pts.reduce((a, p) => a + p.y, 0), pts.reduce((a, p) => a + p.x, 0))
}

/**
 * Variante de la même boucle avec moins de dénivelé : mêmes points de passage calculés en évitant les montées,
 * puis la même direction et ses voisines (±20° et ±40°), qui peuvent changer un peu les lieux traversés.
 * Renvoie null si rien ne monte nettement moins (au moins 10 m et 5 % de moins) à distance comparable.
 */
export async function lowerClimb(loop: Loop, start: LatLon, target: number, allPois: Poi[], opts: RouteOptions = {}): Promise<Loop | null> {
  const climbOpts: RouteOptions = { ...opts, priority: 'denivele' }
  const pois = balance(allPois)
  const direction = directionOf(loop, start)
  const directions = [direction, direction, ...[-1, 1, -2, 2].map(k => direction + (k * Math.PI) / 9)]
  const tries: Promise<Loop>[] = [
    loopFromWaypoints(loop.via ?? loop.waypoints, loop.stops, climbOpts),
    ...directions.slice(1).map(d => routeCandidate(target, fitCandidate(start, pois, target, d), pois, climbOpts)),
  ]
  const before = loopGain(loop)
  let best: { loop: Loop, gain: number } | null = null
  const results = await Promise.allSettled(tries)
  for (const [i, r] of results.entries()) {
    if (r.status !== 'fulfilled') continue
    if (Math.abs(r.value.distance - target) / target > TOLERANCE * 1.5) continue
    const gain = loopGain(r.value)
    if (!best || gain < best.gain) best = { loop: { ...r.value, direction: directions[i] }, gain }
  }
  if (!best || best.gain > Math.min(before - 10, before * 0.95)) return null
  return withPassedPlaces(best.loop, pois)
}

/** Un lieu à moins de cette distance (m) du tracé est sur le chemin : on l'annonce comme les autres */
const PASS_BY = 75
/** Deux lieux plus proches que ça (m) sont le même endroit (une église et son entrée « monument historique ») */
const SAME_SPOT = 50
/** Même début de nom à moins de cette distance (m) : même lieu (le bâtiment et le musée qu'il abrite, à deux fiches) */
const SAME_NAME_SPOT = 200

/** Début de nom sans accents ni ponctuation (« Musée d'histoire culturelle d'Oslo » ≈ « Musée d’histoire culturelle ») */
const nameKey = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 16)

function sameSpot(a: Poi, b: Poi): boolean {
  const d = haversine(a, b)
  return d < SAME_SPOT || (d < SAME_NAME_SPOT && nameKey(a.name).length >= 8 && nameKey(a.name) === nameKey(b.name))
}

/** Lieux annoncés au plus par boucle (ceux visés sont toujours gardés) : au-delà, la liste et la carte deviennent illisibles */
const MAX_STOPS = 15

/**
 * Ajoute aux lieux d'une boucle ceux devant lesquels le tracé passe déjà sans les viser (le tracé ne change pas),
 * puis range tous les lieux dans l'ordre de passage. En campagne, c'est presque autant de lieux que ceux visés.
 */
export function withPassedPlaces(loop: Loop, pool: Poi[]): Loop {
  const c = loop.coords
  if (!c.length) return loop
  // Repère local en mètres et emprise du tracé : seuls les lieux dans l'emprise sont examinés
  const { toXY } = projector(at(c[0]!))
  const pts = c.map(p => toXY(at(p)))
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const box = { x0: Math.min(...xs) - PASS_BY, x1: Math.max(...xs) + PASS_BY, y0: Math.min(...ys) - PASS_BY, y1: Math.max(...ys) + PASS_BY }
  /** Point du tracé le plus proche du lieu et sa distance */
  const closest = (p: LatLon) => {
    const q = toXY(p)
    let best = { i: 0, d: Infinity }
    pts.forEach((t, i) => {
      const d = Math.hypot(t.x - q.x, t.y - q.y)
      if (d < best.d) best = { i, d }
    })
    return best
  }
  const stops = loop.stops.map(p => ({ p, i: closest(p).i }))
  // En ville on passe devant des dizaines de monuments : au plus MAX_STOPS lieux, les plus remarquables d'abord
  const byWeight = [...pool].sort((a, b) => (b.weight ?? b.score) - (a.weight ?? a.score))
  for (const p of byWeight) {
    if (stops.length >= MAX_STOPS) break
    if (stops.some(s => s.p.id === p.id || sameSpot(s.p, p))) continue
    const q = toXY(p)
    if (q.x < box.x0 || q.x > box.x1 || q.y < box.y0 || q.y > box.y1) continue
    const near = closest(p)
    if (near.d <= PASS_BY) stops.push({ p, i: near.i })
  }
  if (stops.length === loop.stops.length) return loop
  return { ...loop, stops: stops.sort((a, b) => a.i - b.i).map(s => s.p) }
}

/** Recalcule une boucle à partir de ses points de passage (lien partagé) */
export function loopFromWaypoints(waypoints: LatLon[], stops: Poi[], opts: RouteOptions = {}): Promise<Loop> {
  // Les lieux sont reconnus parmi les points de passage par identité (voir cutSpurs) :
  // le point du lien qui tombe sur un lieu (coordonnées arrondies au mètre) est remplacé par ce lieu
  const points = waypoints.map((w, i) => {
    if (i === 0 || i === waypoints.length - 1) return w
    return stops.find(s => haversine(s, w) < 15) ?? w
  })
  // Les lieux du lien qui ne sont pas des points de passage sont ceux devant lesquels on passe : on les retrouve
  return routeOnce(points, stops, opts).then(loop => withPassedPlaces(loop, stops))
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
