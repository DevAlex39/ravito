/**
 * Cartes du site (MapLibre), communes à toutes les pages :
 * - fond « Plan » : notre fond de carte vectoriel (Protomaps, palette Alpast, clair ou sombre) si VITE_CARTE_URL
 *   indique où il est servi, sinon les tuiles OpenStreetMap (comme avant) ;
 * - fond « Topographique » : OpenTopoMap ;
 * - le thème du site (clair/sombre) change le fond en direct ; les tracés et les marqueurs restent.
 * Tout ce que les pages ajoutent (sources et calques) porte le préfixe « a- » pour survivre aux changements de fond.
 *
 * Les niveaux de zoom des pages restent ceux de l'ancienne carte (Leaflet, tuiles de 256 px) : MapLibre compte
 * avec des tuiles de 512 px, d'où le décalage d'un niveau (z).
 */
import type * as Maplibre from 'maplibre-gl'

export type Ml = typeof Maplibre
export type LonLat = [number, number]

/** Adresse des données du labo (fonds de carte .pmtiles, polices, icônes), voir scripts/labo/servir-carte.sh */
const CARTE_URL = (import.meta.env.VITE_CARTE_URL ?? '').replace(/\/$/, '')
const FONDS = { europe: 'europe/fond-de-carte/europe.pmtiles', japon: 'asie/japon/fond-de-carte/japon.pmtiles' }
const ASSETS = `${CARTE_URL}/monde/carte-assets`

const OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Zoom de l'ancienne carte → zoom MapLibre, et inversement */
export const z = (leaflet: number) => leaflet - 1
export const zLeaflet = (maplibre: number) => maplibre + 1

export type Fond = 'plan' | 'topo'

export function isDark(): boolean {
  const chosen = document.documentElement.dataset.theme
  if (chosen) return chosen === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

let loading: Promise<Ml> | null = null
let basemaps: typeof import('@protomaps/basemaps') | null = null

/** MapLibre est chargé à la demande (pages sans carte plus légères) ; le protocole pmtiles:// une seule fois */
function load(): Promise<Ml> {
  loading ??= (async () => {
    const mod = await import('maplibre-gl')
    const ml = ((mod as unknown as { default?: Ml }).default ?? mod) as Ml
    if (CARTE_URL) {
      const [{ Protocol }, bm] = await Promise.all([import('pmtiles'), import('@protomaps/basemaps')])
      basemaps = bm
      ml.addProtocol('pmtiles', new Protocol().tile)
    }
    return ml
  })()
  return loading
}

/** Palette Alpast posée sur les styles Protomaps (mêmes teintes que inertia/css/app.css et la démo du labo) */
function flavor(dark: boolean) {
  const bm = basemaps!
  if (dark) {
    return {
      ...bm.namedFlavor('dark'),
      background: '#1b211e', earth: '#1b211e', water: '#1d3442', ocean_label: '#7fa6bb',
      park_a: '#1f3327', park_b: '#24402f', wood_a: '#1e3226', wood_b: '#22392b', scrub_a: '#232d23', scrub_b: '#263325',
      sand: '#2e2b22', beach: '#302c22', glacier: '#2c3438', pedestrian: '#262b27', buildings: '#2a2f2b',
      highway: '#8c4a47', highway_casing_early: '#5a2f2d', highway_casing_late: '#5a2f2d',
      major: '#8a7637', major_casing_early: '#5a4c22', major_casing_late: '#5a4c22',
      link: '#8a7637', link_casing: '#5a4c22',
      minor_a: '#4a524c', minor_b: '#4a524c', minor_casing: '#2a302c', minor_service: '#3c433e', minor_service_casing: '#2a302c',
      other: '#1b211e', boundaries: '#6d6a5e', railway: '#6b6a60',
      city_label: '#ebe7dd', city_label_halo: '#161c19', subplace_label: '#b9b5a9', subplace_label_halo: '#161c19',
      roads_label_minor: '#a9a59a', roads_label_minor_halo: '#161c19', roads_label_major: '#b9b5a9', roads_label_major_halo: '#161c19',
      state_label: '#8a938c', state_label_halo: '#161c19', country_label: '#b9b5a9',
    }
  }
  return {
    ...bm.namedFlavor('light'),
    background: '#f4efe1', earth: '#f4efe1', water: '#9fcbe3', ocean_label: '#3f6f87',
    park_a: '#cfe8c6', park_b: '#a8d69c', wood_a: '#c4e0b8', wood_b: '#93c787', scrub_a: '#dcebc6', scrub_b: '#c3dea6',
    sand: '#f3e2ae', beach: '#f5e4a8', glacier: '#ffffff', pedestrian: '#ece3d0', buildings: '#e2d4bd',
    // Hiérarchie des routes : autoroutes rose brique, routes principales jaunes, petites routes blanches bien cernées
    highway: '#eba3a0', highway_casing_early: '#b9605c', highway_casing_late: '#b9605c',
    major: '#f7d76b', major_casing_early: '#c4a03a', major_casing_late: '#c4a03a',
    link: '#f7d76b', link_casing: '#c4a03a',
    minor_a: '#ffffff', minor_b: '#ffffff', minor_casing: '#bfb299', minor_service: '#fffdf7', minor_service_casing: '#cfc4ad',
    other: '#f4efe1', boundaries: '#8e7f66', railway: '#8f8573',
    bridges_highway: '#eba3a0', bridges_highway_casing: '#b9605c', bridges_major: '#f7d76b', bridges_major_casing: '#c4a03a',
    bridges_minor: '#ffffff', bridges_minor_casing: '#bfb299', bridges_link: '#f7d76b', bridges_link_casing: '#c4a03a',
    city_label: '#1d2721', city_label_halo: '#f5f2ea', subplace_label: '#56625a', subplace_label_halo: '#f5f2ea',
    roads_label_minor: '#56625a', roads_label_minor_halo: '#ffffff', roads_label_major: '#56625a', roads_label_major_halo: '#ffffff',
    state_label: '#8a938c', state_label_halo: '#f5f2ea', country_label: '#56625a',
  }
}

/** Tuiles d'image (OSM, OpenTopoMap), assombries en thème sombre */
function rasterStyle(fond: Fond, dark: boolean): Maplibre.StyleSpecification {
  const topo = fond === 'topo'
  return {
    version: 8,
    sources: {
      fond: topo
        ? { type: 'raster', tiles: ['a', 'b', 'c'].map(s => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`), tileSize: 256, maxzoom: 17, attribution: `${OSM}, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)` }
        : { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: OSM },
    },
    layers: [{
      id: 'fond',
      type: 'raster',
      source: 'fond',
      paint: dark ? { 'raster-brightness-max': 0.78, 'raster-contrast': 0.08, 'raster-saturation': -0.15 } : {},
    }],
  }
}

/**
 * Notre fond vectoriel : Europe et Japon. Sentiers et pistes en pointillés bruns (pas les trottoirs ni les pistes
 * cyclables des villes) : bien visibles sans se confondre avec le tracé orange.
 */
function vectorStyle(dark: boolean): Maplibre.StyleSpecification {
  const bm = basemaps!
  const sources: Maplibre.StyleSpecification['sources'] = {}
  let layers: Maplibre.LayerSpecification[] = []
  Object.entries(FONDS).forEach(([pays, file], i) => {
    sources[pays] = { type: 'vector', url: `pmtiles://${CARTE_URL}/${file}`, attribution: `${OSM} · <a href="https://protomaps.com">Protomaps</a>` }
    const own = (bm.layers(pays, flavor(dark), { lang: 'fr' }) as Maplibre.LayerSpecification[])
      .filter(l => l.type !== 'background' || i === 0)
      .map(l => ({ ...l, id: `${pays}-${l.id}` }) as Maplibre.LayerSpecification)
    const firstLabel = own.findIndex(l => l.type === 'symbol')
    own.splice(firstLabel, 0, {
      id: `${pays}-sentiers`,
      type: 'line',
      source: pays,
      'source-layer': 'roads',
      minzoom: 12,
      filter: ['all', ['==', ['get', 'kind'], 'path'], ['in', ['get', 'kind_detail'], ['literal', ['path', 'track', 'bridleway']]]],
      paint: { 'line-color': dark ? '#b8936a' : '#8a5a2b', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 16, 2.2], 'line-dasharray': [2.5, 1.5] },
    })
    layers = layers.concat(own)
  })
  return {
    version: 8,
    glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS}/sprites/v4/${dark ? 'dark' : 'light'}`,
    sources,
    layers,
  }
}

function baseStyle(fond: Fond, dark: boolean) {
  return fond === 'plan' && CARTE_URL ? vectorStyle(dark) : rasterStyle(fond, dark)
}

/** Ce que les pages ont ajouté (préfixe a-) passe d'un fond à l'autre */
function keepOverlays(prev: Maplibre.StyleSpecification | undefined, next: Maplibre.StyleSpecification): Maplibre.StyleSpecification {
  if (!prev) return next
  const sources = { ...next.sources }
  for (const [id, s] of Object.entries(prev.sources)) if (id.startsWith('a-')) sources[id] = s
  return { ...next, sources, layers: [...next.layers, ...prev.layers.filter(l => l.id.startsWith('a-'))] }
}

/** Petit sélecteur Plan / Topographique, en haut à droite */
class FondControl implements Maplibre.IControl {
  private box?: HTMLElement
  constructor(private choose: (f: Fond) => void, private current: () => Fond) {}
  onAdd() {
    const box = document.createElement('div')
    box.className = 'maplibregl-ctrl maplibregl-ctrl-group fond-switch'
    for (const [fond, label] of [['plan', 'Plan'], ['topo', 'Topo']] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.title = fond === 'plan' ? 'Plan' : 'Carte topographique (relief)'
      b.dataset.fond = fond
      b.addEventListener('click', () => {
        this.choose(fond)
        this.refresh()
      })
      box.appendChild(b)
    }
    this.box = box
    this.refresh()
    return box
  }

  refresh() {
    for (const b of this.box?.querySelectorAll('button') ?? []) b.classList.toggle('on', b.dataset.fond === this.current())
  }

  onRemove() {
    this.box?.remove()
  }
}

export interface MapOptions {
  center?: LonLat
  /** Zoom de l'ancienne carte (Leaflet) */
  zoom?: number
  scrollZoom?: boolean
  /** Mentions ajoutées à celles du fond (lieux, itinéraires…) */
  attribution?: string
}

export interface SiteMap {
  ml: Ml
  map: Maplibre.Map
  /** Attend que le style soit prêt avant d'ajouter des sources (premier affichage) */
  ready: Promise<void>
  destroy(): void
}

/** Crée une carte dans l'élément, au fond et au thème du site */
export async function createMap(container: HTMLElement, opts: MapOptions = {}): Promise<SiteMap> {
  const ml = await load()
  let fond: Fond = 'plan'
  let dark = isDark()
  const map = new ml.Map({
    container,
    style: baseStyle(fond, dark),
    center: opts.center ?? [2.5, 46.6],
    zoom: z(opts.zoom ?? 6),
    maxZoom: 19,
    scrollZoom: opts.scrollZoom ?? true,
    doubleClickZoom: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: { compact: true, customAttribution: opts.attribution },
  })
  map.touchZoomRotate.disableRotation()
  map.keyboard.disableRotation()
  map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-left')
  const switchFond = (next: Fond) => {
    fond = next
    map.setStyle(baseStyle(fond, dark), { transformStyle: keepOverlays })
  }
  map.addControl(new FondControl(switchFond, () => fond), 'top-right')
  map.addControl(new ml.ScaleControl({ maxWidth: 90 }), 'bottom-left')

  // Thème du site changé (bouton lune/soleil ou réglage de l'appareil)
  const onTheme = () => {
    if (isDark() === dark) return
    dark = isDark()
    switchFond(fond)
  }
  const observer = new MutationObserver(onTheme)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener('change', onTheme)
  const ready = new Promise<void>(resolve => map.isStyleLoaded() ? resolve() : map.once('load', () => resolve()))
  // Mentions repliées derrière le (i) : dépliées, elles cachent le bas de la carte sur téléphone
  ready.then(() => container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'))

  return {
    ml,
    map,
    ready,
    destroy() {
      observer.disconnect()
      media?.removeEventListener('change', onTheme)
      map.remove()
    },
  }
}

/** Lance fn dès que le style accepte des ajouts (au premier affichage ou pendant un changement de fond) */
function whenStyle(map: Maplibre.Map, fn: () => void) {
  try {
    fn()
  }
  catch {
    map.once('styledata', () => whenStyle(map, fn))
  }
}

/** Source GeoJSON d'une page : créée au premier appel, mise à jour ensuite */
export function setData(map: Maplibre.Map, id: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) {
  whenStyle(map, () => {
    const src = map.getSource(id) as Maplibre.GeoJSONSource | undefined
    if (src) src.setData(data)
    else map.addSource(id, { type: 'geojson', data })
  })
}

export function addLayer(map: Maplibre.Map, layer: Maplibre.LayerSpecification) {
  whenStyle(map, () => {
    if (!map.getLayer(layer.id)) map.addLayer(layer)
  })
}

export const line = (coords: LonLat[], props: Record<string, unknown> = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'LineString', coordinates: coords },
})

export const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features })

/** Cadre une liste de points [lon, lat] */
export function fitPoints(ml: Ml, map: Maplibre.Map, pts: LonLat[], padding = 30, animate = true) {
  if (!pts.length) return
  const bounds = new ml.LngLatBounds(pts[0], pts[0])
  for (const p of pts) bounds.extend(p)
  map.fitBounds(bounds, { padding, animate, maxZoom: z(17) })
}

/** Élément HTML d'un marqueur */
export function markerEl(className: string, html = '', size?: number): HTMLElement {
  const el = document.createElement('div')
  el.className = className
  el.innerHTML = html
  if (size) {
    el.style.width = `${size}px`
    el.style.height = `${size}px`
  }
  return el
}

/** Clic sur le fond de la carte (pas sur un marqueur ni sa bulle) */
export function onMapClick(map: Maplibre.Map, fn: (e: Maplibre.MapMouseEvent) => void) {
  map.on('click', (e) => {
    const target = e.originalEvent.target as Element | null
    if (!target?.closest?.('.maplibregl-marker, .maplibregl-popup')) fn(e)
  })
}

/** Bulle d'aide au survol d'un marqueur ; renvoie de quoi l'ouvrir et la fermer à la demande */
export function hoverTip(ml: Ml, map: Maplibre.Map, marker: Maplibre.Marker, html: string, offset = 12) {
  const popup = new ml.Popup({ closeButton: false, closeOnClick: false, closeOnMove: false, className: 'tip', offset, anchor: 'bottom', maxWidth: '260px' })
    .setHTML(html)
  const el = marker.getElement()
  const show = () => popup.setLngLat(marker.getLngLat()).addTo(map)
  const hide = () => popup.remove()
  el.addEventListener('mouseenter', show)
  el.addEventListener('mouseleave', hide)
  return { show, hide }
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[ch]!)
}
