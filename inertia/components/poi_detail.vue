<template>
  <article class="detail" :class="poi.category">
    <img v-if="details?.image" :src="details.image" :alt="poi.name" class="photo" loading="lazy" @error="details.image = null">
    <div class="body">
      <header>
        <span class="kind">{{ kind.icon }} {{ kind.label }}</span>
        <button type="button" class="close" title="Fermer" @click="emit('close')">✕</button>
      </header>
      <h3>{{ poi.name }}</h3>
      <p v-if="!details" class="soft">Chargement…</p>
      <p v-else-if="details.description" class="text">{{ details.description }}</p>
      <p v-else class="soft">Pas de description disponible pour ce lieu.</p>
      <div v-if="details" class="links">
        <a v-if="details.wikipedia" :href="details.wikipedia" target="_blank" rel="noopener">Lire sur Wikipédia ↗</a>
        <a :href="details.osm" target="_blank" rel="noopener">Voir sur OpenStreetMap ↗</a>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Poi } from '~/utils/loops'
import { kindOf, placeDetails, type PlaceDetails } from '~/utils/places'

const props = defineProps<{ poi: Poi }>()
const emit = defineEmits<{ close: [] }>()

const kind = computed(() => kindOf(props.poi))
const details = ref<PlaceDetails | null>(null)

watch(() => props.poi, async (poi) => {
  details.value = null
  const found = await placeDetails(poi)
  // Ignore une réponse arrivée après qu'on a cliqué sur un autre lieu
  if (props.poi === poi) details.value = { ...found }
}, { immediate: true })
</script>

<style scoped>
.detail {
  display: flex;
  gap: 14px;
  border: 1px solid var(--border-strong);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 12px;
  background: var(--panel);
}
.detail.nature { border-left-color: var(--forest); }
.photo { width: 180px; height: 135px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0; }
.body { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kind { font-size: 0.82rem; font-weight: 600; color: var(--text-soft); }
.close { font: inherit; border: none; background: none; cursor: pointer; color: var(--text-soft); font-size: 1rem; padding: 2px 6px; }
.close:hover { color: var(--text); }
h3 { font-size: 1.15rem; }
.text { font-size: 0.9rem; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 6; line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.soft { font-size: 0.88rem; color: var(--text-soft); }
.links { display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.85rem; font-weight: 600; }

@media (max-width: 640px) {
  .detail { flex-direction: column; }
  .photo { width: 100%; height: 180px; }
}
</style>
