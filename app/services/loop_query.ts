import { createHash } from 'node:crypto'

/** Paramètres acceptés dans un lien de boucle : rien d'autre n'est enregistré */
const ALLOWED = new Set(['lat', 'lon', 'km', 'n', 'chemins', 'nom', 'style', 'priorite', 'types', 'via', 'lieux'])

/**
 * Paramètres d'une boucle (/boucles?…) remis au propre, ou null s'ils ne décrivent pas une boucle.
 * « n » (ancien nombre de boucles proposées) est accepté mais retiré : il ne change pas la boucle.
 */
export function cleanLoopQuery(query: string): string | null {
  const params = new URLSearchParams(query)
  const lat = Number(params.get('lat'))
  const lon = Number(params.get('lon'))
  if ([...params.keys()].some(k => !ALLOWED.has(k)) || !params.get('via') || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return null
  params.delete('n')
  return params.toString()
}

/** Empreinte SHA-256 des paramètres : reconnaît une boucle déjà enregistrée */
export function loopQueryHash(clean: string): string {
  return createHash('sha256').update(clean).digest('hex')
}
