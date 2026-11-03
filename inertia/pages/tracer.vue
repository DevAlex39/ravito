<template>
  <DefaultLayout>
    <Head title="Créer une trace" />
    <div class="container tracer">
      <div class="head">
        <h1>Créer une trace</h1>
        <p class="hint">Clique sur la carte pour poser tes points : le tracé suit les sentiers. Glisse un point pour le déplacer, clique dessus pour le retirer. Avec « Afficher les lieux », ajoute les lieux de ton choix, même dans plusieurs villes.</p>
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
          <button type="button" class="places-toggle" :class="{ active: showPlaces }" :aria-pressed="showPlaces" title="Afficher les lieux à voir de la zone, pour les ajouter au parcours" @click="togglePlaces">
            <Icon name="landmark" :size="16" />{{ showPlaces ? 'Masquer les lieux' : 'Afficher les lieux' }}
          </button>
        </div>
        <p v-if="searchError" class="notice bad">{{ searchError }}</p>
        <p v-if="showPlaces && placesNote" class="notice">{{ placesNote }}</p>

        <div class="map-area" :class="{ 'with-list': showPlaces && places.length }">
          <div ref="mapWrap" class="map-wrap">
            <TraceMap
              ref="mapRef"
              :waypoints="waypoints"
              :legs="legs"
              :track="track"
              :hover="hoverD"
              :start-bounds="startBounds"
              :places="showPlaces ? shownPlaces : []"
              @add="onMapClick"
              @place="onPlace"
              @view="onView"
              @move="movePoint"
              @remove="removePoint"
            />
            <div v-if="!waypoints.length" class="overlay">Clique sur la carte pour poser ton départ</div>
          </div>

          <aside v-if="showPlaces && places.length" class="place-list" :class="{ open: listOpen }">
            <button type="button" class="list-toggle" :aria-expanded="listOpen" @click="listOpen = !listOpen">
              <Icon name="landmark" :size="16" />{{ listOpen ? 'Masquer la liste' : `Afficher la liste (${shownPlaces.length})` }}
            </button>
            <div class="list-body">
              <div class="box list-search">
                <input v-model="placeQuery" type="search" placeholder="Rechercher un lieu (ex. collégiale)" aria-label="Rechercher dans les lieux">
              </div>
              <div v-if="groupsHere.length > 1" class="groups" role="group" aria-label="Filtrer par type de lieu">
                <button
                  v-for="g in visibleGroups"
                  :key="g.id"
                  type="button"
                  class="group"
                  :class="[g.category, { active: placeGroups.includes(g.id) }]"
                  :aria-pressed="placeGroups.includes(g.id)"
                  @click="toggleGroup(g.id)"
                >
                  <Icon :name="g.icon" :size="13" />{{ g.label }} <span class="count">{{ g.count }}</span>
                </button>
                <button v-if="groupsHere.length > GROUPS_SHOWN" type="button" class="group more" @click="allGroups = !allGroups">
                  {{ allGroups ? 'Moins' : `+ ${groupsHere.length - GROUPS_SHOWN} autres` }}
                </button>
              </div>
              <p class="list-from">{{ shownPlaces.length }} lieu{{ shownPlaces.length > 1 ? 'x' : '' }} · distance à vol d'oiseau {{ fromLabel }}</p>
              <ul class="items">
                <li v-for="item in listItems" :key="item.p.id" class="item" :class="item.p.category">
                  <button type="button" class="item-main" title="Voir sur la carte" @click="showOnMap(item.p.id)">
                    <Icon :name="kindOf(item.p).icon" :size="15" class="item-icon" />
                    <span class="item-text">
                      <strong>{{ item.p.name }}</strong>
                      <small>{{ kindOf(item.p).label }}</small>
                    </span>
                    <span class="item-dist num">{{ formatDistance(item.d) }}</span>
                  </button>
                  <button type="button" class="item-add" :aria-label="`Ajouter ${item.p.name} au parcours`" title="Ajouter au parcours" @click="onPlace(item.p)">+</button>
                </li>
              </ul>
              <p v-if="places.length && !listItems.length" class="list-empty">Aucun lieu ne correspond.</p>
            </div>
          </aside>
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

        <div v-if="tracePois.length" class="pois">
          <span class="pois-title">Lieux du parcours</span>
          <span ref="chipList" class="poi-list">
            <span
              v-for="(p, k) in tracePois"
              :key="p.id"
              :data-id="p.id"
              class="poi-chip"
              :class="[p.category, { fixed: !movable.has(p.id) }]"
              :title="movable.has(p.id) ? 'Glisse pour changer l\'ordre de visite' : ''"
            >
              <span class="poi-rank num">{{ k + 1 }}</span>
              <Icon :name="kindOf(p).icon" :size="14" />{{ p.name }}
              <button type="button" :aria-label="`Retirer ${p.name} du parcours`" title="Retirer du parcours" @click="removePoi(p.id)">×</button>
            </span>
          </span>
          <button
            v-if="movable.size >= 2"
            type="button"
            class="optimize"
            :disabled="pending"
            title="Remet les lieux dans l'ordre qui donne le parcours le plus court (départ et arrivée inchangés)"
            @click="onOptimize"
          >
            <Icon name="route" :size="15" />Optimiser l'ordre
          </button>
          <span v-if="orderNote" class="order-note">{{ orderNote }}</span>
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
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Sortable from 'sortablejs'
import { Head, router } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import TraceMap, { type MapView } from '~/components/trace_map.vue'
import ElevationProfile from '~/components/elevation_profile.vue'
import PlaceInput from '~/components/place_input.vue'
import Icon from '~/components/icon.vue'
import { useTracer } from '~/composables/use_tracer'
import { usePlan } from '~/composables/use_plan'
import { autoBoundaries, computeSegments } from '~/utils/segments'
import { searchPlace, type PlaceSuggestion } from '~/utils/geocode'
import { formatKm } from '~/utils/format'
import { KIND_GROUPS, kindOf } from '~/utils/places'
import type { Poi } from '~/utils/loops'
import type { LatLon } from '~/utils/routing'
import type { IconName } from '~/utils/icons'
import { haversine } from '~/utils/gpx'

const {
  waypoints, legs, mode, name, history, track, profile, isLoop, pending, failed, noElevation,
  restore, addPoint, insertPoint, movePoint, removePoint, removePoi, reorderPois, optimizeOrder, closeLoop, undo, clear, gpxText,
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

// --- Lieux à voir : ceux de la zone affichée, rechargés quand on déplace la carte ---
const showPlaces = ref(false)
const places = ref<Poi[]>([])
const placesNote = ref('')
const lastView = shallowRef<MapView | null>(null)
let viewTimer: ReturnType<typeof setTimeout> | undefined
/** Numéro de la dernière demande : une réponse plus ancienne arrivée en retard est ignorée */
let placesRequest = 0

function onView(view: MapView) {
  lastView.value = view
  if (!showPlaces.value) return
  clearTimeout(viewTimer)
  viewTimer = setTimeout(loadPlaces, 400)
}

function togglePlaces() {
  showPlaces.value = !showPlaces.value
  if (showPlaces.value) loadPlaces()
}

async function loadPlaces() {
  const view = lastView.value
  if (!view) return
  if (view.zoom < 12) {
    places.value = []
    placesNote.value = 'Zoome sur une ville ou un secteur pour voir ses lieux.'
    return
  }
  const id = ++placesRequest
  placesNote.value = 'Recherche des lieux…'
  try {
    const radius = Math.round(Math.min(9000, Math.max(300, view.radius)))
    const res = await fetch(`/lieux?lat=${view.lat.toFixed(5)}&lon=${view.lon.toFixed(5)}&rayon=${radius}`, { headers: { Accept: 'application/json' } })
    if (id !== placesRequest) return
    if (!res.ok) throw new Error()
    places.value = ((await res.json()) as { lieux: Poi[] }).lieux
    placesNote.value = places.value.length ? 'Clique sur un lieu pour l\'ajouter au parcours.' : 'Aucun lieu connu dans cette zone.'
  }
  catch {
    if (id === placesRequest) placesNote.value = 'Les lieux sont indisponibles pour le moment.'
  }
}

/** Lieux posés dans le tracé, dans l'ordre de passage */
const tracePois = computed(() => waypoints.value.flatMap(w => (w.poi ? [w.poi] : [])))
/** Lieux dont on peut changer l'ordre : tous sauf un lieu posé en départ ou en arrivée */
const movable = computed(() => {
  const w = waypoints.value
  return new Set(w.flatMap((p, i) => (p.poi && i > 0 && i < w.length - 1 ? [p.poi.id] : [])))
})

// --- Ordre de visite des lieux : glisser-déposer des pastilles, ou « Optimiser l'ordre » ---
const chipList = ref<HTMLElement>()
const orderNote = ref('')
let orderNoteTimer: ReturnType<typeof setTimeout> | undefined
let sortable: Sortable | null = null

function showOrderNote(text: string) {
  orderNote.value = text
  clearTimeout(orderNoteTimer)
  orderNoteTimer = setTimeout(() => (orderNote.value = ''), 4000)
}

function onOptimize() {
  showOrderNote(optimizeOrder() ? 'Ordre optimisé : l\'itinéraire est recalculé.' : 'Cet ordre est déjà le plus court.')
}

// La liste n'existe que s'il y a des lieux : Sortable est branché à son apparition
watch(chipList, (el) => {
  sortable?.destroy()
  sortable = el
    ? Sortable.create(el, {
        draggable: '.poi-chip',
        // Le bouton « × » reste cliquable, les lieux de départ/arrivée ne bougent pas
        filter: 'button, .fixed',
        preventOnFilter: false,
        // Au doigt : appui long pour attraper, sinon la page ne défile plus
        delay: 180,
        delayOnTouchOnly: true,
        animation: 150,
        ghostClass: 'chip-ghost',
        onEnd(evt) {
          const { item, from, oldIndex, newIndex } = evt
          if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
          // Vue garde la main sur la liste : on annule le déplacement fait par Sortable, puis on change les données
          from.removeChild(item)
          from.insertBefore(item, from.children[oldIndex] ?? null)
          const ids = tracePois.value.map(p => p.id)
          ids.splice(newIndex, 0, ids.splice(oldIndex, 1)[0]!)
          reorderPois(ids.filter(id => movable.value.has(id)))
        },
      })
    : null
})
onBeforeUnmount(() => sortable?.destroy())

// --- Liste des lieux : recherche par nom ou type, filtre par famille, tri par distance ---
const placeQuery = ref('')
const placeGroups = ref<string[]>([])
/** Sur mobile, la liste est repliée tant qu'on ne l'ouvre pas (sur ordinateur elle est toujours visible) */
const listOpen = ref(false)
/** Dernier point posé (clic sur la carte ou lieu ajouté) : les distances de la liste partent de lui */
const lastAdded = ref<LatLon | null>(null)

const simplify = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const groupOf = (p: Poi) => KIND_GROUPS.find(g => g.kinds.includes(p.kind))?.id ?? `autres-${p.category}`

/** Lieux de la zone pas encore dans le parcours */
const freePlaces = computed(() => {
  const picked = new Set(tracePois.value.map(p => p.id))
  return places.value.filter(p => !picked.has(p.id))
})

/** Familles présentes dans la zone, les plus fournies d'abord */
const groupsHere = computed(() => {
  const counts = new Map<string, number>()
  for (const p of freePlaces.value) counts.set(groupOf(p), (counts.get(groupOf(p)) ?? 0) + 1)
  const others = (category: 'patrimoine' | 'nature') => ({ id: `autres-${category}`, category, icon: (category === 'nature' ? 'leaf' : 'pin') as IconName, label: category === 'nature' ? 'Autres sites naturels' : 'Autres lieux' })
  return [...KIND_GROUPS, others('patrimoine'), others('nature')]
    .filter(g => counts.has(g.id))
    .map(g => ({ ...g, count: counts.get(g.id)! }))
    .sort((a, b) => b.count - a.count)
})

/** Les familles les plus fournies, les autres derrière « + N autres » (une famille cochée reste visible) */
const GROUPS_SHOWN = 5
const allGroups = ref(false)
const visibleGroups = computed(() => (allGroups.value
  ? groupsHere.value
  : groupsHere.value.filter((g, i) => i < GROUPS_SHOWN || placeGroups.value.includes(g.id))))

function toggleGroup(id: string) {
  placeGroups.value = placeGroups.value.includes(id) ? placeGroups.value.filter(g => g !== id) : [...placeGroups.value, id]
}

/** Lieux retenus par la recherche et les familles cochées (la carte affiche les mêmes) */
const shownPlaces = computed(() => {
  const q = simplify(placeQuery.value.trim())
  // Une famille cochée qui n'existe plus dans la zone affichée ne doit pas tout masquer
  const groups = placeGroups.value.filter(id => groupsHere.value.some(g => g.id === id))
  return freePlaces.value.filter(p =>
    (!groups.length || groups.includes(groupOf(p)))
    && (!q || simplify(p.name).includes(q) || simplify(kindOf(p).label).includes(q)))
})

/** Point de départ des distances : le dernier point posé s'il est encore là, sinon la fin du tracé, sinon le centre de la carte */
const fromPoint = computed<{ at: LatLon, label: string } | null>(() => {
  const w = waypoints.value
  const last = lastAdded.value
  if (last && w.some(p => p.lat === last.lat && p.lon === last.lon)) return { at: last, label: 'depuis ton dernier point' }
  const end = w[isLoop.value ? w.length - 2 : w.length - 1]
  if (end) return { at: end, label: 'depuis la fin du tracé' }
  return lastView.value ? { at: { lat: lastView.value.lat, lon: lastView.value.lon }, label: 'depuis le centre de la carte' } : null
})
const fromLabel = computed(() => fromPoint.value?.label ?? '')

const listItems = computed(() => {
  const from = fromPoint.value?.at
  return shownPlaces.value
    .map(p => ({ p, d: from ? haversine(from, p) : 0 }))
    .sort((a, b) => a.d - b.d)
})

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${formatKm(m, 1)} km`
}

/** Ouvre la bulle du lieu ; sur mobile la carte est au-dessus de la liste, on y remonte si elle n'est plus visible */
const mapWrap = ref<HTMLElement>()
function showOnMap(id: number) {
  mapRef.value?.focusPlace(id)
  const box = mapWrap.value?.getBoundingClientRect()
  if (box && (box.bottom < 80 || box.top > window.innerHeight)) mapWrap.value!.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function onMapClick(p: LatLon) {
  addPoint(p)
  lastAdded.value = p
}

function onPlace(p: Poi) {
  const first = !waypoints.value.length
  const point = { lat: p.lat, lon: p.lon }
  insertPoint({ ...point, poi: { id: p.id, name: p.name, kind: p.kind, category: p.category } })
  lastAdded.value = point
  placesNote.value = first
    ? `« ${p.name} » est ton point de départ : ajoute d'autres lieux ou clique sur la carte.`
    : `« ${p.name} » ajouté au parcours, là où il rallonge le moins le tracé.`
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

.places-toggle { display: inline-flex; align-items: center; gap: 6px; height: 46px; padding: 0 14px; font: inherit; font-size: 0.86rem; font-weight: 600; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--panel-2); color: var(--text); cursor: pointer; white-space: nowrap; }
.places-toggle .icon { color: var(--forest); }
.places-toggle:hover { border-color: var(--forest); }
.places-toggle.active { background: var(--forest); border-color: var(--forest); color: #fff; }
.places-toggle.active .icon { color: #fff; }
.pois { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.pois-title { font-size: 0.8rem; font-weight: 600; color: var(--text-soft); margin-right: 2px; }
.poi-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 4px 3px 9px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 10%, #fff); border: 1px solid color-mix(in srgb, var(--accent) 35%, #fff); font-size: 0.83rem; }
.poi-chip .icon { color: #b4561f; }
.poi-chip.nature { background: var(--forest-soft); border-color: #bcd3c4; }
.poi-chip.nature .icon { color: #2f7d4f; }
.poi-chip button { width: 20px; height: 20px; border: none; border-radius: 50%; background: none; color: var(--text-soft); font-size: 1rem; line-height: 1; cursor: pointer; }
.poi-chip button:hover { background: var(--bad-bg); color: var(--bad); }
.poi-list { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.poi-chip:not(.fixed) { cursor: grab; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
.poi-chip.chip-ghost { opacity: 0.4; }
.poi-rank { min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: rgb(0 0 0 / 0.08); font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
.optimize { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border: 1px dashed var(--border-strong); border-radius: 999px; background: transparent; font: inherit; font-size: 0.82rem; font-weight: 600; color: var(--forest); cursor: pointer; }
.optimize:hover:not(:disabled) { background: var(--forest-soft); border-style: solid; }
.optimize:disabled { opacity: 0.5; cursor: default; }
.order-note { font-size: 0.8rem; color: var(--text-soft); }
.map-wrap { position: relative; height: 62vh; min-height: 420px; border-radius: 10px; overflow: hidden; }
.map-area { display: grid; grid-template-columns: 1fr; gap: 12px; }
.map-area.with-list { grid-template-columns: minmax(0, 1fr) 360px; }

.place-list { display: flex; flex-direction: column; height: 62vh; min-height: 420px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel-2); overflow: hidden; }
.list-toggle { display: none; }
.list-body { display: flex; flex-direction: column; gap: 8px; min-height: 0; flex: 1; padding: 10px; }
.list-search { height: 40px; padding: 0 12px; background: #fff; }
.list-search input { flex: 1; min-width: 0; border: none; background: transparent; font: inherit; font-size: 0.9rem; outline: none; }
.groups { display: flex; flex-wrap: wrap; gap: 4px; }
.group { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border: 1px solid var(--border-strong); border-radius: 999px; background: #fff; font: inherit; font-size: 0.74rem; color: var(--text); cursor: pointer; }
.group.more { border-style: dashed; color: var(--forest); font-weight: 600; }
.group .icon { color: #b4561f; }
.group.nature .icon { color: #2f7d4f; }
.group .count { color: var(--text-dim); font-size: 0.72rem; }
.group.active { background: var(--forest); border-color: var(--forest); color: #fff; }
.group.active .icon, .group.active .count { color: #fff; }
.list-from { margin: 0; font-size: 0.76rem; color: var(--text-dim); }
.items { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 4px; }
.item { display: flex; align-items: center; gap: 4px; background: #fff; border: 1px solid var(--border); border-radius: 9px; }
.item-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 7px 4px 7px 9px; border: none; background: none; font: inherit; text-align: left; color: var(--text); cursor: pointer; }
.item-icon { flex: none; color: #b4561f; }
.item.nature .item-icon { color: #2f7d4f; }
.item-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.item-text strong { font-size: 0.86rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-text small { font-size: 0.74rem; color: var(--text-soft); }
.item-dist { flex: none; font-size: 0.8rem; font-weight: 600; color: var(--text-soft); }
.item-add { flex: none; width: 30px; height: 30px; margin-right: 5px; border: none; border-radius: 8px; background: var(--forest-soft); color: var(--forest); font-size: 1.2rem; line-height: 1; cursor: pointer; }
.item-add:hover { background: var(--forest); color: #fff; }
.list-empty { margin: 0; font-size: 0.84rem; color: var(--text-soft); }
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

/* Écran étroit : la liste passe sous la carte, repliée derrière un bouton */
@media (max-width: 900px) {
  .map-area.with-list { grid-template-columns: 1fr; }
  .place-list { height: auto; min-height: 0; }
  .list-toggle { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border: none; background: none; font: inherit; font-size: 0.88rem; font-weight: 600; color: var(--forest); cursor: pointer; }
  .place-list:not(.open) .list-body { display: none; }
  .place-list.open .list-body { padding-top: 0; }
  .place-list.open .items { max-height: 55vh; }
}

@media (max-width: 640px) {
  .head h1 { font-size: 2rem; }
  .map-card { padding: 10px; }
  .modes { width: 100%; }
  .places-toggle { width: 100%; justify-content: center; }
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
