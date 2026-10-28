<template>
  <div class="sheet">
    <header>
      <div>
        <h1>{{ track.name }}</h1>
        <p>
          {{ formatKm(profile.distance) }} km · {{ Math.round(profile.gain) }} m D+ · {{ Math.round(profile.loss) }} m D−
          <template v-if="totalRun != null"> · départ {{ formatClock(startSec) }} · arrivée prévue {{ formatClock(finish!.arrival) }}</template>
        </p>
        <p v-if="settings.objectiveOn" class="objective">Plan objectif : {{ formatDuration(finish!.arrival - startSec) }}</p>
      </div>
      <span class="brand">Ravito</span>
    </header>

    <ElevationProfile :profile="profile" :segments="segments" :markers="markers" :width="700" :height="170" />

    <h2>Passages</h2>
    <table>
      <thead>
        <tr>
          <th>Point</th>
          <th class="r">Km</th>
          <th class="r">D+ cumulé</th>
          <th class="r">Temps course</th>
          <th class="r">Heure prévue</th>
          <th class="r">Arrêt</th>
          <th class="r">Barrière</th>
          <th class="r">Marge</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in timeline" :key="t.key">
          <td><strong>{{ t.name }}</strong></td>
          <td class="r">{{ formatKm(t.d) }}</td>
          <td class="r">{{ Math.round(t.gainCum) }} m</td>
          <td class="r">{{ formatDuration(t.arrival - startSec) }}</td>
          <td class="r"><strong>{{ formatClock(t.arrival) }}</strong></td>
          <td class="r">{{ t.stop ? formatDuration(t.stop) : '' }}</td>
          <td class="r">{{ t.barrier != null ? formatClock(t.barrier) : '' }}</td>
          <td class="r"><MarginBadge :margin="t.margin" /></td>
        </tr>
      </tbody>
    </table>

    <div class="cols">
      <div>
        <h2>Tronçons</h2>
        <table class="small">
          <thead>
            <tr><th>Km</th><th>Type</th><th class="r">D+/D−</th><th class="r">Temps</th><th class="r">Allure</th><th class="r">Fin vers</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in segmentRows" :key="s.start">
              <td>{{ formatKm(s.start) }} → {{ formatKm(s.end) }}</td>
              <td><span class="dot" :class="s.type" />{{ SEG_LABELS[s.type] }}</td>
              <td class="r">+{{ Math.round(s.gain) }}/−{{ Math.round(s.loss) }}</td>
              <td class="r">{{ formatDuration(s.time) }}</td>
              <td class="r">{{ formatPace(s.pace) }}</td>
              <td class="r">{{ formatClock(s.endClock) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h2>À emporter</h2>
        <table class="small">
          <thead>
            <tr><th>Portion</th><th class="r">Durée</th><th class="r">Gels</th><th class="r">Eau</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in legs" :key="l.from.key">
              <td>{{ l.from.name }} → {{ l.to.name }}</td>
              <td class="r">{{ formatDuration(l.duration) }}</td>
              <td class="r">{{ l.gels }}</td>
              <td class="r">{{ Math.round(l.water / 50) * 50 }} ml</td>
            </tr>
          </tbody>
        </table>
        <p class="note">Base : {{ settings.carbsPerHour }} g glucides/h, {{ settings.waterPerHour }} ml eau/h, gels de {{ settings.gelCarbs }} g.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { track: trackRef, profile: profileRef, segments, segmentRows, timeline, legs, markers, totalRun, startSec, settings } = usePlan()
// Ce composant n'est monté que lorsqu'une trace est chargée
const track = computed(() => trackRef.value!)
const profile = computed(() => profileRef.value!)
const finish = computed(() => timeline.value[timeline.value.length - 1])
</script>

<style scoped>
.sheet { color: #000; font-size: 9.5pt; }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #24503c; padding-bottom: 6px; margin-bottom: 10px; }
h1 { font-size: 20pt; }
h2 { font-size: 12pt; margin: 12px 0 4px; color: #24503c; }
.objective { font-weight: 600; color: #e2672b; }
.brand { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 14pt; color: #e2672b; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; }
th { font-size: 7.5pt; padding: 3px 5px; color: #555; border-bottom: 1px solid #999; }
td { padding: 3px 5px; border-bottom: 1px solid #ddd; }
table.small { font-size: 8pt; }
.r { text-align: right; }
.cols { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
.dot.montee { background: var(--up); }
.dot.descente { background: var(--down); }
.dot.plat { background: var(--flat); }
.note { font-size: 7.5pt; color: #666; margin-top: 4px; }
tr { break-inside: avoid; }
</style>
