<template>
  <DefaultLayout>
    <Head title="Connexion" />
    <div class="container auth">
      <form class="card" @submit.prevent="submit">
        <h1>Connexion</h1>
        <p class="hint">Retrouve tes plans de course sur tous tes appareils.</p>
        <label class="field">
          <span>Adresse e-mail</span>
          <input v-model="form.email" type="email" autocomplete="email" required autofocus>
          <small v-if="form.errors.email" class="err">{{ form.errors.email }}</small>
        </label>
        <label class="field">
          <span>Mot de passe</span>
          <input v-model="form.password" type="password" autocomplete="current-password" required>
          <small v-if="form.errors.password" class="err">{{ form.errors.password }}</small>
        </label>
        <button class="btn" type="submit" :disabled="form.processing">Se connecter</button>
        <p class="switch">Pas encore de compte ? <Link :href="`/inscription?next=${encodeURIComponent(next)}`">Crée-le en 10 secondes</Link></p>
      </form>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { Head, Link, useForm } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'

const props = defineProps<{ next: string }>()
const form = useForm({ email: '', password: '', next: props.next })

function submit() {
  form.post('/connexion', { onFinish: () => form.reset('password') })
}
</script>

<style scoped src="./auth.css"></style>
