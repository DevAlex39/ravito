/**
 * Dédoublonnage des lieux venus d'autres sources qu'OpenStreetMap (IGN, Wikidata) :
 * un lieu n'est ajouté que si la base n'a pas déjà le même tout près.
 */

/** Types qui désignent le même genre de lieu : deux lieux proches de la même famille sont un doublon */
const FAMILY: Record<string, string> = {
  viewpoint: 'vue',
  peak: 'sommet', saddle: 'sommet', volcano: 'sommet',
  cave_entrance: 'grotte',
  waterfall: 'eau', spring: 'eau',
  gorge: 'roche', arch: 'roche', cliff: 'roche', rock: 'roche',
  lavoir: 'fontaine', fountain: 'fontaine',
  archaeological_site: 'vestige', ruins: 'vestige', tomb: 'vestige', stone: 'vestige',
  museum: 'musee', gallery: 'musee',
  monument: 'monument', memorial: 'monument',
  castle: 'chateau', fort: 'chateau', manor: 'chateau', palace: 'chateau', citywalls: 'chateau',
  place_of_worship: 'culte', cathedral: 'culte', church: 'culte',
  bridge: 'pont',
  tower: 'tour', lighthouse: 'tour',
  park: 'parc', garden: 'parc',
}
/** Distance sous laquelle deux lieux de la même famille sont le même lieu (mètres) */
const SAME_PLACE = 150
/** Les sommets sont placés moins précisément d'une source à l'autre */
const SAME_PEAK = 250
/** Même nom à moins d'1 km : même lieu, quel que soit le type */
const SAME_NAME = 1000
/** Un sommet IGN nomme souvent toute la colline : son point peut être loin de celui d'OpenStreetMap */
const SAME_PEAK_NAME = 2000
/** Noms donnés faute de mieux : deux « Lavoir » voisins sont bien deux lavoirs */
const GENERIC = new Set(['lavoir', 'point de vue', 'belvedere', 'table d orientation', 'megalithe'])

/** Garde les lieux que la base n'a pas déjà (ni la source elle-même deux fois) */
export function keepNew<T extends Place>(candidates: T[], known: Grid): T[] {
  const kept: T[] = []
  for (const c of candidates) {
    if (known.hasTwin(c)) continue
    kept.push(c)
    known.add(c)
  }
  return kept
}

export interface Place { lat: number, lon: number, kind: string, name: string }

/** Lieux rangés par case de 0,01° (~1 km) : on ne compare un lieu qu'à ses voisins */
export class Grid {
  private cells = new Map<string, Place[]>()

  get size() {
    let n = 0
    for (const list of this.cells.values()) n += list.length
    return n
  }

  add(p: Place) {
    const key = `${Math.floor(p.lat * 100)}:${Math.floor(p.lon * 100)}`
    const list = this.cells.get(key)
    if (list) list.push(p)
    else this.cells.set(key, [p])
  }

  /** Un lieu déjà là : même famille tout près, ou même nom (pas générique) dans les environs */
  hasTwin(c: Place): boolean {
    const family = FAMILY[c.kind]
    const name = normalize(c.name)
    const sameName = GENERIC.has(name) ? 0 : family === 'sommet' ? SAME_PEAK_NAME : SAME_NAME
    const i = Math.floor(c.lat * 100)
    const j = Math.floor(c.lon * 100)
    // Cases de ~1 km : 3 de chaque côté couvrent les 2 km du cas le plus large
    for (let di = -3; di <= 3; di++) {
      for (let dj = -3; dj <= 3; dj++) {
        for (const p of this.cells.get(`${i + di}:${j + dj}`) ?? []) {
          const d = distance(c, p)
          if (family && FAMILY[p.kind] === family && d < (family === 'sommet' ? SAME_PEAK : SAME_PLACE)) return true
          if (d < sameName && normalize(p.name) === name) return true
        }
      }
    }
    return false
  }
}

function normalize(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function distance(a: { lat: number, lon: number }, b: { lat: number, lon: number }): number {
  const dLat = (a.lat - b.lat) * 111_320
  const dLon = (a.lon - b.lon) * 111_320 * Math.cos(a.lat * Math.PI / 180)
  return Math.hypot(dLat, dLon)
}
