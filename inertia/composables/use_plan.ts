import type { Track } from '~/utils/gpx'
import type { Segment } from '~/utils/segments'
import type { Reference } from '~/utils/model'
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { parseGpx } from '~/utils/gpx'
import { buildProfile, climb, indexAt } from '~/utils/profile'
import { autoBoundaries, computeSegments } from '~/utils/segments'
import { cumulativeEffort, effortAt, predictTime } from '~/utils/model'
import { pad, parsePace, parseTime } from '~/utils/format'

export interface Ravito {
  id: number
  name: string
  km: number
  /** Heure limite de passage "hh:mm" (vide = pas de barrière) */
  barrier: string
  /** Temps d'arrêt prévu, en minutes */
  stop: number
}

export interface Settings {
  mode: 'allure' | 'chrono' | 'course'
  /** Allure tenue sur 10 km, "min:s" */
  pace: string
  chronoKm: number
  chronoTime: string
  calibTime: string
  /** Heure de départ "hh:mm" */
  start: string
  descente: number
  technicite: number
  endurance: number
  carbsPerHour: number
  waterPerHour: number
  gelCarbs: number
  flask: number
  finishBarrier: string
  objectiveOn: boolean
  /** Temps visé à l'arrivée, arrêts compris "h:mm[:ss]" */
  objectiveTime: string
}

export interface TimelinePoint {
  key: string
  kind: 'start' | 'ravito' | 'finish'
  name: string
  d: number
  runTime: number
  arrival: number
  departure: number
  stop: number
  gainCum: number
  barrier: number | null
  margin: number | null
}

export interface Leg {
  from: TimelinePoint
  to: TimelinePoint
  distance: number
  gain: number
  loss: number
  duration: number
  carbs: number
  gels: number
  water: number
  overFlask: boolean
}

export interface SegmentRow extends Segment {
  time: number
  pace: number
  endClock: number
  /** Allure imposée à la main (mode objectif) */
  fixed: boolean
}

const STORAGE_KEY = 'ravito:v1'

function defaultSettings(): Settings {
  return {
    mode: 'allure',
    pace: '5:30',
    chronoKm: 10,
    chronoTime: '0:55:00',
    calibTime: '',
    start: '07:00',
    descente: 0.4,
    technicite: 1.08,
    endurance: 1.07,
    carbsPerHour: 60,
    waterPerHour: 500,
    gelCarbs: 25,
    flask: 1000,
    finishBarrier: '',
    objectiveOn: false,
    objectiveTime: '',
  }
}

// État partagé (application 100 % client, pas de SSR)
const gpxText = ref<string | null>(null)
const fileName = ref('')
const track = shallowRef<Track | null>(null)
const boundaries = ref<number[]>([])
const ravitos = ref<Ravito[]>([])
const settings = reactive<Settings>(defaultSettings())
const calibText = ref<string | null>(null)
const calibName = ref('')
const calibTrack = shallowRef<Track | null>(null)
const hoverD = ref<number | null>(null)
const error = ref('')
/** Allures imposées par tronçon (s/km), clé = bornes du tronçon */
const paceOverrides = ref<Record<string, number>>({})
const objectiveScale = ref(1)

const profile = computed(() => (track.value ? buildProfile(track.value) : null))
const calibProfile = computed(() => (calibTrack.value ? buildProfile(calibTrack.value) : null))
const segments = computed(() => (profile.value ? computeSegments(profile.value, boundaries.value) : []))
const effort = computed(() => (profile.value ? cumulativeEffort(profile.value, settings.descente, settings.technicite) : []))
const startSec = computed(() => parseTime(settings.start) ?? 7 * 3600)

const reference = computed<Reference | null>(() => {
  switch (settings.mode) {
    case 'allure': {
      const p = parsePace(settings.pace)
      return p ? { distance: 10000, time: p * 10 } : null
    }
    case 'chrono': {
      const t = parseTime(settings.chronoTime)
      return t && settings.chronoKm > 0 ? { distance: settings.chronoKm * 1000, time: t } : null
    }
    case 'course': {
      const t = parseTime(settings.calibTime)
      if (!t || !calibProfile.value) return null
      const e = cumulativeEffort(calibProfile.value, settings.descente, 1)
      return { distance: e[e.length - 1]!, time: t }
    }
  }
  return null
})

/** Temps de course prédit d'après le niveau (hors arrêts), en secondes */
const predictedRun = computed(() => {
  const e = effort.value
  if (!reference.value || !e.length) return null
  return predictTime(e[e.length - 1]!, reference.value, settings.endurance)
})

/** Allure équivalente sur 10 km plat, pour se situer */
const flatPace10k = computed(() => (reference.value ? predictTime(10000, reference.value, settings.endurance) / 10 : null))

// --- Mode objectif ---
// Le temps visé (arrêts compris) est réparti sur les tronçons au prorata de l'effort.
// Une allure saisie sur un tronçon le « fixe » et fait bouger le total ;
// `objectiveScale` étire les tronçons non fixés pour revenir à l'objectif.

const segKey = (s: Segment) => `${Math.round(s.start)}-${Math.round(s.end)}`

/** Effort (mètres équivalents plat) de chaque tronçon */
const segEffort = computed(() => {
  const p = profile.value
  const e = effort.value
  if (!p || !e.length) return []
  return segments.value.map(s => effortAt(p, e, s.end) - effortAt(p, e, s.start))
})

const totalStops = computed(() => sortedRavitos.value.reduce((acc, r) => acc + r.stop * 60, 0))

/** Temps de course visé (objectif moins les arrêts prévus) */
const objectiveRun = computed(() => {
  const t = parseTime(settings.objectiveTime)
  if (!settings.objectiveOn || !t) return null
  const run = t - totalStops.value
  return run > 0 ? run : null
})

interface PlanSeg { time: number, fixed: boolean, base: number }

/** Temps de chaque tronçon en mode objectif (null si le mode est inactif) */
const planSegs = computed<PlanSeg[] | null>(() => {
  const run = objectiveRun.value
  const eq = segEffort.value
  const total = eq.reduce((a, b) => a + b, 0)
  if (run == null || total <= 0) return null
  return segments.value.map((s, i) => {
    const base = run * eq[i]! / total
    const pace = paceOverrides.value[segKey(s)]
    return pace != null
      ? { time: pace * s.length / 1000, fixed: true, base }
      : { time: base * objectiveScale.value, fixed: false, base }
  })
})

/** Temps de course total du plan actif (objectif s'il est défini, sinon prédiction) */
const totalRun = computed(() => (planSegs.value ? planSegs.value.reduce((a, s) => a + s.time, 0) : predictedRun.value))

function runTimeAt(d: number): number {
  const p = profile.value
  const e = effort.value
  if (!p || totalRun.value == null || !e.length) return 0
  const plan = planSegs.value
  if (!plan) return totalRun.value * effortAt(p, e, d) / e[e.length - 1]!
  // Objectif : temps cumulé des tronçons précédents + part d'effort déjà faite dans le tronçon courant
  let acc = 0
  for (let i = 0; i < segments.value.length; i++) {
    const s = segments.value[i]!
    if (d <= s.end || i === segments.value.length - 1) {
      const eq = segEffort.value[i]!
      const done = effortAt(p, e, Math.min(d, s.end)) - effortAt(p, e, s.start)
      return acc + (eq > 0 ? plan[i]!.time * done / eq : 0)
    }
    acc += plan[i]!.time
  }
  return acc
}

/** Ramène une heure "hh:mm" sur le bon jour par rapport à l'heure d'arrivée prévue */
function barrierSec(txt: string, arrival: number): number | null {
  if (!txt.trim()) return null
  let b = parseTime(txt)
  if (b == null) return null
  while (b + 12 * 3600 < arrival) b += 86400
  return b
}

const sortedRavitos = computed(() => [...ravitos.value]
  .filter(r => profile.value && r.km * 1000 > 0 && r.km * 1000 < profile.value.distance)
  .sort((a, b) => a.km - b.km))

const timeline = computed<TimelinePoint[]>(() => {
  const p = profile.value
  if (!p) return []
  const pts: TimelinePoint[] = []
  let stops = 0
  const push = (key: string, kind: TimelinePoint['kind'], name: string, d: number, stopMin: number, barrierTxt: string) => {
    const runTime = runTimeAt(d)
    const arrival = startSec.value + runTime + stops
    const stop = stopMin * 60
    const barrier = barrierSec(barrierTxt, arrival)
    pts.push({
      key,
      kind,
      name,
      d,
      runTime,
      arrival,
      departure: arrival + stop,
      stop,
      gainCum: climb(p.ele, 0, indexAt(p, d)).gain,
      barrier,
      margin: barrier != null ? barrier - arrival : null,
    })
    stops += stop
  }
  push('start', 'start', 'Départ', 0, 0, '')
  for (const r of sortedRavitos.value) push(`r${r.id}`, 'ravito', r.name || 'Ravito', r.km * 1000, r.stop, r.barrier)
  push('finish', 'finish', 'Arrivée', p.distance, 0, settings.finishBarrier)
  return pts
})

const legs = computed<Leg[]>(() => {
  const p = profile.value
  if (!p) return []
  const tl = timeline.value
  const out: Leg[] = []
  for (let i = 0; i < tl.length - 1; i++) {
    const from = tl[i]!
    const to = tl[i + 1]!
    const { gain, loss } = climb(p.ele, indexAt(p, from.d), indexAt(p, to.d))
    const duration = to.runTime - from.runTime
    const hours = duration / 3600
    const water = hours * settings.waterPerHour
    const carbs = hours * settings.carbsPerHour
    out.push({
      from,
      to,
      distance: to.d - from.d,
      gain,
      loss,
      duration,
      carbs,
      gels: settings.gelCarbs > 0 ? Math.ceil(carbs / settings.gelCarbs - 0.25) : 0,
      water,
      overFlask: water > settings.flask,
    })
  }
  return out
})

/** Heure de passage prévue à la distance `d` (les arrêts aux ravitos précédents décalent l'horaire) */
function clockAt(d: number): number {
  const stops = timeline.value.filter(t => t.d < d).reduce((acc, t) => acc + t.stop, 0)
  return startSec.value + runTimeAt(d) + stops
}

const segmentRows = computed<SegmentRow[]>(() => segments.value.map((s, i) => {
  const time = runTimeAt(s.end) - runTimeAt(s.start)
  return {
    ...s,
    time,
    pace: s.length > 0 ? time / (s.length / 1000) : 0,
    endClock: clockAt(s.end),
    fixed: planSegs.value?.[i]?.fixed ?? false,
  }
}))

/** Repères affichés sur la carte et le profil */
const markers = computed(() => timeline.value
  .filter(t => t.kind === 'ravito')
  .map(t => ({ d: t.d, label: t.name })))

let nextId = 1

function setTrack(text: string, name: string): Track {
  const t = parseGpx(text)
  gpxText.value = text
  fileName.value = name
  track.value = t
  return t
}

function loadGpx(text: string, name: string, presetRavitos?: Omit<Ravito, 'id'>[]) {
  error.value = ''
  try {
    setTrack(text, name)
  }
  catch (e) {
    error.value = (e as Error).message
    return false
  }
  boundaries.value = autoBoundaries(profile.value!)
  ravitos.value = (presetRavitos ?? []).map(r => ({ ...r, id: nextId++ }))
  hoverD.value = null
  resetObjective()
  return true
}

function loadCalibration(text: string, name: string) {
  try {
    calibTrack.value = parseGpx(text)
    calibText.value = text
    calibName.value = name
    return ''
  }
  catch (e) {
    return (e as Error).message
  }
}

function clearCalibration() {
  calibTrack.value = null
  calibText.value = null
  calibName.value = ''
}

function resetSegments() {
  if (profile.value) boundaries.value = autoBoundaries(profile.value)
}

function mergeWithNext(index: number) {
  const seg = segments.value[index]
  if (!seg) return
  boundaries.value = boundaries.value.filter(b => b !== seg.end)
}

function splitAt(km: number) {
  const p = profile.value
  if (!p) return
  const d = Math.round(km * 1000)
  if (d <= 50 || d >= p.distance - 50) return
  if (boundaries.value.some(b => Math.abs(b - d) < 50)) return
  boundaries.value = [...boundaries.value, d].sort((a, b) => a - b)
}

function addRavito() {
  const p = profile.value
  if (!p) return
  const sorted = sortedRavitos.value
  const lastKm = sorted.length ? sorted[sorted.length - 1]!.km : 0
  const km = Math.round(((lastKm + p.distance / 1000) / 2) * 10) / 10
  ravitos.value.push({ id: nextId++, name: `Ravito ${ravitos.value.length + 1}`, km, barrier: '', stop: 3 })
}

function removeRavito(id: number) {
  ravitos.value = ravitos.value.filter(r => r.id !== id)
}

function clearTrack() {
  gpxText.value = null
  fileName.value = ''
  track.value = null
  boundaries.value = []
  ravitos.value = []
  hoverD.value = null
  settings.finishBarrier = ''
  resetObjective()
}

// --- Actions du mode objectif ---

/** Écart entre le plan et l'objectif saisi (s), positif = plus lent que l'objectif */
const objectiveGap = computed(() => (planSegs.value && objectiveRun.value != null ? totalRun.value! - objectiveRun.value : null))

/** Les allures fixées laissent-elles assez de temps aux autres tronçons pour tenir l'objectif ? */
const objectiveFeasible = computed(() => {
  const plan = planSegs.value
  if (!plan || objectiveRun.value == null) return true
  const fixed = plan.filter(s => s.fixed).reduce((a, s) => a + s.time, 0)
  return objectiveRun.value - fixed > 0.2 * plan.filter(s => !s.fixed).reduce((a, s) => a + s.base, 0)
})

/** Étire ou resserre les tronçons non fixés pour retomber sur l'objectif */
function rebalance() {
  const plan = planSegs.value
  const run = objectiveRun.value
  if (!plan || run == null) {
    objectiveScale.value = 1
    return
  }
  const fixed = plan.filter(s => s.fixed).reduce((a, s) => a + s.time, 0)
  const base = plan.filter(s => !s.fixed).reduce((a, s) => a + s.base, 0)
  objectiveScale.value = base > 0 ? Math.max(0.2, (run - fixed) / base) : 1
}

function enableObjective() {
  if (!parseTime(settings.objectiveTime) && predictedRun.value != null) {
    // Point de départ : la prédiction arrondie aux 5 minutes supérieures
    const t = Math.ceil((predictedRun.value + totalStops.value) / 300) * 300
    settings.objectiveTime = `${Math.floor(t / 3600)}:${pad(Math.floor(t % 3600 / 60))}`
  }
  settings.objectiveOn = true
  rebalance()
}

function disableObjective() {
  settings.objectiveOn = false
}

/** Impose une allure (s/km) sur un tronçon, ou la libère avec `null` */
function setSegmentPace(index: number, pace: number | null) {
  const s = segments.value[index]
  if (!s) return
  const next = { ...paceOverrides.value }
  if (pace == null) delete next[segKey(s)]
  else next[segKey(s)] = pace
  paceOverrides.value = next
}

function clearPaceOverrides() {
  paceOverrides.value = {}
  rebalance()
}

function resetObjective() {
  settings.objectiveOn = false
  settings.objectiveTime = ''
  paceOverrides.value = {}
  objectiveScale.value = 1
}

// --- Sauvegarde locale (confort uniquement : le site marche sans) ---

let restored = false

function restore() {
  if (restored) return
  restored = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      Object.assign(settings, defaultSettings(), saved.settings ?? {})
      if (saved.calibText) loadCalibration(saved.calibText, saved.calibName ?? '')
      if (saved.gpxText) {
        setTrack(saved.gpxText, saved.fileName ?? '')
        boundaries.value = Array.isArray(saved.boundaries) ? saved.boundaries : autoBoundaries(profile.value!)
        ravitos.value = Array.isArray(saved.ravitos) ? saved.ravitos : []
        nextId = Math.max(0, ...ravitos.value.map(r => r.id)) + 1
        if (saved.paceOverrides && typeof saved.paceOverrides === 'object') paceOverrides.value = saved.paceOverrides
        if (typeof saved.objectiveScale === 'number') objectiveScale.value = saved.objectiveScale
      }
    }
  }
  catch {
    // Sauvegarde illisible ou stockage bloqué : on repart de zéro
  }
  // Saisir un nouvel objectif répartit à nouveau le temps (les allures fixées restent)
  watch(() => settings.objectiveTime, rebalance)
  watch([gpxText, boundaries, ravitos, () => ({ ...settings }), calibText, paceOverrides, objectiveScale], save, { deep: true })
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      gpxText: gpxText.value,
      fileName: fileName.value,
      boundaries: boundaries.value,
      ravitos: ravitos.value,
      settings,
      calibText: calibText.value,
      calibName: calibName.value,
      paceOverrides: paceOverrides.value,
      objectiveScale: objectiveScale.value,
    }))
  }
  catch {
    // Quota dépassé (très gros GPX) ou stockage indisponible : tant pis pour la reprise
  }
}

export function usePlan() {
  return {
    // état
    gpxText, fileName, track, boundaries, ravitos, settings, calibName, calibTrack, hoverD, error,
    // dérivés
    profile, calibProfile, segments, segmentRows, reference, totalRun, predictedRun, flatPace10k, startSec, timeline, legs, markers,
    objectiveRun, objectiveGap, objectiveFeasible, totalStops,
    // actions
    clockAt, restore, loadGpx, loadCalibration, clearCalibration, clearTrack, resetSegments, mergeWithNext, splitAt, addRavito, removeRavito,
    enableObjective, disableObjective, setSegmentPace, clearPaceOverrides, rebalance,
  }
}
