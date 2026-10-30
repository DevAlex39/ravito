/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [[0,"/"]],
    types: placeholder as Registry['home']['types'],
  },
  'tracer': {
    methods: ["GET","HEAD"],
    pattern: '/tracer',
    tokens: [[0,"tracer"]],
    types: placeholder as Registry['tracer']['types'],
  },
  'loops': {
    methods: ["GET","HEAD"],
    pattern: '/boucles',
    tokens: [[0,"boucles"]],
    types: placeholder as Registry['loops']['types'],
  },
  'pois.around': {
    methods: ["GET","HEAD"],
    pattern: '/lieux',
    tokens: [[0,"lieux"]],
    types: placeholder as Registry['pois.around']['types'],
  },
  'shared.around': {
    methods: ["GET","HEAD"],
    pattern: '/partages',
    tokens: [[0,"partages"]],
    types: placeholder as Registry['shared.around']['types'],
  },
  'shared.show': {
    methods: ["GET","HEAD"],
    pattern: '/partages/:id',
    tokens: [[0,"partages"],[1,"id"]],
    types: placeholder as Registry['shared.show']['types'],
  },
  'signup': {
    methods: ["GET","HEAD"],
    pattern: '/inscription',
    tokens: [[0,"inscription"]],
    types: placeholder as Registry['signup']['types'],
  },
  'auth.signup': {
    methods: ["POST"],
    pattern: '/inscription',
    tokens: [[0,"inscription"]],
    types: placeholder as Registry['auth.signup']['types'],
  },
  'login': {
    methods: ["GET","HEAD"],
    pattern: '/connexion',
    tokens: [[0,"connexion"]],
    types: placeholder as Registry['login']['types'],
  },
  'auth.login': {
    methods: ["POST"],
    pattern: '/connexion',
    tokens: [[0,"connexion"]],
    types: placeholder as Registry['auth.login']['types'],
  },
  'password.forgot': {
    methods: ["GET","HEAD"],
    pattern: '/mot-de-passe-oublie',
    tokens: [[0,"mot-de-passe-oublie"]],
    types: placeholder as Registry['password.forgot']['types'],
  },
  'auth.forgot': {
    methods: ["POST"],
    pattern: '/mot-de-passe-oublie',
    tokens: [[0,"mot-de-passe-oublie"]],
    types: placeholder as Registry['auth.forgot']['types'],
  },
  'password.reset': {
    methods: ["GET","HEAD"],
    pattern: '/nouveau-mot-de-passe/:token',
    tokens: [[0,"nouveau-mot-de-passe"],[1,"token"]],
    types: placeholder as Registry['password.reset']['types'],
  },
  'auth.reset': {
    methods: ["POST"],
    pattern: '/nouveau-mot-de-passe/:token',
    tokens: [[0,"nouveau-mot-de-passe"],[1,"token"]],
    types: placeholder as Registry['auth.reset']['types'],
  },
  'sso.redirect': {
    methods: ["GET","HEAD"],
    pattern: '/connexion/:provider',
    tokens: [[0,"connexion"],[1,"provider"]],
    types: placeholder as Registry['sso.redirect']['types'],
  },
  'sso.callback': {
    methods: ["GET","HEAD"],
    pattern: '/connexion/:provider/retour',
    tokens: [[0,"connexion"],[1,"provider"],[0,"retour"]],
    types: placeholder as Registry['sso.callback']['types'],
  },
  'logout': {
    methods: ["POST"],
    pattern: '/deconnexion',
    tokens: [[0,"deconnexion"]],
    types: placeholder as Registry['logout']['types'],
  },
  'plans.index': {
    methods: ["GET","HEAD"],
    pattern: '/mes-parcours',
    tokens: [[0,"mes-parcours"]],
    types: placeholder as Registry['plans.index']['types'],
  },
  'plans.show': {
    methods: ["GET","HEAD"],
    pattern: '/parcours/:id',
    tokens: [[0,"parcours"],[1,"id"]],
    types: placeholder as Registry['plans.show']['types'],
  },
  'plans.store': {
    methods: ["POST"],
    pattern: '/parcours',
    tokens: [[0,"parcours"]],
    types: placeholder as Registry['plans.store']['types'],
  },
  'plans.update': {
    methods: ["PUT"],
    pattern: '/parcours/:id',
    tokens: [[0,"parcours"],[1,"id"]],
    types: placeholder as Registry['plans.update']['types'],
  },
  'plans.share': {
    methods: ["PATCH"],
    pattern: '/parcours/:id/partage',
    tokens: [[0,"parcours"],[1,"id"],[0,"partage"]],
    types: placeholder as Registry['plans.share']['types'],
  },
  'shared.vote': {
    methods: ["POST"],
    pattern: '/partages/:id/vote',
    tokens: [[0,"partages"],[1,"id"],[0,"vote"]],
    types: placeholder as Registry['shared.vote']['types'],
  },
  'plans.destroy': {
    methods: ["DELETE"],
    pattern: '/parcours/:id',
    tokens: [[0,"parcours"],[1,"id"]],
    types: placeholder as Registry['plans.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
