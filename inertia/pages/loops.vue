<template>
  <DefaultLayout>
    <Head title="Boucle découverte" />
    <div class="container loops">
      <div v-if="!loops.length" class="head">
        <h1>Boucles découverte</h1>
        <p class="hint">Choisis un départ et une distance : on te propose des boucles qui passent par les lieux à voir.</p>
      </div>

      <div v-if="!formOpen" class="summary card">
        <div class="pill strong">
          <Icon name="pin" :size="18" />
          <PlaceInput v-model="query" class="place" placeholder="Point choisi sur la carte" aria-label="Lieu de départ" @pick="pickAndRun" @enter="propose" />
        </div>
        <div class="pill step">
          <button type="button" aria-label="Un kilomètre de moins" :disabled="km <= 3" @click="stepAndRun(-1)">−</button>
          <span class="num">{{ km }} km</span>
          <button type="button" aria-label="Un kilomètre de plus" :disabled="km >= 40" @click="stepAndRun(1)">+</button>
        </div>
        <label class="pill pick tone" :title="themeInfo.hint">
          <Icon :name="themeInfo.icon" :size="16" />
          <select v-model="theme" aria-label="Style de boucle" @change="propose">
            <option v-for="t in THEMES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <Icon name="chevron" :size="14" class="caret" />
        </label>
        <label class="pill pick" :title="terrainInfo.hint">
          <select v-model="terrain" aria-label="Type de chemins" @change="propose">
            <option v-for="t in TERRAINS" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <Icon name="chevron" :size="14" class="caret" />
        </label>
        <label class="pill pick">
          <select v-model="count" aria-label="Nombre de boucles" @change="propose">
            <option v-for="n in 5" :key="n" :value="n">{{ n }} boucle{{ n > 1 ? 's' : '' }}</option>
          </select>
          <Icon name="chevron" :size="14" class="caret" />
        </label>
        <button class="btn ghost" type="button" @click="formOpen = true">
          <Icon name="sliders" :size="18" />Types de lieux<span v-if="groups.length" class="badge">{{ groups.length }}</span>
        </button>
      </div>

      <form v-else class="controls card" @submit.prevent="propose">
        <div class="row">
          <div class="field start">
            <span>Départ</span>
            <div class="box">
              <Icon name="pin" class="box-icon" />
              <PlaceInput v-model="query" class="place" placeholder="Ville, adresse ou code postal (ex. Annecy)" aria-label="Lieu de départ" @pick="onPick" @enter="onSearch" />
              <button class="square" type="button" title="Partir de ma position" aria-label="Partir de ma position" @click="onLocate()"><Icon name="locate" /></button>
            </div>
          </div>
          <div class="field distance">
            <span>Distance</span>
            <div class="box stepper">
              <button class="square" type="button" aria-label="Un kilomètre de moins" :disabled="km <= 3" @click="stepKm(-1)">−</button>
              <label class="km">
                <input v-model.number="km" type="number" min="3" max="40" step="1" inputmode="numeric" aria-label="Distance en kilomètres">
                <span>km</span>
              </label>
              <button class="square" type="button" aria-label="Un kilomètre de plus" :disabled="km >= 40" @click="stepKm(1)">+</button>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="field">
            <span>Style de boucle</span>
            <div class="chips" role="radiogroup" aria-label="Style de boucle">
              <button
                v-for="t in THEMES"
                :key="t.value"
                type="button"
                role="radio"
                :title="t.hint"
                :aria-checked="theme === t.value"
                :class="{ on: theme === t.value }"
                @click="theme = t.value"
              >
                <Icon :name="t.icon" :size="18" />{{ t.label }}
              </button>
            </div>
          </div>
          <div class="field">
            <span>Chemins</span>
            <div class="count" role="radiogroup" aria-label="Type de chemins">
              <button
                v-for="t in TERRAINS"
                :key="t.value"
                type="button"
                role="radio"
                class="wide"
                :title="t.hint"
                :aria-checked="terrain === t.value"
                :class="{ on: terrain === t.value }"
                @click="terrain = t.value"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
          <div class="field">
            <span>Nombre de boucles</span>
            <div class="count" role="radiogroup" aria-label="Nombre de boucles">
              <button
                v-for="n in 5"
                :key="n"
                type="button"
                role="radio"
                :aria-checked="count === n"
                :class="{ on: count === n }"
                @click="count = n"
              >
                {{ n }}
              </button>
            </div>
          </div>
        </div>
        <button type="button" class="more" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
          {{ groups.length ? `${groups.length} type${groups.length > 1 ? 's' : ''} de lieux choisi${groups.length > 1 ? 's' : ''}` : 'Choisir les types de lieux' }}
          <Icon name="chevron" :size="16" :class="{ flip: moreOpen }" />
        </button>
        <div v-if="moreOpen" class="groups">
          <p class="groups-hint">Coche ce que tu veux voir en chemin (rien de coché : tous les lieux du style choisi).</p>
          <div class="families">
            <section v-for="cat in visibleCategories" :key="cat" class="family" :class="cat">
              <h3 class="family-title">
                <Icon :name="cat === 'patrimoine' ? 'castle' : 'leaf'" :size="18" />
                {{ cat === 'patrimoine' ? 'Patrimoine' : 'Nature' }}
                <span v-if="pickedIn(cat)" class="family-count">{{ pickedIn(cat) }}</span>
              </h3>
              <div class="family-chips">
                <button
                  v-for="g in KIND_GROUPS.filter(g => g.category === cat)"
                  :key="g.id"
                  type="button"
                  class="chip"
                  :class="{ on: groups.includes(g.id) }"
                  :aria-pressed="groups.includes(g.id)"
                  @click="toggleGroup(g.id)"
                >
                  <Icon :name="g.icon" :size="16" />{{ g.label }}
                </button>
              </div>
            </section>
          </div>
          <button v-if="groups.length" type="button" class="clear" @click="groups = []">Tout décocher</button>
        </div>
        <div class="submit-row">
          <button v-if="loops.length" class="btn ghost" type="button" @click="formOpen = false">Annuler</button>
          <button class="btn go" type="submit" :disabled="(!start && !query.trim()) || busy">
            {{ busy ? 'Recherche…' : loops.length ? 'Relancer' : 'Proposer des boucles' }} <Icon name="arrow" />
          </button>
        </div>
      </form>

      <p v-if="message" class="notice" :class="{ bad: messageBad }">{{ message }}</p>

      <div class="layout" :class="{ split: loops.length }">
        <aside v-if="loops.length" class="side">
          <template v-for="(loop, i) in loops" :key="i">
            <article v-if="i === selected" class="loop card active">
              <header class="loop-head">
                <h2>Boucle {{ i + 1 }}</h2>
                <span class="soft">{{ loop.stops.length ? `${loop.stops.length} lieu${loop.stops.length > 1 ? 'x' : ''}` : 'sans lieu remarquable' }}</span>
              </header>
              <div class="stats">
                <div><strong class="num">{{ formatKm(loop.distance) }} km</strong><span>distance</span></div>
                <div><strong class="num">+{{ Math.round(gains[i] ?? 0) }} m</strong><span>dénivelé</span></div>
                <label v-if="durations[i]" class="duration" title="Durée estimée selon ton allure sur le plat et le dénivelé : clique pour changer d'allure">
                  <strong class="num">≈ {{ formatDuration(durations[i]!) }}</strong>
                  <span>à {{ paceLabel }}/km <Icon name="chevron" :size="12" /></span>
                  <select v-model="paceChoice" aria-label="Ton allure sur le plat (min/km)">
                    <option v-for="p in PACES" :key="p" :value="p">{{ formatPace(p) }} min/km</option>
                  </select>
                </label>
              </div>
              <p v-if="surfaceText(loop)" class="soft">{{ surfaceText(loop) }}</p>
              <button v-if="currentAmenities.length" type="button" class="amenities-line" :aria-pressed="showAmenities" @click="showAmenities = !showAmenities">
                <span v-if="amenityCount.water"><Icon name="droplet" :size="16" />{{ amenityCount.water }} point{{ amenityCount.water > 1 ? 's' : '' }} d'eau</span>
                <span v-if="amenityCount.toilets"><Icon name="toilets" :size="16" />{{ amenityCount.toilets }} toilettes</span>
                <span class="toggle">{{ showAmenities ? 'Masquer' : 'Voir sur la carte' }}</span>
              </button>
              <template v-if="loop.stops.length">
                <ol class="stops">
                  <li v-for="(s, k) in visibleStops" :key="s.id">
                    <button
                      type="button"
                      class="stop"
                      :class="[s.category, { on: selectedStop?.id === s.id, hl: hoverStop === s.id }]"
                      :aria-expanded="selectedStop?.id === s.id"
                      @click="toggleStop(s)"
                      @mouseenter="hoverStop = s.id"
                      @mouseleave="hoverStop = null"
                    >
                      <span class="n">{{ k + 1 }}</span>
                      <Icon :name="kindOf(s).icon" class="kind-icon" />
                      <span class="name">{{ s.name }}</span>
                      <span class="kind">{{ kindOf(s).label }}</span>
                    </button>
                  </li>
                </ol>
                <button v-if="loop.stops.length > STOPS_SHOWN" type="button" class="more" @click="allStops = !allStops">
                  {{ allStops ? 'Voir moins de lieux' : `Voir les ${loop.stops.length - STOPS_SHOWN} autres lieux` }}
                  <Icon name="chevron" :size="16" :class="{ flip: allStops }" />
                </button>
                <div class="detail-anchor">
                  <PoiDetail v-if="selectedStop" :poi="selectedStop" @close="selectedStop = null" />
                </div>
              </template>
            </article>
            <button v-else type="button" class="loop card" @click="selected = i">
              <span class="loop-head">
                <span class="title">Boucle {{ i + 1 }}</span>
                <strong class="num">{{ formatKm(loop.distance) }} km · +{{ Math.round(gains[i] ?? 0) }} m<template v-if="durations[i]"> · ≈ {{ formatDuration(durations[i]!) }}</template></strong>
              </span>
              <span class="preview">
                <template v-if="loop.stops.length">{{ loop.stops.length }} lieu{{ loop.stops.length > 1 ? 'x' : '' }} · {{ loop.stops.slice(0, 3).map(s => s.name).join(', ') }}{{ loop.stops.length > 3 ? '…' : '' }}</template>
                <template v-else>Pas de lieu remarquable sur ce tour</template>
              </span>
              <span v-if="surfaceText(loop)" class="soft">{{ surfaceText(loop) }}</span>
            </button>
          </template>
          <button type="button" class="btn ghost more-loops" :disabled="busy" title="Nouvelles boucles avec les mêmes réglages, différentes de celles déjà vues" @click="proposeMore">
            <Icon name="refresh" :size="18" />D'autres boucles
          </button>
        </aside>

        <div class="main">
          <section class="map-card">
            <div class="map-wrap">
              <LoopMap
                ref="mapRef"
                :start="start"
                :loops="loops"
                :selected="selected"
                :track="track"
                :hover="hoverD"
                :highlight="hoverStop"
                :amenities="showAmenities ? currentAmenities : []"
                @pick="setStart"
                @select="selected = $event"
                @stop="openStop"
                @hover-stop="hoverStop = $event"
              />
              <div v-if="!start" class="overlay">Clique sur la carte pour choisir ton départ</div>
              <button
                v-if="currentAmenities.length"
                type="button"
                class="amenity-toggle"
                :class="{ on: showAmenities }"
                :aria-pressed="showAmenities"
                title="Points d'eau potable et toilettes le long de la boucle"
                @click="showAmenities = !showAmenities"
              >
                <Icon name="droplet" :size="16" />Eau &amp; WC
              </button>
              <div v-if="busy" class="loading"><RunnerLoader /></div>
            </div>
          </section>

          <nav v-if="loops.length > 1" class="loop-tabs" aria-label="Choisir une boucle">
            <button
              v-for="(loop, i) in loops"
              :key="i"
              type="button"
              :class="{ on: i === selected }"
              :aria-pressed="i === selected"
              @click="selected = i"
            >
              <strong>Boucle {{ i + 1 }}</strong>
              <span class="num">{{ formatKm(loop.distance) }} km</span>
            </button>
          </nav>

          <template v-if="loops.length">
            <section v-if="profile" class="card profile">
              <ElevationProfile v-model:hover="hoverD" :profile="profile" :segments="segments" :markers="stopMarkers" :height="150" />
            </section>
            <div class="finish-actions">
              <button class="btn" type="button" @click="download"><Icon name="download" :size="18" />Télécharger le GPX</button>
              <button class="btn ghost" type="button" @click="copyLink"><Icon name="link" :size="18" />{{ copied ? 'Lien copié ✓' : 'Copier le lien' }}</button>
              <button class="btn ghost" type="button" @click="adjust"><Icon name="pencil" :size="18" />Ajuster dans le traceur</button>
              <button class="btn ghost" type="button" @click="useForPlan">Préparer ma course avec cette boucle <Icon name="arrow" :size="18" /></button>
            </div>
            <p class="disclaimer">
              Boucles calculées automatiquement à partir d'OpenStreetMap : vérifie l'état des chemins, les accès et la météo sur place.
              <Link href="/mentions-legales">En savoir plus</Link>
            </p>
          </template>

          <section v-if="shared.length" class="card shared">
            <h2><Icon name="thumb" />Parcours partagés près d'ici</h2>
            <ul>
              <li v-for="p in shared" :key="p.id">
                <Link :href="`/partages/${p.id}`" class="shared-item">
                  <strong>{{ p.name }}</strong>
                  <span class="num">{{ formatKm(p.distance) }} km · +{{ p.gain }} m · {{ p.away < 1000 ? 'départ tout près' : `départ à ${formatKm(p.away)} km` }}</span>
                  <span class="votes num"><Icon name="thumb" :size="16" />{{ p.votes }}</span>
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import LoopMap from '~/components/loop_map.vue'
import ElevationProfile from '~/components/elevation_profile.vue'
import PoiDetail from '~/components/poi_detail.vue'
import RunnerLoader from '~/components/runner_loader.vue'
import { usePlan } from '~/composables/use_plan'
import { useTracer } from '~/composables/use_tracer'
import { readLoops, storeLoops } from '~/utils/loop_cache'
import { amenitiesAlong, generateLoops, loopFromWaypoints, loopTrack, searchRadius, type Amenity, type Loop, type Poi } from '~/utils/loops'
import type { LatLon, Terrain } from '~/utils/routing'
import { searchPlace, type PlaceSuggestion } from '~/utils/geocode'
import PlaceInput from '~/components/place_input.vue'
import { buildProfile } from '~/utils/profile'
import { autoBoundaries, computeSegments } from '~/utils/segments'
import { formatDuration, formatKm, formatPace, parsePace } from '~/utils/format'
import { cumulativeEffort, predictTime } from '~/utils/model'
import { haversine, toGpx } from '~/utils/gpx'
import { KIND_GROUPS, kindOf } from '~/utils/places'
import Icon from '~/components/icon.vue'
import type { IconName } from '~/utils/icons'

const plan = usePlan()
const tracer = useTracer()
const mapRef = ref<InstanceType<typeof LoopMap>>()

const start = ref<LatLon | null>(null)
/** Nom court du lieu de départ, pour nommer la boucle */
const placeName = ref('')
const km = ref(10)
/** Nombre de boucles demandées (3 par défaut, de 1 à 5) */
const count = ref(3)

function stepKm(delta: number) {
  km.value = Math.min(40, Math.max(3, Math.round(km.value || 10) + delta))
}

/** Formulaire déplié ; il se replie en bandeau une fois les boucles calculées */
const formOpen = ref(true)

/** Bandeau : la distance se règle par petits pas, on attend que l'on s'arrête de cliquer pour relancer */
let stepTimer: ReturnType<typeof setTimeout> | undefined
function stepAndRun(delta: number) {
  stepKm(delta)
  clearTimeout(stepTimer)
  stepTimer = setTimeout(propose, 600)
}

type Theme = 'tout' | 'patrimoine' | 'nature'
const THEMES: { value: Theme, label: string, icon: IconName, hint: string }[] = [
  { value: 'tout', label: 'Équilibrée', icon: 'route', hint: 'Monuments et nature : le plus beau du coin' },
  { value: 'nature', label: 'Nature', icon: 'leaf', hint: 'Cascades, sommets, points de vue, parcs…' },
  { value: 'patrimoine', label: 'Patrimoine', icon: 'landmark', hint: 'Châteaux, églises, musées, vieilles rues…' },
]
/** Lieux à voir sur les boucles : tous, ou seulement le patrimoine / la nature */
const theme = ref<Theme>('tout')
const themeInfo = computed(() => THEMES.find(t => t.value === theme.value)!)

// --- « Plus de choix » : familles de lieux précises (cascades, grottes, châteaux…) ---
const moreOpen = ref(false)
const groups = ref<string[]>([])
const visibleCategories = computed(() => (theme.value === 'tout' ? ['patrimoine', 'nature'] as const : [theme.value]))
/** Nombre de familles cochées dans Patrimoine ou Nature */
function pickedIn(cat: string): number {
  return KIND_GROUPS.filter(g => g.category === cat && groups.value.includes(g.id)).length
}
// Passer en « Nature » décoche les familles du patrimoine, et inversement
watch(theme, (t) => {
  if (t !== 'tout') groups.value = groups.value.filter(id => KIND_GROUPS.find(g => g.id === id)?.category === t)
})

function toggleGroup(id: string) {
  groups.value = groups.value.includes(id) ? groups.value.filter(g => g !== id) : [...groups.value, id]
}

/** Types de lieux demandés au serveur (vide : tout le thème) */
const kinds = computed(() => KIND_GROUPS.filter(g => groups.value.includes(g.id)).flatMap(g => g.kinds))

const TERRAINS: { value: Terrain, label: string, hint: string }[] = [
  { value: 'route', label: 'Route', hint: 'Plutôt du bitume, pour une allure régulière' },
  { value: 'mixte', label: 'Mixte', hint: 'Chemins et petites rues, sans les grandes routes' },
  { value: 'sentiers', label: 'Sentiers', hint: 'Le plus de sentiers possible, quitte à faire un détour' },
]
/** Type de chemins voulu ; toutes les options évitent les routes à circulation */
const terrain = ref<Terrain>('mixte')
const terrainInfo = computed(() => TERRAINS.find(t => t.value === terrain.value)!)

/** « 65 % sentiers · 3 % grandes routes » (grandes routes masquées sous 1 %) */
function surfaceText(loop: Loop): string {
  const { total, trail, bigRoad } = loop.surface
  if (!total) return ''
  const pct = (x: number) => Math.round((100 * x) / total)
  return [`${pct(trail)} % sentiers`, pct(bigRoad) >= 1 ? `${pct(bigRoad)} % grandes routes` : ''].filter(Boolean).join(' · ')
}

const loops = ref<Loop[]>([])
const selected = ref(0)
const hoverD = ref<number | null>(null)
const busy = ref(false)
const message = ref('')
const messageBad = ref(false)

const current = computed(() => loops.value[selected.value] ?? null)

// --- Points d'eau et toilettes (France), affichés sur demande ---
const amenities = ref<Amenity[]>([])
const showAmenities = ref(false)
const loopAmenities = computed(() => loops.value.map(l => amenitiesAlong(l, amenities.value)))
const currentAmenities = computed(() => loopAmenities.value[selected.value] ?? [])
const amenityCount = computed(() => ({
  water: currentAmenities.value.filter(a => a.kind === 'water').length,
  toilets: currentAmenities.value.filter(a => a.kind === 'toilets').length,
}))

// --- Fiche d'un lieu ---
const selectedStop = ref<Poi | null>(null)
/** Lieu survolé, dans la liste ou sur la carte : les deux le font ressortir */
const hoverStop = ref<number | null>(null)
/** Au-delà, les lieux de la boucle se déplient sur demande */
const STOPS_SHOWN = 6
const allStops = ref(false)
const visibleStops = computed(() => {
  const stops = current.value?.stops ?? []
  return allStops.value ? stops : stops.slice(0, STOPS_SHOWN)
})
// Une autre boucle n'a pas les mêmes lieux : on referme la fiche et la liste
watch([loops, selected], () => {
  selectedStop.value = null
  allStops.value = false
})

function toggleStop(poi: Poi) {
  selectedStop.value = selectedStop.value?.id === poi.id ? null : poi
}

/** Clic sur un lieu de la carte : ouvre sa fiche sous la liste */
async function openStop(poi: Poi) {
  selectedStop.value = poi
  // Lieu caché dans la liste repliée : on la déplie pour qu'il soit visible au-dessus de sa fiche
  if (!visibleStops.value.some(s => s.id === poi.id)) allStops.value = true
  await nextTick()
  document.querySelector('.detail-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
const loopName = computed(() => `Boucle découverte${placeName.value ? ` – ${placeName.value}` : ''} (${Math.round(km.value)} km)`)
const tracks = computed(() => loops.value.map(l => loopTrack(l, loopName.value)))
const profiles = computed(() => tracks.value.map(t => buildProfile(t)))
const gains = computed(() => profiles.value.map(p => p.gain))

// --- Durée estimée : même modèle que le plan de course (effort selon la pente, puis allure du coureur) ---
/** Allures proposées (s/km), de 3:30 à 9:00 */
const PACES = Array.from({ length: 23 }, (_, k) => 210 + 15 * k)
/** Allure sur le plat du coureur : celle de son plan de course, 5:30 par défaut */
const paceChoice = computed({
  get: () => {
    const p = plan.flatPace10k.value ?? 330
    // Valeur la plus proche de la liste, pour que le menu l'affiche
    return PACES.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a))
  },
  // Choisir une allure ici règle aussi le plan de course (même coureur)
  set: (sec: number) => {
    plan.settings.mode = 'allure'
    plan.settings.pace = formatPace(sec)
  },
})
const paceLabel = computed(() => formatPace(plan.flatPace10k.value ?? 330))
const durations = computed(() => {
  const ref = plan.reference.value ?? { distance: 10_000, time: (parsePace(plan.settings.pace) ?? 330) * 10 }
  return profiles.value.map((p) => {
    const effort = cumulativeEffort(p, plan.settings.descente, plan.settings.technicite)
    return effort.length > 1 ? predictTime(effort[effort.length - 1]!, ref, plan.settings.endurance) : null
  })
})
const track = computed(() => tracks.value[selected.value] ?? null)
const profile = computed(() => profiles.value[selected.value] ?? null)
const segments = computed(() => (profile.value ? computeSegments(profile.value, autoBoundaries(profile.value)) : []))

/**
 * Lieux sur le graphique km / D+ : numéro et icône au kilomètre où l'on y passe.
 * On suit le tracé dans l'ordre : pour chaque lieu, le premier passage à moins de 150 m après le
 * précédent (une boucle repasse près du départ à la fin : il ne faut pas confondre les deux).
 */
const stopMarkers = computed(() => {
  const points = track.value?.points ?? []
  const stops = current.value?.stops ?? []
  let from = 0
  return stops.flatMap((stop, k) => {
    let best = -1
    let bestDist = Infinity
    for (let i = from; i < points.length; i++) {
      const dist = haversine(points[i]!, stop)
      if (dist < bestDist) {
        best = i
        bestDist = dist
      }
      // Assez près et l'on s'en éloigne : c'est ce passage-là
      else if (bestDist < 150 && dist > bestDist + 50) break
    }
    if (best < 0) return []
    from = best
    return [{ d: points[best]!.d, label: String(k + 1), name: stop.name, icon: kindOf(stop).icon }]
  })
})

// --- Parcours partagés par les autres coureurs autour du départ ---
type SharedItem = { id: number, name: string, distance: number, gain: number, votes: number, away: number }
const shared = ref<SharedItem[]>([])
watch(start, async (p) => {
  shared.value = []
  if (!p) return
  try {
    const res = await fetch(`/partages?lat=${p.lat.toFixed(5)}&lon=${p.lon.toFixed(5)}`, { headers: { Accept: 'application/json' } })
    // Le départ a pu changer pendant la requête
    if (res.ok && start.value === p) shared.value = (await res.json() as { parcours: SharedItem[] }).parcours
  }
  catch {
    // Facultatif : sans réponse, la page fonctionne sans
  }
})

function setStart(p: LatLon, name = '') {
  // Départ choisi (recherche, carte ou position) : le texte du champ est « consommé »
  usedQuery.value = query.value.trim()
  start.value = p
  placeName.value = name
  loops.value = []
  message.value = ''
}

// --- Choix du départ ---
const query = ref('')
/** Texte du champ au moment où le départ actuel a été choisi : s'il a changé depuis, on relance la recherche */
const usedQuery = ref('')
const searching = ref(false)

/** Cherche le lieu tapé et en fait le départ ; renvoie false si rien n'a été trouvé */
async function onSearch(): Promise<boolean> {
  if (!query.value.trim() || searching.value) return false
  searching.value = true
  message.value = ''
  try {
    const place = await searchPlace(query.value.trim())
    if (!place) {
      showError(`Aucun lieu trouvé pour « ${query.value.trim()} ».`)
      return false
    }
    setStart({ lat: place.lat, lon: place.lon }, place.name)
    mapRef.value?.flyTo(place.lat, place.lon)
    return true
  }
  catch {
    showError('La recherche est indisponible pour le moment.')
    return false
  }
  finally {
    searching.value = false
  }
}

/** Suggestion choisie dans la liste : c'est le départ, sans autre recherche */
function onPick(place: PlaceSuggestion) {
  query.value = place.label
  setStart({ lat: place.lat, lon: place.lon }, place.name)
  mapRef.value?.flyTo(place.lat, place.lon)
}

/** Depuis le bandeau : nouveau départ, nouvelles boucles aussitôt */
function pickAndRun(place: PlaceSuggestion) {
  onPick(place)
  propose()
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
    const filter = kinds.value.length
      ? `&types=${kinds.value.join(',')}`
      : theme.value === 'tout' ? '' : `&categorie=${theme.value}`
    const res = await fetch(`/lieux?lat=${p.lat.toFixed(5)}&lon=${p.lon.toFixed(5)}&rayon=${searchRadius(target)}${filter}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error()
    return (await res.json() as { lieux: Poi[] }).lieux
  }
  finally {
    clearTimeout(slow)
  }
}

/** Réglage changé pendant un calcul : on relance une fois celui-ci terminé */
let again = false

// --- « D'autres boucles » : nouveaux tirages, sans reproposer ce qui a déjà été vu ---
/** Boucles déjà montrées depuis le dernier changement de départ ou de réglage */
let shownLoops: Loop[] = []
let variant = 0
let wantMore = false

function proposeMore() {
  wantMore = true
  propose()
}

/** Facultatif : sans réponse, les boucles s'affichent sans points d'eau ni toilettes */
async function fetchAmenities(p: LatLon, target: number): Promise<Amenity[]> {
  try {
    const res = await fetch(`/equipements?lat=${p.lat.toFixed(5)}&lon=${p.lon.toFixed(5)}&rayon=${searchRadius(target)}`, { headers: { Accept: 'application/json' } })
    return res.ok ? (await res.json() as { equipements: Amenity[] }).equipements : []
  }
  catch {
    return []
  }
}

function showLoops(found: Loop[], near: Amenity[], text = '', bad = false) {
  amenities.value = near
  loops.value = found
  selected.value = 0
  message.value = text
  messageBad.value = bad
  if (found.length) formOpen.value = false
  // Les nouvelles boucles n'arrivent à la carte qu'au rendu suivant
  nextTick(() => mapRef.value?.fitLoops())
}

async function propose() {
  if (busy.value) {
    again = true
    return
  }
  // Ville changée dans le champ sans cliquer sur « Rechercher » : on cherche d'abord la nouvelle ville
  if (query.value.trim() && query.value.trim() !== usedQuery.value && !(await onSearch())) return
  if (!start.value) return
  const target = Math.min(40, Math.max(3, Math.round(km.value || 10))) * 1000
  km.value = target / 1000
  const more = wantMore && loops.value.length > 0
  wantMore = false
  // Même recherche que tout à l'heure : on réaffiche les boucles déjà calculées
  const cacheKey = JSON.stringify([start.value.lat.toFixed(5), start.value.lon.toFixed(5), target, theme.value, [...kinds.value].sort(), terrain.value, count.value])
  const cached = more ? null : readLoops(cacheKey)
  if (cached) {
    shownLoops = [...cached.loops]
    variant = 0
    return showLoops(cached.loops, cached.amenities, cached.message, cached.messageBad)
  }
  busy.value = true
  message.value = ''
  let pois: Poi[] = []
  let poisFailed = false
  const amenityRequest = fetchAmenities(start.value, target)
  try {
    pois = await fetchPois(start.value, target)
  }
  catch {
    poisFailed = true
  }
  try {
    if (more) {
      variant++
      const found = await generateLoops(start.value, target, pois, count.value, { terrain: terrain.value }, { variant, shown: shownLoops })
      if (!found.length) {
        showInfo('Pas d\'autre boucle vraiment différente autour de ce départ : essaie une autre distance, un autre style ou un départ un peu plus loin.')
        return
      }
      shownLoops.push(...found)
      showLoops(found, await amenityRequest)
      if (found.length < count.value) showInfo(`${found.length === 1 ? 'Une seule nouvelle boucle' : `Seulement ${found.length} nouvelles boucles`} : les autres ressemblaient trop à celles déjà vues.`)
      return
    }
    const found = await generateLoops(start.value, target, pois, count.value, { terrain: terrain.value })
    shownLoops = [...found]
    variant = 0
    showLoops(found, await amenityRequest)
    if (poisFailed) showError('Les lieux à voir sont indisponibles pour le moment : voici des boucles sans étapes.')
    else if (!loops.value.some(l => l.stops.length)) {
      const what = kinds.value.length ? 'de lieux de ce type' : theme.value === 'nature' ? 'de lieux naturels' : theme.value === 'patrimoine' ? 'de patrimoine' : 'de lieux remarquables'
      showInfo(`Peu ${what} connus ici : ces boucles explorent simplement les alentours.`)
    }
    else if (loops.value.length < count.value) showInfo(`Seulement ${loops.value.length} boucle${loops.value.length > 1 ? 's' : ''} trouvée${loops.value.length > 1 ? 's' : ''} autour de ce départ (relief, rivière ou manque de chemins).`)
    else message.value = ''
    // Lieux indisponibles : ces boucles de secours ne sont pas gardées
    if (!poisFailed && loops.value.length && !more) storeLoops(cacheKey, { loops: loops.value, amenities: amenities.value, message: message.value, messageBad: messageBad.value })
  }
  catch {
    loops.value = []
    showError('Le calcul des itinéraires a échoué. Réessaie dans un instant, ou déplace le point de départ.')
  }
  finally {
    busy.value = false
    if (again) {
      again = false
      propose()
    }
  }
}

// --- Lien de partage : départ, réglages et points de passage de la boucle choisie ---
const copied = ref(false)

function shareUrl(): string {
  const loop = current.value!
  const p = new URLSearchParams({
    lat: start.value!.lat.toFixed(5),
    lon: start.value!.lon.toFixed(5),
    km: String(km.value),
    n: String(count.value),
    chemins: terrain.value,
  })
  const name = placeName.value || query.value.trim()
  if (name) p.set('nom', name)
  if (theme.value !== 'tout') p.set('style', theme.value)
  if (groups.value.length) p.set('types', groups.value.join(','))
  // Points de passage : la même boucle est recalculée à l'identique à l'ouverture du lien
  p.set('via', (loop.via ?? loop.waypoints).map(w => `${w.lat.toFixed(5)},${w.lon.toFixed(5)}`).join('_'))
  if (loop.stops.length) p.set('lieux', loop.stops.map(s => s.id).join(','))
  return `${window.location.origin}/boucles?${p}`
}

async function copyLink() {
  const url = shareUrl()
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  }
  catch {
    // Presse-papiers refusé (ancien navigateur, page non sécurisée) : on montre le lien à copier
    window.prompt('Copie ce lien :', url)
  }
}

/** Ouverture d'un lien partagé : on recalcule la boucle par ses points de passage */
async function openSharedLoop(via: string, stopIds: number[]) {
  const waypoints = via.split('_').map((pair) => {
    const [la, lo] = pair.split(',').map(Number)
    return { lat: la!, lon: lo! }
  }).filter(w => Math.abs(w.lat) <= 90 && Math.abs(w.lon) <= 180)
  if (waypoints.length < 3 || waypoints.length > 40 || !start.value) return propose()
  busy.value = true
  let failed = false
  try {
    const target = km.value * 1000
    const amenityRequest = fetchAmenities(start.value, target)
    const pois = await fetchPois(start.value, target).catch(() => [] as Poi[])
    const byId = new Map(pois.map(p => [p.id, p]))
    const stops = stopIds.map(id => byId.get(id)).filter((p): p is Poi => !!p)
    const loop = await loopFromWaypoints(waypoints, stops, { terrain: terrain.value })
    shownLoops = [loop]
    variant = 0
    showLoops([loop], await amenityRequest, 'Boucle partagée par lien : change un réglage ou demande d\'autres boucles pour en voir d\'autres.')
  }
  catch {
    failed = true
  }
  finally {
    busy.value = false
  }
  if (failed) {
    await propose()
    showError('La boucle partagée n\'a pas pu être recalculée : voici d\'autres boucles autour du même départ.')
  }
}

// --- Arrivée depuis l'accueil (?depart=Dole, ?position=1 ou ?lat=…&lon=…, avec &km=10, &n=3, &style=nature) : on enchaîne tout seul ---
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const lat = Number(params.get('lat'))
  const lon = Number(params.get('lon'))
  const fromPoint = params.has('lat') && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  if (!params.has('depart') && !params.has('position') && !fromPoint) return
  const wanted = Number(params.get('km'))
  if (wanted) km.value = Math.min(40, Math.max(3, Math.round(wanted)))
  const wantedCount = Number(params.get('n'))
  if (wantedCount) count.value = Math.min(5, Math.max(1, Math.round(wantedCount)))
  const style = params.get('style')
  if (style === 'nature' || style === 'patrimoine') theme.value = style
  const paths = params.get('chemins')
  if (paths === 'route' || paths === 'mixte' || paths === 'sentiers') terrain.value = paths
  const types = (params.get('types') ?? '').split(',').filter(id => KIND_GROUPS.some(g => g.id === id))
  if (types.length) groups.value = types
  const via = params.get('via')
  const stopIds = (params.get('lieux') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)
  // L'adresse redevient /boucles : recharger la page ne relance pas le calcul
  history.replaceState(history.state, '', '/boucles')
  if (params.has('position')) return onLocate(propose)
  if (fromPoint) {
    // Adresse choisie dans les suggestions de l'accueil : on la remet dans le champ
    query.value = params.get('nom') ?? ''
    // La carte se centre d'elle-même sur ce départ à sa création
    setStart({ lat, lon }, query.value)
    mapRef.value?.flyTo(lat, lon)
    return via ? openSharedLoop(via, stopIds) : propose()
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
.loops { display: flex; flex-direction: column; gap: 18px; }
.head h1 { font-size: 2.6rem; font-weight: 700; }
.head .hint { color: var(--text-soft); }

/* --- Formulaire (mêmes champs que l'accueil) --- */
.controls { display: flex; flex-direction: column; gap: 16px; padding: 20px; border-radius: 20px; }
.row { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-end; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field > span { font-size: 0.82rem; font-weight: 600; color: var(--text-soft); }
.field.start { flex: 999 1 340px; min-width: 0; }
.field.distance { flex: 1 1 200px; }
.box { display: flex; align-items: center; gap: 8px; height: 50px; padding: 0 6px 0 14px; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--panel-2); }
.box:focus-within { border-color: var(--forest); }
.box-icon { color: var(--forest); }
.box .place { flex: 1; }
.box .place :deep(input) { border: none; background: transparent; font-size: 1rem; padding: 12px 0; outline: none; width: 100%; }
.square { flex: none; width: 38px; height: 38px; display: grid; place-items: center; border: none; border-radius: 10px; background: var(--forest-soft); color: var(--forest); font: inherit; font-size: 1.35rem; line-height: 1; cursor: pointer; }
.square:hover { background: #d3e2d8; }
.square:disabled { opacity: 0.4; cursor: not-allowed; }
.stepper { justify-content: space-between; padding: 0 6px; }
.km { display: flex; align-items: baseline; gap: 4px; font-weight: 500; color: var(--text-soft); }
.km input { width: 3ch; border: none; background: transparent; padding: 0; text-align: right; font-size: 1.25rem; font-weight: 600; color: var(--text); outline: none; -moz-appearance: textfield; appearance: textfield; }
.km input::-webkit-inner-spin-button, .km input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips button { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 15px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--panel); font: inherit; font-size: 0.93rem; color: var(--text); cursor: pointer; }
.chips button:hover { border-color: var(--forest); }
.chips button.on { background: var(--forest); border-color: var(--forest); color: #fff; font-weight: 600; }
.count { display: flex; padding: 3px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--panel-2); }
.count button { min-width: 40px; height: 36px; padding: 0 4px; border: none; border-radius: 999px; background: transparent; font: inherit; font-size: 0.93rem; color: var(--text); cursor: pointer; }
.count button.wide { padding: 0 14px; }
.count button.on { background: var(--forest); color: #fff; font-weight: 600; }
.more { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; font: inherit; font-size: 0.9rem; font-weight: 600; color: var(--forest); background: none; border: none; cursor: pointer; padding: 2px; }
.more:hover { text-decoration: underline; }
.flip { transform: rotate(180deg); }
.groups { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; background: var(--panel-2); border-radius: 12px; }
.groups-hint { font-size: 0.82rem; color: var(--text-soft); }
/* Patrimoine et Nature : un bloc chacun, aux couleurs des lieux sur la carte (orange / vert) */
.families { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
.family { --fam: #c9561f; --fam-soft: #fbebe1; background: var(--panel); border: 1px solid var(--border); border-top: 3px solid var(--fam); border-radius: 12px; padding: 10px 12px 12px; }
.family.nature { --fam: #2f7d4f; --fam-soft: #e3f0e7; }
.family-title { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; font-family: "Barlow Condensed", sans-serif; font-size: 1.15rem; font-weight: 700; color: var(--fam); }
.family-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--fam); color: #fff; font-family: "Inter", sans-serif; font-size: 0.72rem; display: inline-flex; align-items: center; justify-content: center; }
.family-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 0.85rem; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--border); background: var(--fam-soft); color: var(--text); cursor: pointer; }
.chip :deep(svg) { color: var(--fam); }
.chip:hover { border-color: var(--fam); }
.chip.on { background: var(--fam); border-color: var(--fam); color: #fff; font-weight: 600; }
.chip.on :deep(svg) { color: #fff; }
.clear { align-self: flex-start; font: inherit; font-size: 0.8rem; color: var(--text-soft); background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0; }
.submit-row { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.go { height: 50px; padding: 0 24px; font-size: 1.02rem; border-radius: 12px; gap: 10px; }
.go:disabled { opacity: 0.5; cursor: not-allowed; }
.submit-row .ghost { height: 50px; padding: 0 20px; border-radius: 12px; }

/* --- Résumé de la recherche, une fois les boucles affichées --- */
.summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px; border-radius: 16px; }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; border-radius: 10px; background: var(--panel-2); border: 1px solid var(--border); font-weight: 600; }
.pill.strong { flex: 1 1 200px; min-width: 0; }
.pill.strong:focus-within { border-color: var(--forest); }
.pill.strong .icon { flex: none; color: var(--forest); }
.pill.strong .place { flex: 1; }
.pill.strong .place :deep(input) { border: none; background: transparent; padding: 0; font: inherit; font-weight: 600; color: var(--text); outline: none; text-overflow: ellipsis; }
.pill.tone { background: var(--forest-soft); border-color: var(--forest-soft); color: var(--forest); }
/* Distance : − 10 km + */
.pill.step { gap: 2px; padding: 0 4px; }
.pill.step button { width: 30px; height: 30px; border: none; border-radius: 8px; background: none; font: inherit; font-size: 1.2rem; line-height: 1; color: var(--forest); cursor: pointer; }
.pill.step button:hover:not(:disabled) { background: var(--forest-soft); }
.pill.step button:disabled { opacity: 0.35; cursor: not-allowed; }
.pill.step .num { min-width: 4.2ch; text-align: center; }
/* Listes déroulantes habillées en pastille : le clic ouvre la liste, le choix relance */
.pill.pick { position: relative; padding: 0 10px 0 14px; cursor: pointer; }
.pill.pick:hover { border-color: var(--border-strong); }
.pill.pick.tone:hover { border-color: var(--forest); }
.pill.pick:focus-within { border-color: var(--forest); }
.pill.pick select { appearance: none; -webkit-appearance: none; border: none; background: transparent; padding: 0 18px 0 0; margin-right: -18px; font: inherit; color: inherit; cursor: pointer; outline: none; }
.pill.pick .caret { pointer-events: none; opacity: 0.6; }
.summary .btn { height: 40px; padding: 0 16px; border-radius: 10px; }
.badge { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: var(--forest); color: #fff; font-size: 0.75rem; }

.notice { font-size: 0.9rem; color: var(--text-soft); }
.notice.bad { color: var(--bad); }

/* --- Boucles à gauche, carte à droite --- */
.layout { display: flex; flex-direction: column; gap: 14px; }
.layout.split { flex-direction: row; flex-wrap: wrap; align-items: flex-start; gap: 20px; }
.side { flex: 1 1 360px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.main { flex: 999 1 520px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
/* Barre « Boucle 1 · 2 · 3 » : seulement sur petit écran, où les fiches passent sous la carte */
.loop-tabs { display: none; }
@media (max-width: 920px) {
  /* Ordre : carte, barre des boucles, boucle choisie, profil, boutons, parcours partagés */
  .layout.split { flex-direction: column; align-items: stretch; gap: 12px; }
  .layout.split .main { display: contents; }
  .layout.split .map-card { order: 1; }
  .layout.split .loop-tabs { order: 2; display: flex; gap: 6px; overflow-x: auto; padding: 4px; border-radius: 14px; background: var(--panel); border: 1px solid var(--border); scrollbar-width: none; }
  .layout.split .side { order: 3; flex: none; }
  .layout.split .profile { order: 4; }
  .layout.split .finish-actions { order: 5; }
  .layout.split .disclaimer { order: 5; }
  .layout.split .shared { order: 6; }
  /* La barre remplace les fiches repliées des autres boucles */
  .layout.split .side button.loop { display: none; }
}
.loop-tabs button { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 7px 12px; border: none; border-radius: 10px; background: none; font: inherit; color: var(--text); cursor: pointer; }
.loop-tabs button strong { font-size: 0.9rem; }
.loop-tabs button span { font-size: 0.78rem; color: var(--text-soft); }
.loop-tabs button.on { background: var(--accent-strong); color: #fff; }
.loop-tabs button.on span { color: rgba(255, 255, 255, 0.85); }

.loop { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border-radius: 18px; font: inherit; text-align: left; color: var(--text); }
button.loop { cursor: pointer; }
button.loop:hover { border-color: var(--border-strong); }
.loop.active { gap: 14px; border: 2px solid var(--accent); }
.loop-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.loop-head h2 { margin: 0; font-size: 1.7rem; font-weight: 700; color: var(--accent-strong); }
.loop-head .title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.45rem; font-weight: 700; }
.soft { font-size: 0.84rem; color: var(--text-soft); }
.preview { font-size: 0.9rem; color: var(--text-soft); }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
/* Durée : la tuile entière ouvre la liste des allures (menu natif invisible posé dessus) */
.duration { position: relative; cursor: pointer; }
.duration:hover { box-shadow: inset 0 0 0 1px var(--border-strong); }
.duration span { display: inline-flex; align-items: center; gap: 2px; }
.duration select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.stats > * { display: flex; flex-direction: column; padding: 8px 9px; border-radius: 10px; background: var(--bg); }
.stats strong { font-size: 1.05rem; }
.stats span { font-size: 0.75rem; color: var(--text-soft); }
.amenities-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 8px 12px; border: 1px dashed var(--border-strong); border-radius: 10px; background: none; font: inherit; font-size: 0.88rem; color: var(--text); text-align: left; cursor: pointer; }
.amenities-line:hover { border-color: #2f7fb5; }
.amenities-line span { display: inline-flex; align-items: center; gap: 5px; }
.amenities-line .icon { color: #2f7fb5; }
.amenities-line .toggle { margin-left: auto; font-weight: 600; color: #2f7fb5; }
.amenity-toggle { position: absolute; top: 10px; left: 56px; z-index: 500; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border: 2px solid rgba(0, 0, 0, 0.2); border-radius: 8px; background: #fff; background-clip: padding-box; font: inherit; font-size: 0.85rem; font-weight: 600; color: #2f7fb5; cursor: pointer; }
.amenity-toggle.on { background: #2f7fb5; color: #fff; }
.stops { list-style: none; display: flex; flex-direction: column; }
.stops li + li { border-top: 1px solid var(--border); }
.stop { width: 100%; display: flex; align-items: center; gap: 11px; padding: 9px 4px; border: none; border-radius: 8px; background: none; font: inherit; text-align: left; color: var(--text); cursor: pointer; }
.stop:hover, .stop.on, .stop.hl { background: var(--panel-2); }
.stop .n { flex: none; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; border: 2px solid var(--accent); color: var(--accent-strong); font-size: 0.75rem; font-weight: 700; }
.stop.nature .n { border-color: #2f7d4f; color: #2f7d4f; }
.kind-icon { color: var(--forest); }
/* Fiche du lieu dans la colonne des boucles : la photo passe au-dessus du texte */
.detail-anchor :deep(.detail) { flex-direction: column; margin-top: 4px; }
.detail-anchor :deep(.photo) { width: 100%; height: 170px; }
.stop .name { flex: 1; min-width: 0; font-weight: 500; }
.stop .kind { flex: none; font-size: 0.76rem; color: var(--text-soft); }
@media (max-width: 480px) {
  .stop .kind { display: none; }
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.map-card { border-radius: 18px; overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow); background: var(--panel); }
.map-wrap { position: relative; height: 58vh; min-height: 380px; }
.layout.split .map-wrap { height: 540px; }
.loading { position: absolute; inset: 0; z-index: 500; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.35); pointer-events: none; }
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
.profile { padding: 12px 14px; border-radius: 18px; }
.more-loops { align-self: stretch; justify-content: center; border-radius: 14px; }
.disclaimer { font-size: 0.8rem; color: var(--text-soft); line-height: 1.45; }
.disclaimer a { color: inherit; }
.finish-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.finish-actions .btn { padding: 11px 18px; border-radius: 12px; font-size: 0.93rem; }

.shared { display: flex; flex-direction: column; gap: 8px; border-radius: 18px; }
.shared h2 { display: flex; align-items: center; gap: 8px; font-size: 1.35rem; margin: 0; }
.shared ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.shared-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  text-decoration: none;
}
.shared-item:hover { border-color: var(--accent); }
.shared-item strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shared-item span { font-size: 0.85rem; color: var(--text-soft); }
.shared-item .votes { grid-row: 1 / 3; grid-column: 2; align-self: center; display: flex; align-items: center; gap: 5px; font-weight: 700; color: var(--forest); font-size: 0.95rem; }

@media (max-width: 640px) {
  .controls { padding: 16px; }
  .go { flex: 1 1 100%; justify-content: center; }
  .map-wrap, .layout.split .map-wrap { height: 50vh; min-height: 300px; }
}
</style>
