import type { Amenity, Loop } from '~/utils/loops'

/**
 * Boucles déjà calculées, gardées quelques heures dans le navigateur : refaire la même recherche
 * (même départ, mêmes réglages) les réaffiche aussitôt, sans redemander les itinéraires au serveur.
 */
export interface CachedLoops {
  loops: Loop[]
  amenities: Amenity[]
  message: string
  messageBad: boolean
}

const STORAGE_KEY = 'alpast:boucles:4'
const TTL = 6 * 3600_000
/** Au-delà, les plus anciennes sont oubliées (une boucle pèse quelques dizaines de Ko) */
const MAX_ENTRIES = 8

type Entry = { key: string, at: number, value: CachedLoops }

/** Copie en mémoire : la page s'en sert même si le stockage du navigateur est bloqué ou plein */
let memory: Entry[] | null = null

function entries(): Entry[] {
  if (!memory) {
    try {
      memory = (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Entry[]).filter(e => Date.now() - e.at < TTL)
    }
    catch {
      memory = []
    }
  }
  return memory
}

export function readLoops(key: string): CachedLoops | null {
  const hit = entries().find(e => e.key === key)
  return hit && Date.now() - hit.at < TTL ? hit.value : null
}

export function storeLoops(key: string, value: CachedLoops) {
  const list = [{ key, at: Date.now(), value }, ...entries().filter(e => e.key !== key)].slice(0, MAX_ENTRIES)
  memory = list
  // Stockage plein : on retire les plus anciennes jusqu'à ce que ça tienne (la copie en mémoire reste entière)
  for (let n = list.length; n > 0; n--) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, n)))
      return
    }
    catch {
      // essai suivant avec une entrée de moins
    }
  }
}
