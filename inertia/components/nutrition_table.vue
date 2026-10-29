<template>
  <section class="card">
    <div class="card-head">
      <h2>Ravitaillement entre les points</h2>
      <span class="hint">Ce qu'il faut emporter pour tenir jusqu'au point suivant</span>
    </div>

    <div class="row">
      <label class="field">
        <span>Glucides (g/h)</span>
        <input v-model.number="settings.carbsPerHour" type="number" min="0" step="5">
      </label>
      <label class="field">
        <span>Eau (ml/h)</span>
        <input v-model.number="settings.waterPerHour" type="number" min="0" step="50">
      </label>
      <label class="field">
        <span>Glucides par gel (g)</span>
        <input v-model.number="settings.gelCarbs" type="number" min="1" step="1">
      </label>
      <label class="field">
        <span>Capacité d'eau portée (ml)</span>
        <input v-model.number="settings.flask" type="number" min="0" step="250">
      </label>
    </div>

    <div v-if="totalRun != null" class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Portion</th>
            <th class="r">Distance</th>
            <th class="r">D+</th>
            <th class="r">Durée</th>
            <th class="r">Glucides</th>
            <th class="r">Gels</th>
            <th class="r">Eau</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in legs" :key="l.from.key + l.to.key">
            <td>{{ l.from.name }} → {{ l.to.name }}</td>
            <td class="r num">{{ formatKm(l.distance) }} km</td>
            <td class="r num">{{ Math.round(l.gain) }} m</td>
            <td class="r num">{{ formatDuration(l.duration) }}</td>
            <td class="r num">{{ Math.round(l.carbs) }} g</td>
            <td class="r num">{{ l.gels }}</td>
            <td class="r num">
              <span :class="{ over: l.overFlask }" :title="l.overFlask ? 'Plus que ta capacité d\'eau : prévois un point d\'eau ou plus de flasques' : ''">
                {{ (Math.round(l.water / 50) * 50).toLocaleString('fr-FR') }} ml<template v-if="l.overFlask"> ⚠</template>
              </span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td />
            <td />
            <td class="r num"><strong>{{ formatDuration(totalRun) }}</strong></td>
            <td class="r num"><strong>{{ Math.round(totals.carbs) }} g</strong></td>
            <td class="r num"><strong>{{ totals.gels }}</strong></td>
            <td class="r num"><strong>{{ (Math.round(totals.water / 100) / 10).toLocaleString('fr-FR') }} L</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="hint note">
      Repères courants : 60 à 90 g de glucides par heure sur les efforts longs, 400 à 750 ml d'eau par heure selon la chaleur.
      Teste toujours ta stratégie à l'entraînement.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePlan } from '~/composables/use_plan'
import { formatDuration, formatKm } from '~/utils/format'
const { settings, legs, totalRun } = usePlan()

const totals = computed(() => legs.value.reduce(
  (acc, l) => ({ carbs: acc.carbs + l.carbs, gels: acc.gels + l.gels, water: acc.water + l.water }),
  { carbs: 0, gels: 0, water: 0 },
))
</script>

<style scoped>
.row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.row .field { width: 150px; }
tfoot td { border-top: 1px solid var(--border-strong); border-bottom: none; }
.over { color: var(--bad); font-weight: 600; }
.note { margin-top: 12px; }
</style>
