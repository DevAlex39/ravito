<template>
  <DefaultLayout>
    <Head title="Mot de passe oublié" />
    <div class="container auth">
      <form class="card" @submit.prevent="submit">
        <h1>Mot de passe oublié</h1>
        <p class="hint">Indique l'adresse de ton compte : on t'envoie un lien pour choisir un nouveau mot de passe.</p>
        <p v-if="flash.success" class="flash ok">{{ flash.success }}</p>
        <p v-if="flash.error" class="flash bad">{{ flash.error }}</p>
        <label class="field">
          <span>Adresse e-mail</span>
          <input v-model="form.email" type="email" autocomplete="email" required autofocus>
          <small v-if="form.errors.email" class="err">{{ form.errors.email }}</small>
        </label>
        <button class="btn" type="submit" :disabled="form.processing">Recevoir le lien</button>
        <p class="switch"><Link href="/connexion">← Retour à la connexion</Link></p>
      </form>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link, useForm, usePage } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'

const props = defineProps<{ email: string }>()
const form = useForm({ email: props.email })
const page = usePage()
const flash = computed(() => (page.flash ?? {}) as { success?: string, error?: string })

function submit() {
  form.post('/mot-de-passe-oublie')
}
</script>

<style scoped src="./auth.css"></style>
