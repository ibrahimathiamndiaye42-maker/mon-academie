<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { state, subjectById } from '../store'
import { todayStr, diffDays, fmtDateShort } from '../utils/time'
import { isGraded } from '../utils/grades'
import Icon from './Icon.vue'

const router = useRouter()
const root = ref(null)
const q = ref(''), openSearch = ref(false), openBell = ref(false)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const results = computed(() => {
  const t = norm(q.value.trim())
  if (t.length < 2) return []
  const out = []
  for (const s of state.subjects) if (norm(s.name).includes(t)) out.push({ k: 's' + s.id, icon: s.icon || 'book', label: s.name, sub: 'Matière', to: '/matieres' })
  for (const c of state.chapters) if (norm(c.title).includes(t)) out.push({ k: 'c' + c.id, icon: 'list', label: c.title, sub: 'Chapitre · ' + (subjectById(c.subjectId)?.name || ''), to: '/matieres' })
  for (const d of state.documents) if (norm(d.title).includes(t)) out.push({ k: 'd' + d.id, icon: 'file', label: d.title, sub: 'Cours PDF', to: `/cours/${d.id}` })
  for (const e of state.evaluations) if (norm(e.title).includes(t)) out.push({ k: 'e' + e.id, icon: 'grades', label: e.title, sub: 'Évaluation · ' + fmtDateShort(e.date), to: '/notes' })
  return out.slice(0, 8)
})
const notifs = computed(() => {
  const today = todayStr(), out = []
  const hhmm = new Date(state.now).toTimeString().slice(0, 5)
  if (state.timer) out.push({ k: 't', icon: 'timer', label: `Séance ${state.timer.status === 'paused' ? 'en pause' : 'en cours'}`, sub: subjectById(state.timer.subjectId)?.name || '', to: '/chrono' })
  for (const s of state.sessions.filter((x) => x.kind === 'study' && x.date === today && x.status === 'planned' && x.end > hhmm).sort((a, b) => a.start.localeCompare(b.start))) out.push({ k: s.id, icon: 'planning', label: `Séance à ${s.start}`, sub: subjectById(s.subjectId)?.name || '', to: '/planning' })
  const missed = state.sessions.filter((x) => x.kind === 'study' && (x.status === 'planned' || x.status === 'postponed') && x.date < today).length
  if (missed) out.push({ k: 'm', icon: 'alert', label: `${missed} séance${missed > 1 ? 's' : ''} non réalisée${missed > 1 ? 's' : ''}`, sub: 'À reporter ou annuler', to: '/planning' })
  for (const e of state.evaluations.filter((x) => !isGraded(x) && diffDays(today, x.date) >= 0 && diffDays(today, x.date) <= 7).sort((a, b) => a.date.localeCompare(b.date))) out.push({ k: e.id, icon: 'grades', label: `${e.title} — ${diffDays(today, e.date) === 0 ? "aujourd'hui" : 'dans ' + diffDays(today, e.date) + ' j'}`, sub: subjectById(e.subjectId)?.name || '', to: '/notes' })
  return out
})
const initial = computed(() => (state.settings.name || 'M').trim().charAt(0).toUpperCase())
function go(to) { openSearch.value = false; openBell.value = false; q.value = ''; router.push(to) }
const away = (e) => { if (root.value && !root.value.contains(e.target)) { openSearch.value = false; openBell.value = false } }
onMounted(() => document.addEventListener('mousedown', away))
onUnmounted(() => document.removeEventListener('mousedown', away))
</script>
<template>
  <header ref="root" class="topbar">
    <div class="tb-brand"><div class="brand-mark" style="width:34px;height:34px"><Icon name="book" :size="18" /></div><span>MON ACADÉMIE</span></div>
    <div class="tb-search" @keydown.esc="openSearch = false">
      <Icon name="search" :size="17" />
      <input v-model="q" class="input" type="search" placeholder="Rechercher matière, chapitre, cours…" aria-label="Recherche globale" @focus="openSearch = true" @input="openSearch = true" />
      <div v-if="openSearch && q.trim().length >= 2" class="dropdown">
        <p v-if="!results.length" class="small muted" style="padding:8px 10px">Aucun résultat pour « {{ q }} ».</p>
        <button v-for="r in results" :key="r.k" class="dd-item" @click="go(r.to)"><Icon :name="r.icon" :size="18" /><span class="grow"><b>{{ r.label }}</b><div class="tiny muted">{{ r.sub }}</div></span></button>
      </div>
    </div>
    <div class="grow" />
    <div style="position:relative">
      <button class="icon-btn" :class="{ on: openBell }" aria-label="Notifications" @click="openBell = !openBell"><Icon name="alert" /><span v-if="notifs.length" class="bell-dot">{{ notifs.length }}</span></button>
      <div v-if="openBell" class="dropdown right"><p v-if="!notifs.length" class="small muted" style="padding:10px">Rien à signaler pour le moment.</p>
        <button v-for="n in notifs" :key="n.k" class="dd-item" @click="go(n.to)"><Icon :name="n.icon" :size="18" /><span class="grow"><b>{{ n.label }}</b><div class="tiny muted">{{ n.sub }}</div></span></button></div>
    </div>
    <button class="avatar" aria-label="Profil et paramètres" @click="go('/parametres')">{{ initial }}</button>
  </header>
</template>
