<template>
  <DefaultLayout>
    <Head title="Créer un compte" />
    <div class="container auth">
      <form class="card" @submit.prevent="submit">
        <h1>Créer un compte</h1>
        <p class="hint">Gratuit. Il sert seulement à garder tes plans de course et à les retrouver partout.</p>
        <SsoButtons :sso="sso" :next="next" />
        <label class="field">
          <span>Adresse e-mail</span>
          <input v-model="form.email" type="email" autocomplete="email" required autofocus>
          <small v-if="form.errors.email" class="err">{{ form.errors.email }}</small>
        </label>
        <label class="field">
          <span>Mot de passe <em>(8 caractères minimum)</em></span>
          <input v-model="form.password" type="password" autocomplete="new-password" minlength="8" required>
          <small v-if="form.errors.password" class="err">{{ form.errors.password }}</small>
        </label>
        <button class="btn" type="submit" :disabled="form.processing">Créer mon compte</button>
        <p class="switch">Déjà un compte ? <Link :href="`/connexion?next=${encodeURIComponent(next)}`">Connecte-toi</Link></p>
      </form>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { Head, Link, useForm } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import SsoButtons from '~/components/sso_buttons.vue'

const props = defineProps<{ next: string, sso: { google: boolean, strava: boolean } }>()
const form = useForm({ email: '', password: '', next: props.next })

function submit() {
  form.post('/inscription', { onFinish: () => form.reset('password') })
}
</script>

<style scoped src="./auth.css"></style>
