<template>
  <div ref="root" class="profile" :style="{ height: `${height}px` }" @mouseleave="emit('update:hover', null)">
    <svg v-if="w > 0" :width="w" :height="height" @mousemove="onMove">
      <g v-if="!compact" class="grid">
        <line v-for="t in yTicks" :key="`y${t}`" :x1="padL" :x2="w - padR" :y1="y(t)" :y2="y(t)" />
        <text v-for="t in yTicks" :key="`yt${t}`" :x="padL - 6" :y="y(t) + 4" text-anchor="end">{{ t }}</text>
        <text v-for="t in xTicks" :key="`xt${t}`" :x="x(t * 1000)" :y="height - 6" text-anchor="middle">{{ t }}</text>
      </g>

      <path v-for="s in segPaths" :key="s.i" :d="s.area" :class="['area', s.type]" />
      <path :d="line" class="line" />

      <g v-for="m in placedMarkers" :key="`${m.label}${m.d}`" class="marker">
        <line :x1="x(m.d)" :x2="x(m.d)" :y1="padT" :y2="height - padB" />
        <text v-if="!compact" :x="x(m.d) + 4" :y="padT + 9 + 13 * m.row">{{ m.label }}</text>
      </g>

      <g v-if="hoverInfo" class="cursor">
        <line :x1="x(hoverInfo.d)" :x2="x(hoverInfo.d)" :y1="padT" :y2="height - padB" />
        <circle :cx="x(hoverInfo.d)" :cy="y(hoverInfo.ele)" r="4" />
      </g>
    </svg>

    <div v-if="hoverInfo && !compact" class="tip" :style="tipStyle">
      <strong>km {{ formatKm(hoverInfo.d, 2) }}</strong>
      <span>{{ Math.round(hoverInfo.ele) }} m</span>
      <span :class="hoverInfo.grade > 0 ? 'up' : 'down'">{{ hoverInfo.grade > 0 ? '+' : '' }}{{ Math.round(hoverInfo.grade * 100) }} %</span>
      <span v-if="hoverInfo.clock">{{ hoverInfo.clock }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { eleAt, indexAt } from '~/utils/profile'
import { formatKm } from '~/utils/format'
import type { Profile } from '~/utils/profile'
import type { Segment } from '~/utils/segments'

const props = withDefaults(defineProps<{
  profile: Profile
  segments: Segment[]
  markers?: { d: number, label: string }[]
  hover?: number | null
  height?: number
  /** Largeur fixe (impression) ; sinon on suit le conteneur */
  width?: number
  compact?: boolean
  /** Heure de passage prévue à une distance, pour l'infobulle */
  clockAt?: (d: number) => string
}>(), { markers: () => [], hover: null, height: 200, compact: false })

const emit = defineEmits<{ 'update:hover': [number | null] }>()

const root = ref<HTMLElement>()
const measured = ref(0)
const w = computed(() => props.width ?? measured.value)

let ro: ResizeObserver | null = null
onMounted(() => {
  if (props.width || !root.value) return
  ro = new ResizeObserver(([entry]) => { measured.value = Math.floor(entry!.contentRect.width) })
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const padL = computed(() => (props.compact ? 2 : 42))
const padR = computed(() => (props.compact ? 2 : 10))
const padT = computed(() => (props.compact ? 4 : 16))
const padB = computed(() => (props.compact ? 2 : 22))

function niceStep(range: number, maxTicks: number, steps: number[]): number {
  return steps.find(s => range / s <= maxTicks) ?? steps[steps.length - 1]!
}

const yStep = computed(() => niceStep(props.profile.maxEle - props.profile.minEle, 4, [10, 20, 25, 50, 100, 200, 250, 500, 1000]))
const yMin = computed(() => Math.floor((props.profile.minEle - 5) / yStep.value) * yStep.value)
const yMax = computed(() => Math.max(yMin.value + yStep.value, Math.ceil((props.profile.maxEle + 5) / yStep.value) * yStep.value))
const yTicks = computed(() => {
  const out: number[] = []
  for (let v = yMin.value; v <= yMax.value; v += yStep.value) out.push(v)
  return out
})
const xTicks = computed(() => {
  const km = props.profile.distance / 1000
  const step = niceStep(km, Math.max(4, Math.floor(w.value / 70)), [1, 2, 5, 10, 20, 25, 50, 100])
  const out: number[] = []
  for (let v = 0; v <= km + 1e-6; v += step) out.push(v)
  return out
})

/** Repères trop proches pour que leurs étiquettes tiennent côte à côte : on les décale d'une ligne */
const placedMarkers = computed(() => {
  const lastX: number[] = []
  return [...props.markers].sort((a, b) => a.d - b.d).map((m) => {
    const px = x(m.d)
    let row = lastX.findIndex(prev => px - prev >= 36)
    if (row < 0) row = lastX.length < 3 ? lastX.length : 0
    lastX[row] = px
    return { ...m, row }
  })
})

const x = (d: number) => padL.value + (d / props.profile.distance) * (w.value - padL.value - padR.value)
const y = (e: number) => padT.value + (1 - (e - yMin.value) / (yMax.value - yMin.value)) * (props.height - padT.value - padB.value)

/** Pas d'échantillonnage pour dessiner (≈ 1 point par pixel) */
const stride = computed(() => Math.max(1, Math.floor(props.profile.d.length / Math.max(1, w.value))))

function pathPoints(from: number, to: number): string {
  const p = props.profile
  const parts: string[] = []
  for (let i = from; i <= to; i += stride.value) parts.push(`${x(p.d[i]!).toFixed(1)},${y(p.ele[i]!).toFixed(1)}`)
  parts.push(`${x(p.d[to]!).toFixed(1)},${y(p.ele[to]!).toFixed(1)}`)
  return parts.join(' L')
}

const segPaths = computed(() => {
  const p = props.profile
  const base = (props.height - padB.value).toFixed(1)
  return props.segments.map((s) => {
    const ia = indexAt(p, s.start)
    const ib = indexAt(p, s.end)
    return {
      i: s.index,
      type: s.type,
      area: `M${x(s.start).toFixed(1)},${base} L${pathPoints(ia, ib)} L${x(s.end).toFixed(1)},${base} Z`,
    }
  })
})

const line = computed(() => `M${pathPoints(0, props.profile.d.length - 1)}`)

const hoverInfo = computed(() => {
  if (props.hover == null) return null
  const p = props.profile
  const d = Math.min(p.distance, Math.max(0, props.hover))
  const i = indexAt(p, d)
  return { d, ele: eleAt(p, d), grade: p.grade[i]!, clock: props.clockAt?.(d) ?? '' }
})

const tipStyle = computed(() => {
  if (!hoverInfo.value) return {}
  const px = x(hoverInfo.value.d)
  return px > w.value * 0.7 ? { right: `${w.value - px + 10}px` } : { left: `${px + 10}px` }
})

function onMove(e: MouseEvent) {
  if (props.compact) return
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const t = (e.clientX - rect.left - padL.value) / (w.value - padL.value - padR.value)
  emit('update:hover', Math.min(1, Math.max(0, t)) * props.profile.distance)
}
</script>

<style scoped>
.profile { position: relative; width: 100%; user-select: none; }
svg { display: block; overflow: visible; }

.grid line { stroke: var(--border); stroke-width: 1; }
.grid text { fill: var(--text-dim); font-size: 11px; font-variant-numeric: tabular-nums; }

.area { stroke: none; }
.area.montee { fill: color-mix(in srgb, var(--up) 30%, transparent); }
.area.descente { fill: color-mix(in srgb, var(--down) 26%, transparent); }
.area.plat { fill: color-mix(in srgb, var(--flat) 24%, transparent); }
.line { fill: none; stroke: var(--text); stroke-width: 1.4; stroke-linejoin: round; }

.marker line { stroke: var(--forest); stroke-width: 1.2; stroke-dasharray: 3 3; }
.marker text { fill: var(--forest); font-size: 10.5px; font-weight: 600; }

.cursor line { stroke: var(--accent); stroke-width: 1.2; }
.cursor circle { fill: var(--accent); stroke: #fff; stroke-width: 2; }

.tip {
  position: absolute;
  top: 6px;
  display: flex;
  gap: 8px;
  align-items: baseline;
  background: rgba(29, 39, 33, 0.92);
  color: #fff;
  font-size: 0.78rem;
  padding: 4px 9px;
  border-radius: 6px;
  pointer-events: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.tip .up { color: #ffb08a; }
.tip .down { color: #9cccff; }
</style>
