<template>
  <div
    class="drop"
    :class="{ over }"
    @dragover.prevent="over = true"
    @dragleave.prevent="over = false"
    @drop.prevent="onDrop"
  >
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <path d="M4 38 L16 20 L24 30 L32 14 L44 38 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
      <circle cx="32" cy="10" r="3" fill="currentColor" />
    </svg>
    <p class="title">Glisse ton fichier GPX ici</p>
    <p class="hint">ou</p>
    <div class="buttons">
      <label class="btn">
        Choisir un fichier
        <input type="file" accept=".gpx,application/gpx+xml" hidden @change="onPick">
      </label>
      <button class="btn ghost" type="button" @click="emit('example')">Essayer avec un exemple</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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
.drop {
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--panel);
  padding: 36px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  color: var(--forest);
  transition: border-color 0.15s, background 0.15s;
}
.drop.over { border-color: var(--accent); background: #fff6f0; }
.title { font-weight: 600; color: var(--text); font-size: 1.05rem; }
.buttons { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
</style>
