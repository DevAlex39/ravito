<template>
  <div class="runner-loader" role="status" aria-live="polite">
    <div class="runner" aria-hidden="true">
      <!-- 4 poses côte à côte dans une seule image, affichées l'une après l'autre -->
      <div class="sprite" :style="{ backgroundImage: `url(${coureur})` }" />
      <div class="ground" />
    </div>
    <Transition name="fade" mode="out-in">
      <p :key="index" class="phrase">{{ PHRASES[index] }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import coureur from '~/images/coureur.webp'

/** Phrases affichées à tour de rôle pendant la recherche des boucles */
const PHRASES = [
  'Balisage des sentiers en cours…',
  'PB en cours de réalisation…',
  'Laçage des chaussures…',
  'Remplissage des bidons…',
  'Négociation avec les côtes…',
  'Échauffement des mollets…',
  'Recherche du ravito le plus proche…',
  'Calcul du D+ en douce…',
  'Fractionné mental en cours…',
  'Contournement des départementales…',
  'Repérage des jolis coins…',
  'Crème anti-frottements appliquée…',
  'Le GPS cherche ses satellites…',
  'Les bénévoles prennent position…',
  'Allure footing, pas de panique…',
  'Épinglage du dossard…',
  'On demande le chemin aux randonneurs…',
  'Dernier passage aux toilettes avant le départ…',
]

// Départ au hasard : on ne voit pas toujours les mêmes phrases
const index = ref(Math.floor(Math.random() * PHRASES.length))
const timer = setInterval(() => { index.value = (index.value + 1) % PHRASES.length }, 2400)
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.runner-loader { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 22px 12px; background: rgba(255, 255, 255, 0.94); border-radius: var(--radius); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14); color: var(--forest); }
.runner { display: flex; flex-direction: column; align-items: center; }
.sprite { width: 93px; height: 96px; background: 0 0 / 400% 100% no-repeat; animation: legs 0.48s steps(1) infinite, bob 0.12s ease-in-out infinite alternate; }
.ground { width: 130px; height: 3px; margin-top: -2px; background: repeating-linear-gradient(90deg, var(--border-strong) 0 14px, transparent 14px 26px); background-size: 26px 3px; animation: ground 0.24s linear infinite; }

/* Foulée, jambe repliée, foulée, jambe repliée */
@keyframes legs { 0% { background-position: 0 0; } 25% { background-position: 33.333% 0; } 50% { background-position: 66.667% 0; } 75% { background-position: 100% 0; } }
@keyframes bob { to { transform: translateY(-3px); } }
@keyframes ground { to { background-position: -26px 0; } }

.phrase { margin: 0; font-size: 0.92rem; font-weight: 600; color: var(--text); text-align: center; min-height: 1.3em; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.fade-enter-from { opacity: 0; transform: translateY(4px); }
.fade-leave-to { opacity: 0; transform: translateY(-4px); }

@media (prefers-reduced-motion: reduce) {
  .runner * { animation: none !important; }
}
</style>
