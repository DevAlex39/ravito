import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Plan from '#models/plan'
import { planValidator } from '#validators/plan'
import { startOfPlan } from '#services/plan_start'

export default class PlansController {
  /** Mes parcours : les plus récemment modifiés d'abord */
  async index({ inertia, auth }: HttpContext) {
    const plans = await Plan.query()
      .where('userId', auth.user!.id)
      .select('id', 'name', 'distance', 'gain', 'duration', 'isPublic', 'updatedAt', 'createdAt')
      .select(db.raw('(SELECT COUNT(*) FROM plan_votes v WHERE v.plan_id = plans.id) AS votes'))
      .orderBy('updatedAt', 'desc')
    const favorites = await db.from('favorite_loops')
      .where('user_id', auth.user!.id)
      .select('id', 'query', 'name', 'distance', 'gain', 'stops', 'created_at')
      .orderBy('created_at', 'desc')
    return inertia.render('plans/index', {
      favorites: favorites.map(f => ({
        id: f.id as number,
        url: `/boucles?${f.query}`,
        name: f.name as string,
        distance: f.distance as number,
        gain: f.gain as number,
        stops: f.stops as number,
        createdAt: new Date(f.created_at).toISOString(),
      })),
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        distance: p.distance,
        gain: p.gain,
        duration: p.duration,
        isPublic: !!p.isPublic,
        votes: Number(p.$extras.votes),
        updatedAt: (p.updatedAt ?? p.createdAt).toISO()!,
      })),
    })
  }

  /** Ouvre un plan enregistré dans la page plan */
  async show({ inertia, auth, params }: HttpContext) {
    const plan = await Plan.query().where('id', params.id).where('userId', auth.user!.id).firstOrFail()
    return inertia.render('home', { saved: { id: plan.id, data: plan.data } })
  }

  async store({ request, auth, response }: HttpContext) {
    const payload = await request.validateUsing(planValidator)
    if (!isPlanData(payload.data)) return response.badRequest({ message: 'Plan illisible' })
    const used = await usage(auth.user!.id)
    if (used.count >= MAX_PLANS) {
      return response.unprocessableEntity({ message: `Tu as déjà ${MAX_PLANS} parcours enregistrés : supprimes-en dans « Mes parcours » pour en ajouter.` })
    }
    if (used.size + payload.data.length > MAX_STORAGE) return response.unprocessableEntity({ message: FULL })
    const plan = await Plan.create({ ...payload, ...round(payload), ...start(payload.data), userId: auth.user!.id })
    return { id: plan.id }
  }

  async update({ request, auth, params, response }: HttpContext) {
    const plan = await Plan.query().where('id', params.id).where('userId', auth.user!.id).firstOrFail()
    const payload = await request.validateUsing(planValidator)
    if (!isPlanData(payload.data)) return response.badRequest({ message: 'Plan illisible' })
    const used = await usage(auth.user!.id)
    if (used.size - plan.data.length + payload.data.length > MAX_STORAGE) return response.unprocessableEntity({ message: FULL })
    // La trace peut avoir changé : le point de départ suit (recherche des parcours partagés)
    plan.merge({ ...payload, ...round(payload), ...start(payload.data) })
    await plan.save()
    return { id: plan.id }
  }

  async destroy({ auth, params, response, session }: HttpContext) {
    const plan = await Plan.query().where('id', params.id).where('userId', auth.user!.id).firstOrFail()
    await plan.delete()
    session.flash('success', `« ${plan.name} » a été supprimé.`)
    return response.redirect().back()
  }
}

/**
 * Limites par compte : un plan garde son GPX complet (jusqu'à 20 Mo pour un ultra enregistré à la seconde),
 * sans plafond un seul compte pourrait remplir le disque du serveur
 */
const MAX_PLANS = 100
const MAX_STORAGE = 100_000_000
const FULL = 'Ton espace est plein (100 Mo de parcours) : supprime d\'anciens parcours dans « Mes parcours » pour enregistrer celui-ci.'

/** Nombre de plans du compte et place occupée (caractères des données enregistrées) */
async function usage(userId: number) {
  const [row] = await db.from('plans').where('user_id', userId).select(db.raw('COUNT(*) AS n, COALESCE(SUM(CHAR_LENGTH(data)), 0) AS size'))
  return { count: Number(row?.n ?? 0), size: Number(row?.size ?? 0) }
}

function start(data: string) {
  const p = startOfPlan(data)
  return { startLat: p?.lat ?? null, startLon: p?.lon ?? null }
}

function round(p: { distance: number, gain: number, duration: number | null }) {
  return {
    distance: Math.round(p.distance),
    gain: Math.round(p.gain),
    duration: p.duration == null ? null : Math.round(p.duration),
  }
}

/** Le minimum pour pouvoir rouvrir le plan : un objet JSON avec son GPX */
function isPlanData(text: string) {
  try {
    const data = JSON.parse(text)
    return typeof data === 'object' && data !== null && typeof data.gpxText === 'string'
  }
  catch {
    return false
  }
}
