import type { IconName } from '~/utils/icons'

/** Option d'une liste déroulante (components/pick_list.vue) */
export interface PickOption<V> {
  value: V
  label: string
  /** Précision sous le libellé */
  hint?: string
  /** Valeur alignée à droite (ex. « ≈ 1h35 ») */
  side?: string
  icon?: IconName
}
