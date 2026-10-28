import type { Profile } from './profile'

/**
 * Modèle de temps
 * ---------------
 * 1. Chaque mètre du parcours est converti en « mètres-effort » équivalents plat
 *    grâce au coût énergétique de la course selon la pente (Minetti et al., 2002).
 * 2. Le temps total est extrapolé depuis une référence (allure, chrono ou course passée)
 *    avec la loi de Riegel : T = Tref × (D / Dref)^endurance.
 * 3. Le temps est réparti le long du parcours proportionnellement à l'effort.
 */

/** Coût énergétique de la course (J/kg/m) selon la pente i (fraction) — Minetti 2002 */
export function minetti(i: number): number {
  return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6
}

const FLAT_COST = minetti(0)

/**
 * Multiplicateur d'effort d'un mètre à la pente donnée.
 * En descente, le gain théorique n'est exploitable qu'en partie (technique,
 * freinage, sécurité) : `descente` va de 0 (aucun gain) à 1 (gain théorique complet).
 */
export function effortRatio(grade: number, descente: number): number {
  const i = Math.min(0.45, Math.max(-0.45, grade))
  const r = minetti(i) / FLAT_COST
  if (i >= 0 || r >= 1) return r
  return 1 - (1 - r) * descente
}

/** Effort cumulé (mètres équivalents plat) à chaque point du profil */
export function cumulativeEffort(p: Profile, descente: number, technicite: number): number[] {
  const cum = [0]
  for (let i = 0; i < p.d.length - 1; i++) {
    const step = p.d[i + 1]! - p.d[i]!
    const grade = (p.grade[i]! + p.grade[i + 1]!) / 2
    cum.push(cum[i]! + step * effortRatio(grade, descente) * technicite)
  }
  return cum
}

/** Effort cumulé interpolé à la distance `d` */
export function effortAt(p: Profile, cum: number[], d: number): number {
  const i = Math.min(p.d.length - 2, Math.max(0, Math.floor(d / p.step)))
  const span = p.d[i + 1]! - p.d[i]!
  const t = span > 0 ? Math.min(1, Math.max(0, (d - p.d[i]!) / span)) : 0
  return cum[i]! + (cum[i + 1]! - cum[i]!) * t
}

export interface Reference {
  /** Distance d'effort équivalent plat de la référence (m) */
  distance: number
  /** Temps réalisé sur cette référence (s) */
  time: number
}

/** Temps prévu pour une distance d'effort donnée (loi de Riegel) */
export function predictTime(effort: number, ref: Reference, endurance: number): number {
  return ref.time * Math.pow(effort / ref.distance, endurance)
}
