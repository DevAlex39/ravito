/*
|--------------------------------------------------------------------------
| Limites de tentatives
|--------------------------------------------------------------------------
|
| Contre les essais de mots de passe en série, la création de comptes en masse
| et les appels en boucle aux services de cartes. Au-delà, la page affiche
| « Trop de tentatives » (voir app/exceptions/handler.ts).
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import limiter from '@adonisjs/limiter/services/main'

/**
 * IP du visiteur, transmise par Nginx. Sans elle, toutes les requêtes semblent venir du serveur
 * lui-même : une limite par IP bloquerait tout le monde à la fois, on ne l'applique donc pas.
 */
function visitorIp(ctx: HttpContext): string | null {
  const ip = ctx.request.ip()
  return /^(127\.|::1$|::ffff:127\.)/.test(ip) ? null : ip
}

/** Par IP : `requests` requêtes par période */
function perIp(name: string, requests: number, duration: string) {
  return limiter.define(name, (ctx) => {
    const ip = visitorIp(ctx)
    return ip ? limiter.allowRequests(requests).every(duration).usingKey(ip) : limiter.noLimit()
  })
}

/** Connexion : 10 essais par compte visé toutes les 15 minutes, même si l'attaquant change d'IP */
export const throttleAccount = limiter.define('account', (ctx) => {
  const email = String(ctx.request.input('email') ?? '').trim().toLowerCase().slice(0, 254)
  return email ? limiter.allowRequests(10).every('15 minutes').usingKey(email) : limiter.noLimit()
})

/** Connexion, mot de passe oublié, Google / Strava : 30 essais par IP toutes les 15 minutes */
export const throttleAuth = perIp('auth', 30, '15 minutes')

/** Création de compte : 5 par heure et par IP */
export const throttleSignup = perIp('signup', 5, '1 hour')

/** Lieux à voir (peut interroger OpenStreetMap) : 60 par minute et par IP */
export const throttleLieux = perIp('lieux', 60, '1 minute')

/** Enregistrements (parcours, partages, votes) : 60 par minute et par compte */
export const throttleWrites = limiter.define('writes', (ctx) =>
  ctx.auth.user ? limiter.allowRequests(60).every('1 minute').usingKey(ctx.auth.user.id) : limiter.noLimit())
