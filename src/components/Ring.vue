<script setup>
import { computed } from 'vue'
const props = defineProps({ value: { type: Number, default: 0 }, size: { type: Number, default: 120 }, stroke: { type: Number, default: 10 }, color: String, track: { type: String, default: 'var(--surface-2)' } })
const r = computed(() => (props.size - props.stroke) / 2)
const c = computed(() => 2 * Math.PI * r.value)
const off = computed(() => c.value * (1 - Math.min(1, Math.max(0, props.value / 100))))
</script>
<template>
  <div :style="{ width: size + 'px', height: size + 'px', position: 'relative', flex: 'none' }">
    <svg :width="size" :height="size" style="transform: rotate(-90deg)">
      <circle :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke="track" :stroke-width="stroke" />
      <circle :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke="color || 'var(--accent)'" :stroke-width="stroke" stroke-linecap="round" :stroke-dasharray="c" :stroke-dashoffset="off" style="transition: stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)" />
    </svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><slot /></div>
  </div>
</template>
