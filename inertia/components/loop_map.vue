<template>
  <div ref="el" class="map" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import type { Track } from '~/utils/gpx'
import { pointAt } from '~/utils/gpx'
import type { LatLon } from '~/utils/routing'
import type { Amenity, Loop, Poi } from '~/utils/loops'
import { kindOf } from '~/utils/places'
import { iconSvg } from '~/utils/icons'
import { addLayer, collection, createMap, escapeHtml, fitPoints, hoverTip, line, markerEl, onMapClick, setData, z } from '~/utils/map'
import type { LonLat, SiteMap } from '~/utils/map'

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
let site: SiteMap | null = null
let startMarker: Maplibre.Marker | null = null
let hoverMarker: Maplibre.Marker | null = null
let amenityMarkers: Maplibre.Marker[] = []
/** Marqueurs des lieux de la boucle choisie, par identifiant de lieu */
const stopMarkers = new Map<number, { marker: Maplibre.Marker, tip: ReturnType<typeof hoverTip> }>()
/**
 * La page change la taille de la carte (colonne des boucles qui apparaît) : la carte doit se redimensionner,
 * et un cadrage demandé juste avant est refait à la nouvelle taille.
 */
let refitUntil = 0
const resize = new ResizeObserver(() => {
  site?.map.resize()
  if (Date.now() < refitUntil) fitAll()
})

onMounted(async () => {
  site = await createMap(el.value!, {
    center: props.start ? [props.start.lon, props.start.lat] : undefined,
    zoom: props.start ? 14 : 6,
    attribution: 'lieux <a href="https://www.wikidata.org">Wikidata</a>, <a href="https://geoservices.ign.fr/bdtopo">IGN</a> (France) | itinéraires <a href="https://brouter.de">BRouter</a>',
  })
  const { ml, map } = site
  await site.ready
  setLoops()
  addLayer(map, { id: 'a-others', type: 'line', source: 'a-others', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#8a938c', 'line-width': 4, 'line-opacity': 0.7 } })
  addLayer(map, { id: 'a-loop-halo', type: 'line', source: 'a-loop', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': 0.85 } })
  addLayer(map, { id: 'a-loop', type: 'line', source: 'a-loop', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#e2672b', 'line-width': 5 } })

  // Les autres propositions : cliquables, nom au survol
  const tip = new ml.Popup({ closeButton: false, closeOnClick: false, className: 'tip', offset: 10 })
  map.on('mousemove', 'a-others', (e) => {
    map.getCanvas().style.cursor = 'pointer'
    tip.setLngLat(e.lngLat).setText(`Boucle ${Number(e.features?.[0]?.properties?.i) + 1}`).addTo(map)
  })
  map.on('mouseleave', 'a-others', () => {
    map.getCanvas().style.cursor = ''
    tip.remove()
  })
  onMapClick(map, (e) => {
    const [other] = map.queryRenderedFeatures(e.point, { layers: ['a-others'] })
    if (other) emit('select', Number(other.properties.i))
    else emit('pick', { lat: e.lngLat.lat, lon: e.lngLat.lng })
  })
  drawStart()
  drawStops()
  drawAmenities()
  resize.observe(el.value!)
  // Boucles (déjà en mémoire) ou départ arrivés pendant la création de la carte : le cadrage demandé
  // à ce moment-là s'est perdu, on le refait
  if (props.loops.length) fitLoops()
  else if (props.start) flyTo(props.start.lat, props.start.lon)
})

onBeforeUnmount(() => {
  resize.disconnect()
  site?.destroy()
})

function drawStart() {
  if (!site) return
  const { ml, map } = site
  if (!props.start) {
    startMarker?.remove()
    startMarker = null
    return
  }
  const ll: LonLat = [props.start.lon, props.start.lat]
  if (!startMarker) {
    const node = markerEl('wp wp-start', 'D', 26)
    node.title = 'Point de départ (glisse pour le déplacer)'
    startMarker = new ml.Marker({ element: node, draggable: true }).setLngLat(ll).addTo(map)
    startMarker.on('dragend', () => {
      const p = startMarker!.getLngLat()
      emit('pick', { lat: p.lat, lon: p.lng })
    })
  }
  else startMarker.setLngLat(ll)
}

/** Tracés : les autres propositions en gris, la boucle choisie en orange par-dessus */
function setLoops() {
  if (!site) return
  const coords = (l: Loop) => l.coords.map(c => [c[0], c[1]] as LonLat)
  setData(site.map, 'a-others', collection(props.loops.flatMap((l, i) => i === props.selected ? [] : [line(coords(l), { i })])))
  const loop = props.loops[props.selected]
  setData(site.map, 'a-loop', collection(loop ? [line(coords(loop))] : []))
}

function drawLoops() {
  setLoops()
  drawStops()
}

/** Lieux de la boucle choisie, numérotés dans l'ordre du parcours */
function drawStops() {
  if (!site) return
  const { ml, map } = site
  for (const { marker } of stopMarkers.values()) marker.remove()
  stopMarkers.clear()
  highlighted = null
  const loop = props.loops[props.selected]
  loop?.stops.forEach((s, k) => {
    const kind = kindOf(s)
    const node = markerEl(`stop stop-${s.category}`, String(k + 1), 22)
    const marker = new ml.Marker({ element: node }).setLngLat([s.lon, s.lat]).addTo(map)
    const tip = hoverTip(ml, map, marker, `<span class="tip-name">${iconSvg(kind.icon, 15)} ${escapeHtml(s.name)}</span><small>${kind.label} · clique pour en savoir plus</small>`)
    node.addEventListener('click', () => emit('stop', s))
    node.addEventListener('mouseenter', () => emit('hoverStop', s.id))
    node.addEventListener('mouseleave', () => emit('hoverStop', null))
    stopMarkers.set(s.id, { marker, tip })
  })
  drawHighlight()
}

/** Le lieu survolé dans la liste grossit, passe devant les autres et montre son nom */
let highlighted: number | null = null
function drawHighlight() {
  const next = props.highlight != null && stopMarkers.has(props.highlight) ? props.highlight : null
  if (next === highlighted) return
  const old = highlighted == null ? null : stopMarkers.get(highlighted)
  if (old) {
    old.marker.getElement().classList.remove('stop-hl')
    old.marker.getElement().style.zIndex = ''
    old.tip.hide()
  }
  highlighted = next
  const now = next == null ? null : stopMarkers.get(next)
  if (now) {
    now.marker.getElement().classList.add('stop-hl')
    now.marker.getElement().style.zIndex = '5'
    now.tip.show()
  }
}

/** Points d'eau (goutte bleue) et toilettes (gris), sous les lieux de la boucle */
function drawAmenities() {
  if (!site) return
  const { ml, map } = site
  for (const m of amenityMarkers) m.remove()
  amenityMarkers = (props.amenities ?? []).map((a) => {
    const water = a.kind === 'water'
    const label = water ? 'Eau potable' : 'Toilettes'
    const node = markerEl(`amenity amenity-${a.kind}`, iconSvg(water ? 'droplet' : 'toilets', 13), 22)
    node.style.zIndex = '-1'
    const marker = new ml.Marker({ element: node }).setLngLat([a.lon, a.lat]).addTo(map)
    hoverTip(ml, map, marker, a.name && a.name !== label ? `<strong>${label}</strong> · ${escapeHtml(a.name)}` : `<strong>${label}</strong>`)
    return marker
  })
}

/** Cadre toutes les propositions */
function fitLoops() {
  refitUntil = Date.now() + 1500
  site?.map.resize()
  fitAll()
}

function fitAll() {
  if (!site || !props.loops.length) return
  fitPoints(site.ml, site.map, props.loops.flatMap(l => l.coords.map(c => [c[0], c[1]] as LonLat)), 30, false)
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

watch(() => props.start, drawStart)
// Copie de la liste : une boucle remplacée (Moins de D+, retour à l'origine) redessine aussi la carte
watch(() => [...props.loops, props.selected], drawLoops)
watch(() => props.hover, drawHover)
watch(() => props.highlight, drawHighlight)
watch(() => props.amenities, drawAmenities)

/** Centre la carte sur un lieu (recherche) */
function flyTo(lat: number, lon: number, zoom = 14) {
  site?.map.jumpTo({ center: [lon, lat], zoom: z(zoom) })
}

defineExpose({ flyTo, fitLoops })
</script>

<style scoped>
.map { width: 100%; height: 100%; min-height: 380px; border-radius: var(--radius-sm); z-index: 0; }
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
}
:deep(.wp-start) { background: #24503c; z-index: 6; }
:deep(.stop) {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #e2672b;
  color: #e2672b;
  font: 700 11px/1 'Inter', sans-serif;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
:deep(.stop-nature) { border-color: #2f7d4f; color: #2f7d4f; }
:deep(.amenity) { display: flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); color: #fff; }
:deep(.amenity-water) { background: #2f7fb5; }
:deep(.amenity-toilets) { background: #6b7a72; }
:deep(.stop.stop-hl) { background: #e2672b; color: #fff; box-shadow: 0 0 0 4px rgba(226, 103, 43, 0.3), 0 1px 3px rgba(0, 0, 0, 0.3); }
:deep(.stop-nature.stop-hl) { background: #2f7d4f; box-shadow: 0 0 0 4px rgba(47, 125, 79, 0.3), 0 1px 3px rgba(0, 0, 0, 0.3); }
:deep(.dot-hover) { box-sizing: border-box; border-radius: 50%; border: 2px solid #fff; background: #24503c; pointer-events: none; }
</style>
