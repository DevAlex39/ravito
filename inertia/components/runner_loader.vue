<template>
  <div class="runner-loader" role="status" aria-live="polite">
    <svg class="runner" viewBox="0 0 80 84" width="84" height="88" aria-hidden="true">
      <g class="body">
        <!-- Bras arrière, jambe arrière, puis le reste : le corps passe devant -->
        <g class="arm arm-b"><polyline points="42,25 38,34 44,39" /></g>
        <g class="leg leg-b">
          <line x1="37" y1="45" x2="37" y2="59" />
          <g class="shin"><line x1="37" y1="59" x2="37" y2="72" /><line class="shoe" x1="37" y1="72" x2="42" y2="72" /></g>
        </g>
        <line x1="42" y1="23" x2="37" y2="45" />
        <circle class="head" cx="45" cy="15" r="6" />
        <line class="band" x1="39.5" y1="13" x2="50.5" y2="13" />
        <g class="leg leg-a">
          <line x1="37" y1="45" x2="37" y2="59" />
          <g class="shin"><line x1="37" y1="59" x2="37" y2="72" /><line class="shoe" x1="37" y1="72" x2="42" y2="72" /></g>
        </g>
        <g class="arm arm-a"><polyline points="42,25 38,34 44,39" /></g>
      </g>
      <line class="ground" x1="0" y1="80" x2="80" y2="80" />
    </svg>
    <Transition name="fade" mode="out-in">
      <p :key="index" class="phrase">{{ PHRASES[index] }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

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
.runner { overflow: visible; }
.runner line, .runner polyline { stroke: currentColor; stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; fill: none; }
.runner .head { fill: currentColor; }
.runner .band { stroke: #e2672b; stroke-width: 3; }
.runner .shoe { stroke: #e2672b; }
.runner .ground { stroke: var(--border-strong); stroke-width: 2.5; stroke-dasharray: 6 8; animation: ground 0.35s linear infinite; }

/* Chaque membre tourne autour de son articulation (coordonnées du dessin) */
.runner g { transform-box: view-box; }
.body { animation: bob 0.35s ease-in-out infinite; }
.leg { transform-origin: 37px 45px; animation: thigh 0.7s ease-in-out infinite; }
.leg .shin { transform-origin: 37px 59px; animation: shin 0.7s ease-in-out infinite; }
.arm { transform-origin: 42px 25px; animation: arm 0.7s ease-in-out infinite; }
.leg-b, .leg-b .shin, .arm-a { animation-delay: -0.35s; }
.leg-b, .arm-b { opacity: 0.55; }

@keyframes thigh { 0%, 100% { transform: rotate(-38deg); } 50% { transform: rotate(32deg); } }
@keyframes shin { 0%, 100% { transform: rotate(15deg); } 30% { transform: rotate(25deg); } 65% { transform: rotate(95deg); } }
@keyframes arm { 0%, 100% { transform: rotate(35deg); } 50% { transform: rotate(-40deg); } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes ground { to { stroke-dashoffset: 14; } }

.phrase { margin: 0; font-size: 0.92rem; font-weight: 600; color: var(--text); text-align: center; min-height: 1.3em; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.fade-enter-from { opacity: 0; transform: translateY(4px); }
.fade-leave-to { opacity: 0; transform: translateY(-4px); }

@media (prefers-reduced-motion: reduce) {
  .runner * { animation: none !important; }
}
</style>
