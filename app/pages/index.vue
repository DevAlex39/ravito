<template>
  <div>
    <section v-if="!track" class="container hero screen-only">
      <h1>Ton plan de course,<br><span>à partir du GPX.</span></h1>
      <p class="lead">
        Importe la trace de ta course : Ravito la découpe en montées et descentes, estime tes temps de passage
        selon ton niveau, vérifie les barrières horaires et calcule ce que tu dois emporter entre chaque ravito.
        Le tout s'imprime en fiche A4 ou en bracelet.
      </p>
      <GpxDrop @file="onFile" @example="loadExample" />
      <p v-if="error" class="error">{{ error }}</p>
      <ul class="features">
        <li><strong>Temps réalistes</strong> calculés mètre par mètre selon la pente, calibrables sur une de tes anciennes courses.</li>
        <li><strong>Barrières horaires</strong> : ta marge à chaque ravito, en un coup d'œil.</li>
        <li><strong>Nutrition</strong> : gels et eau à emporter pour chaque portion.</li>
        <li><strong>Rien ne quitte ton navigateur</strong> : aucun compte, aucun envoi de fichier.</li>
      </ul>
    </section>

    <div v-else-if="profile" class="container plan screen-only">
      <div class="course-head">
        <div>
          <h1>{{ track.name }}</h1>
          <p class="hint">{{ fileName }}</p>
        </div>
        <div class="actions">
          <button class="btn ghost" type="button" @click="clearTrack">Changer de GPX</button>
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
  </div>
</template>

<script setup lang="ts">
const { track, profile, fileName, segments, markers, hoverD, totalRun, timeline, startSec, settings, error, clockAt: clockSecAt, loadGpx, clearTrack, enableObjective } = usePlan()

const finish = computed(() => timeline.value[timeline.value.length - 1])

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
.hero { max-width: 760px; padding-top: 24px; }
.hero h1 { font-size: clamp(2.4rem, 6vw, 3.6rem); margin-bottom: 16px; }
.hero h1 span { color: var(--accent); }
.lead { font-size: 1.05rem; color: var(--text-soft); margin-bottom: 24px; }
.error { margin-top: 12px; color: var(--bad); background: var(--bad-bg); padding: 8px 12px; border-radius: var(--radius-sm); }
.features { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 28px; }
.features li { font-size: 0.9rem; color: var(--text-soft); padding-left: 14px; border-left: 3px solid var(--forest); }
.features strong { color: var(--text); }

.plan { display: flex; flex-direction: column; gap: 18px; }
.course-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.course-head h1 { font-size: 2.2rem; }
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
