<template>
  <div class="app-root">
    <header class="topbar screen-only">
      <div class="container bar">
        <Link href="/" class="logo" @click="clearTrack">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <circle cx="16" cy="16" r="15" fill="#24503c" />
            <path d="M7 22l6-9 4 5 3-4 5 8z" fill="#f5f2ea" />
            <circle cx="21.5" cy="10" r="2.2" fill="#e2672b" />
          </svg>
          {{ APP_NAME }}
          <span class="beta" title="Le site est en cours de construction : certaines choses peuvent encore changer ou mal fonctionner">Bêta</span>
        </Link>
        <nav class="menu" aria-label="Rubriques">
          <Link href="/boucles" :class="{ on: page.url.startsWith('/boucles') }">Boucles</Link>
          <Link href="/tracer" :class="{ on: page.url.startsWith('/tracer') }">Tracer</Link>
          <Link v-if="user" href="/mes-parcours" :class="{ on: page.url.startsWith('/mes-parcours') }">Mes parcours</Link>
        </nav>
        <nav class="account">
          <Link v-if="user" href="/deconnexion" method="post" as="button" class="nav-link quiet" :title="user.email ?? user.fullName ?? ''">Se déconnecter</Link>
          <Link v-else href="/connexion" class="nav-link pill">Se connecter</Link>
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
import { Link, usePage } from '@inertiajs/vue3'
import { APP_NAME } from '~/brand'
import { usePlan } from '~/composables/use_plan'
import { useAccount } from '~/composables/use_account'

const page = usePage()
const { restore, clearTrack } = usePlan()
restore()
const { user } = useAccount()
</script>

<style scoped>
.app-root { min-height: 100vh; display: flex; flex-direction: column; }
.topbar { height: var(--header-h); border-bottom: 1px solid var(--border); background: rgba(250, 248, 243, 0.92); backdrop-filter: blur(6px); position: sticky; top: 0; z-index: 1100; }
.bar { height: 100%; display: flex; align-items: center; gap: 28px; }
.logo { display: flex; align-items: center; gap: 9px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 1.75rem; color: var(--text); text-decoration: none; }
.beta { font-family: 'Inter', system-ui, sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; background: var(--accent); border-radius: 999px; padding: 2px 8px; align-self: center; }
.menu { display: flex; gap: 22px; }
.menu a { font-size: 0.95rem; color: var(--text-soft); text-decoration: none; padding: 6px 0; border-bottom: 2px solid transparent; }
.menu a:hover { color: var(--text); }
.menu a.on { color: var(--text); font-weight: 600; border-bottom-color: var(--accent); }
.account { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.nav-link { font: inherit; font-size: 0.9rem; font-weight: 600; color: var(--forest); text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; white-space: nowrap; }
.nav-link:hover { text-decoration: underline; }
.nav-link.quiet { color: var(--text-dim); font-weight: 500; }
.nav-link.pill { color: var(--text); border: 1px solid var(--border-strong); border-radius: 999px; padding: 7px 16px; }
.nav-link.pill:hover { text-decoration: none; background: var(--panel); }
main { flex: 1; padding: 28px 0 40px; }
footer { border-top: 1px solid var(--border); padding: 16px 0; font-size: 0.8rem; color: var(--text-dim); }
@media (max-width: 640px) {
  .bar { gap: 14px; }
  .logo { font-size: 1.5rem; }
  .beta { display: none; }
  .menu { gap: 14px; }
  .nav-link.pill { padding: 6px 12px; }
}
@media print { main { padding: 0; } }
</style>
