<template>
  <DefaultLayout>
    <Head title="Mes parcours" />
    <div class="container plans">
      <div class="head">
        <h1>Mes parcours</h1>
        <Link href="/" class="btn" @click="clearTrack">+ Nouveau plan</Link>
      </div>
      <p v-if="flash" class="flash">{{ flash }}</p>

      <div v-if="!plans.length" class="card empty">
        <p>Tu n'as encore aucun parcours enregistré.</p>
        <p class="hint">
          Importe un GPX ou <Link href="/tracer">trace ton parcours sur la carte</Link>,
          puis clique sur <strong>Enregistrer</strong> : il apparaîtra ici.
        </p>
      </div>

      <ul v-else class="list">
        <li v-for="p in plans" :key="p.id" class="card item">
          <Link :href="`/parcours/${p.id}`" class="open">
            <strong class="name">{{ p.name }}</strong>
            <span class="meta num">
              {{ formatKm(p.distance) }} km · +{{ p.gain }} m<template v-if="p.duration != null"> · {{ formatDuration(p.duration) }}</template>
            </span>
            <span class="date">Modifié {{ formatDate(p.updatedAt) }}</span>
          </Link>
          <button class="btn icon" type="button" :title="`Supprimer « ${p.name} »`" @click="remove(p)">✕</button>
        </li>
      </ul>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import { usePlan } from '~/composables/use_plan'
import { formatDuration, formatKm } from '~/utils/format'

type PlanItem = {
  id: number
  name: string
  distance: number
  gain: number
  duration: number | null
  updatedAt: string
}

defineProps<{ plans: PlanItem[] }>()

const { planId, clearTrack } = usePlan()
const page = usePage()
const flash = computed(() => (page.flash as { success?: string } | undefined)?.success)

function formatDate(iso: string) {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return `aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

function remove(p: PlanItem) {
  if (!confirm(`Supprimer « ${p.name} » ? Cette action est définitive.`)) return
  router.delete(`/parcours/${p.id}`, {
    preserveScroll: true,
    // Le plan ouvert dans le navigateur n'est plus relié au compte
    onSuccess: () => {
      if (planId.value === p.id) planId.value = null
    },
  })
}
</script>

<style scoped>
.plans { max-width: 820px; display: flex; flex-direction: column; gap: 16px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.head h1 { font-size: 2.2rem; }
.head .btn { text-decoration: none; }
.flash { background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 0.9rem; }
.empty { text-align: center; display: flex; flex-direction: column; gap: 6px; padding: 32px 20px; }
.empty a { color: var(--accent); font-weight: 600; }
.list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.item { display: flex; align-items: center; gap: 12px; padding: 0; }
.open { flex: 1; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 16px; padding: 14px 16px; color: var(--text); text-decoration: none; }
.open:hover .name { color: var(--accent); }
.name { font-family: 'Barlow Condensed', sans-serif; font-size: 1.3rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { color: var(--text-soft); font-size: 0.92rem; align-self: center; white-space: nowrap; }
.date { grid-column: 1 / -1; color: var(--text-dim); font-size: 0.8rem; }
.item .btn.icon { margin-right: 12px; }
@media (max-width: 640px) {
  .open { grid-template-columns: minmax(0, 1fr); }
}
</style>
