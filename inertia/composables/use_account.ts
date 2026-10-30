import { computed, effectScope, ref, watch, type ComputedRef } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { usePlan } from '~/composables/use_plan'

export type SyncState = 'idle' | 'saving' | 'saved' | 'error'

/** Après connexion, le plan en cours est enregistré tout seul si l'utilisateur l'avait demandé */
const SAVE_AFTER_LOGIN = 'alpas:enregistrer-apres-connexion'

const syncState = ref<SyncState>('idle')
const syncError = ref('')
/** Dernière version envoyée : évite de renvoyer un plan identique */
let lastSent = ''
let timer: ReturnType<typeof setTimeout> | undefined
let user: ComputedRef<{ id: number, email: string | null, fullName: string | null } | null> | null = null

function xsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]!) : ''
}

function payload() {
  const plan = usePlan()
  const finish = plan.timeline.value[plan.timeline.value.length - 1]
  return {
    name: plan.planName.value,
    distance: plan.profile.value?.distance ?? 0,
    gain: plan.profile.value?.gain ?? 0,
    duration: plan.totalRun.value != null && finish ? finish.arrival - plan.startSec.value : null,
    data: JSON.stringify(plan.serialize()),
  }
}

/** Envoie le plan courant au compte : le crée la première fois, le met à jour ensuite */
async function push() {
  const plan = usePlan()
  if (!user?.value || !plan.track.value) return
  const body = payload()
  const id = plan.planId.value
  if (id != null && body.data === lastSent) {
    syncState.value = 'saved'
    return
  }
  syncState.value = 'saving'
  try {
    const res = await fetch(id == null ? '/parcours' : `/parcours/${id}`, {
      method: id == null ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-XSRF-TOKEN': xsrfToken() },
      body: JSON.stringify(body),
    })
    if (res.status === 404) {
      // Supprimé entre-temps (ou appartenant à un autre compte) : il redevient un plan non enregistré
      plan.planId.value = null
      syncState.value = 'idle'
      return
    }
    if (res.status === 401) throw new Error('Ta session a expiré : reconnecte-toi pour enregistrer.')
    if (!res.ok) throw new Error('L\'enregistrement a échoué, réessaie dans un instant.')
    const { id: newId } = await res.json() as { id: number }
    lastSent = body.data
    plan.planId.value = newId
    syncState.value = 'saved'
    syncError.value = ''
  }
  catch (e) {
    syncState.value = 'error'
    syncError.value = e instanceof TypeError ? 'Connexion impossible : tes modifications restent dans ce navigateur.' : (e as Error).message
  }
}

/** Surveillances partagées, créées une seule fois et indépendantes des pages affichées */
function setup() {
  const page = usePage()
  effectScope(true).run(() => {
    const plan = usePlan()
    user = computed(() => (page.props.user as { id: number, email: string | null, fullName: string | null } | undefined) ?? null)

    // Un plan déjà enregistré suit ensuite chaque modification (regroupées)
    watch(() => [plan.planId.value, plan.serialize()], () => {
      if (plan.planId.value == null || !user!.value) return
      clearTimeout(timer)
      timer = setTimeout(push, 1200)
    }, { deep: true })

    // Déconnecté : le plan reste dans le navigateur mais n'est plus relié au compte
    watch(user, (u) => {
      if (!u) plan.planId.value = null
    })

    watch(() => plan.planId.value, (id) => {
      if (id != null) return
      clearTimeout(timer)
      lastSent = ''
      syncState.value = 'idle'
    })
  })
}

export function useAccount() {
  if (!user) setup()
  const plan = usePlan()

  /** Bouton « Enregistrer » : direct si connecté, sinon on passe par la connexion */
  function saveToAccount() {
    if (user!.value) return push()
    try {
      sessionStorage.setItem(SAVE_AFTER_LOGIN, '1')
    }
    catch {
      // Stockage bloqué : il faudra recliquer sur Enregistrer après la connexion
    }
    window.location.assign('/connexion?next=/')
  }

  /** À appeler sur la page plan : reprend un enregistrement demandé avant la connexion */
  function resumePendingSave() {
    let pending = false
    try {
      pending = sessionStorage.getItem(SAVE_AFTER_LOGIN) === '1'
      sessionStorage.removeItem(SAVE_AFTER_LOGIN)
    }
    catch {
      // Stockage bloqué : rien à reprendre
    }
    if (pending && user!.value && plan.track.value && plan.planId.value == null) push()
  }

  /** Le plan vient d'être ouvert depuis le compte : il y est déjà à jour */
  function markSynced() {
    lastSent = JSON.stringify(plan.serialize())
    syncState.value = 'saved'
    syncError.value = ''
  }

  return { user: user!, syncState, syncError, saveToAccount, resumePendingSave, markSynced }
}
