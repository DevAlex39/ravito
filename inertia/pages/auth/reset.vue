<template>
  <DefaultLayout>
    <Head title="Nouveau mot de passe" />
    <div class="container auth">
      <form v-if="valid" class="card" @submit.prevent="submit">
        <h1>Nouveau mot de passe</h1>
        <p class="hint">Choisis ton nouveau mot de passe : tu seras connecté juste après.</p>
        <label class="field">
          <span>Nouveau mot de passe <em>(8 caractères minimum)</em></span>
          <input v-model="form.password" type="password" autocomplete="new-password" minlength="8" required autofocus>
          <small v-if="form.errors.password" class="err">{{ form.errors.password }}</small>
        </label>
        <button class="btn" type="submit" :disabled="form.processing">Enregistrer et me connecter</button>
      </form>
      <div v-else class="card">
        <h1>Lien expiré</h1>
        <p class="hint">Ce lien n'est plus valable : il dure 1 heure et ne sert qu'une fois.</p>
        <Link href="/mot-de-passe-oublie" class="btn">Recevoir un nouveau lien</Link>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { Head, Link, useForm } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'

const props = defineProps<{ token: string, valid: boolean }>()
const form = useForm({ password: '' })

function submit() {
  form.post(`/nouveau-mot-de-passe/${props.token}`, { onFinish: () => form.reset('password') })
}
</script>

<style scoped src="./auth.css"></style>
