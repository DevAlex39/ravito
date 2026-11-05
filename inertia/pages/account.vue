<template>
  <DefaultLayout>
    <Head title="Mon compte" />
    <div class="container account-page">
      <h1>Mon compte</h1>

      <section class="card who">
        <span class="avatar">{{ initials }}</span>
        <div class="who-text">
          <strong>{{ user?.fullName || user?.email }}</strong>
          <span v-if="user?.fullName && user?.email">{{ user.email }}</span>
          <span v-if="since" class="since">Membre depuis {{ since }}</span>
        </div>
      </section>

      <nav class="card links" aria-label="Mon espace">
        <Link href="/mes-parcours"><Icon name="route" :size="18" />Mes parcours<Icon name="arrow" :size="16" class="go" /></Link>
      </nav>

      <section class="card danger-zone">
        <h2>Supprimer mon compte</h2>
        <p class="hint">Tes parcours, tes partages et tes votes seront effacés définitivement.</p>
        <button type="button" class="danger" @click="deleteAccount">Supprimer mon compte</button>
      </section>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import Icon from '~/components/icon.vue'
import { usePlan } from '~/composables/use_plan'
import { useAccount, userInitials } from '~/composables/use_account'

const { planId } = usePlan()
const { user } = useAccount()
const initials = computed(() => userInitials(user.value))
const since = computed(() => {
  const created = user.value?.createdAt
  return created ? new Date(created).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : ''
})

function deleteAccount() {
  if (!confirm('Supprimer définitivement ton compte ? Tous tes parcours, partages et votes seront effacés. Cette action ne peut pas être annulée.')) return
  router.delete('/compte', {
    // Le plan ouvert dans le navigateur n'est plus relié à aucun compte
    onSuccess: () => (planId.value = null),
  })
}
</script>

<style scoped>
.account-page { max-width: 640px; display: flex; flex-direction: column; gap: 16px; }
h1 { font-size: 2.2rem; margin: 0; }
.who { display: flex; align-items: center; gap: 16px; padding: 20px; }
.avatar { flex: none; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--forest-fill); color: #fff; font-weight: 700; font-size: 1.3rem; text-transform: uppercase; }
.who-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.who-text strong { font-size: 1.05rem; overflow: hidden; text-overflow: ellipsis; }
.who-text span { color: var(--text-soft); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; }
.who-text .since { color: var(--text-dim); font-size: 0.82rem; }
.links { padding: 6px; }
.links a { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; color: var(--text); font-weight: 600; text-decoration: none; }
.links a:hover { background: var(--panel-2); color: var(--forest); }
.links .icon { color: var(--forest); }
.links .go { margin-left: auto; color: var(--text-dim); }
.danger-zone { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 18px 20px; }
.danger-zone h2 { font-size: 1.2rem; margin: 0; }
.hint { font-size: 0.88rem; color: var(--text-soft); margin: 0; }
.danger { font: inherit; font-size: 0.9rem; font-weight: 600; padding: 8px 14px; border-radius: 10px; border: 1px solid var(--bad); background: none; color: var(--bad); cursor: pointer; margin-top: 4px; }
.danger:hover { background: var(--bad); color: #fff; }
</style>
