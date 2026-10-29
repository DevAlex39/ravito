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

router.on('/').renderInertia('home', {}).as('home')
router.on('/tracer').renderInertia('tracer', {}).as('tracer')
router.on('/boucles').renderInertia('loops', {}).as('loops')
router.get('/lieux', [PoisController, 'around']).as('pois.around')

router
  .group(() => {
    router.get('/inscription', [AuthController, 'showSignup']).as('signup')
    router.post('/inscription', [AuthController, 'signup'])
    router.get('/connexion', [AuthController, 'showLogin']).as('login')
    router.post('/connexion', [AuthController, 'login'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('/deconnexion', [AuthController, 'logout']).as('logout')
    router.get('/mes-parcours', [PlansController, 'index']).as('plans.index')
    router.get('/parcours/:id', [PlansController, 'show']).as('plans.show').where('id', router.matchers.number())
    router.post('/parcours', [PlansController, 'store']).as('plans.store')
    router.put('/parcours/:id', [PlansController, 'update']).as('plans.update').where('id', router.matchers.number())
    router.delete('/parcours/:id', [PlansController, 'destroy']).as('plans.destroy').where('id', router.matchers.number())
  })
  .use(middleware.auth())
