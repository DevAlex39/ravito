import { climb, indexAt, type Profile } from './profile'

export type SegType = 'montee' | 'descente' | 'plat'

export interface Segment {
  index: number
  start: number
  end: number
  length: number
  gain: number
  loss: number
  /** Pente moyenne nette (fraction) */
  grade: number
  eleStart: number
  eleEnd: number
  type: SegType
}

export const SEG_LABELS: Record<SegType, string> = {
  montee: 'Montée',
  descente: 'Descente',
  plat: 'Plat / vallonné',
}

/** Pente moyenne à partir de laquelle un tronçon est une montée / une descente */
const TYPE_THRESHOLD = 0.03
/** Pente locale utilisée pour le premier étiquetage */
const LOCAL_THRESHOLD = 0.04

function typeOf(grade: number): SegType {
  if (grade > TYPE_THRESHOLD) return 'montee'
  if (grade < -TYPE_THRESHOLD) return 'descente'
  return 'plat'
}

/** Construit les tronçons à partir des coupures intérieures (en mètres) */
export function computeSegments(p: Profile, boundaries: number[]): Segment[] {
  const edges = [0, ...boundaries.filter(b => b > 0 && b < p.distance).sort((a, b) => a - b), p.distance]
  const segs: Segment[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    const start = edges[i]!
    const end = edges[i + 1]!
    const ia = indexAt(p, start)
    const ib = indexAt(p, end)
    const { gain, loss } = climb(p.ele, ia, ib)
    const length = end - start
    const grade = length > 0 ? (p.ele[ib]! - p.ele[ia]!) / length : 0
    segs.push({
      index: i,
      start,
      end,
      length,
      gain,
      loss,
      grade,
      eleStart: p.ele[ia]!,
      eleEnd: p.ele[ib]!,
      type: typeOf(grade),
    })
  }
  return segs
}

interface Run { type: number, from: number, to: number }

/**
 * Découpage automatique : montées, descentes et portions plates d'au moins `minLen` mètres
 * (par défaut ~1/30 du parcours, pour garder une trentaine de tronçons au plus).
 */
export function autoBoundaries(p: Profile, minLen = Math.max(400, p.distance / 30)): number[] {
  const label = (g: number) => (g > LOCAL_THRESHOLD ? 1 : g < -LOCAL_THRESHOLD ? -1 : 0)
  let runs: Run[] = []
  for (let i = 0; i < p.d.length - 1; i++) {
    const t = label(p.grade[i]!)
    const last = runs[runs.length - 1]
    if (last && last.type === t) last.to = i + 1
    else runs.push({ type: t, from: i, to: i + 1 })
  }
  const len = (r: Run) => p.d[r.to]! - p.d[r.from]!
  const mergeSame = (list: Run[]) => list.reduce<Run[]>((acc, r) => {
    const last = acc[acc.length - 1]
    if (last && last.type === r.type) last.to = r.to
    else acc.push({ ...r })
    return acc
  }, [])

  // On absorbe le plus court tronçon trop court dans son plus long voisin, jusqu'à stabilité
  while (runs.length > 1) {
    let k = -1
    let min = Infinity
    runs.forEach((r, i) => {
      const l = len(r)
      if (l < minLen && l < min) { min = l; k = i }
    })
    if (k < 0) break
    const prev = runs[k - 1]
    const next = runs[k + 1]
    const target = !prev ? next! : !next ? prev : (len(prev) >= len(next) ? prev : next)
    target.from = Math.min(target.from, runs[k]!.from)
    target.to = Math.max(target.to, runs[k]!.to)
    runs.splice(k, 1)
    runs = mergeSame(runs)
  }

  // Le type réel d'un tronçon dépend de sa pente moyenne : on fusionne les voisins qui finissent identiques
  return simplify(p, runs.slice(1).map(r => p.d[r.from]!))
}

/** Supprime les coupures entre deux tronçons de même type */
export function simplify(p: Profile, boundaries: number[]): number[] {
  let bounds = [...boundaries]
  let changed = true
  while (changed) {
    changed = false
    const segs = computeSegments(p, bounds)
    for (let i = 0; i < segs.length - 1; i++) {
      if (segs[i]!.type === segs[i + 1]!.type) {
        bounds = bounds.filter(b => b !== segs[i]!.end)
        changed = true
        break
      }
    }
  }
  return bounds
}
