import 'leaflet/dist/leaflet.css'
import './css/app.css'
import { client } from '~/client'
import { createInertiaApp } from '@inertiajs/vue3'
import { TuyauProvider } from '@adonisjs/inertia/vue'
import { createApp, type DefineComponent, h } from 'vue'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { APP_NAME } from '~/brand'

createInertiaApp({
  title: (title) => (title ? `${title} · ${APP_NAME}` : `${APP_NAME} · Plan de course à partir d'un GPX`),
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
