<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import DefaultLayout from '~/layouts/default.vue'
</script>

<template>
  <DefaultLayout>
    <Head title="Erreur" />
    <section class="container error-page">
      <h1>Oups, une erreur est survenue</h1>
      <p class="hint">Réessaie dans un instant. Si le problème persiste, recharge la page.</p>
      <Link href="/" class="btn">Retour à l'accueil</Link>
    </section>
  </DefaultLayout>
</template>

<style scoped>
.error-page { max-width: 640px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; padding-top: 24px; }
.error-page h1 { font-size: 2.4rem; }
</style>
