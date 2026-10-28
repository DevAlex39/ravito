<template>
  <div class="app-root">
    <NuxtRouteAnnouncer />
    <header class="topbar screen-only">
      <div class="container bar">
        <a href="/" class="logo" @click.prevent="clearTrack">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <path d="M3 26 L11 13 L16 20 L22 8 L29 26 Z" fill="#24503c" />
            <circle cx="22" cy="6" r="3" fill="#e2672b" />
          </svg>
          Ravito
        </a>
        <span class="tagline">Ton plan de course à partir d'un GPX</span>
      </div>
    </header>
    <main>
      <NuxtPage />
    </main>
    <footer class="screen-only">
      <div class="container">
        Ravito · tes fichiers restent dans ton navigateur · fonds de carte © OpenStreetMap / OpenTopoMap
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { restore, clearTrack } = usePlan()
restore()
</script>

<style scoped>
.app-root { min-height: 100vh; display: flex; flex-direction: column; }
.topbar { height: var(--header-h); border-bottom: 1px solid var(--border); background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(6px); position: sticky; top: 0; z-index: 10; }
.bar { height: 100%; display: flex; align-items: center; gap: 16px; }
.logo { display: flex; align-items: center; gap: 8px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 1.6rem; color: var(--text); text-decoration: none; }
.tagline { color: var(--text-dim); font-size: 0.88rem; }
main { flex: 1; padding: 28px 0 40px; }
footer { border-top: 1px solid var(--border); padding: 16px 0; font-size: 0.8rem; color: var(--text-dim); }
@media (max-width: 640px) { .tagline { display: none; } }
@media print { main { padding: 0; } }
</style>
