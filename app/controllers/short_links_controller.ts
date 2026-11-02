import type { HttpContext } from '@adonisjs/core/http'
import { createHash, randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 7
/** Paramètres acceptés dans un lien de boucle : rien d'autre n'est enregistré */
const ALLOWED = new Set(['lat', 'lon', 'km', 'n', 'chemins', 'nom', 'style', 'priorite', 'types', 'via', 'lieux'])

const storeValidator = vine.create(
  vine.object({
    query: vine.string().maxLength(3000),
  }),
)

/** Code au hasard, sans les caractères qu'on confond (0/O, 1/l/I) */
function newCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  return [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('')
}

export default class ShortLinksController {
  /** Raccourcit le lien d'une boucle ; renvoie le code (le même pour un lien déjà raccourci) */
  async store({ request, response }: HttpContext) {
    const { query } = await storeValidator.validate(request.body())
    const params = new URLSearchParams(query)
    const lat = Number(params.get('lat'))
    const lon = Number(params.get('lon'))
    if ([...params.keys()].some(k => !ALLOWED.has(k)) || !params.get('via') || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
      return response.badRequest({ message: 'Lien de boucle invalide.' })
    }
    const clean = params.toString()
    const hash = createHash('sha256').update(clean).digest('hex')
    const existing = await db.from('short_links').where('query_hash', hash).first()
    if (existing) return { code: existing.code }
    // Collision de code improbable (57⁷ possibilités) : quelques essais suffisent
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode()
      try {
        await db.table('short_links').insert({ code, query: clean, query_hash: hash, hits: 0, created_at: new Date() })
        return { code }
      }
      catch (error) {
        // Le même lien raccourci au même instant par un autre visiteur : on renvoie son code
        const again = await db.from('short_links').where('query_hash', hash).first()
        if (again) return { code: again.code }
        if (attempt === 4) throw error
      }
    }
  }

  /** Ouvre un lien court : redirige vers la boucle (lien inconnu : page Boucles vide) */
  async show({ params, response }: HttpContext) {
    const link = await db.from('short_links').where('code', String(params.code)).first()
    if (!link) return response.redirect().withQs(false).toPath('/boucles')
    await db.from('short_links').where('id', link.id).update({ hits: db.raw('hits + 1'), last_used_at: new Date() })
    return response.redirect().withQs(false).toPath(`/boucles?${link.query}`)
  }
}
