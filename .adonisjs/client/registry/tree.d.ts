/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  tracer: typeof routes['tracer']
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
    destroy: typeof routes['plans.destroy']
  }
}
