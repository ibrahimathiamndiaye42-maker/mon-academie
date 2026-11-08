<script setup>
import { computed } from 'vue'
// Courbe simple. points: [{ label, value }]
const props = defineProps({ points: Array, min: { type: Number, default: 0 }, max: { type: Number, default: 20 }, color: { type: String, default: 'var(--accent)' }, height: { type: Number, default: 200 }, suffix: { type: String, default: '' }, decimals: { type: Number, default: 1 } })
const W = 640, padL = 36, padB = 26, padT = 12, padR = 14
const plotH = computed(() => props.height - padB - padT)
const x = (i) => (props.points.length < 2 ? padL + (W - padL - padR) / 2 : padL + ((W - padL - padR) * i) / (props.points.length - 1))
const y = (v) => padT + plotH.value * (1 - (v - props.min) / (props.max - props.min || 1))
const path = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' '))
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => props.min + (props.max - props.min) * f))
const every = computed(() => Math.ceil(props.points.length / 8))
</script>
<template>
  <svg :viewBox="`0 0 ${W} ${height}`" style="width:100%;height:auto" role="img">
    <g v-for="t in ticks" :key="t"><line :x1="padL" :x2="W - padR" :y1="y(t)" :y2="y(t)" stroke="var(--line)" /><text :x="padL - 6" :y="y(t) + 4" text-anchor="end" font-size="11" fill="var(--ink-3)">{{ Math.round(t) }}</text></g>
    <path v-if="points.length > 1" :d="path" fill="none" :stroke="color" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    <g v-for="(p, i) in points" :key="i">
      <circle :cx="x(i)" :cy="y(p.value)" r="4.5" :fill="color" stroke="var(--surface)" stroke-width="2"><title>{{ p.label }} : {{ p.value.toFixed(decimals).replace('.', ',') }}{{ suffix }}</title></circle>
      <text v-if="i % every === 0" :x="x(i)" :y="height - 7" text-anchor="middle" font-size="11" fill="var(--ink-3)">{{ p.label }}</text>
    </g>
  </svg>
</template>
