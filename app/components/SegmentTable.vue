<template>
  <section class="card">
    <div class="card-head">
      <h2>Tronçons</h2>
      <div class="tools">
        <label class="split">
          <span class="hint">Couper au km</span>
          <input v-model.number="cutKm" type="number" min="0" step="0.1" placeholder="12,5" @keydown.enter="cut">
          <button class="btn ghost small" type="button" :disabled="!cutKm" @click="cut">Couper</button>
        </label>
        <button class="btn ghost small" type="button" @click="resetSegments">Redécouper automatiquement</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Type</th>
            <th class="r">De → à (km)</th>
            <th class="r">Long.</th>
            <th class="r">D+ / D−</th>
            <th class="r">Pente</th>
            <th class="r">Temps</th>
            <th class="r">Allure</th>
            <th class="r">Fin vers</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in segmentRows" :key="`${s.start}-${s.end}`" @mouseenter="hoverD = (s.start + s.end) / 2" @mouseleave="hoverD = null">
            <td class="muted num">{{ i + 1 }}</td>
            <td><span class="badge" :class="s.type">{{ SEG_LABELS[s.type] }}</span></td>
            <td class="r num">{{ formatKm(s.start) }} → {{ formatKm(s.end) }}</td>
            <td class="r num">{{ formatKm(s.length) }} km</td>
            <td class="r num">+{{ Math.round(s.gain) }} / −{{ Math.round(s.loss) }}</td>
            <td class="r num">{{ s.grade > 0 ? '+' : '' }}{{ (s.grade * 100).toFixed(1).replace('.', ',') }} %</td>
            <td class="r num">{{ hasModel ? formatDuration(s.time) : '–' }}</td>
            <td class="r num">{{ hasModel ? formatPace(s.pace) : '–' }}</td>
            <td class="r num">{{ hasModel ? formatClock(s.endClock) : '–' }}</td>
            <td class="r">
              <button v-if="i < segmentRows.length - 1" class="btn ghost small merge" type="button" title="Fusionner avec le tronçon suivant" @click="mergeWithNext(i)">
                Fusionner ↓
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
const { segmentRows, totalRun, hoverD, resetSegments, mergeWithNext, splitAt } = usePlan()

const hasModel = computed(() => totalRun.value != null)
const cutKm = ref<number | null>(null)

function cut() {
  if (!cutKm.value) return
  splitAt(cutKm.value)
  cutKm.value = null
}
</script>

<style scoped>
.tools { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.split { display: flex; align-items: center; gap: 6px; }
.split input { width: 80px; }
.merge { opacity: 0; transition: opacity 0.15s; }
tr:hover .merge, .merge:focus { opacity: 1; }
@media (hover: none) { .merge { opacity: 1; } }
</style>
