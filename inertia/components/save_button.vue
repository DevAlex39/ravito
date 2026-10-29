<template>
  <button v-if="planId == null" class="btn ghost" type="button" :disabled="syncState === 'saving'" @click="saveToAccount">
    {{ syncState === 'saving' ? 'Enregistrement…' : 'Enregistrer' }}
  </button>
  <span v-else class="status" :class="syncState" :title="syncState === 'error' ? syncError : undefined">
    <template v-if="syncState === 'saving'">Enregistrement…</template>
    <template v-else-if="syncState === 'error'">
      Non enregistré
      <button class="link" type="button" @click="saveToAccount">Réessayer</button>
    </template>
    <template v-else>✓ Enregistré dans <Link href="/mes-parcours">mes parcours</Link></template>
  </span>
  <p v-if="syncState === 'error' && syncError" class="err">{{ syncError }}</p>
</template>

<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { useAccount } from '~/composables/use_account'
import { usePlan } from '~/composables/use_plan'

const { planId } = usePlan()
const { syncState, syncError, saveToAccount } = useAccount()
</script>

<style scoped>
.status { align-self: center; font-size: 0.88rem; color: var(--forest); font-weight: 600; white-space: nowrap; }
.status a { color: inherit; }
.status.saving { color: var(--text-dim); }
.status.error { color: var(--bad); }
.link { font: inherit; background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; padding: 0 0 0 4px; }
.err { flex-basis: 100%; font-size: 0.82rem; color: var(--bad); text-align: right; }
</style>
