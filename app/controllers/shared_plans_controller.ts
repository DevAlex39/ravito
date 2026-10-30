import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'
import Plan from '#models/plan'
import { startOfPlan } from '#services/plan_start'

/** Rayon autour du départ choisi dans lequel on propose les parcours partagés */
const AROUND_M = 15_000
const MAX_AROUND = 5

const aroundValidator = vine.create(
  vine.object({
    lat: vine.number().range([-85, 85]),
    lon: vine.number().range([-180, 180]),
  }),
)

const shareValidator = vine.create(vine.object({ public: vine.boolean() }))

function voteCount(planId: number) {
  return db.from('plan_votes').where('plan_id', planId).count('* as n').first().then(r => Number(r?.n ?? 0))
}

export default class SharedPlansController {
  /** Les parcours partagés les mieux notés autour d'un point (JSON) */
  async around({ request }: HttpContext) {
    const { lat, lon } = await aroundValidator.validate(request.qs())
    // Pré-filtre rectangulaire (indexé), puis distance exacte
    const dLat = AROUND_M / 111_320
    const dLon = AROUND_M / (111_320 * Math.cos((lat * Math.PI) / 180))
    const rows = await db.from('plans as p')
      .where('p.is_public', true)
      .whereBetween('p.start_lat', [lat - dLat, lat + dLat])
      .whereBetween('p.start_lon', [lon - dLon, lon + dLon])
      .select('p.id', 'p.name', 'p.distance', 'p.gain', 'p.start_lat', 'p.start_lon')
      .select(db.raw('(SELECT COUNT(*) FROM plan_votes v WHERE v.plan_id = p.id) AS votes'))
    const parcours = rows
      .map(r => ({
        id: r.id as number,
        name: r.name as string,
        distance: r.distance as number,
        gain: r.gain as number,
        votes: Number(r.votes),
        away: Math.round(haversine(lat, lon, r.start_lat, r.start_lon)),
      }))
      .filter(r => r.away <= AROUND_M)
      .sort((a, b) => b.votes - a.votes || a.away - b.away)
      .slice(0, MAX_AROUND)
    return { parcours }
  }

  /** Page publique d'un parcours : la trace seulement, jamais les allures ou ravitos du propriétaire */
  async show({ inertia, auth, params }: HttpContext) {
    // Un parcours privé n'existe que pour son propriétaire
    const plan = await Plan.query()
      .where('id', params.id)
      .where(q => q.where('isPublic', true).orWhere('userId', auth.user?.id ?? 0))
      .firstOrFail()
    const mine = auth.user?.id === plan.userId
    const votes = await voteCount(plan.id)
    const voted = auth.user
      ? !!(await db.from('plan_votes').where({ plan_id: plan.id, user_id: auth.user.id }).first())
      : false
    let gpxText = ''
    try {
      gpxText = JSON.parse(plan.data).gpxText
    }
    catch {
      // Plan illisible : la page l'indique
    }
    return inertia.render('shared', {
      parcours: {
        id: plan.id,
        name: plan.name,
        distance: plan.distance,
        gain: plan.gain,
        gpxText,
        votes,
        voted,
        mine,
        isPublic: !!plan.isPublic,
      },
    })
  }

  /** Rendre un de ses parcours public ou privé (depuis « Mes parcours ») */
  async share({ request, auth, params, response, session }: HttpContext) {
    const plan = await Plan.query().where('id', params.id).where('userId', auth.user!.id).firstOrFail()
    const { public: isPublic } = await request.validateUsing(shareValidator)
    if (isPublic) {
      const start = startOfPlan(plan.data)
      if (!start) {
        session.flash('success', `« ${plan.name} » n'a pas pu être partagé : sa trace est illisible.`)
        return response.redirect().back()
      }
      plan.merge({ startLat: start.lat, startLon: start.lon })
    }
    plan.isPublic = isPublic
    await plan.save()
    session.flash('success', isPublic
      ? `« ${plan.name} » est maintenant public : il est proposé aux coureurs qui cherchent autour de son départ.`
      : `« ${plan.name} » est de nouveau privé.`)
    return response.redirect().back()
  }

  /** Voter (ou retirer son vote) pour le parcours d'un autre coureur */
  async vote({ auth, params, response }: HttpContext) {
    const plan = await Plan.findOrFail(params.id)
    const userId = auth.user!.id
    if (!plan.isPublic || plan.userId === userId) return response.redirect().back()
    const deleted = await db.from('plan_votes').where({ plan_id: plan.id, user_id: userId }).delete()
    if (!deleted) {
      await db.table('plan_votes').insert({ plan_id: plan.id, user_id: userId, created_at: new Date() })
    }
    return response.redirect().back()
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a))
}
