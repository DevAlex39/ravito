<template>
  <DefaultLayout>
    <Head title="Connexion" />
    <div class="container auth">
      <form class="card" @submit.prevent="submit">
        <div class="head">
          <span class="badge"><Icon name="user" :size="24" /></span>
          <h1>Connexion</h1>
          <p class="hint">Retrouve tes plans de course sur tous tes appareils.</p>
        </div>
        <p v-if="flash.error" class="flash bad">{{ flash.error }}</p>
        <SsoButtons :sso="sso" :next="next" />
        <AuthField v-model="form.email" label="Adresse e-mail" type="email" icon="mail" autocomplete="email" :error="form.errors.email" autofocus />
        <AuthField v-model="form.password" label="Mot de passe" type="password" icon="lock" autocomplete="current-password" :error="form.errors.password">
          <Link :href="`/mot-de-passe-oublie?email=${encodeURIComponent(form.email)}`" class="forgot">Mot de passe oublié ?</Link>
        </AuthField>
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
import AuthField from '~/components/auth_field.vue'
import Icon from '~/components/icon.vue'

const props = defineProps<{ next: string, sso: { google: boolean, strava: boolean } }>()
const page = usePage()
const flash = computed(() => (page.flash ?? {}) as { error?: string })
const form = useForm({ email: '', password: '', next: props.next })

function submit() {
  form.post('/connexion', { onFinish: () => form.reset('password') })
}
</script>

<style scoped src="./auth.css"></style>
