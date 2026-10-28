// Application 100 % côté client : le GPX est lu et traité dans le navigateur,
// rien n'est envoyé au serveur. `nuxt generate` produit un site statique.
export default defineNuxtConfig({
  compatibilityDate: '2025-09-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['leaflet/dist/leaflet.css', '~/assets/css/main.css'],
  app: {
    head: {
      title: 'Ravito · Plan de course à partir d\'un GPX',
      htmlAttrs: { lang: 'fr' },
      meta: [
        { name: 'description', content: 'Importe le GPX de ta course : temps de passage, barrières horaires, ravitaillement et fiche imprimable.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
