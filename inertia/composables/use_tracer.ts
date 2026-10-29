import { computed, effectScope, ref, watch } from 'vue'
import { haversine, toGpx, type Track, type TrackPoint } from '~/utils/gpx'
import { routeLeg, type Coord, type LatLon } from '~/utils/routing'
import { buildProfile } from '~/utils/profile'

export type TraceMode = 'sentiers' | 'droit'

export interface TraceLeg {
  id: number
  mode: TraceMode
  coords: Coord[]
  status: 'ok' | 'loading' | 'error'
}

interface Snapshot {
  waypoints: LatLon[]
  legs: TraceLeg[]
}

const STORAGE_KEY = 'ravito:tracer'

// État partagé du traceur (un seul brouillon à la fois)
const waypoints = ref<LatLon[]>([])
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

function addPoint(p: LatLon) {
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
    restore, addPoint, movePoint, removePoint, closeLoop, undo, clear, gpxText,
  }
}
