import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'tracer': { paramsTuple?: []; params?: {} }
    'loops': { paramsTuple?: []; params?: {} }
    'pois.around': { paramsTuple?: []; params?: {} }
    'shared.around': { paramsTuple?: []; params?: {} }
    'shared.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signup': { paramsTuple?: []; params?: {} }
    'auth.signup': { paramsTuple?: []; params?: {} }
    'login': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'password.forgot': { paramsTuple?: []; params?: {} }
    'auth.forgot': { paramsTuple?: []; params?: {} }
    'password.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'auth.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'sso.redirect': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'sso.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'logout': { paramsTuple?: []; params?: {} }
    'plans.index': { paramsTuple?: []; params?: {} }
    'plans.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'plans.store': { paramsTuple?: []; params?: {} }
    'plans.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'plans.share': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'shared.vote': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'plans.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'tracer': { paramsTuple?: []; params?: {} }
    'loops': { paramsTuple?: []; params?: {} }
    'pois.around': { paramsTuple?: []; params?: {} }
    'shared.around': { paramsTuple?: []; params?: {} }
    'shared.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signup': { paramsTuple?: []; params?: {} }
    'login': { paramsTuple?: []; params?: {} }
    'password.forgot': { paramsTuple?: []; params?: {} }
    'password.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'sso.redirect': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'sso.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'plans.index': { paramsTuple?: []; params?: {} }
    'plans.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'tracer': { paramsTuple?: []; params?: {} }
    'loops': { paramsTuple?: []; params?: {} }
    'pois.around': { paramsTuple?: []; params?: {} }
    'shared.around': { paramsTuple?: []; params?: {} }
    'shared.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signup': { paramsTuple?: []; params?: {} }
    'login': { paramsTuple?: []; params?: {} }
    'password.forgot': { paramsTuple?: []; params?: {} }
    'password.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'sso.redirect': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'sso.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'plans.index': { paramsTuple?: []; params?: {} }
    'plans.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  POST: {
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.forgot': { paramsTuple?: []; params?: {} }
    'auth.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'logout': { paramsTuple?: []; params?: {} }
    'plans.store': { paramsTuple?: []; params?: {} }
    'shared.vote': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'plans.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'plans.share': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'plans.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}