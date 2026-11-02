import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'
import { cleanLoopQuery, loopQueryHash } from '#services/loop_query'

/** Au-delà, on demande d'en retirer : la liste reste lisible et la table raisonnable */
const MAX_FAVORITES = 200

const storeValidator = vine.create(
  vine.object({
    query: vine.string().maxLength(3000),
    name: vine.string().trim().maxLength(120),
    distance: vine.number().min(0).max(200_000),
    gain: vine.number().min(0).max(20_000),
    stops: vine.number().min(0).max(100),
  }),
)

export default class FavoriteLoopsController {
  /** Les favoris du compte (page Boucles : allume l'étoile des boucles déjà enregistrées) */
  async index({ auth }: HttpContext) {
    const rows = await db.from('favorite_loops').where('user_id', auth.user!.id).select('id', 'query')
    return rows.map(r => ({ id: r.id, query: r.query }))
  }

  /** Ajoute une boucle aux favoris ; renvoie le favori existant si elle y est déjà */
  async store({ request, response, auth }: HttpContext) {
    const payload = await storeValidator.validate(request.body())
    const clean = cleanLoopQuery(payload.query)
    if (!clean) return response.badRequest({ message: 'Boucle invalide.' })
    const userId = auth.user!.id
    const hash = loopQueryHash(clean)
    const existing = await db.from('favorite_loops').where({ user_id: userId, query_hash: hash }).first()
    if (existing) return { id: existing.id, query: clean }
    const [{ total }] = await db.from('favorite_loops').where('user_id', userId).count('* as total')
    if (Number(total) >= MAX_FAVORITES) {
      return response.unprocessableEntity({ message: `Tu as déjà ${MAX_FAVORITES} boucles favorites : retires-en dans « Mes parcours ».` })
    }
    const [id] = await db.table('favorite_loops').insert({
      user_id: userId,
      query: clean,
      query_hash: hash,
      name: payload.name || 'Boucle',
      distance: Math.round(payload.distance),
      gain: Math.round(payload.gain),
      stops: Math.round(payload.stops),
      created_at: new Date(),
    })
    return { id, query: clean }
  }

  /** Retire un favori : depuis la page Boucles (réponse JSON) ou depuis « Mes parcours » (retour à la page) */
  async destroy({ request, response, auth, params, session }: HttpContext) {
    const favorite = await db.from('favorite_loops').where({ id: params.id, user_id: auth.user!.id }).first()
    if (favorite) await db.from('favorite_loops').where('id', favorite.id).delete()
    if (request.header('x-inertia')) {
      if (favorite) session.flash('success', `« ${favorite.name} » a été retirée des favoris.`)
      return response.redirect().back()
    }
    return { ok: true }
  }
}
