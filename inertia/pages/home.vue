<template>
  <DefaultLayout>
    <Head :title="track ? planName : undefined" />
    <section v-if="!track" class="container home screen-only">
      <p v-if="flash" class="flash">{{ flash }}</p>
      <div class="hero">
        <div class="hero-text">
          <p class="kicker">Boucles découverte</p>
          <h1>Joins l'utile à l'agréable&nbsp;:<br><span>cours et découvre les alentours.</span></h1>
          <p class="lead">
            Donne un point de départ et une distance : {{ APP_NAME }} te trace des boucles
            qui passent par les plus beaux lieux du coin.
          </p>
        </div>
        <HeroMap class="hero-art" />
      </div>

      <form class="loop-form card" @submit.prevent="findLoop()">
        <div class="row">
          <div class="field start">
            <span>Départ</span>
            <div class="box">
              <Icon name="pin" class="box-icon" />
              <PlaceInput
                v-model="loopStart"
                class="place"
                :placeholder="loopPoint ? 'Point choisi sur la carte ✓' : 'Ville, adresse ou code postal (ex. Annecy)'"
                :input-class="{ picked: loopPoint }"
                aria-label="Lieu de départ"
                @pick="loopPicked = $event"
                @enter="findLoop()"
              />
              <button class="square" type="button" title="Partir de ma position" aria-label="Partir de ma position" @click="findLoop(true)">
                <Icon name="locate" />
              </button>
            </div>
          </div>
          <div class="field distance">
            <span>Distance</span>
            <div class="box stepper">
              <button class="square" type="button" aria-label="Un kilomètre de moins" :disabled="loopKm <= 3" @click="stepKm(-1)">−</button>
              <label class="km">
                <input v-model.number="loopKm" type="number" min="3" max="40" step="1" inputmode="numeric" aria-label="Distance en kilomètres">
                <span>km</span>
              </label>
              <button class="square" type="button" aria-label="Un kilomètre de plus" :disabled="loopKm >= 40" @click="stepKm(1)">+</button>
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
                :aria-checked="loopTheme === t.value"
                :class="{ on: loopTheme === t.value }"
                @click="loopTheme = t.value"
              >
                <Icon :name="t.icon" :size="18" />{{ t.label }}
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
                :aria-checked="loopCount === n"
                :class="{ on: loopCount === n }"
                @click="loopCount = n"
              >
                {{ n }}
              </button>
            </div>
          </div>
          <button class="btn go" type="submit" :disabled="!loopStart.trim() && !loopPoint">
            Trouver mes boucles <Icon name="arrow" />
          </button>
        </div>
        <button class="alt" type="button" :aria-expanded="showMap" @click="showMap = !showMap">
          <Icon name="map" :size="18" />
          {{ showMap ? 'masquer la carte' : 'ou choisis le départ sur la carte' }}
        </button>
        <div v-if="showMap" class="pick-map">
          <div class="pick-map-inner">
            <LoopMap ref="pickMap" :start="loopPoint" :loops="[]" :selected="0" :track="null" :hover="null" @pick="pickPoint" />
          </div>
          <p class="pick-hint">
            {{ loopPoint ? 'Départ posé : glisse-le pour l\'ajuster, puis « Trouver mes boucles ».' : 'Clique sur la carte pour poser ton départ.' }}
          </p>
        </div>
      </form>

      <div class="paths">
        <GpxDrop class="card path" @file="onFile" @example="loadExample">
          <span class="tile"><Icon name="mountain" :size="26" /></span>
          <h2>Tu prépares une course ?</h2>
          <p class="grow">
            Importe le GPX : temps de passage selon ton niveau, barrières horaires,
            nutrition entre chaque ravito, fiche A4 ou bracelet à imprimer.
          </p>
          <p v-if="error" class="error">{{ error }}</p>
        </GpxDrop>
        <section class="card path">
          <span class="tile"><Icon name="route" :size="26" /></span>
          <h2>Tu as ton tracé en tête ?</h2>
          <p class="grow">Dessine-le sur la carte : il suit les sentiers, avec la distance et le dénivelé en direct.</p>
          <div class="buttons">
            <Link href="/tracer" class="btn">Tracer mon parcours <Icon name="arrow" :size="18" /></Link>
          </div>
          <p class="hint">Export GPX pour ta montre</p>
        </section>
      </div>

      <p class="account-note">
        <strong>Sans compte</strong>, rien ne quitte ton navigateur. <strong>Avec un compte</strong>, tes plans te suivent partout.
      </p>
    </section>

    <div v-else-if="profile" class="container plan screen-only">
      <div class="course-head">
        <div class="title">
          <form v-if="editingName" class="rename" @submit.prevent="saveName">
            <input
              ref="nameInput"
              v-model="nameDraft"
              type="text"
              maxlength="200"
              aria-label="Nom du plan"
              @keydown.esc="editingName = false"
              @blur="saveName"
            >
          </form>
          <h1 v-else>
            {{ planName }}
            <button class="rename-btn" type="button" title="Renommer ce plan" @click="startRename">✎</button>
          </h1>
          <p class="hint">{{ fileName }}</p>
        </div>
        <div class="actions">
          <SaveButton />
          <button class="btn ghost" type="button" @click="changeGpx">Changer de GPX</button>
          <button v-if="!settings.objectiveOn" class="btn ghost target-btn" type="button" @click="enableObjective">◎ Définir un temps ciblé</button>
          <button class="btn" type="button" :disabled="totalRun == null" @click="print('fiche')">Imprimer la fiche</button>
          <button class="btn" type="button" :disabled="totalRun == null" @click="print('bracelet')">Imprimer le bracelet</button>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><span>Distance</span><strong>{{ formatKm(profile.distance) }} km</strong></div>
        <div class="stat"><span>Dénivelé</span><strong>+{{ Math.round(profile.gain) }} / −{{ Math.round(profile.loss) }} m</strong></div>
        <div class="stat"><span>Altitude</span><strong>{{ Math.round(profile.minEle) }} → {{ Math.round(profile.maxEle) }} m</strong></div>
        <template v-if="totalRun != null && finish">
          <div class="stat main"><span>{{ settings.objectiveOn ? 'Temps du plan objectif' : 'Temps estimé' }}</span><strong>{{ formatDuration(finish.arrival - startSec) }}</strong></div>
          <div class="stat main"><span>Arrivée prévue</span><strong>{{ formatClock(finish.arrival) }}</strong></div>
        </template>
        <div v-else class="stat warn"><span>Temps estimé</span><strong>Renseigne ton niveau</strong></div>
      </div>

      <ObjectivePanel v-if="settings.objectiveOn" />

      <section class="card viz">
        <CourseMap v-model:hover="hoverD" class="map" :track="track" :segments="segments" :markers="markers" />
        <ElevationProfile v-model:hover="hoverD" :profile="profile" :segments="segments" :markers="markers" :height="190" :clock-at="clockAt" />
        <div class="legend">
          <span><i class="montee" />Montée</span>
          <span><i class="descente" />Descente</span>
          <span><i class="plat" />Plat / vallonné</span>
        </div>
      </section>

      <div class="grid-2">
        <LevelForm />
        <RavitoTable />
      </div>

      <SegmentTable />
      <NutritionTable />
    </div>

    <template v-if="track && profile && totalRun != null">
      <PrintSheet class="print-only print-fiche" />
      <PrintBand class="print-only print-bracelet" />
    </template>
  </DefaultLayout>
</template>

<script setup lang='ts'>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import { APP_NAME } from '~/brand'
import { usePlan } from '~/composables/use_plan'
import { formatClock, formatDuration, formatKm } from '~/utils/format'
import DefaultLayout from '~/layouts/default.vue'
import GpxDrop from '~/components/gpx_drop.vue'
import CourseMap from '~/components/course_map.vue'
import ElevationProfile from '~/components/elevation_profile.vue'
import LevelForm from '~/components/level_form.vue'
import RavitoTable from '~/components/ravito_table.vue'
import SegmentTable from '~/components/segment_table.vue'
import NutritionTable from '~/components/nutrition_table.vue'
import ObjectivePanel from '~/components/objective_panel.vue'
import PrintSheet from '~/components/print_sheet.vue'
import PrintBand from '~/components/print_band.vue'
import SaveButton from '~/components/save_button.vue'
import LoopMap from '~/components/loop_map.vue'
import PlaceInput from '~/components/place_input.vue'
import Icon from '~/components/icon.vue'
import HeroMap from '~/components/hero_map.vue'
import type { IconName } from '~/utils/icons'
import type { PlaceSuggestion } from '~/utils/geocode'
import type { LatLon } from '~/utils/routing'
import { useAccount } from '~/composables/use_account'

/** `saved` : plan ouvert depuis « Mes parcours » (/parcours/:id) */
const props = defineProps<{ saved?: { id: number, data: string } }>()
/** Message de la page précédente (ex. compte supprimé) */
const flash = computed(() => (usePage().flash as { success?: string } | undefined)?.success)

const { track, profile, fileName, segments, markers, hoverD, totalRun, timeline, startSec, settings, error, clockAt: clockSecAt, loadGpx, loadSaved, clearTrack, enableObjective, planName, renamePlan } = usePlan()
const { markSynced, resumePendingSave } = useAccount()

if (props.saved) {
  loadSaved(props.saved.id, props.saved.data)
  markSynced()
}
onMounted(resumePendingSave)

/** Repart d'un plan vierge ; depuis un plan du compte, on quitte aussi son adresse */
function changeGpx() {
  clearTrack()
  if (props.saved) router.visit('/')
}

const finish = computed(() => timeline.value[timeline.value.length - 1])

// --- Boucle découverte lancée depuis l'accueil (la page /boucles fait la recherche et le calcul) ---
const loopStart = ref('')
/** Suggestion choisie : ses coordonnées servent tant que le champ n'est pas retouché */
const loopPicked = ref<PlaceSuggestion | null>(null)
const loopKm = ref(10)
const loopCount = ref(3)

type LoopTheme = 'tout' | 'nature' | 'patrimoine'
const THEMES: { value: LoopTheme, label: string, icon: IconName, hint: string }[] = [
  { value: 'tout', label: 'Équilibrée', icon: 'route', hint: 'Monuments et nature : le plus beau du coin' },
  { value: 'nature', label: 'Nature', icon: 'leaf', hint: 'Cascades, sommets, points de vue, parcs…' },
  { value: 'patrimoine', label: 'Patrimoine', icon: 'landmark', hint: 'Châteaux, églises, musées, vieilles rues…' },
]
const loopTheme = ref<LoopTheme>('tout')

function stepKm(delta: number) {
  loopKm.value = Math.min(40, Math.max(3, Math.round(loopKm.value || 10) + delta))
}
/** Départ posé sur la carte (remplace le nom tapé, et inversement) */
const loopPoint = ref<LatLon | null>(null)
const showMap = ref(false)
const pickMap = ref<InstanceType<typeof LoopMap>>()

function pickPoint(p: LatLon) {
  // Premier point (souvent posé sur la carte de France entière) : on zoome dessus pour l'ajuster
  if (!loopPoint.value) pickMap.value?.flyTo(p.lat, p.lon, 13)
  loopPoint.value = p
  loopStart.value = ''
}

watch(loopStart, (v) => {
  if (v.trim()) loopPoint.value = null
})

function findLoop(fromPosition = false) {
  const params = new URLSearchParams({ km: String(Math.min(40, Math.max(3, Math.round(loopKm.value || 10)))), n: String(loopCount.value) })
  if (loopTheme.value !== 'tout') params.set('style', loopTheme.value)
  if (fromPosition) params.set('position', '1')
  else if (loopPicked.value && loopPicked.value.label === loopStart.value) {
    params.set('lat', loopPicked.value.lat.toFixed(5))
    params.set('lon', loopPicked.value.lon.toFixed(5))
    params.set('nom', loopPicked.value.label)
  }
  else if (loopStart.value.trim()) params.set('depart', loopStart.value.trim())
  else if (loopPoint.value) {
    params.set('lat', loopPoint.value.lat.toFixed(5))
    params.set('lon', loopPoint.value.lon.toFixed(5))
  }
  else return
  router.visit(`/boucles?${params}`)
}

// --- Renommer le plan (clic sur le crayon, Entrée ou clic ailleurs pour valider, Échap pour annuler) ---
const editingName = ref(false)
const nameDraft = ref('')
const nameInput = ref<HTMLInputElement>()

function startRename() {
  nameDraft.value = planName.value
  editingName.value = true
  nextTick(() => nameInput.value?.select())
}

function saveName() {
  if (!editingName.value) return
  editingName.value = false
  if (nameDraft.value.trim()) renamePlan(nameDraft.value)
}

/** Heure de passage prévue à une distance (infobulle du profil) */
function clockAt(d: number): string {
  return totalRun.value == null ? '' : formatClock(clockSecAt(d))
}

async function onFile(f: File) {
  loadGpx(await f.text(), f.name)
}

async function loadExample() {
  const text = await fetch('/exemple.gpx').then(r => r.text())
  const ok = loadGpx(text, 'exemple.gpx', [
    { name: 'Col des Crêts', km: 7.4, barrier: '09:45', stop: 3 },
    { name: 'La Combe', km: 15.2, barrier: '11:30', stop: 5 },
  ])
  if (ok) settings.finishBarrier = '13:00'
}

function print(mode: 'fiche' | 'bracelet') {
  document.body.dataset.print = mode
  nextTick(() => window.print())
}

onMounted(() => window.addEventListener('afterprint', clearPrint))
onBeforeUnmount(() => window.removeEventListener('afterprint', clearPrint))
function clearPrint() {
  delete document.body.dataset.print
}
</script>

<style scoped>
.home { display: flex; flex-direction: column; gap: 32px; padding-top: 28px; }
.flash { margin-bottom: -16px; padding: 10px 14px; border-radius: 12px; background: var(--forest-soft); color: var(--forest); font-weight: 600; font-size: 0.92rem; }
.hero { display: flex; align-items: center; gap: 48px; }
.hero-text { flex: 1; min-width: 0; }
.kicker { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--forest); margin-bottom: 12px; }
.hero h1 { font-size: clamp(2.4rem, 6vw, 4rem); line-height: 1; font-weight: 700; margin-bottom: 16px; }
.hero h1 span { color: var(--accent); }
.lead { font-size: 1.12rem; line-height: 1.55; color: var(--text-soft); max-width: 560px; }
.hero-art { width: 340px; flex: none; }
@media (max-width: 860px) { .hero-art { display: none; } }

.loop-form { display: flex; flex-direction: column; gap: 18px; padding: 22px; border-radius: 20px; }
.row { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-end; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field > span { font-size: 0.82rem; font-weight: 600; color: var(--text-soft); }
.field.start { flex: 999 1 340px; min-width: 0; }
.field.distance { flex: 1 1 200px; }
.box { display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 6px 0 14px; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--panel-2); }
.box:focus-within { border-color: var(--forest); }
.box-icon { color: var(--forest); }
.box .place { flex: 1; }
.box .place :deep(input) { border: none; background: transparent; font-size: 1rem; padding: 12px 0; outline: none; width: 100%; }
.box .place :deep(input.picked::placeholder) { color: var(--forest); font-weight: 600; opacity: 1; }
.square { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border: none; border-radius: 10px; background: var(--forest-soft); color: var(--forest); font: inherit; font-size: 1.35rem; line-height: 1; cursor: pointer; }
.square:hover { background: #d3e2d8; }
.square:disabled { opacity: 0.4; cursor: not-allowed; }
.stepper { justify-content: space-between; padding: 0 6px; }
.km { display: flex; align-items: baseline; gap: 4px; font-weight: 500; color: var(--text-soft); }
.km input { width: 3ch; border: none; background: transparent; padding: 0; text-align: right; font-size: 1.25rem; font-weight: 600; color: var(--text); outline: none; -moz-appearance: textfield; appearance: textfield; }
.km input::-webkit-inner-spin-button, .km input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips button { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--panel); font: inherit; font-size: 0.95rem; color: var(--text); cursor: pointer; }
.chips button:hover { border-color: var(--forest); }
.chips button.on { background: var(--forest); border-color: var(--forest); color: #fff; font-weight: 600; }
.count { display: flex; padding: 3px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--panel-2); }
.count button { width: 42px; height: 38px; border: none; border-radius: 999px; background: transparent; font: inherit; font-size: 0.95rem; color: var(--text); cursor: pointer; }
.count button.on { background: var(--forest); color: #fff; font-weight: 600; }
.go { margin-left: auto; height: 52px; padding: 0 24px; font-size: 1.05rem; border-radius: 12px; gap: 10px; }
.go:disabled { opacity: 0.5; cursor: not-allowed; }
.alt { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 0.92rem; font-weight: 500; color: var(--forest); background: none; border: none; cursor: pointer; padding: 2px; }
.alt:hover { color: var(--accent-strong); }
.pick-map-inner { height: 340px; }
.pick-map-inner .map { min-height: 0; }
.pick-hint { font-size: 0.88rem; color: var(--text-soft); margin-top: 8px; }
@media (max-width: 640px) {
  .loop-form { padding: 16px; }
  .go { flex: 1 1 100%; justify-content: center; }
  .pick-map-inner { height: 280px; }
}

.paths { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; align-items: stretch; }
.path { display: flex; flex-direction: column; gap: 14px; padding: 26px; border-radius: 20px; }
.tile { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 14px; background: var(--forest-soft); color: var(--forest); }
.path h2 { font-size: 1.9rem; font-weight: 700; margin: 0; }
.path p.grow { flex: 1; font-size: 1rem; line-height: 1.55; color: var(--text-soft); }
.path .buttons .btn { padding: 11px 18px; font-size: 0.95rem; border-radius: 12px; text-decoration: none; }
.path .hint { font-size: 0.82rem; color: var(--text-soft); }
.account-note { font-size: 0.9rem; color: var(--text-soft); }
.account-note strong { color: var(--text); }
.error { color: var(--bad); background: var(--bad-bg); padding: 8px 12px; border-radius: var(--radius-sm); }

.plan { display: flex; flex-direction: column; gap: 18px; }
.course-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.course-head h1 { font-size: 2.2rem; }
.title { min-width: 0; }
.rename-btn { font: inherit; font-size: 1.1rem; vertical-align: 0.35em; background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.rename-btn:hover { color: var(--accent); background: var(--panel-2); }
.rename input { font-family: 'Barlow Condensed', sans-serif; font-size: 2rem; font-weight: 700; width: min(560px, 100%); padding: 2px 8px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.actions .btn:disabled { opacity: 0.45; cursor: not-allowed; }
.actions .target-btn { color: var(--accent); border-color: var(--accent); }
.actions .target-btn:hover { background: #fff6f0; }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
@media (max-width: 640px) { .stats { grid-template-columns: 1fr 1fr; } .stat strong { font-size: 1.3rem; } }
.stat { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; flex-direction: column; }
.stat span { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); font-weight: 600; }
.stat strong { font-family: 'Barlow Condensed', sans-serif; font-size: 1.55rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.stat.main { background: var(--forest); border-color: var(--forest); color: #fff; }
.stat.main span { color: #b9d2c3; }
.stat.warn strong { color: var(--accent); font-size: 1.2rem; }

.viz { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.viz .map { height: 380px; }
.legend { display: flex; gap: 16px; font-size: 0.8rem; color: var(--text-soft); padding-left: 42px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.legend i.montee { background: var(--up); }
.legend i.descente { background: var(--down); }
.legend i.plat { background: var(--flat); }

.grid-2 { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 18px; align-items: start; }
@media (max-width: 1100px) { .grid-2 { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 900px) { .viz .map { height: 300px; } }
</style>
