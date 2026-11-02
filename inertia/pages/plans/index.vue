<template>
  <DefaultLayout>
    <Head title="Mes parcours" />
    <div class="container plans">
      <div class="head">
        <div>
          <h1>Mes parcours</h1>
          <p v-if="plans.length" class="count">{{ plans.length }} parcours enregistré{{ plans.length > 1 ? 's' : '' }}</p>
        </div>
        <Link v-if="plans.length" href="/" class="btn" @click="clearTrack"><Icon name="plus" :size="16" />Nouveau plan</Link>
      </div>
      <p v-if="flash" class="flash">{{ flash }}</p>

      <div v-if="!plans.length" class="card empty">
        <span class="empty-icon"><Icon name="route" :size="28" /></span>
        <h2>Aucun parcours pour l'instant</h2>
        <p class="hint">Importe le GPX de ta course ou dessine ton parcours sur la carte, puis clique sur <strong>Enregistrer</strong> : il apparaîtra ici, sur tous tes appareils.</p>
        <div class="empty-actions">
          <Link href="/" class="btn" @click="clearTrack"><Icon name="upload" :size="16" />Importer un GPX</Link>
          <Link href="/tracer" class="btn ghost"><Icon name="pencil" :size="16" />Créer une trace</Link>
        </div>
      </div>

      <ul v-else class="list">
        <li v-for="p in plans" :key="p.id" class="card item">
          <Link :href="`/parcours/${p.id}`" class="open">
            <strong class="name">{{ p.name }}</strong>
            <span class="stats">
              <span class="stat"><Icon name="route" :size="15" /><span class="num">{{ formatKm(p.distance) }} km</span></span>
              <span class="stat"><Icon name="mountain" :size="15" /><span class="num">+{{ p.gain }} m</span></span>
              <span v-if="p.duration != null" class="stat"><Icon name="clock" :size="15" /><span class="num">{{ formatDuration(p.duration) }}</span></span>
            </span>
          </Link>
          <div class="foot">
            <button
              type="button"
              class="share"
              :class="{ on: p.isPublic }"
              :title="p.isPublic ? 'Visible de tous : clique pour le rendre privé' : 'Toi seul le vois : clique pour le partager avec les autres coureurs'"
              @click="toggleShare(p)"
            >
              <Icon :name="p.isPublic ? 'globe' : 'lock'" :size="14" />{{ p.isPublic ? 'Partagé' : 'Privé' }}
            </button>
            <Link v-if="p.isPublic" :href="`/partages/${p.id}`" class="public-link"><Icon name="thumb" :size="14" />{{ p.votes }} · voir la page</Link>
            <span class="date">Modifié {{ formatDate(p.updatedAt) }}</span>
            <button class="remove" type="button" :title="`Supprimer « ${p.name} »`" :aria-label="`Supprimer « ${p.name} »`" @click="remove(p)">
              <Icon name="trash" :size="17" />
            </button>
          </div>
        </li>
      </ul>

      <section v-if="favorites.length" class="favorites">
        <h2><Icon name="star" :size="20" class="fav-icon" />Boucles favorites</h2>
        <ul class="list">
          <li v-for="f in favorites" :key="f.id" class="card item">
            <Link :href="f.url" class="open">
              <strong class="name">{{ f.name }}</strong>
              <span class="stats">
                <span class="stat"><Icon name="route" :size="15" /><span class="num">{{ formatKm(f.distance) }} km</span></span>
                <span class="stat"><Icon name="mountain" :size="15" /><span class="num">+{{ f.gain }} m</span></span>
                <span class="stat"><Icon name="star" :size="15" /><span class="num">{{ f.stops ? `${f.stops} lieu${f.stops > 1 ? 'x' : ''}` : 'sans lieu' }}</span></span>
              </span>
            </Link>
            <div class="foot">
              <span class="date">Ajoutée {{ formatDate(f.createdAt) }}</span>
              <button class="remove" type="button" :title="`Retirer « ${f.name} » des favoris`" :aria-label="`Retirer « ${f.name} » des favoris`" @click="removeFavorite(f)">
                <Icon name="trash" :size="17" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import Icon from '~/components/icon.vue'
import { usePlan } from '~/composables/use_plan'
import { formatDuration, formatKm } from '~/utils/format'

type PlanItem = {
  id: number
  name: string
  distance: number
  gain: number
  duration: number | null
  isPublic: boolean
  votes: number
  updatedAt: string
}

type FavoriteItem = {
  id: number
  /** Lien de la boucle (/boucles?…) */
  url: string
  name: string
  distance: number
  gain: number
  stops: number
  createdAt: string
}

defineProps<{ plans: PlanItem[], favorites: FavoriteItem[] }>()

const { planId, clearTrack } = usePlan()

const page = usePage()
const flash = computed(() => (page.flash as { success?: string } | undefined)?.success)

function formatDate(iso: string) {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return `aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

function toggleShare(p: PlanItem) {
  if (!p.isPublic && !confirm(`Partager « ${p.name} » ? Sa trace (pas tes allures ni tes ravitos) sera visible de tous et proposée aux coureurs qui cherchent autour de son départ. Les heures, les données de montre et les 250 premiers et derniers mètres sont retirés de la version publique.`)) return
  router.patch(`/parcours/${p.id}/partage`, { public: !p.isPublic }, { preserveScroll: true })
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

function removeFavorite(f: FavoriteItem) {
  if (!confirm(`Retirer « ${f.name} » de tes boucles favorites ?`)) return
  router.delete(`/favoris/${f.id}`, { preserveScroll: true })
}
</script>

<style scoped>
.plans { max-width: 820px; display: flex; flex-direction: column; gap: 16px; }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.head h1 { font-size: 2.2rem; margin: 0; }
.count { margin: 2px 0 0; color: var(--text-soft); font-size: 0.92rem; }
.btn { display: inline-flex; align-items: center; gap: 7px; text-decoration: none; }
.flash { background: var(--forest-soft); color: var(--forest); border-radius: 10px; padding: 10px 12px; font-size: 0.9rem; margin: 0; }

.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 40px 24px; }
.empty-icon { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 18px; background: var(--forest-soft); color: var(--forest); }
.empty h2 { font-size: 1.5rem; margin: 4px 0 0; }
.empty .hint { max-width: 460px; color: var(--text-soft); font-size: 0.93rem; line-height: 1.5; margin: 0; }
.empty-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.empty-actions .btn { padding: 10px 16px; }

.list { list-style: none; display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; }
.item { padding: 0; overflow: hidden; transition: box-shadow 0.15s, border-color 0.15s; }
.item:hover { border-color: var(--border-strong); }
.open { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px 12px; color: var(--text); text-decoration: none; }
.name { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; line-height: 1.15; overflow-wrap: anywhere; }
.open:hover .name { color: var(--accent); }
.stats { display: flex; flex-wrap: wrap; gap: 6px; }
.stat { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px; background: var(--panel-2); color: var(--text); font-size: 0.86rem; font-weight: 600; }
.stat .icon { color: var(--forest); }

.foot { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding: 10px 12px 10px 18px; border-top: 1px solid var(--border); background: color-mix(in srgb, var(--panel-2) 50%, transparent); }
.share { display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 0.8rem; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--panel); color: var(--text-soft); cursor: pointer; white-space: nowrap; }
.share:hover { border-color: var(--forest); color: var(--forest); }
.share.on { background: var(--forest); border-color: var(--forest); color: #fff; }
.public-link { display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; color: var(--forest); text-decoration: none; white-space: nowrap; }
.public-link:hover { text-decoration: underline; }
.date { color: var(--text-dim); font-size: 0.8rem; margin-left: auto; white-space: nowrap; }
.remove { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: none; border-radius: 8px; background: none; color: var(--text-dim); cursor: pointer; }
.remove:hover { color: var(--bad); background: var(--bad-bg); }

.favorites { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.favorites h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.6rem; }
.fav-icon { color: #e0a100; fill: currentColor; }

@media (max-width: 520px) {
  .head h1 { font-size: 2rem; }
  .date { margin-left: 0; order: 3; flex-basis: 100%; }
  .remove { margin-left: auto; }
}
</style>
