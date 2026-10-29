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
import type { Loop } from '~/utils/loops'

const props = defineProps<{
  start: LatLon | null
  loops: Loop[]
  selected: number
  track: Track | null
  hover: number | null
}>()

const emit = defineEmits<{
  pick: [LatLon]
  select: [number]
}>()

const el = ref<HTMLElement>()
let L: typeof Leaflet | null = null
let map: Leaflet.Map | null = null
let loopLayer: Leaflet.LayerGroup | null = null
let startMarker: Leaflet.Marker | null = null
let hoverMarker: Leaflet.CircleMarker | null = null

onMounted(async () => {
  const mod = await import('leaflet')
  L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod
  map = L.map(el.value!, { doubleClickZoom: false })
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | lieux <a href="https://www.wikidata.org">Wikidata</a> | itinéraires <a href="https://brouter.de">BRouter</a>',
  })
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  })
  // En ville, le plan se lit mieux que la carte topographique
  osm.addTo(map)
  L.control.layers({ Plan: osm, Topographique: topo }).addTo(map)
  loopLayer = L.layerGroup().addTo(map)

  if (props.start) map.setView([props.start.lat, props.start.lon], 14)
  else map.setView([46.6, 2.5], 6)

  map.on('click', (e: Leaflet.LeafletMouseEvent) => emit('pick', { lat: e.latlng.lat, lon: e.latlng.lng }))
  drawStart()
  drawLoops()
})

onBeforeUnmount(() => map?.remove())

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
    L!.marker([s.lat, s.lon], {
      icon: L!.divIcon({ className: 'stop', html: String(k + 1), iconSize: [22, 22], iconAnchor: [11, 11] }),
      keyboard: false,
    })
      .bindTooltip(s.name, { direction: 'top', offset: [0, -10] })
      .addTo(loopLayer!)
  })
}

/** Cadre toutes les propositions */
function fitLoops() {
  if (!L || !map || !props.loops.length) return
  const pts = props.loops.flatMap(l => l.coords.map(c => [c[1], c[0]] as [number, number]))
  map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] })
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
}
</style>
