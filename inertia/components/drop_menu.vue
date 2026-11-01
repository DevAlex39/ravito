<template>
  <div ref="root" class="drop-menu">
    <button type="button" class="btn" :disabled="disabled" :aria-expanded="open" aria-haspopup="menu" @click="open = !open">
      <slot />
      <Icon name="chevron" :size="15" class="caret" :class="{ flip: open }" />
    </button>
    <div v-if="open" class="panel" role="menu">
      <button v-for="item in items" :key="item.label" type="button" role="menuitem" @click="choose(item)">
        <Icon :name="item.icon" :size="18" />
        <span class="text">
          <strong>{{ item.label }}</strong>
          <small v-if="item.hint">{{ item.hint }}</small>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import Icon from '~/components/icon.vue'
import type { IconName } from '~/utils/icons'

export interface DropMenuItem { label: string, hint?: string, icon: IconName, action: () => void }

/** Bouton principal qui ouvre une courte liste de choix (ex. Imprimer : fiche ou bracelet) */
defineProps<{ items: DropMenuItem[], disabled?: boolean }>()
const root = ref<HTMLElement | null>(null)
const open = ref(false)

function choose(item: DropMenuItem) {
  open.value = false
  item.action()
}

function onOutside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

watch(open, (o) => {
  const method = o ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onOutside as EventListener, true)
  document[method]('keydown', onKey as EventListener)
})
onBeforeUnmount(() => (open.value = false))
</script>

<style scoped>
.drop-menu { position: relative; display: inline-flex; }
.btn { display: inline-flex; align-items: center; gap: 8px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.caret { transition: transform 0.15s; }
.flip { transform: rotate(180deg); }
.panel { position: absolute; right: 0; top: calc(100% + 6px); z-index: 1200; min-width: 250px; padding: 6px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 32px rgba(40, 35, 20, 0.16), 0 2px 6px rgba(40, 35, 20, 0.08); display: flex; flex-direction: column; animation: menu-in 0.12s ease-out; }
.panel button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px; border: none; border-radius: 8px; background: none; font: inherit; color: var(--text); text-align: left; cursor: pointer; }
.panel button:hover { background: var(--panel-2); }
.panel .icon { color: var(--forest); flex: none; }
.text { display: flex; flex-direction: column; }
.text strong { font-size: 0.92rem; }
.text small { font-size: 0.8rem; color: var(--text-soft); }
@keyframes menu-in { from { opacity: 0; transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
@media (max-width: 640px) { .panel { left: 0; right: auto; } }
</style>
