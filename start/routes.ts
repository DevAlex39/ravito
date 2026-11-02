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
import { throttleAccount, throttleAuth, throttleLieux, throttleLinks, throttleSignup, throttleWrites } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const FavoriteLoopsController = () => import('#controllers/favorite_loops_controller')
const PlansController = () => import('#controllers/plans_controller')
const PoisController = () => import('#controllers/pois_controller')
const SharedPlansController = () => import('#controllers/shared_plans_controller')
const ShortLinksController = () => import('#controllers/short_links_controller')

router.on('/').renderInertia('home', {}).as('home')
router.on('/tracer').renderInertia('tracer', {}).as('tracer')
router.on('/boucles').renderInertia('loops', {}).as('loops')
router.on('/mentions-legales').renderInertia('legal', {}).as('legal')
router.get('/lieux', [PoisController, 'around']).as('pois.around').use(throttleLieux)
router.get('/equipements', [PoisController, 'amenities']).as('pois.amenities').use(throttleLieux)
router.post('/liens', [ShortLinksController, 'store']).as('links.store').use(throttleLinks)
router.get('/b/:code', [ShortLinksController, 'show']).as('links.show').where('code', /^[A-Za-z0-9]{4,12}$/)
router.get('/partages', [SharedPlansController, 'around']).as('shared.around')
router.get('/partages/:id', [SharedPlansController, 'show']).as('shared.show').where('id', router.matchers.number())

router
  .group(() => {
    router.get('/inscription', [AuthController, 'showSignup']).as('signup')
    router.post('/inscription', [AuthController, 'signup']).use(throttleSignup)
    router.get('/connexion', [AuthController, 'showLogin']).as('login')
    router.post('/connexion', [AuthController, 'login']).use([throttleAuth, throttleAccount])
    router.get('/mot-de-passe-oublie', [AuthController, 'showForgot']).as('password.forgot')
    router.post('/mot-de-passe-oublie', [AuthController, 'forgot']).use(throttleAuth)
    router.get('/nouveau-mot-de-passe/:token', [AuthController, 'showReset']).as('password.reset')
    router.post('/nouveau-mot-de-passe/:token', [AuthController, 'reset']).use(throttleAuth)
  })
  .use(middleware.guest())

// Ouvert même connecté : sert aussi à relier un compte Google ou Strava au compte en cours
router.get('/connexion/:provider', [AuthController, 'redirectToProvider']).as('sso.redirect').where('provider', /^(google|strava)$/).use(throttleAuth)
router.get('/connexion/:provider/retour', [AuthController, 'providerCallback']).as('sso.callback').where('provider', /^(google|strava)$/)

router
  .group(() => {
    router.post('/deconnexion', [AuthController, 'logout']).as('logout')
    router.on('/mon-compte').renderInertia('account', {}).as('account')
    router.delete('/compte', [AuthController, 'destroyAccount']).as('account.destroy')
    router.get('/mes-parcours', [PlansController, 'index']).as('plans.index')
    router.get('/parcours/:id', [PlansController, 'show']).as('plans.show').where('id', router.matchers.number())
    router.post('/parcours', [PlansController, 'store']).as('plans.store')
    router.put('/parcours/:id', [PlansController, 'update']).as('plans.update').where('id', router.matchers.number())
    router.patch('/parcours/:id/partage', [SharedPlansController, 'share']).as('plans.share').where('id', router.matchers.number())
    router.post('/partages/:id/vote', [SharedPlansController, 'vote']).as('shared.vote').where('id', router.matchers.number())
    router.delete('/parcours/:id', [PlansController, 'destroy']).as('plans.destroy').where('id', router.matchers.number())
    router.get('/favoris', [FavoriteLoopsController, 'index']).as('favorites.index')
    router.post('/favoris', [FavoriteLoopsController, 'store']).as('favorites.store')
    router.delete('/favoris/:id', [FavoriteLoopsController, 'destroy']).as('favorites.destroy').where('id', router.matchers.number())
  })
  .use([middleware.auth(), throttleWrites])
