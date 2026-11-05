<template>
  <div ref="el" class="map" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { pointAt } from '~/utils/gpx'
import { formatKm } from '~/utils/format'
import { addLayer, collection, createMap, fitPoints, hoverTip, line, markerEl, setData } from '~/utils/map'
import type { LonLat, SiteMap } from '~/utils/map'
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
let site: SiteMap | null = null
let ends: Maplibre.Marker[] = []
let ravitos: Maplibre.Marker[] = []
let hoverMarker: Maplibre.Marker | null = null

onMounted(async () => {
  site = await createMap(el.value!, { scrollZoom: false })
  const { map } = site
  await site.ready
  setRoute()
  addLayer(map, { id: 'a-route-halo', type: 'line', source: 'a-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#fff', 'line-width': 8, 'line-opacity': 0.9 } })
  addLayer(map, { id: 'a-segments', type: 'line', source: 'a-segments', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 5 } })
  map.on('mousemove', 'a-segments', (e) => {
    const f = e.features?.[0]
    const seg = props.segments[Number(f?.properties?.i)]
    if (seg) emit('update:hover', nearestD(seg, e.lngLat.lat, e.lngLat.lng))
  })
  map.on('mouseleave', 'a-segments', () => emit('update:hover', null))
  drawRoute(true)
  drawMarkers()
})

onBeforeUnmount(() => site?.destroy())

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

/** Trace entière (liseré blanc) et segments colorés montée / descente / plat */
function setRoute() {
  if (!site) return
  const { map } = site
  const all: LonLat[] = props.track.points.map(p => [p.lon, p.lat])
  const segs = props.segments.map((seg, i) => {
    const a = pointAt(props.track, seg.start)
    const b = pointAt(props.track, seg.end)
    const pts: LonLat[] = [[a.lon, a.lat]]
    for (const p of props.track.points) if (p.d > seg.start && p.d < seg.end) pts.push([p.lon, p.lat])
    pts.push([b.lon, b.lat])
    return line(pts, { i, color: COLORS[seg.type] })
  })
  setData(map, 'a-route', line(all))
  setData(map, 'a-segments', collection(segs))
  return all
}

function drawRoute(fit: boolean) {
  if (!site) return
  const { ml, map } = site
  const all = setRoute() ?? []
  for (const m of ends) m.remove()
  const start = props.track.points[0]!
  const end = props.track.points[props.track.points.length - 1]!
  ends = [[start, 'Départ', 'dot dot-start'], [end, 'Arrivée', 'dot dot-end']].map(([p, label, cls]) => {
    const pt = p as typeof start
    const m = new ml.Marker({ element: markerEl(cls as string, '', 14) }).setLngLat([pt.lon, pt.lat]).addTo(map)
    hoverTip(ml, map, m, label as string, 8)
    return m
  })
  if (fit) fitPoints(ml, map, all, 20, false)
}

/** Ravitos : rond blanc et étiquette toujours visible */
function drawMarkers() {
  if (!site) return
  const { ml, map } = site
  for (const m of ravitos) m.remove()
  ravitos = props.markers.map((m) => {
    const p = pointAt(props.track, m.d)
    const node = markerEl('ravito')
    const label = document.createElement('span')
    label.className = 'ravito-tip'
    label.textContent = `${m.label} · km ${formatKm(m.d)}`
    node.appendChild(label)
    return new ml.Marker({ element: node }).setLngLat([p.lon, p.lat]).addTo(map)
  })
}

function drawHover() {
  if (!site) return
  const { ml, map } = site
  if (props.hover == null) {
    hoverMarker?.remove()
    hoverMarker = null
    return
  }
  const p = pointAt(props.track, props.hover)
  hoverMarker ??= new ml.Marker({ element: markerEl('dot dot-hover', '', 14) }).setLngLat([p.lon, p.lat]).addTo(map)
  hoverMarker.setLngLat([p.lon, p.lat])
}

watch(() => props.track, () => drawRoute(true))
watch(() => props.segments, () => drawRoute(false))
watch(() => props.markers, drawMarkers, { deep: true })
watch(() => props.hover, drawHover)
</script>

<style scoped>
.map { width: 100%; height: 100%; min-height: 320px; border-radius: var(--radius-sm); z-index: 0; }
:deep(.dot) { border-radius: 50%; border: 2px solid #fff; box-sizing: border-box; }
:deep(.dot-start) { background: #24503c; }
:deep(.dot-end) { background: #1d2721; }
:deep(.dot-hover) { background: #e2672b; pointer-events: none; }
:deep(.ravito) { width: 12px; height: 12px; box-sizing: border-box; border-radius: 50%; border: 2px solid #24503c; background: #fff; }
:deep(.ravito-tip) {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--forest);
  background: var(--panel);
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  pointer-events: none;
}
</style>
