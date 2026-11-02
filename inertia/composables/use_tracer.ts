import { computed, effectScope, ref, watch } from 'vue'
import { haversine, toGpx, type Track, type TrackPoint } from '~/utils/gpx'
import { routeLeg, type Coord, type LatLon } from '~/utils/routing'
import { buildProfile } from '~/utils/profile'

export type TraceMode = 'sentiers' | 'droit'

/** Lieu à voir posé comme point de passage : repéré sur la carte par son nom */
export interface TracePoi {
  id: number
  name: string
  kind: string
  category: 'patrimoine' | 'nature'
}

/** Point de passage ; `poi` quand c'est un lieu à voir (il le reste tant qu'on ne le déplace pas) */
export type TracePoint = LatLon & { poi?: TracePoi }

export interface TraceLeg {
  id: number
  mode: TraceMode
  coords: Coord[]
  status: 'ok' | 'loading' | 'error'
}

interface Snapshot {
  waypoints: TracePoint[]
  legs: TraceLeg[]
}

const STORAGE_KEY = 'ravito:tracer'

// État partagé du traceur (un seul brouillon à la fois)
const waypoints = ref<TracePoint[]>([])
const legs = ref<TraceLeg[]>([])
const mode = ref<TraceMode>('sentiers')
const name = ref('')
const history = ref<Snapshot[]>([])

let nextLegId = 1

function snapshot() {
  history.value.push({ waypoints: [...waypoints.value], legs: [...legs.value] })
  if (history.value.length > 100) history.value.shift()
}

/** Crée un tronçon entre deux points ; en mode sentiers, le calcul d'itinéraire arrive ensuite */
function makeLeg(a: LatLon, b: LatLon, legMode: TraceMode): TraceLeg {
  const leg: TraceLeg = {
    id: nextLegId++,
    mode: legMode,
    coords: [[a.lon, a.lat, null], [b.lon, b.lat, null]],
    status: legMode === 'sentiers' ? 'loading' : 'ok',
  }
  if (legMode === 'sentiers') {
    routeLeg(a, b)
      .then(coords => updateLeg(leg.id, { coords, status: 'ok' }))
      .catch(() => updateLeg(leg.id, { status: 'error' }))
  }
  return leg
}

/** Applique le résultat d'un calcul s'il concerne encore un tronçon affiché */
function updateLeg(id: number, patch: Partial<TraceLeg>) {
  const i = legs.value.findIndex(l => l.id === id)
  if (i < 0) return
  legs.value.splice(i, 1, { ...legs.value[i]!, ...patch })
  // L'historique garde l'ancienne version du tronçon : on le met à jour aussi pour que « Annuler » ne la ressuscite pas
  for (const snap of history.value) {
    const j = snap.legs.findIndex(l => l.id === id)
    if (j >= 0) snap.legs[j] = legs.value[i]!
  }
}

function addPoint(p: TracePoint) {
  snapshot()
  const prev = waypoints.value[waypoints.value.length - 1]
  waypoints.value.push(p)
  if (prev) legs.value.push(makeLeg(prev, p, mode.value))
}

function movePoint(i: number, p: LatLon) {
  snapshot()
  waypoints.value.splice(i, 1, p)
  const before = waypoints.value[i - 1]
  const after = waypoints.value[i + 1]
  if (before) legs.value.splice(i - 1, 1, makeLeg(before, p, legs.value[i - 1]!.mode))
  if (after) legs.value.splice(i, 1, makeLeg(p, after, legs.value[i]!.mode))
}

function removePoint(i: number) {
  snapshot()
  const n = waypoints.value.length
  if (n <= 1 || i === n - 1) {
    waypoints.value.pop()
    legs.value.pop()
  }
  else if (i === 0) {
    waypoints.value.shift()
    legs.value.shift()
  }
  else {
    const legMode = legs.value[i - 1]!.mode
    legs.value.splice(i - 1, 2, makeLeg(waypoints.value[i - 1]!, waypoints.value[i + 1]!, legMode))
    waypoints.value.splice(i, 1)
  }
}

/**
 * Ajoute un point là où il rallonge le moins le tracé (à vol d'oiseau) : entre deux points existants,
 * ou au bout si le tracé n'est pas bouclé. Ajouter plusieurs lieux ainsi donne un ordre de visite raisonnable.
 */
function insertPoint(p: TracePoint) {
  const w = waypoints.value
  if (w.length < 2) return addPoint(p)
  let best = { at: w.length, cost: isLoop.value ? Infinity : haversine(w[w.length - 1]!, p) }
  for (let i = 0; i < w.length - 1; i++) {
    const cost = haversine(w[i]!, p) + haversine(p, w[i + 1]!) - haversine(w[i]!, w[i + 1]!)
    if (cost < best.cost) best = { at: i + 1, cost }
  }
  if (best.at === w.length) return addPoint(p)
  snapshot()
  const before = w[best.at - 1]!
  const after = w[best.at]!
  const legMode = legs.value[best.at - 1]!.mode
  legs.value.splice(best.at - 1, 1, makeLeg(before, p, legMode), makeLeg(p, after, legMode))
  waypoints.value.splice(best.at, 0, p)
}

/** Retire du tracé le point posé sur ce lieu */
function removePoi(id: number) {
  const i = waypoints.value.findIndex(w => w.poi?.id === id)
  if (i >= 0) removePoint(i)
}

/** Revient au point de départ pour fermer la boucle */
function closeLoop() {
  const first = waypoints.value[0]
  if (first && waypoints.value.length > 1) addPoint({ ...first })
}

function undo() {
  const prev = history.value.pop()
  if (!prev) return
  waypoints.value = prev.waypoints
  legs.value = prev.legs
}

/** Remplace le tracé par un itinéraire déjà calculé (boucle découverte), pour l'ajuster à la main */
function loadRoute(points: (LatLon & Partial<TracePoi>)[], legCoords: Coord[][], routeName: string) {
  if (waypoints.value.length) snapshot()
  // Les lieux de la boucle restent des lieux (nom, icône) ; les points de forme deviennent de simples points
  waypoints.value = points.map(p => ({
    lat: p.lat,
    lon: p.lon,
    ...(p.id != null && p.name && p.kind && p.category ? { poi: { id: p.id, name: p.name, kind: p.kind, category: p.category } } : {}),
  }))
  legs.value = legCoords.map(coords => ({ id: nextLegId++, mode: 'sentiers', coords, status: 'ok' }))
  mode.value = 'sentiers'
  name.value = routeName
}

function clear() {
  if (!waypoints.value.length) return
  snapshot()
  waypoints.value = []
  legs.value = []
}

const isLoop = computed(() => {
  const w = waypoints.value
  return w.length > 2 && haversine(w[0]!, w[w.length - 1]!) < 30
})
const pending = computed(() => legs.value.some(l => l.status === 'loading'))
const failed = computed(() => legs.value.some(l => l.status === 'error'))

/**
 * Trace complète : les tronçons bout à bout, distances cumulées, altitudes manquantes
 * (lignes droites, échecs de calcul) interpolées entre les altitudes connues.
 */
const track = computed<Track | null>(() => {
  if (!legs.value.length) return null
  const coords: Coord[] = []
  legs.value.forEach((l, i) => coords.push(...(i === 0 ? l.coords : l.coords.slice(1))))

  const points: TrackPoint[] = []
  let d = 0
  for (const [lon, lat, ele] of coords) {
    const prev = points[points.length - 1]
    if (prev) d += haversine(prev, { lat, lon })
    points.push({ lat, lon, ele: ele ?? NaN, d })
  }
  if (d < 1) return null

  const known = points.map((p, i) => (isFinite(p.ele) ? i : -1)).filter(i => i >= 0)
  if (!known.length) points.forEach(p => (p.ele = 0))
  else {
    let k = 0
    points.forEach((p, i) => {
      if (isFinite(p.ele)) return
      while (k < known.length - 1 && known[k + 1]! < i) k++
      const a = points[known[k]!]!
      const b = points[known[Math.min(k + 1, known.length - 1)]!]!
      // Avant la première altitude connue ou après la dernière : on prolonge à plat
      if (i < known[0]! || b === a || b.d <= a.d) p.ele = a.ele
      else p.ele = a.ele + (b.ele - a.ele) * (p.d - a.d) / (b.d - a.d)
    })
  }
  return { name: name.value.trim() || 'Mon parcours', points, distance: d }
})

/** Le tracé n'a aucune altitude connue (que des lignes droites) */
const noElevation = computed(() => legs.value.length > 0 && legs.value.every(l => l.coords.every(c => c[2] == null)))

const profile = computed(() => (track.value ? buildProfile(track.value) : null))

function gpxText(): string | null {
  return track.value ? toGpx(track.value.name, track.value.points) : null
}

// --- Brouillon conservé dans le navigateur ---

let restored = false

function restore() {
  if (restored) return
  restored = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      waypoints.value = Array.isArray(saved.waypoints) ? saved.waypoints : []
      // Les calculs en cours au moment de la sauvegarde sont relancés
      legs.value = (Array.isArray(saved.legs) ? saved.legs as TraceLeg[] : []).map((l, i) => {
        const a = waypoints.value[i]
        const b = waypoints.value[i + 1]
        return l.status === 'loading' && a && b ? makeLeg(a, b, l.mode) : { ...l, id: nextLegId++ }
      })
      if (saved.mode === 'sentiers' || saved.mode === 'droit') mode.value = saved.mode
      name.value = typeof saved.name === 'string' ? saved.name : ''
    }
  }
  catch {
    // Brouillon illisible ou stockage bloqué : on repart d'une carte vide
  }
  // Portée détachée : la surveillance doit survivre au départ de la page
  effectScope(true).run(() => watch([waypoints, legs, mode, name], save, { deep: true }))
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ waypoints: waypoints.value, legs: legs.value, mode: mode.value, name: name.value }))
  }
  catch {
    // Stockage indisponible : le tracé reste utilisable, il ne sera juste pas repris
  }
}

export function useTracer() {
  return {
    waypoints, legs, mode, name, history,
    track, profile, isLoop, pending, failed, noElevation,
    restore, addPoint, insertPoint, movePoint, removePoint, removePoi, closeLoop, undo, clear, gpxText, loadRoute,
  }
}
