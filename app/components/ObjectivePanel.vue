<template>
  <section class="card objective">
    <div class="card-head">
      <h2>Temps ciblé</h2>
      <button class="btn ghost small" type="button" @click="disableObjective">Retirer l'objectif</button>
    </div>

    <div class="layout">
      <label class="field target">
        <span>Temps visé à l'arrivée, arrêts compris (h:mm)</span>
        <input v-model.lazy="settings.objectiveTime" type="text" placeholder="3:15" :class="{ invalid: !objectiveRun }">
      </label>

      <div v-if="objectiveRun != null && totalRun != null" class="summary">
        <div class="line">
          <span>Temps du plan</span>
          <strong class="num">{{ formatDuration(totalRun + totalStops) }}</strong>
          <span v-if="gapLabel" class="gap" :class="objectiveGap! > 0 ? 'slower' : 'faster'">{{ gapLabel }}</span>
          <button v-if="gapLabel" class="btn small" type="button" @click="rebalance">Revenir à l'objectif</button>
        </div>
        <p v-if="fixedCount" class="hint">
          {{ fixedCount }} allure{{ fixedCount > 1 ? 's' : '' }} fixée{{ fixedCount > 1 ? 's' : '' }} à la main ·
          <button class="link" type="button" @click="clearPaceOverrides">tout déverrouiller</button>
        </p>
        <p v-if="vsPrediction" class="hint">{{ vsPrediction }}</p>
        <p v-if="!objectiveFeasible" class="warn">
          Les allures fixées prennent déjà presque tout le temps visé : les autres tronçons ne peuvent pas compenser.
        </p>
      </div>
      <p v-else class="hint">Saisis un temps au format h:mm (par exemple 3:15), supérieur aux arrêts prévus aux ravitos.</p>
    </div>

    <p class="hint how">
      Le temps visé est réparti sur les tronçons selon leur difficulté. Change l'allure d'un tronçon dans le tableau
      « Tronçons » : elle est fixée (🔒) et le temps total s'ajuste. « Revenir à l'objectif » répartit l'écart sur les tronçons non fixés.
    </p>
  </section>
</template>

<script setup lang="ts">
const {
  settings, totalRun, predictedRun, totalStops, segmentRows,
  objectiveRun, objectiveGap, objectiveFeasible,
  disableObjective, rebalance, clearPaceOverrides,
} = usePlan()

const fixedCount = computed(() => segmentRows.value.filter(s => s.fixed).length)

const gapLabel = computed(() => {
  const g = objectiveGap.value
  if (g == null || Math.abs(g) < 30) return ''
  return `${g > 0 ? '+' : '−'}${formatDuration(Math.abs(g))} sur l'objectif`
})

const vsPrediction = computed(() => {
  if (predictedRun.value == null || totalRun.value == null) return ''
  const pct = Math.round((predictedRun.value / totalRun.value - 1) * 100)
  const pred = formatDuration(predictedRun.value + totalStops.value)
  if (Math.abs(pct) < 2) return `Ton plan colle à la prédiction de ton niveau (${pred}).`
  return pct > 0
    ? `Ton plan est ${pct} % plus rapide que la prédiction de ton niveau (${pred}).`
    : `Ton plan est ${-pct} % plus prudent que la prédiction de ton niveau (${pred}).`
})
</script>

<style scoped>
.objective { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.layout { display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
.target { width: 260px; }
.target input { font-size: 1.1rem; font-weight: 600; }
.summary { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 6px; }
.line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.line strong { font-family: 'Barlow Condensed', sans-serif; font-size: 1.6rem; font-weight: 600; }
.gap { font-weight: 600; font-size: 0.85rem; padding: 2px 8px; border-radius: 6px; }
.gap.slower { background: var(--warn-bg); color: var(--warn); }
.gap.faster { background: var(--ok-bg); color: var(--ok); }
.link { font: inherit; background: none; border: none; color: var(--forest); text-decoration: underline; cursor: pointer; padding: 0; }
.warn { color: var(--bad); font-size: 0.85rem; }
.how { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px; }
</style>
