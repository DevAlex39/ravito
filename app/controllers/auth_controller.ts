import { createHash, randomBytes } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import User from '#models/user'
import { forgotValidator, loginValidator, resetValidator, signupValidator } from '#validators/auth'
import { sendResetMail } from '#services/mailer'
import { authorizeUrl, enabledProviders, fetchProfile, type Provider } from '#services/oauth'

/** Adresse publique : en production elle est fixe (un en-tête Host trafiqué ne doit pas détourner les liens envoyés) */
function baseUrl({ request }: HttpContext) {
  return app.inProduction ? 'https://alpas.alpastudio.fr' : `${request.protocol()}://${request.host()}`
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

/** Utilisateur dont le lien « mot de passe oublié » est encore valable */
function userForToken(token: string) {
  return User.query()
    .where('resetTokenHash', hashToken(token))
    .where('resetExpiresAt', '>', DateTime.now().toSQL({ includeOffset: false })!)
    .first()
}

const PROVIDER_NAMES: Record<Provider, string> = { google: 'Google', strava: 'Strava' }
const PROVIDER_COLUMNS = { google: 'googleId', strava: 'stravaId' } as const

/** Après connexion, on revient sur la page demandée (chemin interne uniquement) */
function nextPath(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export default class AuthController {
  async showSignup({ inertia, request }: HttpContext) {
    return inertia.render('auth/signup', { next: nextPath(request.input('next')), sso: enabledProviders() })
  }

  async signup({ request, response, session, auth }: HttpContext) {
    const { email, password } = await request.validateUsing(signupValidator)
    if (await User.findBy('email', email)) {
      session.flash('inputErrorsBag', { email: 'Un compte existe déjà avec cette adresse : connecte-toi.' })
      session.flashExcept(['password'])
      return response.redirect().back()
    }
    const user = await User.create({ email, password })
    await auth.use('web').login(user)
    return response.redirect(nextPath(request.input('next')))
  }

  async showLogin({ inertia, request }: HttpContext) {
    return inertia.render('auth/login', { next: nextPath(request.input('next')), sso: enabledProviders() })
  }

  async login({ request, response, session, auth }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    let user: User
    try {
      user = await User.verifyCredentials(email, password)
    }
    catch {
      session.flash('inputErrorsBag', { email: 'Adresse e-mail ou mot de passe incorrect.' })
      session.flashExcept(['password'])
      return response.redirect().back()
    }
    await auth.use('web').login(user)
    return response.redirect(nextPath(request.input('next')))
  }

  // --- Mot de passe oublié ---

  async showForgot({ inertia, request }: HttpContext) {
    return inertia.render('auth/forgot', { email: String(request.input('email') ?? '') })
  }

  async forgot(ctx: HttpContext) {
    const { request, response, session } = ctx
    const { email } = await request.validateUsing(forgotValidator)
    const user = await User.findBy('email', email)
    // Pas plus d'un e-mail toutes les 2 minutes pour une même adresse
    const recent = user?.resetExpiresAt && user.resetExpiresAt > DateTime.now().plus({ minutes: 58 })
    if (user && !recent) {
      const token = randomBytes(32).toString('base64url')
      user.merge({ resetTokenHash: hashToken(token), resetExpiresAt: DateTime.now().plus({ hours: 1 }) })
      await user.save()
      try {
        await sendResetMail(email, `${baseUrl(ctx)}/nouveau-mot-de-passe/${token}`)
      }
      catch (e) {
        logger.error({ err: e }, 'Envoi du mail « mot de passe oublié » impossible')
        session.flash('error', 'L\'envoi de l\'e-mail a échoué. Réessaie dans quelques minutes.')
        return response.redirect().back()
      }
    }
    // Même réponse que l'adresse existe ou non : on ne révèle pas qui a un compte
    session.flash('success', `Si un compte existe pour ${email}, un e-mail vient d'y être envoyé avec un lien valable 1 heure. Pense à regarder dans les indésirables.`)
    return response.redirect().back()
  }

  async showReset({ inertia, params }: HttpContext) {
    const user = await userForToken(params.token)
    return inertia.render('auth/reset', { token: params.token, valid: !!user })
  }

  async reset({ request, response, session, auth, params }: HttpContext) {
    const { password } = await request.validateUsing(resetValidator)
    const user = await userForToken(params.token)
    if (!user) {
      session.flash('error', 'Ce lien a expiré ou a déjà servi. Redemande un e-mail.')
      return response.redirect('/mot-de-passe-oublie')
    }
    user.merge({ password, resetTokenHash: null, resetExpiresAt: null })
    await user.save()
    await auth.use('web').login(user)
    session.flash('success', 'Ton nouveau mot de passe est enregistré, tu es connecté.')
    return response.redirect('/mes-parcours')
  }

  // --- Connexion avec Google ou Strava ---

  async redirectToProvider(ctx: HttpContext) {
    const { params, request, response, session } = ctx
    const provider = params.provider as Provider
    if (!enabledProviders()[provider]) return response.redirect('/connexion')
    // Le « state » protège le retour contre une connexion forcée par un autre site
    const state = randomBytes(16).toString('hex')
    session.put('oauth', { state, provider, next: nextPath(request.input('next')) })
    // Sans recopier ?next= dans l'adresse de Google ou Strava
    return response.redirect().withQs(false).toPath(authorizeUrl(provider, `${baseUrl(ctx)}/connexion/${provider}/retour`, state))
  }

  async providerCallback(ctx: HttpContext) {
    const { params, request, response, session, auth } = ctx
    const provider = params.provider as Provider
    const pending = session.pull('oauth') as { state: string, provider: Provider, next: string } | undefined
    const name = PROVIDER_NAMES[provider]
    const fail = (message: string) => {
      session.flash('error', message)
      return response.redirect().withQs(false).toPath('/connexion')
    }
    if (!pending || pending.provider !== provider || pending.state !== request.input('state')) {
      return fail(`La connexion avec ${name} a expiré, réessaie.`)
    }
    if (request.input('error') || !request.input('code')) return fail(`Connexion avec ${name} annulée.`)

    let profile
    try {
      profile = await fetchProfile(provider, request.input('code'), `${baseUrl(ctx)}/connexion/${provider}/retour`)
    }
    catch (e) {
      logger.error({ err: e }, `Connexion ${name} impossible`)
      return fail(`${name} n'a pas répondu comme prévu, réessaie dans un instant.`)
    }

    const column = PROVIDER_COLUMNS[provider]
    let user = await User.findBy(column, profile.id)
    // Déjà connecté : on relie ce compte au compte en cours
    if (!user && auth.user && !auth.user[column]) user = auth.user
    // Même adresse vérifiée qu'un compte existant : c'est la même personne
    if (!user && profile.email) user = await User.findBy('email', profile.email)
    if (!user) user = new User()
    user[column] = profile.id
    user.email ??= profile.email
    user.fullName ??= profile.name
    await user.save()

    await auth.use('web').login(user)
    return response.redirect().withQs(false).toPath(pending.next)
  }

  async logout({ response, auth }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/')
  }
}
