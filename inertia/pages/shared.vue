<template>
  <DefaultLayout>
    <Head :title="parcours.name" />
    <div class="container shared">
      <div class="head">
        <div>
          <p class="kicker">Parcours partagé</p>
          <h1>{{ parcours.name }}</h1>
          <p class="meta num">{{ formatKm(parcours.distance) }} km · +{{ parcours.gain }} m</p>
        </div>
        <div class="vote">
          <span v-if="parcours.mine" class="votes" title="Les votes des autres coureurs">👍 {{ votesText }}</span>
          <button v-else-if="user" type="button" class="btn" :class="{ ghost: !parcours.voted }" :disabled="voting" @click="vote">
            👍 {{ parcours.voted ? 'Tu aimes' : 'J\'aime' }} · {{ parcours.votes }}
          </button>
          <Link v-else :href="`/connexion?next=${encodeURIComponent(`/partages/${parcours.id}`)}`" class="btn ghost">👍 {{ parcours.votes }} · Connecte-toi pour voter</Link>
        </div>
      </div>

      <p v-if="parcours.mine && !parcours.isPublic" class="notice">
        🔒 Ce parcours est privé : toi seul peux voir cette page. Rends-le public depuis <Link href="/mes-parcours">Mes parcours</Link>.
      </p>
      <p v-else-if="parcours.mine" class="notice">
        🌍 C'est ton parcours : il est proposé aux coureurs qui cherchent une boucle autour de son départ.
      </p>

      <p v-if="!track" class="notice bad">La trace de ce parcours est illisible.</p>
      <template v-else>
        <section class="card">
          <CourseMap v-model:hover="hoverD" class="map" :track="track" :segments="segments" :markers="[]" />
          <ElevationProfile v-model:hover="hoverD" :profile="profile!" :segments="segments" :height="160" />
        </section>

        <section class="card actions">
          <button class="btn ghost" type="button" @click="copyLink">{{ copied ? 'Lien copié ✓' : '🔗 Copier le lien' }}</button>
          <button class="btn ghost" type="button" @click="download">Télécharger le GPX</button>
          <button class="btn" type="button" @click="useForPlan">Préparer ma course avec ce parcours →</button>
        </section>

        <Link :href="`/boucles?lat=${track.points[0]!.lat.toFixed(5)}&lon=${track.points[0]!.lon.toFixed(5)}`" class="back">
          ← Voir d'autres boucles autour de ce départ
        </Link>
      </template>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import CourseMap from '~/components/course_map.vue'
import ElevationProfile from '~/components/elevation_profile.vue'
import { usePlan } from '~/composables/use_plan'
import { useAccount } from '~/composables/use_account'
import { parseGpx, type Track } from '~/utils/gpx'
import { buildProfile } from '~/utils/profile'
import { autoBoundaries, computeSegments } from '~/utils/segments'
import { formatKm } from '~/utils/format'

type SharedPlan = {
  id: number
  name: string
  distance: number
  gain: number
  gpxText: string
  votes: number
  voted: boolean
  mine: boolean
  isPublic: boolean
}

const props = defineProps<{ parcours: SharedPlan }>()

const plan = usePlan()
const { user } = useAccount()
const hoverD = ref<number | null>(null)

const track = computed<Track | null>(() => {
  try {
    return parseGpx(props.parcours.gpxText)
  }
  catch {
    return null
  }
})
const profile = computed(() => (track.value ? buildProfile(track.value) : null))
const segments = computed(() => (profile.value ? computeSegments(profile.value, autoBoundaries(profile.value)) : []))
const votesText = computed(() => `${props.parcours.votes} vote${props.parcours.votes > 1 ? 's' : ''}`)

const voting = ref(false)
function vote() {
  router.post(`/partages/${props.parcours.id}/vote`, {}, {
    preserveScroll: true,
    onStart: () => (voting.value = true),
    onFinish: () => (voting.value = false),
  })
}

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  }
  catch {
    // Presse-papiers refusé : l'adresse reste dans la barre du navigateur
    prompt('Copie ce lien :', window.location.href)
  }
}

function fileName() {
  return `${props.parcours.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'parcours'}.gpx`
}

function download() {
  const url = URL.createObjectURL(new Blob([props.parcours.gpxText], { type: 'application/gpx+xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName()
  a.click()
  URL.revokeObjectURL(url)
}

/** La trace devient un nouveau plan dans ce navigateur (rien n'est modifié chez l'auteur) */
function useForPlan() {
  if (plan.loadGpx(props.parcours.gpxText, fileName())) router.visit('/')
}
</script>

<style scoped>
.shared { max-width: 980px; display: flex; flex-direction: column; gap: 16px; }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.kicker { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--forest); }
.head h1 { font-size: 2.2rem; }
.meta { color: var(--text-soft); font-weight: 600; }
.vote .btn { text-decoration: none; }
.votes { font-weight: 600; color: var(--text-soft); }
.notice { font-size: 0.9rem; background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px; }
.notice a { color: var(--accent); font-weight: 600; }
.notice.bad { color: var(--bad); }
.card { display: flex; flex-direction: column; gap: 12px; }
.map { height: 50vh; min-height: 320px; }
.actions { flex-direction: row; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.back { color: var(--forest); font-weight: 600; font-size: 0.9rem; }
@media (max-width: 640px) {
  .actions .btn { flex: 1 1 100%; }
}
</style>
