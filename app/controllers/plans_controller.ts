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
    return inertia.render('plans/index', {
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
    const plan = await Plan.create({ ...payload, ...round(payload), ...start(payload.data), userId: auth.user!.id })
    return { id: plan.id }
  }

  async update({ request, auth, params, response }: HttpContext) {
    const plan = await Plan.query().where('id', params.id).where('userId', auth.user!.id).firstOrFail()
    const payload = await request.validateUsing(planValidator)
    if (!isPlanData(payload.data)) return response.badRequest({ message: 'Plan illisible' })
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
