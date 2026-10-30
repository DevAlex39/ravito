<template>
  <div class="app-root">
    <header class="topbar screen-only">
      <div class="container bar">
        <Link href="/" class="logo" @click="clearTrack">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <path d="M3 26 L11 13 L16 20 L22 8 L29 26 Z" fill="#24503c" />
            <circle cx="22" cy="6" r="3" fill="#e2672b" />
          </svg>
          {{ APP_NAME }}
        </Link>
        <span class="tagline">{{ APP_TAGLINE }}</span>
        <nav class="account">
          <template v-if="user">
            <Link href="/mes-parcours" class="nav-link">Mes parcours</Link>
            <Link href="/deconnexion" method="post" as="button" class="nav-link quiet" :title="user.email ?? user.fullName ?? ''">Se déconnecter</Link>
          </template>
          <Link v-else href="/connexion" class="nav-link">Se connecter</Link>
        </nav>
      </div>
    </header>
    <main>
      <slot />
    </main>
    <footer class="screen-only">
      <div class="container">
        {{ APP_NAME }} · sans compte, tes fichiers restent dans ton navigateur · fonds de carte © OpenStreetMap / OpenTopoMap
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { APP_NAME, APP_TAGLINE } from '~/brand'
import { usePlan } from '~/composables/use_plan'
import { useAccount } from '~/composables/use_account'

const { restore, clearTrack } = usePlan()
restore()
const { user } = useAccount()
</script>

<style scoped>
.app-root { min-height: 100vh; display: flex; flex-direction: column; }
.topbar { height: var(--header-h); border-bottom: 1px solid var(--border); background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(6px); position: sticky; top: 0; z-index: 10; }
.bar { height: 100%; display: flex; align-items: center; gap: 16px; }
.logo { display: flex; align-items: center; gap: 8px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 1.6rem; color: var(--text); text-decoration: none; }
.tagline { color: var(--text-dim); font-size: 0.88rem; }
.account { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.nav-link { font: inherit; font-size: 0.9rem; font-weight: 600; color: var(--forest); text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; white-space: nowrap; }
.nav-link:hover { text-decoration: underline; }
.nav-link.quiet { color: var(--text-dim); font-weight: 500; }
main { flex: 1; padding: 28px 0 40px; }
footer { border-top: 1px solid var(--border); padding: 16px 0; font-size: 0.8rem; color: var(--text-dim); }
@media (max-width: 640px) { .tagline { display: none; } }
@media print { main { padding: 0; } }
</style>
