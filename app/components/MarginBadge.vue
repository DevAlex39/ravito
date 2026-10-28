<template>
  <span v-if="margin != null" class="margin" :class="level" :title="title">{{ formatMargin(margin) }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{ margin: number | null }>()

/** Moins de 30 min d'avance sur une barrière : zone de vigilance */
const level = computed(() => {
  const m = props.margin ?? 0
  return m < 0 ? 'bad' : m < 30 * 60 ? 'warn' : 'ok'
})
const title = computed(() => ({
  bad: 'Barrière dépassée avec ce plan',
  warn: 'Marge serrée sur la barrière',
  ok: 'Marge confortable',
}[level.value]))
</script>
