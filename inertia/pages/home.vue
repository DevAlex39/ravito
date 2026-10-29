<template>
  <DefaultLayout>
    <Head :title="track ? planName : undefined" />
    <section v-if="!track" class="container home screen-only">
      <div class="hero">
        <h1>Joins l'utile à l'agréable :<br><span>cours et découvre les alentours.</span></h1>
        <p class="lead">
          Donne un point de départ et une distance : {{ APP_NAME }} te trace une boucle
          qui passe par les plus beaux lieux du coin.
        </p>
        <form class="loop-form card" @submit.prevent="findLoop()">
          <input v-model="loopStart" type="text" placeholder="Ville ou lieu de départ (ex. Dole)" aria-label="Lieu de départ">
          <label class="km">
            <input v-model.number="loopKm" type="number" min="3" max="40" step="1" inputmode="numeric" aria-label="Distance en kilomètres">
            <span>km</span>
          </label>
          <button class="btn" type="submit" :disabled="!loopStart.trim()">Trouver ma boucle →</button>
        </form>
        <button class="locate" type="button" @click="findLoop(true)">📍 ou pars de ma position</button>
      </div>

      <div class="paths">
        <section class="card path">
          <h2>Tu prépares une course ?</h2>
          <p>
            Importe le GPX : temps de passage selon ton niveau, barrières horaires,
            nutrition entre chaque ravito, fiche A4 ou bracelet à imprimer.
          </p>
          <GpxDrop @file="onFile" @example="loadExample" />
          <p v-if="error" class="error">{{ error }}</p>
        </section>
        <section class="card path">
          <h2>Tu as ton tracé en tête ?</h2>
          <p>Dessine-le sur la carte : il suit les sentiers, avec la distance et le dénivelé en direct.</p>
          <Link href="/tracer" class="btn ghost">Tracer mon parcours</Link>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
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
import { useAccount } from '~/composables/use_account'

/** `saved` : plan ouvert depuis « Mes parcours » (/parcours/:id) */
const props = defineProps<{ saved?: { id: number, data: string } }>()

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
const loopKm = ref(10)

function findLoop(fromPosition = false) {
  const params = new URLSearchParams({ km: String(Math.min(40, Math.max(3, Math.round(loopKm.value || 10)))) })
  if (fromPosition) params.set('position', '1')
  else if (loopStart.value.trim()) params.set('depart', loopStart.value.trim())
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
.home { display: flex; flex-direction: column; gap: 36px; padding-top: 24px; }
.hero { max-width: 820px; }
.hero h1 { font-size: clamp(2.2rem, 5.5vw, 3.4rem); margin-bottom: 14px; }
.hero h1 span { color: var(--accent); }
.lead { font-size: 1.1rem; color: var(--text-soft); margin-bottom: 20px; }
.loop-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 10px; }
.loop-form > input { flex: 1 1 260px; min-width: 0; font-size: 1rem; padding: 10px 12px; }
.loop-form .km { display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--text-soft); }
.loop-form .km input { width: 70px; text-align: center; font-size: 1rem; padding: 10px 6px; }
.loop-form .btn { font-size: 1rem; padding: 10px 18px; }
.loop-form .btn:disabled { opacity: 0.5; cursor: not-allowed; }
.locate { font: inherit; font-size: 0.92rem; font-weight: 600; color: var(--forest); background: none; border: none; cursor: pointer; padding: 8px 2px; }
.locate:hover { color: var(--accent); }

.paths { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 860px) { .paths { grid-template-columns: minmax(0, 1fr); } }
.path { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.path h2 { font-size: 1.5rem; }
.path p { color: var(--text-soft); font-size: 0.95rem; }
.path :deep(.drop) { align-self: stretch; padding: 22px 16px; }
.account-note { font-size: 0.9rem; color: var(--text-soft); padding-left: 14px; border-left: 3px solid var(--forest); }
.account-note strong { color: var(--text); }
.error { color: var(--bad); background: var(--bad-bg); padding: 8px 12px; border-radius: var(--radius-sm); }
@media (max-width: 640px) { .loop-form .btn { flex: 1 1 100%; } }

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
