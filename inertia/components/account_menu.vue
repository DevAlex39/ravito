<template>
  <div ref="root" class="account-menu">
    <button
      type="button"
      class="trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      aria-label="Mon compte"
      :title="user.email ?? user.fullName ?? 'Mon compte'"
      @click="open = !open"
    >
      <span class="avatar">{{ initials }}</span>
      <Icon name="chevron" :size="14" class="caret" :class="{ flip: open }" />
    </button>
    <div v-if="open" class="panel" role="menu" @keydown.escape="close">
      <p class="who">
        <strong>{{ user.fullName || 'Connecté' }}</strong>
        <span v-if="user.email">{{ user.email }}</span>
      </p>
      <Link href="/mon-compte" role="menuitem" @click="close"><Icon name="user" :size="17" />Mon compte</Link>
      <Link href="/mes-parcours" role="menuitem" @click="close"><Icon name="route" :size="17" />Mes parcours</Link>
      <hr>
      <Link href="/deconnexion" method="post" as="button" role="menuitem" class="logout" @click="close"><Icon name="arrow" :size="17" />Se déconnecter</Link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '~/components/icon.vue'
import { userInitials, type AccountUser } from '~/composables/use_account'

/** Menu du compte dans l'en-tête : pastille aux initiales, accès au compte, aux parcours et déconnexion */
const props = defineProps<{ user: AccountUser }>()
const root = ref<HTMLElement | null>(null)
const open = ref(false)
const initials = computed(() => userInitials(props.user))

function close() {
  open.value = false
}

function onOutside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(open, (o) => {
  if (o) {
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('keydown', onKey)
  }
  else {
    document.removeEventListener('pointerdown', onOutside, true)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(close)
</script>

<style scoped>
.account-menu { position: relative; }
.trigger { display: flex; align-items: center; gap: 4px; padding: 3px 6px 3px 3px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--panel); cursor: pointer; color: var(--text-soft); }
.trigger:hover { border-color: var(--text-dim); }
.trigger:focus-visible { outline: 2px solid color-mix(in srgb, var(--forest) 35%, transparent); outline-offset: 2px; }
.avatar { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--forest); color: #fff; font-size: 0.82rem; font-weight: 700; }
.caret { transition: transform 0.15s; }
.flip { transform: rotate(180deg); }
.panel { position: absolute; right: 0; top: calc(100% + 8px); z-index: 1200; min-width: 230px; padding: 6px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 32px rgba(40, 35, 20, 0.16), 0 2px 6px rgba(40, 35, 20, 0.08); display: flex; flex-direction: column; animation: menu-in 0.12s ease-out; }
.who { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px 10px; margin: 0; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.who strong { font-size: 0.92rem; color: var(--text); }
.who span { font-size: 0.8rem; color: var(--text-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.panel a, .panel button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: none; border-radius: 8px; background: none; font: inherit; font-size: 0.92rem; color: var(--text); text-align: left; text-decoration: none; cursor: pointer; }
.panel a:hover, .panel button:hover { background: var(--panel-2); color: var(--forest); }
.panel .icon { color: var(--forest); }
.logout .icon { color: var(--text-dim); }
.logout:hover .icon { color: var(--bad); }
.logout:hover { color: var(--bad) !important; }
hr { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
@keyframes menu-in { from { opacity: 0; transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
</style>
