import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { loginValidator, signupValidator } from '#validators/auth'

/** Après connexion, on revient sur la page demandée (chemin interne uniquement) */
function nextPath(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export default class AuthController {
  async showSignup({ inertia, request }: HttpContext) {
    return inertia.render('auth/signup', { next: nextPath(request.input('next')) })
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
    return inertia.render('auth/login', { next: nextPath(request.input('next')) })
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

  async logout({ response, auth }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/')
  }
}
