<template>
  <DefaultLayout>
    <Head title="Créer un compte" />
    <div class="container auth">
      <form class="card" @submit.prevent="submit">
        <div class="head">
          <span class="badge"><Icon name="user" :size="24" /></span>
          <h1>Créer un compte</h1>
          <p class="hint">Gratuit. Il sert seulement à garder tes plans de course et à les retrouver partout.</p>
        </div>
        <SsoButtons :sso="sso" :next="next" />
        <AuthField v-model="form.email" label="Adresse e-mail" type="email" icon="mail" autocomplete="email" :error="form.errors.email" autofocus />
        <AuthField v-model="form.password" label="Mot de passe" hint="(8 caractères minimum)" type="password" icon="lock" autocomplete="new-password" :minlength="8" :error="form.errors.password" />
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
import AuthField from '~/components/auth_field.vue'
import Icon from '~/components/icon.vue'

const props = defineProps<{ next: string, sso: { google: boolean, strava: boolean } }>()
const form = useForm({ email: '', password: '', next: props.next })

function submit() {
  form.post('/inscription', { onFinish: () => form.reset('password') })
}
</script>

<style scoped src="./auth.css"></style>
