<template>
  <DefaultLayout>
    <Head title="Boucle découverte" />
    <div class="container loops">
      <div class="head">
        <h1>Boucle découverte</h1>
        <p class="hint">Choisis un départ et une distance : on te propose des boucles qui passent par les lieux à voir.</p>
      </div>

      <form class="controls card" @submit.prevent="propose">
        <div class="search">
          <input v-model="query" type="text" placeholder="Ville ou lieu de départ…" aria-label="Rechercher un lieu de départ" @keydown.enter.prevent="onSearch">
          <button class="btn ghost" type="button" :disabled="!query.trim() || searching" @click="onSearch">Rechercher</button>
          <button class="btn ghost" type="button" title="Partir de ma position" @click="onLocate()">📍</button>
        </div>
        <label class="distance">
          <span>Distance</span>
          <input v-model.number="km" type="number" min="3" max="40" step="1" inputmode="numeric" aria-label="Distance en kilomètres">
          <span>km</span>
        </label>
        <label class="distance">
          <select v-model.number="count" aria-label="Nombre de boucles proposées">
            <option v-for="n in 6" :key="n" :value="n">{{ n }}</option>
          </select>
          <span>boucle{{ count > 1 ? 's' : '' }}</span>
        </label>
        <button class="btn" type="submit" :disabled="!start || busy">{{ busy ? 'Recherche…' : 'Proposer des boucles' }}</button>
      </form>

      <p v-if="message" class="notice" :class="{ bad: messageBad }">{{ message }}</p>

      <section class="card map-card">
        <div class="map-wrap">
          <LoopMap
            ref="mapRef"
            :start="start"
            :loops="loops"
            :selected="selected"
            :track="track"
            :hover="hoverD"
            @pick="setStart"
            @select="selected = $event"
          />
          <div v-if="!start" class="overlay">Clique sur la carte pour choisir ton départ</div>
        </div>
      </section>

      <template v-if="loops.length">
        <div class="results">
          <button
            v-for="(loop, i) in loops"
            :key="i"
            type="button"
            class="result card"
            :class="{ active: i === selected }"
            @click="selected = i"
          >
            <span class="title">Boucle {{ i + 1 }}</span>
            <span class="meta num">{{ formatKm(loop.distance) }} km · +{{ Math.round(gains[i] ?? 0) }} m</span>
            <span class="places">
              <template v-if="loop.stops.length">{{ loop.stops.length }} lieu{{ loop.stops.length > 1 ? 'x' : '' }} : {{ loop.stops.map(s => s.name).join(' · ') }}</template>
              <template v-else>Pas de lieu remarquable sur ce tour</template>
            </span>
          </button>
        </div>

        <section v-if="profile" class="card">
          <ElevationProfile v-model:hover="hoverD" :profile="profile" :segments="segments" :height="150" />
        </section>

        <section class="card finish">
          <ol v-if="current?.stops.length" class="stops">
            <li v-for="s in current.stops" :key="s.id">{{ s.name }}</li>
          </ol>
          <div class="finish-actions">
            <button class="btn ghost" type="button" @click="download">Télécharger le GPX</button>
            <button class="btn ghost" type="button" @click="adjust">Ajuster dans le traceur</button>
            <button class="btn" type="button" @click="useForPlan">Préparer ma course avec cette boucle →</button>
          </div>
        </section>
      </template>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import LoopMap from '~/components/loop_map.vue'
import ElevationProfile from '~/components/elevation_profile.vue'
import { usePlan } from '~/composables/use_plan'
import { useTracer } from '~/composables/use_tracer'
import { generateLoops, loopTrack, searchRadius, type Loop, type Poi } from '~/utils/loops'
import { searchPlace, type LatLon } from '~/utils/routing'
import { buildProfile } from '~/utils/profile'
import { autoBoundaries, computeSegments } from '~/utils/segments'
import { formatKm } from '~/utils/format'
import { toGpx } from '~/utils/gpx'

const plan = usePlan()
const tracer = useTracer()
const mapRef = ref<InstanceType<typeof LoopMap>>()

const start = ref<LatLon | null>(null)
/** Nom court du lieu de départ, pour nommer la boucle */
const placeName = ref('')
const km = ref(10)
/** Nombre de boucles demandées (3 par défaut, de 1 à 6) */
const count = ref(3)
const loops = ref<Loop[]>([])
const selected = ref(0)
const hoverD = ref<number | null>(null)
const busy = ref(false)
const message = ref('')
const messageBad = ref(false)

const current = computed(() => loops.value[selected.value] ?? null)
const loopName = computed(() => `Boucle découverte${placeName.value ? ` – ${placeName.value}` : ''} (${Math.round(km.value)} km)`)
const tracks = computed(() => loops.value.map(l => loopTrack(l, loopName.value)))
const profiles = computed(() => tracks.value.map(t => buildProfile(t)))
const gains = computed(() => profiles.value.map(p => p.gain))
const track = computed(() => tracks.value[selected.value] ?? null)
const profile = computed(() => profiles.value[selected.value] ?? null)
const segments = computed(() => (profile.value ? computeSegments(profile.value, autoBoundaries(profile.value)) : []))

function setStart(p: LatLon, name = '') {
  start.value = p
  placeName.value = name
  loops.value = []
  message.value = ''
}

// --- Choix du départ ---
const query = ref('')
const searching = ref(false)

async function onSearch() {
  if (!query.value.trim() || searching.value) return
  searching.value = true
  message.value = ''
  try {
    const place = await searchPlace(query.value.trim())
    if (!place) return showError(`Aucun lieu trouvé pour « ${query.value.trim()} ».`)
    setStart({ lat: place.lat, lon: place.lon }, place.name.split(',')[0]!.trim())
    mapRef.value?.flyTo(place.lat, place.lon)
  }
  catch {
    showError('La recherche est indisponible pour le moment.')
  }
  finally {
    searching.value = false
  }
}

function onLocate(then?: () => void) {
  message.value = ''
  if (!navigator.geolocation) return showError('Position indisponible sur cet appareil.')
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setStart({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      mapRef.value?.flyTo(pos.coords.latitude, pos.coords.longitude)
      then?.()
    },
    () => showError('Position indisponible : autorise la localisation dans ton navigateur.'),
    { timeout: 10000 },
  )
}

function showError(text: string) {
  message.value = text
  messageBad.value = true
}

function showInfo(text: string) {
  message.value = text
  messageBad.value = false
}

// --- Génération ---
async function fetchPois(p: LatLon, target: number): Promise<Poi[]> {
  // Premier passage dans un secteur : les lieux sont récupérés auprès d'OpenStreetMap, c'est plus long
  const slow = setTimeout(() => showInfo('Premier passage dans ce secteur : la recherche des lieux peut prendre jusqu\'à une minute. Les suivantes seront immédiates.'), 3000)
  try {
    const res = await fetch(`/lieux?lat=${p.lat.toFixed(5)}&lon=${p.lon.toFixed(5)}&rayon=${searchRadius(target)}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error()
    return (await res.json() as { lieux: Poi[] }).lieux
  }
  finally {
    clearTimeout(slow)
  }
}

async function propose() {
  if (!start.value || busy.value) return
  const target = Math.min(40, Math.max(3, Math.round(km.value || 10))) * 1000
  km.value = target / 1000
  busy.value = true
  loops.value = []
  showInfo('Recherche des lieux à voir…')
  let pois: Poi[] = []
  let poisFailed = false
  try {
    pois = await fetchPois(start.value, target)
  }
  catch {
    poisFailed = true
  }
  try {
    showInfo('Calcul des itinéraires…')
    loops.value = await generateLoops(start.value, target, pois, count.value)
    selected.value = 0
    // Les nouvelles boucles n'arrivent à la carte qu'au rendu suivant
    nextTick(() => mapRef.value?.fitLoops())
    if (poisFailed) showError('Les lieux à voir sont indisponibles pour le moment : voici des boucles sans étapes.')
    else if (!loops.value.some(l => l.stops.length)) showInfo('Peu de lieux remarquables connus ici : ces boucles explorent simplement les alentours.')
    else if (loops.value.length < count.value) showInfo(`Seulement ${loops.value.length} boucle${loops.value.length > 1 ? 's' : ''} trouvée${loops.value.length > 1 ? 's' : ''} autour de ce départ (relief, rivière ou manque de chemins).`)
    else message.value = ''
  }
  catch {
    showError('Le calcul des itinéraires a échoué. Réessaie dans un instant, ou déplace le point de départ.')
  }
  finally {
    busy.value = false
  }
}

// --- Arrivée depuis l'accueil (?depart=Dole, ?position=1 ou ?lat=…&lon=…, avec &km=10) : on enchaîne tout seul ---
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const lat = Number(params.get('lat'))
  const lon = Number(params.get('lon'))
  const fromPoint = params.has('lat') && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  if (!params.has('depart') && !params.has('position') && !fromPoint) return
  const wanted = Number(params.get('km'))
  if (wanted) km.value = Math.min(40, Math.max(3, Math.round(wanted)))
  // L'adresse redevient /boucles : recharger la page ne relance pas le calcul
  history.replaceState(history.state, '', '/boucles')
  if (params.has('position')) return onLocate(propose)
  if (fromPoint) {
    // La carte se centre d'elle-même sur ce départ à sa création
    setStart({ lat, lon })
    mapRef.value?.flyTo(lat, lon)
    return propose()
  }
  query.value = params.get('depart') ?? ''
  await onSearch()
  if (start.value) propose()
})

// --- Sortie ---
function gpxText() {
  const t = track.value
  return t ? toGpx(t.name, t.points) : null
}

function download() {
  const text = gpxText()
  if (!text) return
  const url = URL.createObjectURL(new Blob([text], { type: 'application/gpx+xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `boucle-${(placeName.value || 'decouverte').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').toLowerCase()}-${Math.round(km.value)}km.gpx`
  a.click()
  URL.revokeObjectURL(url)
}

function adjust() {
  const loop = current.value
  if (!loop) return
  tracer.restore()
  tracer.loadRoute(loop.waypoints, loop.legs, loopName.value)
  router.visit('/tracer')
}

function useForPlan() {
  const text = gpxText()
  if (text && plan.loadGpx(text, `${loopName.value}.gpx`)) router.visit('/')
}
</script>

<style scoped>
.loops { display: flex; flex-direction: column; gap: 16px; }
.head h1 { font-size: 2.2rem; }
.head .hint { color: var(--text-soft); }

.controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px; }
.search { display: flex; gap: 6px; flex: 1 1 360px; min-width: 0; }
.search input { flex: 1; min-width: 0; }
.distance { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; font-weight: 600; color: var(--text-soft); }
.distance input { width: 70px; text-align: center; }
.distance select { font: inherit; padding: 6px 8px; }
.controls .btn:disabled { opacity: 0.5; cursor: not-allowed; }

.notice { font-size: 0.9rem; color: var(--text-soft); }
.notice.bad { color: var(--bad); }

.map-card { padding: 12px; }
.map-wrap { position: relative; height: 58vh; min-height: 380px; }
.overlay {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  background: rgba(29, 39, 33, 0.88);
  color: #fff;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  pointer-events: none;
  white-space: nowrap;
}

.results { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.result {
  font: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  color: var(--text);
}
.result.active { border-color: var(--accent); }
.result .title { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 1.3rem; }
.result.active .title { color: var(--accent); }
.result .meta { font-weight: 600; }
.result .places { font-size: 0.85rem; color: var(--text-soft); }

.finish { display: flex; flex-direction: column; gap: 12px; }
.stops { padding-left: 22px; display: flex; flex-wrap: wrap; gap: 4px 22px; font-size: 0.9rem; }
.finish-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

@media (max-width: 640px) {
  .map-wrap { height: 50vh; min-height: 300px; }
  .controls > .btn { flex: 1 1 100%; }
}
</style>
