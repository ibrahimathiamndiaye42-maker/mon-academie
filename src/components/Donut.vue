<script setup>
import { computed } from 'vue'
import { fmtMin } from '../utils/time'
const props = defineProps({ items: Array, size: { type: Number, default: 170 } }) // [{ label, value, color }]
const total = computed(() => props.items.reduce((a, i) => a + i.value, 0))
const R = 62, C = 2 * Math.PI * R
const arcs = computed(() => { let acc = 0; return props.items.map((i) => { const f = total.value ? i.value / total.value : 0; const a = { ...i, dash: f * C, off: -acc * C }; acc += f; return a }) })
</script>
<template>
  <div class="row wrap" style="gap:18px">
    <svg :width="size" :height="size" viewBox="0 0 160 160" style="flex:none">
      <circle cx="80" cy="80" :r="R" fill="none" stroke="var(--surface-2)" stroke-width="18" />
      <g transform="rotate(-90 80 80)"><circle v-for="a in arcs" :key="a.label" cx="80" cy="80" :r="R" fill="none" :stroke="a.color" stroke-width="18" :stroke-dasharray="`${a.dash} ${C - a.dash}`" :stroke-dashoffset="a.off"><title>{{ a.label }} : {{ fmtMin(a.value) }}</title></circle></g>
      <text x="80" y="78" text-anchor="middle" font-size="17" font-weight="600" fill="var(--ink)" font-family="var(--serif)">{{ fmtMin(total) }}</text>
      <text x="80" y="96" text-anchor="middle" font-size="10" fill="var(--ink-3)">au total</text>
    </svg>
    <div class="col grow" style="gap:6px">
      <div v-for="a in items" :key="a.label" class="row small"><i class="dot" :style="{ background: a.color }" /><span class="grow">{{ a.label }}</span><span class="num muted">{{ fmtMin(a.value) }}</span></div>
    </div>
  </div>
</template>
