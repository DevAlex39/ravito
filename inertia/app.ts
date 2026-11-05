import 'maplibre-gl/dist/maplibre-gl.css'
// Polices servies par le site lui-même (pas de Google Fonts : l'IP des visiteurs n'est pas envoyée à Google)
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './css/app.css'
import { client } from '~/client'
import { createInertiaApp } from '@inertiajs/vue3'
import { TuyauProvider } from '@adonisjs/inertia/vue'
import { createApp, type DefineComponent, h } from 'vue'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { APP_NAME, APP_TAGLINE } from '~/brand'

createInertiaApp({
  title: (title) => (title ? `${title} · ${APP_NAME}` : `${APP_NAME} · ${APP_TAGLINE}`),
  resolve: (name) => {
    return resolvePageComponent(
      `./pages/${name}.vue`,
      import.meta.glob<DefineComponent>('./pages/**/*.vue')
    )
  },
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(TuyauProvider, { client }, { default: () => h(App, props) }) })
      .use(plugin)
      .mount(el)
  },
  progress: {
    color: '#e2672b',
  },
})
