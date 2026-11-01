<template>
  <div ref="root" class="pick-list" v-bind="$attrs">
    <button
      ref="trigger"
      type="button"
      class="trigger"
      :aria-label="label"
      :title="title"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <!-- Contenu du bouton au choix de la page ; par défaut, le libellé de l'option choisie et une flèche -->
      <slot :current="current" :open="open">
        <span class="label">{{ current?.label }}</span>
        <Icon name="chevron" :size="14" class="caret" :class="{ flip: open }" />
      </slot>
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        ref="panel"
        class="pick-panel"
        role="listbox"
        :aria-label="label"
        :style="panelStyle"
        tabindex="-1"
        @keydown="onPanelKey"
      >
        <li
          v-for="(o, i) in options"
          :key="String(o.value)"
          role="option"
          :aria-selected="o.value === modelValue"
          :class="{ on: o.value === modelValue, active: i === active }"
          @mouseenter="active = i"
          @click="choose(o.value)"
        >
          <Icon v-if="o.icon" :name="o.icon" :size="16" class="opt-icon" />
          <span class="opt-text">
            <span class="opt-label">{{ o.label }}</span>
            <span v-if="o.hint" class="opt-hint">{{ o.hint }}</span>
          </span>
          <span v-if="o.side" class="opt-side num">{{ o.side }}</span>
          <Icon name="check" :size="16" class="opt-check" />
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import Icon from '~/components/icon.vue'
import type { PickOption } from '~/utils/pick_list'

/**
 * Liste déroulante aux couleurs du site (remplace le <select> du navigateur, impossible à habiller) :
 * options avec icône, précision et valeur à droite (ex. durée selon l'allure), clavier et clic en dehors.
 */

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: T, options: PickOption<T>[], label: string, title?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: T], 'change': [value: T] }>()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
/** Option survolée ou choisie au clavier */
const active = ref(0)
const panelStyle = ref<Record<string, string>>({})

const current = computed(() => props.options.find(o => o.value === props.modelValue))

/** Place la liste sous le champ (bord à bord), ou au-dessus s'il n'y a pas la place en bas de l'écran */
function place() {
  const r = root.value?.getBoundingClientRect()
  if (!r) return
  const below = window.innerHeight - r.bottom - 12
  const above = r.top - 12
  const up = below < 260 && above > below
  const maxHeight = Math.max(160, Math.min(320, up ? above : below))
  const width = Math.max(r.width, 200)
  const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
  panelStyle.value = {
    left: `${left}px`,
    minWidth: `${width}px`,
    maxHeight: `${maxHeight}px`,
    ...(up ? { bottom: `${window.innerHeight - r.top + 6}px` } : { top: `${r.bottom + 6}px` }),
  }
}

async function show() {
  active.value = Math.max(0, props.options.findIndex(o => o.value === props.modelValue))
  place()
  open.value = true
  document.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', onScroll, true)
  await nextTick()
  panel.value?.focus({ preventScroll: true })
  // À l'ouverture, l'option choisie au milieu : on voit les choix d'à côté, au-dessus comme en dessous
  scrollToActive('center')
}

function close() {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', onScroll, true)
}

function toggle() {
  if (open.value) close()
  else show()
}

function choose(value: T) {
  close()
  trigger.value?.focus()
  if (value === props.modelValue) return
  emit('update:modelValue', value)
  emit('change', value)
}

function onOutside(e: PointerEvent) {
  const t = e.target as Node
  if (!root.value?.contains(t) && !panel.value?.contains(t)) close()
}

/** Défilement de la page : la liste suit son bouton (le défilement dans la liste elle-même ne compte pas) */
function onScroll(e: Event) {
  if (panel.value?.contains(e.target as Node)) return
  place()
}

function scrollToActive(block: ScrollLogicalPosition = 'nearest') {
  const item = panel.value?.children[active.value] as HTMLElement | undefined
  const list = panel.value
  if (!item || !list) return
  // Défilement de la liste seule (scrollIntoView ferait aussi défiler la page)
  if (block === 'center') list.scrollTop = item.offsetTop - (list.clientHeight - item.offsetHeight) / 2
  else if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
  else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
}

function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    show()
  }
}

function onPanelKey(e: KeyboardEvent) {
  const last = props.options.length - 1
  const moves: Record<string, number> = { ArrowDown: active.value + 1, ArrowUp: active.value - 1, Home: 0, End: last, PageDown: active.value + 5, PageUp: active.value - 5 }
  if (e.key in moves) {
    e.preventDefault()
    active.value = Math.min(last, Math.max(0, moves[e.key]!))
    scrollToActive()
  }
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    const o = props.options[active.value]
    if (o) choose(o.value)
  }
  else if (e.key === 'Escape' || e.key === 'Tab') {
    e.preventDefault()
    close()
    trigger.value?.focus()
  }
}

onBeforeUnmount(close)
</script>

<style scoped>
.pick-list { position: relative; display: inline-flex; }
.trigger { display: inline-flex; align-items: center; gap: 6px; width: 100%; min-width: 0; padding: 0; border: none; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.trigger:focus-visible { outline: 2px solid color-mix(in srgb, var(--forest) 35%, transparent); outline-offset: 3px; border-radius: 6px; }
.label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.caret { opacity: 0.6; transition: transform 0.15s; }
.flip { transform: rotate(180deg); }
</style>

<!-- La liste est déplacée dans <body> (au-dessus de la carte et des cartes à bords arrondis) : style non limité au composant -->
<style>
.pick-panel { position: fixed; z-index: 1300; margin: 0; padding: 6px; list-style: none; overflow-y: auto; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 32px rgba(40, 35, 20, 0.16), 0 2px 6px rgba(40, 35, 20, 0.08); outline: none; overscroll-behavior: contain; animation: pick-in 0.12s ease-out; }
.pick-panel li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; font-size: 0.92rem; color: var(--text); cursor: pointer; }
.pick-panel li.active { background: var(--panel-2); }
.pick-panel li.on { background: var(--forest-soft); color: var(--forest); font-weight: 600; }
.pick-panel .opt-icon { color: var(--forest); }
.pick-panel .opt-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.pick-panel .opt-hint { font-size: 0.78rem; font-weight: 400; color: var(--text-soft); }
.pick-panel .opt-side { font-size: 0.85rem; color: var(--text-soft); white-space: nowrap; }
.pick-panel li.on .opt-side { color: var(--forest); }
.pick-panel .opt-check { color: var(--forest); }
.pick-panel li:not(.on) .opt-check { visibility: hidden; }
@keyframes pick-in { from { opacity: 0; transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { .pick-panel { animation: none; } }
</style>
