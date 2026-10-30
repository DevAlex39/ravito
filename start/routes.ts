/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const PlansController = () => import('#controllers/plans_controller')
const PoisController = () => import('#controllers/pois_controller')
const SharedPlansController = () => import('#controllers/shared_plans_controller')

router.on('/').renderInertia('home', {}).as('home')
router.on('/tracer').renderInertia('tracer', {}).as('tracer')
router.on('/boucles').renderInertia('loops', {}).as('loops')
router.get('/lieux', [PoisController, 'around']).as('pois.around')
router.get('/partages', [SharedPlansController, 'around']).as('shared.around')
router.get('/partages/:id', [SharedPlansController, 'show']).as('shared.show').where('id', router.matchers.number())

router
  .group(() => {
    router.get('/inscription', [AuthController, 'showSignup']).as('signup')
    router.post('/inscription', [AuthController, 'signup'])
    router.get('/connexion', [AuthController, 'showLogin']).as('login')
    router.post('/connexion', [AuthController, 'login'])
    router.get('/mot-de-passe-oublie', [AuthController, 'showForgot']).as('password.forgot')
    router.post('/mot-de-passe-oublie', [AuthController, 'forgot'])
    router.get('/nouveau-mot-de-passe/:token', [AuthController, 'showReset']).as('password.reset')
    router.post('/nouveau-mot-de-passe/:token', [AuthController, 'reset'])
  })
  .use(middleware.guest())

// Ouvert même connecté : sert aussi à relier un compte Google ou Strava au compte en cours
router.get('/connexion/:provider', [AuthController, 'redirectToProvider']).as('sso.redirect').where('provider', /^(google|strava)$/)
router.get('/connexion/:provider/retour', [AuthController, 'providerCallback']).as('sso.callback').where('provider', /^(google|strava)$/)

router
  .group(() => {
    router.post('/deconnexion', [AuthController, 'logout']).as('logout')
    router.get('/mes-parcours', [PlansController, 'index']).as('plans.index')
    router.get('/parcours/:id', [PlansController, 'show']).as('plans.show').where('id', router.matchers.number())
    router.post('/parcours', [PlansController, 'store']).as('plans.store')
    router.put('/parcours/:id', [PlansController, 'update']).as('plans.update').where('id', router.matchers.number())
    router.patch('/parcours/:id/partage', [SharedPlansController, 'share']).as('plans.share').where('id', router.matchers.number())
    router.post('/partages/:id/vote', [SharedPlansController, 'vote']).as('shared.vote').where('id', router.matchers.number())
    router.delete('/parcours/:id', [PlansController, 'destroy']).as('plans.destroy').where('id', router.matchers.number())
  })
  .use(middleware.auth())
