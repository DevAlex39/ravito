<template>
  <!-- Pas de :class ici : Vue écraserait les classes que Leaflet pose sur cet élément -->
  <div ref="el" class="map" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as Leaflet from 'leaflet'
import type { Track } from '~/utils/gpx'
import { pointAt } from '~/utils/gpx'
import type { LatLon } from '~/utils/routing'
import type { TraceLeg, TracePoint } from '~/composables/use_tracer'
import type { Poi } from '~/utils/loops'
import { kindOf } from '~/utils/places'
import { iconSvg } from '~/utils/icons'

/** Zone affichée : centre, rayon (m) jusqu'au coin et niveau de zoom */
export interface MapView { lat: number, lon: number, radius: number, zoom: number }

const props = defineProps<{
  waypoints: TracePoint[]
  /** Lieux à voir de la zone affichée (bouton « Lieux à voir ») */
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
let L: typeof Leaflet | null = null
let map: Leaflet.Map | null = null
let legLayer: Leaflet.LayerGroup | null = null
let pointLayer: Leaflet.LayerGroup | null = null
let placeLayer: Leaflet.LayerGroup | null = null
const placeMarkers = new Map<number, Leaflet.Marker>()
let resizer: ResizeObserver | null = null
let hoverMarker: Leaflet.CircleMarker | null = null

onMounted(async () => {
  const mod = await import('leaflet')
  L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod
  map = L.map(el.value!, { doubleClickZoom: false })
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) | itinéraires <a href="https://brouter.de">BRouter</a>',
  })
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | itinéraires <a href="https://brouter.de">BRouter</a>',
  })
  osm.addTo(map)
  L.control.layers({ Plan: osm, Topographique: topo }).addTo(map)
  legLayer = L.layerGroup().addTo(map)
  placeLayer = L.layerGroup().addTo(map)
  pointLayer = L.layerGroup().addTo(map)

  if (props.waypoints.length) fitAll()
  else if (props.startBounds) map.fitBounds(props.startBounds, { padding: [30, 30] })
  else map.setView([46.6, 2.5], 6)

  map.on('click', (e: Leaflet.LeafletMouseEvent) => emit('add', { lat: e.latlng.lat, lon: e.latlng.lng }))
  map.on('moveend', emitView)
  drawLegs()
  drawPoints()
  drawPlaces()
  emitView()
  // La liste des lieux s'affiche à côté de la carte : Leaflet doit recalculer sa taille
  resizer = new ResizeObserver(() => map?.invalidateSize())
  resizer.observe(el.value!)
})

function emitView() {
  if (!map) return
  const c = map.getCenter()
  const corner = map.getBounds().getNorthEast()
  emit('view', { lat: c.lat, lon: c.lng, radius: map.distance(c, corner), zoom: map.getZoom() })
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[ch]!)
}

/** Lieux de la zone : un clic ouvre une bulle pour l'ajouter au parcours (ceux déjà ajoutés sont des points du tracé) */
function drawPlaces() {
  if (!L || !placeLayer) return
  // Les lieux sont rechargés quand la carte bouge (y compris quand elle se décale pour montrer une bulle) : on rouvre la bulle ouverte
  const openId = [...placeMarkers].find(([, m]) => m.isPopupOpen())?.[0]
  placeLayer.clearLayers()
  placeMarkers.clear()
  const picked = new Set(props.waypoints.map(w => w.poi?.id).filter(id => id != null))
  for (const p of props.places ?? []) {
    if (picked.has(p.id)) continue
    const kind = kindOf(p)
    const marker = L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: `place place-${p.category}`, html: iconSvg(kind.icon, 13), iconSize: [24, 24], iconAnchor: [12, 12] }),
      keyboard: false,
    }).addTo(placeLayer)
    placeMarkers.set(p.id, marker)
    const box = document.createElement('div')
    box.className = 'place-pop'
    box.innerHTML = `<strong>${escapeHtml(p.name)}</strong><small>${kind.label}</small>`
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'place-add'
    btn.textContent = 'Ajouter au parcours'
    btn.addEventListener('click', () => {
      marker.closePopup()
      emit('place', p)
    })
    box.appendChild(btn)
    marker.bindPopup(box, { closeButton: false, offset: [0, -8] })
    marker.bindTooltip(escapeHtml(p.name), { direction: 'top', offset: [0, -12] })
  }
  if (openId != null) placeMarkers.get(openId)?.openPopup()
}

onBeforeUnmount(() => {
  resizer?.disconnect()
  map?.remove()
})

function fitAll() {
  if (!L || !map) return
  const pts = props.legs.flatMap(l => l.coords.map(c => [c[1], c[0]] as [number, number]))
  if (!pts.length) pts.push(...props.waypoints.map(w => [w.lat, w.lon] as [number, number]))
  if (pts.length === 1) map.setView(pts[0]!, 15)
  else if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] })
}

function drawLegs() {
  if (!L || !legLayer) return
  legLayer.clearLayers()
  for (const leg of props.legs) {
    const latlngs = leg.coords.map(c => [c[1], c[0]] as [number, number])
    const style: Leaflet.PolylineOptions
      = leg.status === 'loading' ? { color: '#8a938c', weight: 4, dashArray: '6 8' }
        : leg.status === 'error' ? { color: '#c9302c', weight: 4, dashArray: '6 8' }
          : leg.mode === 'droit' ? { color: '#e2672b', weight: 4, dashArray: '2 8', lineCap: 'round' }
            : { color: '#e2672b', weight: 5 }
    L.polyline(latlngs, { color: '#fff', weight: (style.weight ?? 4) + 4, opacity: 0.8, interactive: false }).addTo(legLayer)
    L.polyline(latlngs, { ...style, interactive: false }).addTo(legLayer)
  }
}

function pointIcon(i: number): Leaflet.DivIcon {
  const n = props.waypoints.length
  const poi = props.waypoints[i]?.poi
  // Lieu au milieu du tracé : son icône, cerclée de la couleur du parcours
  if (poi && i > 0 && i < n - 1) {
    return L!.divIcon({ className: `wp wp-poi place-${poi.category}`, html: iconSvg(kindOf(poi).icon, 13), iconSize: [26, 26], iconAnchor: [13, 13] })
  }
  const kind = i === 0 ? 'start' : i === n - 1 ? 'end' : 'mid'
  const label = i === 0 ? 'D' : i === n - 1 && n > 1 ? 'A' : ''
  const size = kind === 'mid' ? 14 : 24
  return L!.divIcon({
    className: `wp wp-${kind}`,
    html: label,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function drawPoints() {
  if (!L || !pointLayer) return
  pointLayer.clearLayers()
  props.waypoints.forEach((w, i) => {
    const marker = L!.marker([w.lat, w.lon], { icon: pointIcon(i), draggable: true, title: w.poi ? undefined : 'Glisse pour déplacer' }).addTo(pointLayer!)
    if (w.poi) marker.bindTooltip(`${escapeHtml(w.poi.name)} · dans le parcours`, { direction: 'top', offset: [0, -14] })
    marker.on('dragend', () => {
      const p = marker.getLatLng()
      emit('move', i, { lat: p.lat, lon: p.lng })
    })
    // Clic sur un point : petite bulle pour le supprimer
    const box = document.createElement('div')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'wp-remove'
    btn.textContent = w.poi ? 'Retirer du parcours' : 'Supprimer ce point'
    btn.addEventListener('click', () => {
      marker.closePopup()
      emit('remove', i)
    })
    box.appendChild(btn)
    marker.bindPopup(box, { closeButton: false, offset: [0, -6] })
  })
}

function drawHover() {
  if (!L || !map) return
  if (props.hover == null || !props.track) {
    hoverMarker?.remove()
    hoverMarker = null
    return
  }
  const p = pointAt(props.track, props.hover)
  if (!hoverMarker) {
    hoverMarker = L.circleMarker([p.lat, p.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#24503c', fillOpacity: 1, interactive: false }).addTo(map)
  }
  else hoverMarker.setLatLng([p.lat, p.lon])
}

// Les tronçons sont remplacés (jamais modifiés en place) : surveiller le contenu du tableau suffit,
// sans parcourir en profondeur les milliers de coordonnées
watch(() => [...props.legs], drawLegs)
watch(() => [...props.waypoints], () => {
  drawPoints()
  drawPlaces()
})
watch(() => props.places, drawPlaces)
watch(() => props.hover, drawHover)

/** Centre la carte sur un lieu (recherche) */
function flyTo(lat: number, lon: number, zoom = 14) {
  map?.setView([lat, lon], zoom)
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

/** Ouvre la bulle d'un lieu de la liste (la carte se décale pour l'afficher) */
function focusPlace(id: number) {
  placeMarkers.get(id)?.openPopup()
}

defineExpose({ flyTo, locate, fitAll, focusPlace })
</script>

<style scoped>
.map { width: 100%; height: 100%; min-height: 420px; border-radius: var(--radius-sm); z-index: 0; cursor: crosshair; }
:deep(.leaflet-grab) { cursor: crosshair; }
:deep(.leaflet-dragging .leaflet-grab) { cursor: grabbing; }
:deep(.wp) {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  font: 700 12px/1 'Inter', sans-serif;
  color: #fff;
  cursor: grab;
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
:deep(.leaflet-popup-content) { margin: 8px; }
:deep(.place) { display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #fff; border: 2px solid #b4561f; color: #b4561f; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); cursor: pointer; }
:deep(.place.place-nature) { border-color: #2f7d4f; color: #2f7d4f; }
:deep(.wp-poi) { border: 3px solid #e2672b; background: #fff; color: #b4561f; }
:deep(.wp-poi.place-nature) { color: #2f7d4f; }
:deep(.place-pop) { display: flex; flex-direction: column; gap: 2px; min-width: 160px; font: 13px 'Inter', sans-serif; }
:deep(.place-pop small) { color: var(--text-soft); margin-bottom: 6px; }
:deep(.place-add) { font: 600 12px 'Inter', sans-serif; border: none; background: var(--forest); color: #fff; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
</style>
