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
