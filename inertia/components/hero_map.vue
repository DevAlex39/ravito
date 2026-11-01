<template>
  <!-- Illustration de l'accueil : une boucle sur une petite carte de randonnée (relief, rivière, bois, village) -->
  <svg class="hero-map" viewBox="0 0 360 290" aria-hidden="true">
    <defs>
      <clipPath id="hero-map-clip"><rect width="360" height="290" rx="28" /></clipPath>
      <filter id="hero-map-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#1d2721" flood-opacity="0.18" />
      </filter>
    </defs>
    <g clip-path="url(#hero-map-clip)">
      <rect width="360" height="290" fill="#eef1e8" />

      <!-- Relief : courbes de niveau autour de la colline -->
      <g fill="none" stroke="#d6dccb" stroke-width="1.3">
        <path d="M232 70c26-30 88-26 108 4 18 28-6 62-46 66-44 4-86-38-62-70z" />
        <path d="M216 66c30-46 114-40 134 6 20 44-26 86-74 86-58 0-96-50-60-92z" />
        <path d="M198 64c32-62 146-60 168 4 20 60-40 112-104 110-74-2-110-60-64-114z" />
        <path d="M250 82c14-14 52-12 60 6 8 16-12 32-34 30-24-2-38-22-26-36z" />
        <path d="M-10 40c40-20 90-14 104 12 12 24-20 44-56 42" />
        <path d="M-10 18c56-26 122-22 138 18 14 36-34 66-86 62" />
      </g>

      <!-- Bois -->
      <path d="M262 108c22-10 58-6 70 14 10 18-8 38-34 38-30 0-56-36-36-52z" fill="#d3e2cd" />
      <path d="M8 196c26-14 70-10 82 10 10 18-14 32-42 32-28 0-58-24-40-42z" fill="#d3e2cd" />
      <g fill="#b9cfb2">
        <circle cx="280" cy="124" r="6" /><circle cx="296" cy="118" r="5" /><circle cx="306" cy="134" r="6" /><circle cx="288" cy="140" r="5" /><circle cx="318" cy="122" r="4" />
        <circle cx="30" cy="206" r="6" /><circle cx="48" cy="214" r="5" /><circle cx="64" cy="204" r="6" /><circle cx="42" cy="226" r="4" />
      </g>

      <!-- Rivière et lac -->
      <path d="M-10 258c50-18 92-6 128-22s58-40 104-38 82 30 148 18" fill="none" stroke="#c4dbe5" stroke-width="12" stroke-linecap="round" />
      <path d="M-10 258c50-18 92-6 128-22s58-40 104-38 82 30 148 18" fill="none" stroke="#d6e7ee" stroke-width="5" stroke-linecap="round" />
      <ellipse cx="318" cy="250" rx="56" ry="30" fill="#c4dbe5" />

      <!-- Petites routes et village -->
      <g fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round">
        <path d="M-10 150c60 4 120-12 170-4s110 30 210 20" />
        <path d="M150 -10c-6 60 8 110 4 160s-24 90-20 150" />
      </g>
      <g fill="#e2dccd">
        <rect x="128" y="132" width="12" height="9" rx="2" /><rect x="164" y="124" width="10" height="9" rx="2" /><rect x="160" y="160" width="13" height="9" rx="2" />
        <rect x="136" y="166" width="9" height="8" rx="2" /><rect x="118" y="150" width="9" height="8" rx="2" />
      </g>

      <!-- La boucle -->
      <path :d="LOOP" fill="none" stroke="#ffffff" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />
      <path class="route" :d="LOOP" pathLength="1" fill="none" stroke="#e2672b" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />

      <!-- Lieux : église, belvédère, cascade -->
      <g filter="url(#hero-map-shadow)">
        <g transform="translate(118 72)">
          <circle r="17" fill="#fff" stroke="#24503c" stroke-width="2.5" />
          <g transform="translate(-9 -9) scale(0.75)" fill="none" stroke="#24503c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M10 4h4M18 22V10l-6-4-6 4v12M2 22h20M10 22v-4a2 2 0 0 1 4 0v4" />
          </g>
        </g>
        <g transform="translate(262 96)">
          <circle r="17" fill="#fff" stroke="#24503c" stroke-width="2.5" />
          <g transform="translate(-9 -9) scale(0.75)" fill="none" stroke="#24503c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="16" r="4" /><circle cx="18" cy="16" r="4" /><path d="M10 16h4M4 13V6a2 2 0 0 1 4 0v4M16 10V6a2 2 0 0 1 4 0v7" />
          </g>
        </g>
        <g transform="translate(236 204)">
          <circle r="17" fill="#fff" stroke="#24503c" stroke-width="2.5" />
          <g transform="translate(-9 -9) scale(0.75)" fill="none" stroke="#24503c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 3h16M7 3v10M12 3v14M17 3v10" /><path d="M3 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
          </g>
        </g>

        <!-- Départ -->
        <g transform="translate(150 150)">
          <circle r="13" fill="#24503c" stroke="#fff" stroke-width="3" />
          <text y="4.5" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="700" fill="#fff">D</text>
        </g>

        <!-- Étiquette de la boucle -->
        <g transform="translate(18 18)">
          <rect width="132" height="34" rx="17" fill="#fff" />
          <circle cx="18" cy="17" r="5" fill="#e2672b" />
          <text x="30" y="21.5" font-family="Inter, sans-serif" font-size="12.5" font-weight="600" fill="#1d2721">10 km · 3 lieux</text>
        </g>
      </g>

      <!-- Nord -->
      <g transform="translate(330 30)" fill="none" stroke="#8a938c" stroke-width="1.5" stroke-linejoin="round">
        <path d="M0 -12l5 14-5-3-5 3z" fill="#8a938c" />
        <text y="18" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#8a938c" stroke="none">N</text>
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
/** Tracé de la boucle : départ au village, église, belvédère sur la colline, cascade au bord de la rivière */
const LOOP = 'M150 150C134 120 104 100 118 72S196 46 230 64s58 22 32 32-4 52-4 70-6 30-22 38-52 10-70-6-30-28-16-48z'
</script>

<style scoped>
.hero-map { display: block; width: 100%; height: auto; }
/* La boucle se dessine à l'arrivée sur la page */
.route { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.8s 0.3s ease-out forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .route { animation: none; stroke-dashoffset: 0; } }
</style>
