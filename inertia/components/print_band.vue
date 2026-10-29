<template>
  <!-- Racine sans display propre : c'est elle que .print-only masque à l'écran -->
  <div>
    <div class="bands">
      <!-- Deux exemplaires : un au poignet, un dans le sac -->
      <div v-for="n in 2" :key="n" class="band">
        <p class="name">{{ track.name }}</p>
        <p class="meta">{{ formatKm(profile.distance, 0) }} km · {{ Math.round(profile.gain) }} D+</p>
        <ElevationProfile :profile="profile" :segments="segments" :markers="markers" :width="184" :height="44" compact />
        <table>
          <thead>
            <tr><th>Km</th><th>Point</th><th class="r">Prévu</th><th class="r">BH</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in timeline" :key="t.key">
              <td>{{ formatKm(t.d) }}</td>
              <td class="pt">{{ t.name }}</td>
              <td class="r"><strong>{{ formatClock(t.arrival) }}</strong></td>
              <td class="r">{{ t.barrier != null ? formatClock(t.barrier) : '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p class="cut">Découpe le long des pointillés et protège avec du ruban adhésif transparent.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePlan } from '~/composables/use_plan'
import { formatClock, formatKm } from '~/utils/format'
import ElevationProfile from '~/components/elevation_profile.vue'
const { track: trackRef, profile: profileRef, segments, timeline, markers } = usePlan()
const track = computed(() => trackRef.value!)
const profile = computed(() => profileRef.value!)
</script>

<style scoped>
.bands { display: flex; flex-wrap: wrap; gap: 8mm; align-items: flex-start; }
.band {
  width: 56mm;
  border: 1px dashed #888;
  padding: 3mm;
  font-size: 7.5pt;
  color: #000;
  break-inside: avoid;
}
.name { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 10pt; line-height: 1.1; }
.meta { font-size: 7pt; color: #444; margin-bottom: 2px; }
table { width: 100%; border-collapse: collapse; margin-top: 3px; }
th { font-size: 6.5pt; color: #555; text-align: left; border-bottom: 1px solid #999; padding: 1px 2px; }
td { padding: 1.5px 2px; border-bottom: 1px solid #ddd; white-space: nowrap; }
.pt { max-width: 20mm; overflow: hidden; text-overflow: ellipsis; }
.r { text-align: right; }
.cut { width: 100%; font-size: 7pt; color: #777; }
</style>
