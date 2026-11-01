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
import type { Amenity, Loop, Poi } from '~/utils/loops'
import { kindOf } from '~/utils/places'
import { iconSvg } from '~/utils/icons'

const props = defineProps<{
  start: LatLon | null
  loops: Loop[]
  selected: number
  track: Track | null
  hover: number | null
  /** Lieu à faire ressortir (survolé dans la liste) */
  highlight?: number | null
  /** Points d'eau et toilettes à montrer (liste vide : rien) */
  amenities?: Amenity[]
}>()

const emit = defineEmits<{
  pick: [LatLon]
  select: [number]
  stop: [Poi]
  hoverStop: [number | null]
}>()

const el = ref<HTMLElement>()
let L: typeof Leaflet | null = null
let map: Leaflet.Map | null = null
let loopLayer: Leaflet.LayerGroup | null = null
let amenityLayer: Leaflet.LayerGroup | null = null
let startMarker: Leaflet.Marker | null = null
let hoverMarker: Leaflet.CircleMarker | null = null
/** Marqueurs des lieux de la boucle choisie, par identifiant de lieu */
const stopMarkers = new Map<number, Leaflet.Marker>()
/**
 * La page change la taille de la carte (colonne des boucles qui apparaît) : Leaflet doit recalculer ses
 * tuiles, et un cadrage demandé juste avant est refait à la nouvelle taille.
 */
let refitUntil = 0
const resize = new ResizeObserver(() => {
  map?.invalidateSize()
  if (Date.now() < refitUntil) fitAll()
})

onMounted(async () => {
  const mod = await import('leaflet')
  L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod
  map = L.map(el.value!, { doubleClickZoom: false })
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | lieux <a href="https://www.wikidata.org">Wikidata</a>, <a href="https://geoservices.ign.fr/bdtopo">IGN</a> | itinéraires <a href="https://brouter.de">BRouter</a>',
  })
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  })
  // En ville, le plan se lit mieux que la carte topographique
  osm.addTo(map)
  L.control.layers({ Plan: osm, Topographique: topo }).addTo(map)
  loopLayer = L.layerGroup().addTo(map)
  amenityLayer = L.layerGroup().addTo(map)

  if (props.start) map.setView([props.start.lat, props.start.lon], 14)
  else map.setView([46.6, 2.5], 6)

  map.on('click', (e: Leaflet.LeafletMouseEvent) => emit('pick', { lat: e.latlng.lat, lon: e.latlng.lng }))
  drawStart()
  drawLoops()
  drawAmenities()
  resize.observe(el.value!)
})

onBeforeUnmount(() => {
  resize.disconnect()
  map?.remove()
})

function drawStart() {
  if (!L || !map) return
  if (!props.start) {
    startMarker?.remove()
    startMarker = null
    return
  }
  const ll: [number, number] = [props.start.lat, props.start.lon]
  if (!startMarker) {
    startMarker = L.marker(ll, {
      icon: L.divIcon({ className: 'wp wp-start', html: 'D', iconSize: [26, 26], iconAnchor: [13, 13] }),
      draggable: true,
      title: 'Point de départ (glisse pour le déplacer)',
      zIndexOffset: 1000,
    }).addTo(map)
    startMarker.on('dragend', () => {
      const p = startMarker!.getLatLng()
      emit('pick', { lat: p.lat, lon: p.lng })
    })
  }
  else startMarker.setLatLng(ll)
}

function drawLoops() {
  if (!L || !loopLayer) return
  loopLayer.clearLayers()
  stopMarkers.clear()
  // Les autres propositions en gris (cliquables), la boucle choisie par-dessus
  props.loops.forEach((loop, i) => {
    if (i === props.selected) return
    const line = L!.polyline(loop.coords.map(c => [c[1], c[0]] as [number, number]), { color: '#8a938c', weight: 4, opacity: 0.7 })
    line.on('click', (e) => {
      L!.DomEvent.stopPropagation(e)
      emit('select', i)
    })
    line.bindTooltip(`Boucle ${i + 1}`, { sticky: true })
    line.addTo(loopLayer!)
  })
  const loop = props.loops[props.selected]
  if (!loop) return
  const latlngs = loop.coords.map(c => [c[1], c[0]] as [number, number])
  L.polyline(latlngs, { color: '#fff', weight: 9, opacity: 0.85, interactive: false }).addTo(loopLayer)
  L.polyline(latlngs, { color: '#e2672b', weight: 5, interactive: false }).addTo(loopLayer)
  loop.stops.forEach((s, k) => {
    const kind = kindOf(s)
    const marker = L!.marker([s.lat, s.lon], {
      icon: L!.divIcon({ className: `stop stop-${s.category}`, html: String(k + 1), iconSize: [22, 22], iconAnchor: [11, 11] }),
      keyboard: false,
    })
      .bindTooltip(`<span class="tip-name">${iconSvg(kind.icon, 15)} ${s.name}</span><small>${kind.label} · clique pour en savoir plus</small>`, { direction: 'top', offset: [0, -10] })
      .on('click', (e) => {
        L!.DomEvent.stopPropagation(e)
        emit('stop', s)
      })
      .on('mouseover', () => emit('hoverStop', s.id))
      .on('mouseout', () => emit('hoverStop', null))
      .addTo(loopLayer!)
    stopMarkers.set(s.id, marker)
  })
  drawHighlight()
}

/** Le lieu survolé grossit, passe devant les autres et montre son nom */
let highlighted: Leaflet.Marker | null = null
function drawHighlight() {
  const next = props.highlight == null ? null : stopMarkers.get(props.highlight) ?? null
  if (next === highlighted) return
  if (highlighted) {
    highlighted.getElement()?.classList.remove('stop-hl')
    highlighted.setZIndexOffset(0)
    highlighted.closeTooltip()
  }
  highlighted = next
  if (next) {
    next.getElement()?.classList.add('stop-hl')
    next.setZIndexOffset(900)
    next.openTooltip()
  }
}

/** Points d'eau (goutte bleue) et toilettes (gris), sous les lieux de la boucle */
function drawAmenities() {
  if (!L || !amenityLayer) return
  amenityLayer.clearLayers()
  for (const a of props.amenities ?? []) {
    const water = a.kind === 'water'
    const label = water ? 'Eau potable' : 'Toilettes'
    L.marker([a.lat, a.lon], {
      icon: L.divIcon({ className: `amenity amenity-${a.kind}`, html: iconSvg(water ? 'droplet' : 'toilets', 13), iconSize: [22, 22], iconAnchor: [11, 11] }),
      keyboard: false,
      zIndexOffset: -500,
    })
      .bindTooltip(a.name && a.name !== label ? `<strong>${label}</strong> · ${escapeHtml(a.name)}` : `<strong>${label}</strong>`, { direction: 'top', offset: [0, -10] })
      .addTo(amenityLayer)
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
}

/** Cadre toutes les propositions */
function fitLoops() {
  refitUntil = Date.now() + 1500
  map?.invalidateSize()
  fitAll()
}

function fitAll() {
  if (!L || !map || !props.loops.length) return
  const pts = props.loops.flatMap(l => l.coords.map(c => [c[1], c[0]] as [number, number]))
  map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], animate: false })
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

watch(() => props.start, drawStart)
watch(() => [props.loops, props.selected], drawLoops)
watch(() => props.hover, drawHover)
watch(() => props.highlight, drawHighlight)
watch(() => props.amenities, drawAmenities)

/** Centre la carte sur un lieu (recherche) */
function flyTo(lat: number, lon: number, zoom = 14) {
  map?.setView([lat, lon], zoom)
}

defineExpose({ flyTo, fitLoops })
</script>

<style scoped>
.map { width: 100%; height: 100%; min-height: 380px; border-radius: var(--radius-sm); z-index: 0; cursor: crosshair; }
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
:deep(.stop) {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #e2672b;
  color: #e2672b;
  font: 700 11px/1 'Inter', sans-serif;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
:deep(.stop-nature) { border-color: #2f7d4f; color: #2f7d4f; }
:deep(.amenity) { display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); color: #fff; }
:deep(.amenity-water) { background: #2f7fb5; }
:deep(.amenity-toilets) { background: #6b7a72; }
:deep(.stop.stop-hl) { background: #e2672b; color: #fff; transform-origin: center; box-shadow: 0 0 0 4px rgba(226, 103, 43, 0.3), 0 1px 3px rgba(0, 0, 0, 0.3); }
:deep(.stop-nature.stop-hl) { background: #2f7d4f; box-shadow: 0 0 0 4px rgba(47, 125, 79, 0.3), 0 1px 3px rgba(0, 0, 0, 0.3); }
</style>
