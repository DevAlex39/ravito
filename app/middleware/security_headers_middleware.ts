import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * En-têtes de sécurité que Shield ne pose pas :
 * - Referrer-Policy : les autres sites ne voient que « alpas.alpastudio.fr », jamais l'adresse complète
 *   (une boucle partagée contient le point de départ). Les serveurs de tuiles OSM exigent ce minimum ;
 * - Permissions-Policy : seule la position est utilisée (« Autour de moi »), le reste est coupé.
 */
export default class SecurityHeadersMiddleware {
  handle({ response }: HttpContext, next: NextFn) {
    response.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.header('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()')
    return next()
  }
}
