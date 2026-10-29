<template>
  <DefaultLayout>
    <Head title="Tracer un parcours" />
    <div class="container tracer">
      <div class="head">
        <div>
          <h1>Trace ton parcours</h1>
          <p class="hint">Clique sur la carte pour poser tes points : le tracé suit les sentiers. Glisse un point pour le déplacer.</p>
        </div>
        <form class="search" @submit.prevent="onSearch">
          <input v-model="query" type="text" placeholder="Aller à une ville, un lieu…" aria-label="Rechercher un lieu">
          <button class="btn ghost" type="submit" :disabled="!query.trim() || searching">Rechercher</button>
          <button class="btn ghost" type="button" title="Centrer sur ma position" @click="onLocate">📍</button>
        </form>
      </div>
      <p v-if="searchError" class="notice bad">{{ searchError }}</p>

      <section class="card map-card">
        <div class="map-wrap">
          <TraceMap
            ref="mapRef"
            :waypoints="waypoints"
            :legs="legs"
            :track="track"
            :hover="hoverD"
            :start-bounds="startBounds"
            @add="addPoint"
            @move="movePoint"
            @remove="removePoint"
          />
          <div v-if="!waypoints.length" class="overlay">Clique sur la carte pour poser ton départ</div>
        </div>

        <div class="toolbar">
          <div class="modes" role="radiogroup" aria-label="Tracé des prochains points">
            <button type="button" role="radio" :aria-checked="mode === 'sentiers'" :class="{ active: mode === 'sentiers' }" @click="mode = 'sentiers'">
              Suivre les sentiers
            </button>
            <button type="button" role="radio" :aria-checked="mode === 'droit'" :class="{ active: mode === 'droit' }" @click="mode = 'droit'">
              Ligne droite
            </button>
          </div>
          <div class="tools">
            <button class="btn ghost small" type="button" :disabled="!history.length" title="Ctrl+Z" @click="undo">↶ Annuler</button>
            <button class="btn ghost small" type="button" :disabled="waypoints.length < 2 || isLoop" @click="closeLoop">⟲ Revenir au départ</button>
            <button class="btn ghost small" type="button" :disabled="!waypoints.length" @click="clear">Tout effacer</button>
          </div>
          <div class="stats num">
            <span><strong>{{ profile ? formatKm(profile.distance, 2) : '0' }}</strong> km</span>
            <span><strong>+{{ profile ? Math.round(profile.gain) : 0 }}</strong> m</span>
            <span><strong>−{{ profile ? Math.round(profile.loss) : 0 }}</strong> m</span>
          </div>
        </div>

        <p v-if="pending" class="notice">Calcul de l'itinéraire…</p>
        <p v-if="failed" class="notice bad">
          Aucun sentier trouvé sur un tronçon (en rouge) : déplace un des points, ou passe en « Ligne droite ».
        </p>
        <p v-if="noElevation" class="notice">Les lignes droites n'ont pas d'altitude : le dénivelé sera nul sur ces portions.</p>
      </section>

      <section v-if="profile" class="card">
        <ElevationProfile v-model:hover="hoverD" :profile="profile" :segments="segments" :height="160" />
      </section>

      <section class="card finish">
        <label class="field grow">
          <span>Nom du parcours</span>
          <input v-model="name" type="text" placeholder="Mon parcours">
        </label>
        <div class="finish-actions">
          <button class="btn ghost" type="button" :disabled="!track || pending" @click="download">Télécharger le GPX</button>
          <button class="btn" type="button" :disabled="!track || pending" @click="useForPlan">Préparer ma course avec ce parcours →</button>
        </div>
      </section>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import TraceMap from '~/components/trace_map.vue'
import ElevationProfile from '~/components/elevation_profile.vue'
import { useTracer } from '~/composables/use_tracer'
import { usePlan } from '~/composables/use_plan'
import { autoBoundaries, computeSegments } from '~/utils/segments'
import { searchPlace } from '~/utils/routing'
import { formatKm } from '~/utils/format'

const {
  waypoints, legs, mode, name, history, track, profile, isLoop, pending, failed, noElevation,
  restore, addPoint, movePoint, removePoint, closeLoop, undo, clear, gpxText,
} = useTracer()
restore()

const plan = usePlan()
const mapRef = ref<InstanceType<typeof TraceMap>>()
const hoverD = ref<number | null>(null)

const segments = computed(() => (profile.value ? computeSegments(profile.value, autoBoundaries(profile.value)) : []))

/** Sans brouillon, on démarre sur la course déjà chargée dans le plan (s'il y en a une) */
const startBounds = computed<[[number, number], [number, number]] | null>(() => {
  const pts = plan.track.value?.points
  if (!pts?.length) return null
  const lats = pts.map(p => p.lat)
  const lons = pts.map(p => p.lon)
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]]
})

// --- Recherche de lieu ---
const query = ref('')
const searching = ref(false)
const searchError = ref('')

async function onSearch() {
  searching.value = true
  searchError.value = ''
  try {
    const place = await searchPlace(query.value.trim())
    if (place) mapRef.value?.flyTo(place.lat, place.lon)
    else searchError.value = `Aucun lieu trouvé pour « ${query.value.trim()} ».`
  }
  catch {
    searchError.value = 'La recherche est indisponible pour le moment.'
  }
  finally {
    searching.value = false
  }
}

async function onLocate() {
  searchError.value = ''
  const ok = await mapRef.value?.locate()
  if (!ok) searchError.value = 'Position indisponible : autorise la localisation dans ton navigateur.'
}

// --- Sortie ---
function fileName() {
  const base = (name.value.trim() || 'parcours').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '')
  return `${base.toLowerCase() || 'parcours'}.gpx`
}

function download() {
  const text = gpxText()
  if (!text) return
  const url = URL.createObjectURL(new Blob([text], { type: 'application/gpx+xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName()
  a.click()
  URL.revokeObjectURL(url)
}

function useForPlan() {
  const text = gpxText()
  if (!text) return
  if (plan.loadGpx(text, fileName())) router.visit('/')
}

// Ctrl+Z annule le dernier point (sauf pendant la saisie dans un champ)
function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    undo()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.tracer { display: flex; flex-direction: column; gap: 16px; }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.head h1 { font-size: 2.2rem; }
.search { display: flex; gap: 6px; flex: 0 1 420px; min-width: 0; }
.search input { flex: 1; min-width: 0; }

.map-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.map-wrap { position: relative; height: 62vh; min-height: 420px; }
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

.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.modes { display: flex; background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px; }
.modes button {
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--text-soft);
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.modes button.active { background: #fff; color: var(--accent); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
.tools { display: flex; gap: 6px; flex-wrap: wrap; }
.tools .btn:disabled, .finish .btn:disabled, .search .btn:disabled { opacity: 0.45; cursor: not-allowed; }
.stats { margin-left: auto; display: flex; gap: 14px; color: var(--text-soft); font-size: 0.9rem; }
.stats strong { font-family: 'Barlow Condensed', sans-serif; font-size: 1.35rem; color: var(--text); }

.notice { font-size: 0.85rem; color: var(--text-soft); }
.notice.bad { color: var(--bad); }

.finish { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.finish .grow { flex: 1; min-width: 200px; }
.finish-actions { display: flex; gap: 8px; flex-wrap: wrap; }

@media (max-width: 640px) {
  .search { flex: 1 1 100%; }
  .map-wrap { height: 55vh; min-height: 320px; }
  .stats { margin-left: 0; }
}
</style>
