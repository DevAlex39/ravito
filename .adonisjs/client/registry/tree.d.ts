/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  tracer: typeof routes['tracer']
  loops: typeof routes['loops']
  pois: {
    around: typeof routes['pois.around']
  }
  shared: {
    around: typeof routes['shared.around']
    show: typeof routes['shared.show']
    vote: typeof routes['shared.vote']
  }
  signup: typeof routes['signup']
  auth: {
    signup: typeof routes['auth.signup']
    login: typeof routes['auth.login']
  }
  login: typeof routes['login']
  logout: typeof routes['logout']
  plans: {
    index: typeof routes['plans.index']
    show: typeof routes['plans.show']
    store: typeof routes['plans.store']
    update: typeof routes['plans.update']
    share: typeof routes['plans.share']
    destroy: typeof routes['plans.destroy']
  }
}
