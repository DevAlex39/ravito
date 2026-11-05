<template>
  <div ref="el" class="map" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import type { Track } from '~/utils/gpx'
import { pointAt } from '~/utils/gpx'
import type { LatLon } from '~/utils/routing'
import type { TraceLeg, TracePoint } from '~/composables/use_tracer'
import type { Poi } from '~/utils/loops'
import { kindOf } from '~/utils/places'
import { iconSvg } from '~/utils/icons'
import { addLayer, collection, createMap, escapeHtml, fitPoints, hoverTip, line, markerEl, onMapClick, setData, z, zLeaflet } from '~/utils/map'
import type { LonLat, SiteMap } from '~/utils/map'

/** Zone affichée : centre, rayon (m) jusqu'au coin et niveau de zoom (échelle de l'ancienne carte) */
export interface MapView { lat: number, lon: number, radius: number, zoom: number }

const props = defineProps<{
  waypoints: TracePoint[]
  /** Lieux à voir de la zone affichée (bouton « Afficher les lieux ») */
  places?: Poi[]
  legs: TraceLeg[]
  track: Track | null
  hover: number | null
  /** Zone à afficher au départ s'il n'y a encore aucun point */
  startBounds?: [[number, number], [number, number]] | null
}>()

const emit = defineEmits<{
  add: [LatLon]
  move: [number, LatLon]
  remove: [number]
  place: [Poi]
  view: [MapView]
}>()

const el = ref<HTMLElement>()
let site: SiteMap | null = null
let pointMarkers: Maplibre.Marker[] = []
const placeMarkers = new Map<number, Maplibre.Marker>()
let resizer: ResizeObserver | null = null
let hoverMarker: Maplibre.Marker | null = null

onMounted(async () => {
  site = await createMap(el.value!, { attribution: 'itinéraires <a href="https://brouter.de">BRouter</a>' })
  const { map } = site
  await site.ready
  setLegs()
  const round = { 'line-join': 'round', 'line-cap': 'round' } as const
  addLayer(map, { id: 'a-legs-halo', type: 'line', source: 'a-legs', layout: round, paint: { 'line-color': '#fff', 'line-width': ['+', ['get', 'w'], 4], 'line-opacity': 0.8 } })
  addLayer(map, { id: 'a-legs', type: 'line', source: 'a-legs', filter: ['==', ['get', 'dash'], 'none'], layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'] } })
  // En calcul : tirets gris ; sans chemin trouvé ou ligne droite voulue : pointillés orange
  addLayer(map, { id: 'a-legs-loading', type: 'line', source: 'a-legs', filter: ['==', ['get', 'dash'], 'loading'], paint: { 'line-color': '#8a938c', 'line-width': 4, 'line-dasharray': [1.5, 2] } })
  addLayer(map, { id: 'a-legs-straight', type: 'line', source: 'a-legs', filter: ['==', ['get', 'dash'], 'straight'], layout: round, paint: { 'line-color': '#e2672b', 'line-width': 4, 'line-dasharray': [0.5, 2] } })

  if (props.waypoints.length) fitAll(false)
  else if (props.startBounds) {
    const [[s, w], [n, e]] = props.startBounds
    fitPoints(site.ml, map, [[w, s], [e, n]], 30, false)
  }

  onMapClick(map, e => emit('add', { lat: e.lngLat.lat, lon: e.lngLat.lng }))
  map.on('moveend', emitView)
  drawPoints()
  drawPlaces()
  emitView()
  // La liste des lieux s'affiche à côté de la carte : elle doit se redimensionner
  resizer = new ResizeObserver(() => site?.map.resize())
  resizer.observe(el.value!)
})

function emitView() {
  if (!site) return
  const { map } = site
  const c = map.getCenter()
  const corner = map.getBounds().getNorthEast()
  emit('view', { lat: c.lat, lon: c.lng, radius: c.distanceTo(corner), zoom: zLeaflet(map.getZoom()) })
}

/** Bulle à bouton, ouverte au clic sur un marqueur */
function buttonPopup(content: HTMLElement, offset: number) {
  return new site!.ml.Popup({ closeButton: false, offset, maxWidth: '260px' }).setDOMContent(content)
}

/** Lieux de la zone : un clic ouvre une bulle pour l'ajouter au parcours (ceux déjà ajoutés sont des points du tracé) */
function drawPlaces() {
  if (!site) return
  const { ml, map } = site
  // Les lieux sont rechargés quand la carte bouge (y compris quand elle se décale pour montrer une bulle) : on rouvre la bulle ouverte
  const openId = [...placeMarkers].find(([, m]) => m.getPopup()?.isOpen())?.[0]
  for (const m of placeMarkers.values()) m.remove()
  placeMarkers.clear()
  const picked = new Set(props.waypoints.map(w => w.poi?.id).filter(id => id != null))
  for (const p of props.places ?? []) {
    if (picked.has(p.id)) continue
    const kind = kindOf(p)
    const marker = new ml.Marker({ element: markerEl(`place place-${p.category}`, iconSvg(kind.icon, 13), 24) }).setLngLat([p.lon, p.lat])
    const box = document.createElement('div')
    box.className = 'place-pop'
    box.innerHTML = `<strong>${escapeHtml(p.name)}</strong><small>${kind.label}</small>`
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'place-add'
    btn.textContent = 'Ajouter au parcours'
    btn.addEventListener('click', () => {
      marker.getPopup()?.remove()
      emit('place', p)
    })
    box.appendChild(btn)
    marker.setPopup(buttonPopup(box, 14)).addTo(map)
    const tip = hoverTip(ml, map, marker, escapeHtml(p.name), 14)
    marker.getElement().addEventListener('click', tip.hide)
    placeMarkers.set(p.id, marker)
  }
  if (openId != null) placeMarkers.get(openId)?.togglePopup()
}

onBeforeUnmount(() => {
  resizer?.disconnect()
  site?.destroy()
})

function fitAll(animate = true) {
  if (!site) return
  const pts: LonLat[] = props.legs.flatMap(l => l.coords.map(c => [c[0], c[1]] as LonLat))
  if (!pts.length) pts.push(...props.waypoints.map(w => [w.lon, w.lat] as LonLat))
  if (pts.length === 1) site.map.jumpTo({ center: pts[0]!, zoom: z(15) })
  else fitPoints(site.ml, site.map, pts, 30, animate)
}

function setLegs() {
  if (!site) return
  setData(site.map, 'a-legs', collection(props.legs.map((leg) => {
    const coords = leg.coords.map(c => [c[0], c[1]] as LonLat)
    const dash = leg.status === 'loading' ? 'loading' : leg.status === 'error' || leg.mode === 'droit' ? 'straight' : 'none'
    return line(coords, { dash, color: '#e2672b', w: dash === 'none' ? 5 : 4 })
  })))
}

function pointEl(i: number): HTMLElement {
  const n = props.waypoints.length
  const poi = props.waypoints[i]?.poi
  // Lieu au milieu du tracé : son icône, cerclée de la couleur du parcours
  if (poi && i > 0 && i < n - 1) return markerEl(`wp wp-poi place-${poi.category}`, iconSvg(kindOf(poi).icon, 13), 26)
  const kind = i === 0 ? 'start' : i === n - 1 ? 'end' : 'mid'
  const label = i === 0 ? 'D' : i === n - 1 && n > 1 ? 'A' : ''
  return markerEl(`wp wp-${kind}`, label, kind === 'mid' ? 14 : 24)
}

function drawPoints() {
  if (!site) return
  const { ml, map } = site
  for (const m of pointMarkers) m.remove()
  pointMarkers = props.waypoints.map((w, i) => {
    const node = pointEl(i)
    if (!w.poi) node.title = 'Glisse pour déplacer'
    const marker = new ml.Marker({ element: node, draggable: true }).setLngLat([w.lon, w.lat])
    marker.on('dragend', () => {
      const p = marker.getLngLat()
      emit('move', i, { lat: p.lat, lon: p.lng })
    })
    // Clic sur un point : petite bulle pour le supprimer
    const box = document.createElement('div')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'wp-remove'
    btn.textContent = w.poi ? 'Retirer du parcours' : 'Supprimer ce point'
    btn.addEventListener('click', () => {
      marker.getPopup()?.remove()
      emit('remove', i)
    })
    box.appendChild(btn)
    marker.setPopup(buttonPopup(box, 14)).addTo(map)
    if (w.poi) {
      const tip = hoverTip(ml, map, marker, `${escapeHtml(w.poi.name)} · dans le parcours`, 14)
      node.addEventListener('click', tip.hide)
    }
    return marker
  })
}

function drawHover() {
  if (!site) return
  const { ml, map } = site
  if (props.hover == null || !props.track) {
    hoverMarker?.remove()
    hoverMarker = null
    return
  }
  const p = pointAt(props.track, props.hover)
  hoverMarker ??= new ml.Marker({ element: markerEl('dot-hover', '', 14) }).setLngLat([p.lon, p.lat]).addTo(map)
  hoverMarker.setLngLat([p.lon, p.lat])
}

// Les tronçons sont remplacés (jamais modifiés en place) : surveiller le contenu du tableau suffit,
// sans parcourir en profondeur les milliers de coordonnées
watch(() => [...props.legs], setLegs)
watch(() => [...props.waypoints], () => {
  drawPoints()
  drawPlaces()
})
watch(() => props.places, drawPlaces)
watch(() => props.hover, drawHover)

/** Centre la carte sur un lieu (recherche) */
function flyTo(lat: number, lon: number, zoom = 14) {
  site?.map.jumpTo({ center: [lon, lat], zoom: z(zoom) })
}

/** Centre la carte sur la position de l'utilisateur ; renvoie false si elle est indisponible */
function locate(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyTo(pos.coords.latitude, pos.coords.longitude, 15)
        resolve(true)
      },
      () => resolve(false),
      { timeout: 10000 },
    )
  })
}

/** Ouvre la bulle d'un lieu de la liste (la carte se recentre dessus) */
function focusPlace(id: number) {
  const m = placeMarkers.get(id)
  if (!m || !site) return
  site.map.easeTo({ center: m.getLngLat() })
  if (!m.getPopup()?.isOpen()) m.togglePopup()
}

defineExpose({ flyTo, locate, fitAll, focusPlace })
</script>

<style scoped>
.map { width: 100%; height: 100%; min-height: 420px; border-radius: var(--radius-sm); z-index: 0; }
.map :deep(.maplibregl-canvas-container) { cursor: crosshair; }
.map :deep(.maplibregl-canvas-container:active) { cursor: grabbing; }
:deep(.wp) {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  font: 700 12px/1 'Inter', sans-serif;
  color: #fff;
  cursor: grab;
  z-index: 3;
}
:deep(.wp-start) { background: #24503c; }
:deep(.wp-end) { background: #e2672b; }
:deep(.wp-mid) { background: #fff; border-color: #e2672b; border-width: 3px; }
:deep(.wp-remove) {
  font: 600 12px 'Inter', sans-serif;
  border: none;
  background: var(--bad-bg);
  color: var(--bad);
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
}
:deep(.place) { display: flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 50%; background: #fff; border: 2px solid #b4561f; color: #b4561f; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); cursor: pointer; }
:deep(.place.place-nature) { border-color: #2f7d4f; color: #2f7d4f; }
:deep(.wp-poi) { border: 3px solid #e2672b; background: #fff; color: #b4561f; }
:deep(.wp-poi.place-nature) { color: #2f7d4f; }
:deep(.place-pop) { display: flex; flex-direction: column; gap: 2px; min-width: 160px; font: 13px 'Inter', sans-serif; }
:deep(.place-pop small) { color: var(--text-soft); margin-bottom: 6px; }
:deep(.place-add) { font: 600 12px 'Inter', sans-serif; border: none; background: var(--forest-fill); color: #fff; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
:deep(.dot-hover) { box-sizing: border-box; border-radius: 50%; border: 2px solid #fff; background: #24503c; pointer-events: none; }
</style>
