import { defineConfig } from '@adonisjs/shield'
import app from '@adonisjs/core/services/app'

const shieldConfig = defineConfig({
  /**
   * Configure CSP policies for your app. Refer documentation
   * to learn more.
   */
  csp: {
    /**
     * Enable the Content-Security-Policy header.
     */
    enabled: true,

    /**
     * Per-resource CSP directives.
     *
     * Seconde barrière si une faille laissait passer du code dans une page : le navigateur
     * n'exécute que les scripts du site et ne contacte que les services listés ici.
     * - cartes : tuiles OpenStreetMap et OpenTopoMap ;
     * - recherche de lieux : Géoplateforme IGN, geo.api.gouv.fr, Nominatim ;
     * - fiches des lieux : Wikidata, Wikipédia, photos Wikimedia Commons ;
     * - itinéraires : BRouter du VPS (même origine en production, appelé depuis le poste en développement).
     * Styles en ligne autorisés : Leaflet et Vue positionnent les éléments avec l'attribut style.
     */
    directives: {
      defaultSrc: [`'self'`],
      scriptSrc: [`'self'`],
      styleSrc: [`'self'`, `'unsafe-inline'`],
      fontSrc: [`'self'`],
      imgSrc: [
        `'self'`,
        'data:',
        'blob:',
        'https://tile.openstreetmap.org',
        'https://*.tile.opentopomap.org',
        // Photos : Commons redirige vers upload.…, les miniatures Wikipédia viennent de thumb.…
        'https://*.wikimedia.org',
      ],
      connectSrc: [
        `'self'`,
        'https://alpas.alpastudio.fr',
        'https://data.geopf.fr',
        'https://geo.api.gouv.fr',
        'https://nominatim.openstreetmap.org',
        'https://www.wikidata.org',
        'https://fr.wikipedia.org',
        'https://commons.wikimedia.org',
        // Développement : rechargement à chaud de Vite
        ...(app.inDev ? ['ws://localhost:*'] : []),
      ],
      objectSrc: [`'none'`],
      baseUri: [`'self'`],
      frameAncestors: [`'none'`],
      formAction: [`'self'`],
    },

    /**
     * Report violations without blocking resources.
     */
    reportOnly: false,
  },

  /**
   * Configure CSRF protection options. Refer documentation
   * to learn more.
   */
  csrf: {
    /**
     * Enable CSRF token verification for state-changing requests.
     */
    enabled: true,

    /**
     * Route patterns to exclude from CSRF checks.
     * Useful for external webhooks or API endpoints.
     */
    exceptRoutes: [],

    /**
     * Expose an encrypted XSRF-TOKEN cookie for frontend HTTP clients.
     */
    enableXsrfCookie: true,

    /**
     * HTTP methods protected by CSRF validation.
     */
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  /**
   * Control how your website should be embedded inside
   * iframes.
   */
  xFrame: {
    /**
     * Enable the X-Frame-Options header.
     */
    enabled: true,

    /**
     * Block all framing attempts. Default value is DENY.
     */
    action: 'DENY',
  },

  /**
   * Force browser to always use HTTPS.
   */
  hsts: {
    /**
     * Enable the Strict-Transport-Security header.
     */
    enabled: true,

    /**
     * HSTS policy duration remembered by browsers.
     */
    maxAge: '180 days',
  },

  /**
   * Disable browsers from sniffing content types and rely only
   * on the response content-type header.
   */
  contentTypeSniffing: {
    /**
     * Enable X-Content-Type-Options: nosniff.
     */
    enabled: true,
  },
})

export default shieldConfig
