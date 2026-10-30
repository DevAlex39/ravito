<template>
  <DefaultLayout>
    <Head title="Connexion" />
    <div class="container auth">
      <form class="card" @submit.prevent="submit">
        <h1>Connexion</h1>
        <p class="hint">Retrouve tes plans de course sur tous tes appareils.</p>
        <p v-if="flash.error" class="flash bad">{{ flash.error }}</p>
        <SsoButtons :sso="sso" :next="next" />
        <label class="field">
          <span>Adresse e-mail</span>
          <input v-model="form.email" type="email" autocomplete="email" required autofocus>
          <small v-if="form.errors.email" class="err">{{ form.errors.email }}</small>
        </label>
        <label class="field">
          <span>Mot de passe</span>
          <input v-model="form.password" type="password" autocomplete="current-password" required>
          <small v-if="form.errors.password" class="err">{{ form.errors.password }}</small>
          <Link :href="`/mot-de-passe-oublie?email=${encodeURIComponent(form.email)}`" class="forgot">Mot de passe oublié ?</Link>
        </label>
        <button class="btn" type="submit" :disabled="form.processing">Se connecter</button>
        <p class="switch">Pas encore de compte ? <Link :href="`/inscription?next=${encodeURIComponent(next)}`">Crée-le en 10 secondes</Link></p>
      </form>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link, useForm, usePage } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import SsoButtons from '~/components/sso_buttons.vue'

const props = defineProps<{ next: string, sso: { google: boolean, strava: boolean } }>()
const page = usePage()
const flash = computed(() => (page.flash ?? {}) as { error?: string })
const form = useForm({ email: '', password: '', next: props.next })

function submit() {
  form.post('/connexion', { onFinish: () => form.reset('password') })
}
</script>

<style scoped src="./auth.css"></style>
