import type { HttpContext } from '@adonisjs/core/http'
import Plan from '#models/plan'
import { planValidator } from '#validators/plan'

export default class PlansController {
  /** Mes parcours : les plus récemment modifiés d'abord */
  async index({ inertia, auth }: HttpContext) {
    const plans = await Plan.query()
      .where('userId', auth.user!.id)
      .select('id', 'name', 'distance', 'gain', 'duration', 'updatedAt', 'createdAt')
      .orderBy('updatedAt', 'desc')
    return inertia.render('plans/index', {
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        distance: p.distance,
        gain: p.gain,
        duration: p.duration,
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
    const plan = await Plan.create({ ...payload, ...round(payload), userId: auth.user!.id })
    return { id: plan.id }
  }

  async update({ request, auth, params, response }: HttpContext) {
    const plan = await Plan.query().where('id', params.id).where('userId', auth.user!.id).firstOrFail()
    const payload = await request.validateUsing(planValidator)
    if (!isPlanData(payload.data)) return response.badRequest({ message: 'Plan illisible' })
    plan.merge({ ...payload, ...round(payload) })
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
