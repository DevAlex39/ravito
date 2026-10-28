import type { Track } from './gpx'

/** Profil ré-échantillonné à pas régulier et lissé : base de tous les calculs */
export interface Profile {
  step: number
  d: number[]
  ele: number[]
  /** Pente locale (fraction : 0.1 = 10 %) */
  grade: number[]
  distance: number
  gain: number
  loss: number
  minEle: number
  maxEle: number
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/**
 * D+ / D− entre deux indices, avec un seuil d'hystérésis pour ne pas
 * compter le bruit résiduel de l'altitude.
 */
export function climb(ele: number[], from: number, to: number, threshold = 2): { gain: number, loss: number } {
  let gain = 0
  let loss = 0
  let ref = ele[from] ?? 0
  for (let i = from + 1; i <= to; i++) {
    const diff = ele[i]! - ref
    if (diff >= threshold) { gain += diff; ref = ele[i]! }
    else if (diff <= -threshold) { loss -= diff; ref = ele[i]! }
  }
  const rest = (ele[to] ?? ref) - ref
  if (rest > 0) gain += rest
  else loss -= rest
  return { gain, loss }
}

export function buildProfile(track: Track, step = 25): Profile {
  const pts = track.points
  const n = Math.max(2, Math.ceil(track.distance / step) + 1)
  const d: number[] = []
  const raw: number[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const x = Math.min(i * step, track.distance)
    while (j < pts.length - 2 && pts[j + 1]!.d < x) j++
    const a = pts[j]!
    const b = pts[j + 1]!
    const t = b.d > a.d ? clamp((x - a.d) / (b.d - a.d), 0, 1) : 0
    d.push(x)
    raw.push(a.ele + (b.ele - a.ele) * t)
  }

  // Lissage par moyenne glissante (±50 m) : l'altitude GPS est bruitée
  const k = 2
  const ele = raw.map((_, i) => {
    let s = 0
    let c = 0
    for (let o = -k; o <= k; o++) {
      const v = raw[i + o]
      if (v !== undefined) { s += v; c++ }
    }
    return s / c
  })

  const g = 2
  const grade = ele.map((_, i) => {
    const a = Math.max(0, i - g)
    const b = Math.min(n - 1, i + g)
    return d[b]! > d[a]! ? (ele[b]! - ele[a]!) / (d[b]! - d[a]!) : 0
  })

  const { gain, loss } = climb(ele, 0, n - 1)
  return {
    step,
    d,
    ele,
    grade,
    distance: track.distance,
    gain,
    loss,
    minEle: Math.min(...ele),
    maxEle: Math.max(...ele),
  }
}

/** Indice du profil le plus proche de la distance `d` */
export function indexAt(p: Profile, d: number): number {
  return clamp(Math.round(d / p.step), 0, p.d.length - 1)
}

/** Altitude interpolée à la distance `d` */
export function eleAt(p: Profile, d: number): number {
  const i = clamp(Math.floor(d / p.step), 0, p.d.length - 2)
  const span = p.d[i + 1]! - p.d[i]!
  const t = span > 0 ? clamp((d - p.d[i]!) / span, 0, 1) : 0
  return p.ele[i]! + (p.ele[i + 1]! - p.ele[i]!) * t
}
