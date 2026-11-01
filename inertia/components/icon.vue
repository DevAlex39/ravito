<template>
  <!-- eslint-disable-next-line vue/no-v-html -- tracés constants de utils/icons.ts -->
  <svg
    class="icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="ICONS[name]"
  />
</template>

<script setup lang="ts">
import { ICONS, type IconName } from '~/utils/icons'

withDefaults(defineProps<{ name: IconName, size?: number }>(), { size: 20 })
</script>

<style scoped>
.icon { flex: none; }
</style>
