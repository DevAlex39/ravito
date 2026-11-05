<template>
  <button
    type="button"
    class="theme-toggle"
    :title="dark ? 'Passer en thème clair' : 'Passer en thème sombre'"
    :aria-label="dark ? 'Passer en thème clair' : 'Passer en thème sombre'"
    @click="toggle"
  >
    <!-- Lune en clair (on propose le sombre), soleil en sombre -->
    <svg v-if="!dark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
    </svg>
    <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

/**
 * Thème clair / sombre. Sans choix enregistré, le site suit le réglage de l'appareil (CSS prefers-color-scheme) ;
 * un clic enregistre le choix contraire dans le navigateur. Le script du <head> (inertia_layout.edge) l'applique
 * avant le premier affichage, pour éviter un éclair blanc.
 */
const KEY = 'alpast:theme'
const dark = ref(false)

function systemDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

onMounted(() => {
  const chosen = document.documentElement.dataset.theme
  dark.value = chosen ? chosen === 'dark' : systemDark()
})

function toggle() {
  dark.value = !dark.value
  const theme = dark.value ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  try {
    // Revenir au réglage de l'appareil quand le choix lui correspond : le site suivra ses changements
    if (dark.value === systemDark()) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  }
  catch {
    // Navigation privée ou stockage bloqué : le choix vaut pour cette page seulement
  }
}
</script>

<style scoped>
.theme-toggle {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: none;
  color: var(--text-soft);
  cursor: pointer;
}
.theme-toggle:hover { color: var(--text); border-color: var(--text-dim); }
</style>
