<template>
  <DefaultLayout>
    <Head title="Nouveau mot de passe" />
    <div class="container auth">
      <form v-if="valid" class="card" @submit.prevent="submit">
        <div class="head">
          <span class="badge"><Icon name="lock" :size="24" /></span>
          <h1>Nouveau mot de passe</h1>
          <p class="hint">Choisis ton nouveau mot de passe : tu seras connecté juste après.</p>
        </div>
        <AuthField v-model="form.password" label="Nouveau mot de passe" hint="(8 caractères minimum)" type="password" icon="lock" autocomplete="new-password" :minlength="8" :error="form.errors.password" autofocus />
        <button class="btn" type="submit" :disabled="form.processing">Enregistrer et me connecter</button>
      </form>
      <div v-else class="card">
        <div class="head">
          <span class="badge"><Icon name="lock" :size="24" /></span>
          <h1>Lien expiré</h1>
          <p class="hint">Ce lien n'est plus valable : il dure 1 heure et ne sert qu'une fois.</p>
        </div>
        <Link href="/mot-de-passe-oublie" class="btn">Recevoir un nouveau lien</Link>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { Head, Link, useForm } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
import AuthField from '~/components/auth_field.vue'
import Icon from '~/components/icon.vue'

const props = defineProps<{ token: string, valid: boolean }>()
const form = useForm({ password: '' })

function submit() {
  form.post(`/nouveau-mot-de-passe/${props.token}`, { onFinish: () => form.reset('password') })
}
</script>

<style scoped src="./auth.css"></style>
