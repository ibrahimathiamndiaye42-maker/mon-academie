<script setup>
import { computed } from 'vue'
// Histogramme groupé en SVG. series: [{ name, color, values }] — valeurs en minutes.
const props = defineProps({ labels: Array, series: Array, height: { type: Number, default: 220 } })
const W = 640, padL = 44, padB = 28, padT = 10
const max = computed(() => {
  const m = Math.max(1, ...props.series.flatMap((s) => s.values))
  const step = m <= 60 ? 15 : m <= 180 ? 30 : m <= 480 ? 60 : 120
  return Math.ceil(m / step) * step
})
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max.value * f)))
const fmt = (v) => (v >= 60 ? (v / 60).toFixed(v % 60 ? 1 : 0).replace('.', ',') + ' h' : v + ' min')
const plotH = computed(() => props.height - padB - padT)
const band = computed(() => (W - padL - 8) / Math.max(1, props.labels.length))
const bw = computed(() => Math.min(30, (band.value * 0.7) / props.series.length))
const y = (v) => padT + plotH.value * (1 - v / max.value)
const every = computed(() => (props.labels.length > 14 ? 3 : props.labels.length > 8 ? 2 : 1))
</script>
<template>
  <svg :viewBox="`0 0 ${W} ${height}`" style="width:100%;height:auto" role="img">
    <g v-for="t in ticks" :key="t">
      <line :x1="padL" :x2="W - 4" :y1="y(t)" :y2="y(t)" stroke="var(--line)" />
      <text :x="padL - 6" :y="y(t) + 4" text-anchor="end" font-size="11" fill="var(--ink-3)">{{ fmt(t) }}</text>
    </g>
    <g v-for="(l, i) in labels" :key="i">
      <rect v-for="(s, j) in series" :key="j" :x="padL + band * i + (band - bw * series.length) / 2 + bw * j" :y="y(s.values[i])" :width="bw - 2" :height="Math.max(0, padT + plotH - y(s.values[i]))" rx="3" :fill="s.color">
        <title>{{ l }} — {{ s.name }} : {{ fmt(Math.round(s.values[i])) }}</title>
      </rect>
      <text v-if="i % every === 0" :x="padL + band * i + band / 2" :y="height - 8" text-anchor="middle" font-size="11" fill="var(--ink-3)">{{ l }}</text>
    </g>
  </svg>
</template>
