<template>
  <div class="auth-field" :class="{ bad: !!error }">
    <label :for="id">{{ label }} <em v-if="hint">{{ hint }}</em></label>
    <div class="box">
      <Icon :name="icon" :size="18" class="lead" />
      <input
        :id="id"
        v-model="model"
        :type="shown ? 'text' : type"
        :autocomplete="autocomplete"
        :minlength="minlength"
        :autofocus="autofocus"
        :aria-invalid="!!error"
        required
      >
      <!-- Mot de passe : l'afficher en clair pour vérifier la frappe (surtout sur mobile) -->
      <button
        v-if="type === 'password'"
        type="button"
        class="peek"
        :aria-label="shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        :title="shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        @click="shown = !shown"
      >
        <Icon :name="shown ? 'eyeOff' : 'eye'" :size="18" />
      </button>
    </div>
    <small v-if="error" class="err">{{ error }}</small>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import Icon from '~/components/icon.vue'
import type { IconName } from '~/utils/icons'

/** Champ des pages de compte (connexion, inscription, mot de passe) : picto, erreur, œil pour le mot de passe */
defineProps<{
  label: string
  type: 'email' | 'password'
  icon: IconName
  autocomplete: string
  hint?: string
  error?: string
  minlength?: number
  autofocus?: boolean
}>()
const model = defineModel<string>({ required: true })
const id = useId()
const shown = ref(false)
</script>

<style scoped>
.auth-field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 0.85rem; font-weight: 600; color: var(--text); }
label em { font-style: normal; font-weight: 400; color: var(--text-dim); }
.box { position: relative; display: flex; align-items: center; }
.lead { position: absolute; left: 13px; color: var(--text-dim); pointer-events: none; transition: color 0.15s; }
.box input {
  width: 100%;
  height: 46px;
  padding: 0 44px 0 42px;
  font: inherit;
  font-size: 0.95rem;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.box input:hover { border-color: var(--border-strong); }
.box input:focus { outline: none; background: #fff; border-color: var(--forest); box-shadow: 0 0 0 3px color-mix(in srgb, var(--forest) 18%, transparent); }
/* Œil natif d'Edge : doublon du nôtre */
.box input::-ms-reveal, .box input::-ms-clear { display: none; }
.box:focus-within .lead { color: var(--forest); }
.peek { position: absolute; right: 6px; display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: none; border-radius: 8px; background: none; color: var(--text-dim); cursor: pointer; }
.peek:hover { color: var(--forest); background: var(--forest-soft); }
.peek:focus-visible { outline: 2px solid color-mix(in srgb, var(--forest) 35%, transparent); }
.bad .box input { border-color: var(--bad); background: var(--bad-bg); }
.bad .lead { color: var(--bad); }
.err { color: var(--bad); font-size: 0.82rem; }
</style>
