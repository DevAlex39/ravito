<template>
  <div ref="el" class="map" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { pointAt } from '~/utils/gpx'
import { formatKm } from '~/utils/format'
import type * as Leaflet from 'leaflet'
import type { Track } from '~/utils/gpx'
import type { Segment } from '~/utils/segments'

const props = defineProps<{
  track: Track
  segments: Segment[]
  markers: { d: number, label: string }[]
  hover: number | null
}>()

const emit = defineEmits<{ 'update:hover': [number | null] }>()

const COLORS: Record<Segment['type'], string> = { montee: '#d9572b', descente: '#2b78bd', plat: '#4f9a5c' }

const el = ref<HTMLElement>()
let L: typeof Leaflet | null = null
let map: Leaflet.Map | null = null
let routeLayer: Leaflet.LayerGroup | null = null
let markerLayer: Leaflet.LayerGroup | null = null
let hoverMarker: Leaflet.CircleMarker | null = null

onMounted(async () => {
  const mod = await import('leaflet')
  L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod
  map = L.map(el.value!, { scrollWheelZoom: false })
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  })
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  topo.addTo(map)
  L.control.layers({ Topographique: topo, Plan: osm }).addTo(map)
  routeLayer = L.layerGroup().addTo(map)
  markerLayer = L.layerGroup().addTo(map)
  drawRoute(true)
  drawMarkers()
})

onBeforeUnmount(() => map?.remove())

function nearestD(seg: Segment, lat: number, lon: number): number {
  let best = seg.start
  let bestDist = Infinity
  const k = Math.cos(lat * Math.PI / 180)
  for (const p of props.track.points) {
    if (p.d < seg.start || p.d > seg.end) continue
    const dist = (p.lat - lat) ** 2 + ((p.lon - lon) * k) ** 2
    if (dist < bestDist) { bestDist = dist; best = p.d }
  }
  return best
}

function drawRoute(fit: boolean) {
  if (!L || !map || !routeLayer) return
  routeLayer.clearLayers()
  const all: Leaflet.LatLngExpression[] = props.track.points.map(p => [p.lat, p.lon])
  L.polyline(all, { color: '#fff', weight: 8, opacity: 0.9 }).addTo(routeLayer)
  for (const seg of props.segments) {
    const pts: Leaflet.LatLngExpression[] = []
    const a = pointAt(props.track, seg.start)
    pts.push([a.lat, a.lon])
    for (const p of props.track.points) if (p.d > seg.start && p.d < seg.end) pts.push([p.lat, p.lon])
    const b = pointAt(props.track, seg.end)
    pts.push([b.lat, b.lon])
    const line = L.polyline(pts, { color: COLORS[seg.type], weight: 5 }).addTo(routeLayer)
    line.on('mousemove', (e: Leaflet.LeafletMouseEvent) => emit('update:hover', nearestD(seg, e.latlng.lat, e.latlng.lng)))
    line.on('mouseout', () => emit('update:hover', null))
  }
  const start = props.track.points[0]!
  const end = props.track.points[props.track.points.length - 1]!
  L.circleMarker([start.lat, start.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#24503c', fillOpacity: 1 })
    .bindTooltip('Départ').addTo(routeLayer)
  L.circleMarker([end.lat, end.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#1d2721', fillOpacity: 1 })
    .bindTooltip('Arrivée').addTo(routeLayer)
  if (fit) map.fitBounds(L.latLngBounds(all), { padding: [20, 20] })
}

function drawMarkers() {
  if (!L || !markerLayer) return
  markerLayer.clearLayers()
  for (const m of props.markers) {
    const p = pointAt(props.track, m.d)
    L.circleMarker([p.lat, p.lon], { radius: 6, color: '#24503c', weight: 2, fillColor: '#fff', fillOpacity: 1 })
      .bindTooltip(`${m.label} · km ${formatKm(m.d)}`, { permanent: true, direction: 'top', offset: [0, -6], className: 'ravito-tip' })
      .addTo(markerLayer)
  }
}

function drawHover() {
  if (!L || !map) return
  if (props.hover == null) {
    hoverMarker?.remove()
    hoverMarker = null
    return
  }
  const p = pointAt(props.track, props.hover)
  if (!hoverMarker) {
    hoverMarker = L.circleMarker([p.lat, p.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#e2672b', fillOpacity: 1, interactive: false }).addTo(map)
  }
  else hoverMarker.setLatLng([p.lat, p.lon])
}

watch(() => props.track, () => drawRoute(true))
watch(() => props.segments, () => drawRoute(false))
watch(() => props.markers, drawMarkers, { deep: true })
watch(() => props.hover, drawHover)
</script>

<style scoped>
.map { width: 100%; height: 100%; min-height: 320px; border-radius: var(--radius-sm); z-index: 0; }
:deep(.ravito-tip) {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--forest);
  padding: 2px 6px;
}
</style>
