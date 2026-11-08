<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { timeToMin, todayStr } from '../utils/time'
// Grille horaire générique. columns: [{ key, label, today }] ; items: [{ id, col, start, end, title, sub, color, kind, status, conflict }]
const props = defineProps({ columns: Array, items: Array, startHour: { type: Number, default: 7 }, endHour: { type: Number, default: 21 }, hourPx: { type: Number, default: 54 } })
const emit = defineEmits(['select', 'create'])
const hours = computed(() => Array.from({ length: props.endHour - props.startHour }, (_, i) => props.startHour + i))
const totalH = computed(() => (props.endHour - props.startHour) * props.hourPx)
const tpl = computed(() => `52px repeat(${props.columns.length}, minmax(0, 1fr))`)
const nowMin = ref(new Date().getHours() * 60 + new Date().getMinutes())
let iv
onMounted(() => { iv = setInterval(() => { const d = new Date(); nowMin.value = d.getHours() * 60 + d.getMinutes() }, 30000) })
onUnmounted(() => clearInterval(iv))
const top = (m) => ((m - props.startHour * 60) / 60) * props.hourPx
function style(it) {
  const s = Math.max(timeToMin(it.start), props.startHour * 60), e = Math.min(timeToMin(it.end), props.endHour * 60)
  const t = top(s), h = Math.max(20, top(e) - t - 2)
  const c = it.color || '#64748b'
  const st = { top: t + 'px', height: h + 'px' }
  if (it.kind === 'pause') return st
  st.background = it.kind === 'session' ? `color-mix(in srgb, ${c} 14%, var(--surface))` : `color-mix(in srgb, ${c} 22%, var(--surface))`
  st.color = `color-mix(in srgb, ${c} 70%, var(--ink))`
  st.borderLeft = `4px solid ${c}`
  return st
}
function clickCol(col, e) {
  if (e.target !== e.currentTarget && !e.target.classList.contains('hl')) return
  const r = e.currentTarget.getBoundingClientRect()
  const min = props.startHour * 60 + Math.floor(((e.clientY - r.top) / props.hourPx) * 4) * 15
  emit('create', col.key, min)
}
const showNow = (col) => col.today && nowMin.value >= props.startHour * 60 && nowMin.value <= props.endHour * 60
</script>
<template>
  <div class="tg">
    <div class="tg-head" :style="{ gridTemplateColumns: tpl }"><div /><div v-for="c in columns" :key="c.key" :class="{ today: c.today }">{{ c.label }}</div></div>
    <div class="tg-body" :style="{ gridTemplateColumns: tpl }">
      <div class="tg-hours"><div v-for="h in hours" :key="h" :style="{ height: hourPx + 'px' }">{{ String(h).padStart(2, '0') }}:00</div></div>
      <div v-for="c in columns" :key="c.key" class="tg-col" :class="{ today: c.today }" :style="{ height: totalH + 'px' }" @click="clickCol(c, $event)">
        <div v-for="h in hours" :key="h" class="hl" :style="{ top: (h - startHour) * hourPx + 'px' }" />
        <button v-for="it in items.filter((x) => x.col === c.key)" :key="it.id" type="button" class="tg-item" :class="[it.kind, it.status, { conflict: it.conflict }]" :style="style(it)" @click.stop="emit('select', it)">
          <b>{{ it.title }}</b><span v-if="it.sub">{{ it.sub }}</span><span>{{ it.start }}–{{ it.end }}</span>
        </button>
        <div v-if="showNow(c)" class="tg-now" :style="{ top: top(nowMin) + 'px' }" />
      </div>
    </div>
  </div>
</template>
