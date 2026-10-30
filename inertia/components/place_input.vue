<template>
  <div class="place-input">
    <input
      ref="field"
      :value="modelValue"
      type="text"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="active >= 0 ? `${listId}-${active}` : undefined"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :class="inputClass"
      @input="onInput"
      @keydown="onKey"
      @focus="open = suggestions.length > 0"
      @blur="open = false"
    >
    <ul v-if="open" :id="listId" class="suggestions" role="listbox">
      <li
        v-for="(s, i) in suggestions"
        :id="`${listId}-${i}`"
        :key="`${s.lat},${s.lon},${s.label}`"
        role="option"
        :aria-selected="i === active"
        :class="{ active: i === active }"
        @mousedown.prevent="choose(s)"
        @mouseenter="active = i"
      >
        <span class="label">{{ s.label }}</span>
        <span v-if="s.detail" class="detail">{{ s.detail }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { suggestPlaces, townCenter, type PlaceSuggestion } from '~/utils/geocode'

/**
 * Champ « lieu de départ » avec suggestions de la Base Adresse Nationale (villes, adresses, codes postaux).
 * Choisir une suggestion émet `pick` ; Entrée sans suggestion surlignée émet `enter` (recherche classique).
 */
defineProps<{
  modelValue: string
  placeholder?: string
  ariaLabel?: string
  inputClass?: Record<string, unknown>
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'pick': [place: PlaceSuggestion]
  'enter': []
}>()

const listId = `places-${Math.random().toString(36).slice(2, 8)}`
const suggestions = ref<PlaceSuggestion[]>([])
const open = ref(false)
const active = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined
let pending: AbortController | undefined

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
  clearTimeout(timer)
  // Une requête toutes les 250 ms au plus pendant la frappe ; la précédente est abandonnée
  timer = setTimeout(async () => {
    pending?.abort()
    pending = new AbortController()
    try {
      suggestions.value = await suggestPlaces(value, pending.signal)
      active.value = -1
      open.value = suggestions.value.length > 0 && document.activeElement === field.value
    }
    catch {
      // Frappe suivante ou service indisponible : le champ reste utilisable sans suggestions
    }
  }, 250)
}

async function choose(s: PlaceSuggestion) {
  emit('update:modelValue', s.label)
  open.value = false
  suggestions.value = []
  emit('pick', await townCenter(s))
}

function onKey(e: KeyboardEvent) {
  const n = suggestions.value.length
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    open.value = true
    active.value = (active.value + 1) % n
  }
  else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    open.value = true
    active.value = (active.value - 1 + n) % n
  }
  else if (e.key === 'Escape') {
    open.value = false
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const s = open.value ? suggestions.value[active.value] : undefined
    if (s) choose(s)
    else {
      open.value = false
      emit('enter')
    }
  }
}

const field = ref<HTMLInputElement>()
onBeforeUnmount(() => {
  clearTimeout(timer)
  pending?.abort()
})
defineExpose({ focus: () => field.value?.focus() })
</script>

<style scoped>
.place-input { position: relative; min-width: 0; }
.place-input input { width: 100%; }
.suggestions { position: absolute; z-index: 1000; top: calc(100% + 4px); left: 0; min-width: min(340px, calc(100vw - 32px)); width: 100%; margin: 0; padding: 4px; list-style: none; background: var(--panel); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14); }
.suggestions li { display: flex; flex-direction: column; padding: 7px 10px; border-radius: 6px; cursor: pointer; }
.suggestions li.active { background: var(--panel-2); }
.label { font-weight: 600; color: var(--text); }
.detail { font-size: 0.8rem; color: var(--text-dim); }
</style>
