<template>
  <DefaultLayout>
    <Head title="Créer une trace" />
    <div class="container tracer">
      <div class="head">
        <h1>Créer une trace</h1>
        <p class="hint">Clique sur la carte pour poser tes points : le tracé suit les sentiers. Glisse un point pour le déplacer, clique dessus pour le retirer.</p>
      </div>

      <section class="card map-card">
        <div class="top">
          <div class="box search">
            <Icon name="pin" class="box-icon" />
            <PlaceInput v-model="query" class="place" placeholder="Aller à une ville, une adresse…" aria-label="Rechercher un lieu" @pick="onPick" @enter="onSearch" />
            <button class="square" type="button" title="Centrer sur ma position" aria-label="Centrer sur ma position" @click="onLocate"><Icon name="locate" /></button>
          </div>
          <div class="modes" role="radiogroup" aria-label="Tracé des prochains points">
            <button type="button" role="radio" :aria-checked="mode === 'sentiers'" :class="{ active: mode === 'sentiers' }" @click="mode = 'sentiers'">
              <Icon name="route" :size="16" />Suivre les sentiers
            </button>
            <button type="button" role="radio" :aria-checked="mode === 'droit'" :class="{ active: mode === 'droit' }" @click="mode = 'droit'">
              <Icon name="arrow" :size="16" />Ligne droite
            </button>
          </div>
        </div>
        <p v-if="searchError" class="notice bad">{{ searchError }}</p>

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
          <div class="tools">
            <button class="tool" type="button" :disabled="!history.length" title="Annuler le dernier point (Ctrl+Z)" @click="undo"><Icon name="undo" :size="17" />Annuler</button>
            <button class="tool" type="button" :disabled="waypoints.length < 2 || isLoop" title="Relier le dernier point au départ" @click="closeLoop"><Icon name="refresh" :size="17" />Revenir au départ</button>
            <button class="tool" type="button" :disabled="!waypoints.length" title="Effacer tous les points" @click="clear"><Icon name="trash" :size="17" />Tout effacer</button>
          </div>
          <div class="stats num" aria-label="Distance et dénivelé">
            <span class="stat"><Icon name="route" :size="16" /><strong>{{ profile ? formatKm(profile.distance, 2) : '0' }}</strong> km</span>
            <span class="stat"><Icon name="mountain" :size="16" /><strong>+{{ profile ? Math.round(profile.gain) : 0 }}</strong> m</span>
            <span class="stat"><strong>−{{ profile ? Math.round(profile.loss) : 0 }}</strong> m</span>
          </div>
        </div>

        <p v-if="pending" class="notice">Calcul de l'itinéraire…</p>
        <p v-if="failed" class="notice bad">
          Aucun sentier trouvé sur un tronçon (en rouge) : déplace un des points, ou passe en « Ligne droite ».
        </p>
        <p v-if="noElevation" class="notice">Les lignes droites n'ont pas d'altitude : le dénivelé sera nul sur ces portions.</p>
      </section>

      <section v-if="profile" class="card profile-card">
        <ElevationProfile v-model:hover="hoverD" :profile="profile" :segments="segments" :height="160" />
      </section>

      <section class="card finish">
        <label class="field grow">
          <span>Nom du parcours</span>
          <span class="box">
            <Icon name="pencil" class="box-icon" />
            <input v-model="name" type="text" placeholder="Mon parcours">
          </span>
        </label>
        <div class="finish-actions">
          <button class="btn ghost" type="button" :disabled="!track || pending" @click="download"><Icon name="download" :size="17" />Télécharger le GPX</button>
          <button class="btn" type="button" :disabled="!track || pending" @click="useForPlan">Préparer ma course<Icon name="arrow" :size="17" /></button>
        </div>
        <p v-if="!track" class="finish-hint">Pose au moins deux points sur la carte pour continuer.</p>
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
import PlaceInput from '~/components/place_input.vue'
import Icon from '~/components/icon.vue'
import { useTracer } from '~/composables/use_tracer'
import { usePlan } from '~/composables/use_plan'
import { autoBoundaries, computeSegments } from '~/utils/segments'
import { searchPlace, type PlaceSuggestion } from '~/utils/geocode'
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

/** Suggestion choisie dans la liste : on y va directement */
function onPick(place: PlaceSuggestion) {
  query.value = place.label
  searchError.value = ''
  mapRef.value?.flyTo(place.lat, place.lon)
}

/** Entrée sans choisir de suggestion : premier lieu trouvé */
async function onSearch() {
  if (!query.value.trim() || searching.value) return
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
.head h1 { font-size: 2.2rem; margin: 0; }
.head .hint { margin: 4px 0 0; color: var(--text-soft); font-size: 0.93rem; }

.map-card { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.box { display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 5px 0 13px; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--panel-2); }
.box:focus-within { border-color: var(--forest); background: #fff; }
.box-icon { flex: none; color: var(--forest); }
.search { flex: 1 1 320px; min-width: 0; }
.search .place { flex: 1; }
.search .place :deep(input) { border: none; background: transparent; font-size: 0.97rem; padding: 10px 0; outline: none; width: 100%; }
.square { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border: none; border-radius: 9px; background: var(--forest-soft); color: var(--forest); cursor: pointer; }
.square:hover { background: #d3e2d8; }

.modes { display: flex; background: var(--panel-2); border: 1px solid var(--border); border-radius: 12px; padding: 3px; }
.modes button { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 0.86rem; font-weight: 600; border: none; background: transparent; color: var(--text-soft); padding: 8px 12px; border-radius: 9px; cursor: pointer; white-space: nowrap; }
.modes button:hover { color: var(--text); }
.modes button.active { background: var(--forest); color: #fff; }

.map-wrap { position: relative; height: 62vh; min-height: 420px; border-radius: 10px; overflow: hidden; }
.overlay { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); z-index: 500; background: rgba(29, 39, 33, 0.88); color: #fff; padding: 7px 14px; border-radius: 999px; font-size: 0.88rem; font-weight: 600; pointer-events: none; white-space: nowrap; }

.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.tools { display: flex; gap: 4px; flex-wrap: wrap; }
.tool { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 0.86rem; font-weight: 600; padding: 7px 10px; border: none; border-radius: 9px; background: none; color: var(--text); cursor: pointer; }
.tool .icon { color: var(--forest); }
.tool:hover:not(:disabled) { background: var(--panel-2); }
.tool:disabled { color: var(--text-dim); cursor: not-allowed; }
.tool:disabled .icon { color: var(--text-dim); }
.stats { display: flex; gap: 6px; color: var(--text-soft); font-size: 0.88rem; }
.stat { display: inline-flex; align-items: baseline; gap: 4px; padding: 5px 11px; border-radius: 999px; background: var(--panel-2); }
.stat .icon { align-self: center; color: var(--forest); }
.stat strong { font-family: 'Barlow Condensed', sans-serif; font-size: 1.3rem; color: var(--text); line-height: 1; }

.notice { margin: 0; font-size: 0.85rem; color: var(--text-soft); }
.notice.bad { color: var(--bad); }

.finish { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.finish .grow { flex: 1 1 260px; min-width: 0; }
.finish .box input { flex: 1; min-width: 0; border: none; background: transparent; padding: 10px 0; font-size: 0.97rem; outline: none; }
.finish-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.finish-actions .btn { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 18px; border-radius: 12px; font-size: 0.95rem; }
.finish-actions .btn:disabled { opacity: 0.45; cursor: not-allowed; }
.finish-hint { flex-basis: 100%; margin: -4px 0 0; font-size: 0.84rem; color: var(--text-dim); }

@media (max-width: 640px) {
  .head h1 { font-size: 2rem; }
  .map-card { padding: 10px; }
  .modes { width: 100%; }
  .modes button { flex: 1; justify-content: center; }
  .map-wrap { height: 55vh; min-height: 320px; }
  .tools { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); }
  .tool { flex-direction: column; gap: 3px; font-size: 0.78rem; padding: 6px 4px; text-align: center; }
  .stats { width: 100%; }
  .stat { flex: 1; justify-content: center; }
  .finish-actions { width: 100%; }
  .finish-actions .btn { flex: 1; justify-content: center; }
}
</style>
