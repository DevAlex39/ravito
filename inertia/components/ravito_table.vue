<template>
  <section class="card">
    <div class="card-head">
      <h2>Ravitos et barrières</h2>
      <button class="btn small" type="button" @click="addRavito">+ Ajouter un ravito</button>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Point</th>
            <th class="r">Km</th>
            <th>Arrêt</th>
            <th>Barrière</th>
            <th class="r">Passage</th>
            <th class="r">Marge</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr class="fixed">
            <td><strong>Départ</strong></td>
            <td class="r num">0</td>
            <td />
            <td />
            <td class="r num">{{ formatClock(startSec) }}</td>
            <td />
            <td />
          </tr>
          <tr v-for="r in rows" :key="r.id" :class="{ out: !point(r.id) }" @mouseenter="hoverD = r.km * 1000" @mouseleave="hoverD = null">
            <td><input v-model="r.name" type="text" class="name" aria-label="Nom du ravito"></td>
            <td class="r"><input v-model.number="r.km" type="number" min="0" step="0.1" class="km" aria-label="Kilomètre"></td>
            <td><input v-model.number="r.stop" type="number" min="0" step="1" class="stop" aria-label="Arrêt en minutes"> <span class="muted">min</span></td>
            <td><input v-model="r.barrier" type="time" class="barrier" aria-label="Barrière horaire"></td>
            <td class="r num">{{ point(r.id) ? formatClock(point(r.id)!.arrival) : 'hors parcours' }}</td>
            <td class="r"><MarginBadge :margin="point(r.id)?.margin ?? null" /></td>
            <td><button class="btn icon" type="button" title="Supprimer" @click="removeRavito(r.id)">✕</button></td>
          </tr>
          <tr v-if="finish" class="fixed">
            <td><strong>Arrivée</strong></td>
            <td class="r num">{{ formatKm(finish.d) }}</td>
            <td />
            <td><input v-model="settings.finishBarrier" type="time" class="barrier" aria-label="Barrière à l'arrivée"></td>
            <td class="r num"><strong>{{ formatClock(finish.arrival) }}</strong></td>
            <td class="r"><MarginBadge :margin="finish.margin" /></td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!ravitos.length" class="hint empty">Ajoute les ravitos de la course (km indiqués sur le site de l'organisation) pour obtenir tes heures de passage.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePlan } from '~/composables/use_plan'
import { formatClock, formatKm } from '~/utils/format'
import MarginBadge from '~/components/margin_badge.vue'
const { ravitos, settings, timeline, startSec, hoverD, addRavito, removeRavito } = usePlan()

// Ordre de création : on ne réordonne pas les lignes pendant la saisie d'un km
const rows = computed(() => [...ravitos.value].sort((a, b) => a.id - b.id))
const point = (id: number) => timeline.value.find(t => t.key === `r${id}`)
const finish = computed(() => timeline.value.find(t => t.kind === 'finish'))
</script>

<style scoped>
.name { width: 100%; min-width: 110px; }
.km { width: 72px; text-align: right; }
.stop { width: 56px; }
.barrier { width: 104px; }
tr.fixed td { background: var(--panel-2); }
tr.out td { opacity: 0.6; }
.empty { margin-top: 10px; }
</style>
