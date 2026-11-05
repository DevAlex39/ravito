<template>
  <div
    class="drop"
    :class="{ over }"
    @dragover.prevent="over = true"
    @dragleave.prevent="over = false"
    @drop.prevent="onDrop"
  >
    <slot />
    <div class="buttons">
      <label class="btn">
        <Icon name="upload" :size="18" />
        Importer un GPX
        <input type="file" accept=".gpx,application/gpx+xml" hidden @change="onPick">
      </label>
      <button class="btn ghost" type="button" @click="emit('example')">Voir un exemple</button>
    </div>
    <p class="hint">{{ over ? 'Lâche ton fichier ici' : 'ou glisse ton fichier GPX sur ce cadre' }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Icon from '~/components/icon.vue'

/** Cadre qui accepte un GPX glissé dessus, avec le bouton d'import et l'exemple ; le contenu (titre, texte) vient du slot */
const emit = defineEmits<{ file: [File], example: [] }>()
const over = ref(false)

function onDrop(e: DragEvent) {
  over.value = false
  const f = e.dataTransfer?.files[0]
  if (f) emit('file', f)
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (f) emit('file', f)
  input.value = ''
}
</script>

<style scoped>
.drop { display: flex; flex-direction: column; gap: 14px; transition: background 0.15s; }
.drop.over { outline: 2px dashed var(--accent); outline-offset: -8px; background: var(--accent-soft); }
.buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.buttons .btn { padding: 11px 18px; font-size: 0.95rem; border-radius: 12px; }
.hint { font-size: 0.82rem; color: var(--text-soft); }
</style>
