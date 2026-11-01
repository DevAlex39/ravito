<template>
  <article class="detail" :class="poi.category">
    <figure v-if="details?.image" class="figure">
      <img :src="details.image" :alt="poi.name" class="photo" loading="lazy" @error="details.image = null">
      <figcaption v-if="details.credit">
        <a :href="details.credit.page" target="_blank" rel="noopener" :title="'Photo : ' + [details.credit.author, details.credit.license].filter(Boolean).join(' · ')">
          Photo{{ details.credit.author ? ` : ${details.credit.author}` : '' }}{{ details.credit.license ? ` · ${details.credit.license}` : ' · Wikimedia Commons' }}
        </a>
      </figcaption>
    </figure>
    <div class="body">
      <header>
        <span class="kind"><Icon :name="kind.icon" :size="16" /> {{ kind.label }}</span>
        <button type="button" class="close" title="Fermer" @click="emit('close')">✕</button>
      </header>
      <h3>{{ poi.name }}</h3>
      <p v-if="!details" class="soft">Chargement…</p>
      <p v-else-if="details.description" class="text">{{ details.description }}</p>
      <p v-if="details?.description && details.fromWikipedia" class="source">Texte : Wikipédia, licence CC BY-SA</p>
      <p v-else class="soft">Pas de description disponible pour ce lieu.</p>
      <div v-if="details" class="links">
        <a v-if="details.wikipedia" :href="details.wikipedia" target="_blank" rel="noopener">Lire sur Wikipédia ↗</a>
        <a v-if="details.osm" :href="details.osm" target="_blank" rel="noopener">Voir sur OpenStreetMap ↗</a>
      </div>
      <p v-if="details?.fromIgn" class="source">Lieu : IGN, BD TOPO, Licence Ouverte 2.0</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Poi } from '~/utils/loops'
import { kindOf, placeDetails, type PlaceDetails } from '~/utils/places'
import Icon from '~/components/icon.vue'

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
.figure { flex-shrink: 0; width: 180px; margin: 0; display: flex; flex-direction: column; gap: 3px; }
.photo { width: 180px; height: 135px; object-fit: cover; border-radius: var(--radius-sm); }
figcaption { font-size: 0.68rem; line-height: 1.3; color: var(--text-dim); }
figcaption a { color: inherit; text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
figcaption a:hover { text-decoration: underline; }
.source { font-size: 0.72rem; color: var(--text-dim); }
.body { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kind { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 600; color: var(--text-soft); }
.close { font: inherit; border: none; background: none; cursor: pointer; color: var(--text-soft); font-size: 1rem; padding: 2px 6px; }
.close:hover { color: var(--text); }
h3 { font-size: 1.15rem; }
.text { font-size: 0.9rem; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 6; line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.soft { font-size: 0.88rem; color: var(--text-soft); }
.links { display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.85rem; font-weight: 600; }

@media (max-width: 640px) {
  .detail { flex-direction: column; }
  .figure, .photo { width: 100%; }
  .photo { height: 180px; }
}
</style>
