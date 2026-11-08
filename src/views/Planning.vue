<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state, save, removeItem, validateSession, postponeSession, duplicateSession, timerStart, subjectById, chapterById, chaptersOf, confirmDialog, toast } from '../store'
import { SESSION_TYPES, SESSION_STATUS, PRIORITY_LEVELS } from '../constants'
import { addDays, weekDates, todayStr, parseDate, toDateStr, monthGrid, isoDow, timeToMin, minToTime, fmtDate, fmtMin, DAYS_SHORT } from '../utils/time'
import { sessionMinutes, freeSlots } from '../utils/schedule'
import { vp } from '../utils/viewport'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import TimeGrid from '../components/TimeGrid.vue'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute(), router = useRouter()
const mode = ref(vp.w <= 900 ? 'day' : 'week')
const cursor = ref(todayStr())
const selDate = ref(todayStr())
const form = ref(null), errors = ref([])
const act = ref(null) // { type: 'detail'|'move'|'postpone'|'duplicate'|'missed', session, date, start }
const today = () => todayStr()

const range = computed(() => (mode.value === 'day' ? [cursor.value] : mode.value === 'week' ? weekDates(cursor.value, state.settings.weekStart) : []))
const columns = computed(() => range.value.map((d) => ({ key: d, label: `${DAYS_SHORT[isoDow(d) - 1]} ${parseDate(d).getDate()}`, today: d === today() })))
const title = computed(() => {
  if (mode.value === 'day') return fmtDate(cursor.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (mode.value === 'week') { const r = range.value; return `${fmtDate(r[0], { day: 'numeric', month: 'short' })} – ${fmtDate(r[6], { day: 'numeric', month: 'short', year: 'numeric' })}` }
  return parseDate(cursor.value).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})
function shift(dir) {
  if (mode.value === 'month') { const d = parseDate(cursor.value); d.setMonth(d.getMonth() + dir, 1); cursor.value = toDateStr(d) }
  else cursor.value = addDays(cursor.value, dir * (mode.value === 'day' ? 1 : 7))
}
const goToday = () => { cursor.value = today(); selDate.value = today() }

const sessionTitle = (s) => (s.kind === 'pause' ? 'Pause' : [subjectById(s.subjectId)?.name || 'Matière supprimée', chapterById(s.chapterId)?.title].filter(Boolean).join(' · '))
function display(s) {
  if (s.status === 'done') return { label: 'Terminée', tone: 'ok' }
  if (s.status === 'running') return { label: 'En cours', tone: 'accent' }
  if (s.status === 'cancelled') return { label: 'Annulée', tone: '' }
  if (s.date < today()) return { label: 'Manquée', tone: 'danger' }
  return s.status === 'postponed' ? { label: 'Reportée', tone: 'warn' } : { label: 'Prévue', tone: 'info' }
}

const items = computed(() => {
  const out = []
  for (const date of range.value) {
    const dow = isoDow(date)
    for (const c of state.timetable.filter((x) => x.day === dow && x.kind === 'course')) {
      const sub = subjectById(c.subjectId)
      out.push({ id: `c|${c.id}|${date}`, col: date, start: c.start, end: c.end, kind: 'course', title: sub?.name || 'Cours', sub: c.room, color: sub?.color })
    }
  }
  for (const s of state.sessions) {
    if (!range.value.includes(s.date)) continue
    out.push({ id: s.id, col: s.date, start: s.start, end: s.end, kind: s.kind === 'pause' ? 'pause' : 'session', status: s.status, title: sessionTitle(s), sub: s.kind === 'pause' ? '' : s.type, color: subjectById(s.subjectId)?.color })
  }
  return out
})

const listDates = computed(() => (mode.value === 'month' ? [selDate.value] : range.value))
const listSessions = computed(() => state.sessions.filter((s) => listDates.value.includes(s.date)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)))
const missed = computed(() => state.sessions.filter((s) => s.kind === 'study' && (s.status === 'planned' || s.status === 'postponed') && s.date < today()))
const free = computed(() => { const d = mode.value === 'day' ? cursor.value : mode.value === 'month' ? selDate.value : null; return d ? freeSlots(d, state.timetable, state.sessions, state.settings.dayStartHour, state.settings.dayEndHour, 20) : [] })

const cells = computed(() => { const d = parseDate(cursor.value); return monthGrid(d.getFullYear(), d.getMonth(), state.settings.weekStart) })
const curMonth = computed(() => parseDate(cursor.value).getMonth())
const cellInfo = (date) => ({
  n: state.sessions.filter((s) => s.date === date && s.kind === 'study' && s.status !== 'cancelled').length,
  ev: state.evaluations.filter((e) => e.date === date && (e.score === null || e.score === undefined || e.score === '')).length
})

/* ---- Formulaire de séance ---- */
function blank(date, start) {
  return { kind: 'study', subjectId: state.subjects[0]?.id || '', chapterId: '', date: date || today(), start: start || '18:00', durationMin: state.settings.sessionMin, type: SESSION_TYPES[0], goal: '', priority: 2, status: 'planned', addBreak: false }
}
function openForm(s, prefill = {}) {
  errors.value = []
  form.value = s ? { ...s, durationMin: sessionMinutes(s), addBreak: false } : { ...blank(prefill.date || (mode.value === 'month' ? selDate.value : mode.value === 'day' ? cursor.value : today()), prefill.start), ...prefill }
  act.value = null
}
watch(() => form.value?.subjectId, () => { if (form.value && form.value.chapterId && chapterById(form.value.chapterId)?.subjectId !== form.value.subjectId) form.value.chapterId = '' })
const endOf = (f) => minToTime(timeToMin(f.start) + Number(f.durationMin || 0))
async function submit() {
  const f = form.value
  errors.value = []
  const dur = Number(f.durationMin)
  if (!(dur >= 5)) errors.value.push('La durée doit être d’au moins 5 minutes.')
  else if (timeToMin(f.start) + dur >= 1440) errors.value.push('La séance doit se terminer avant minuit.')
  if (errors.value.length) return
  const rec = { ...f, end: endOf(f), subjectId: f.kind === 'pause' ? null : f.subjectId, chapterId: f.kind === 'pause' ? null : f.chapterId || null, priority: Number(f.priority) }
  delete rec.durationMin; delete rec.addBreak
  errors.value = validateSession(rec)
  if (errors.value.length) return
  const saved = await save('sessions', rec)
  if (!saved) return
  if (f.addBreak && f.kind === 'study' && !f.id) {
    const b = { kind: 'pause', date: f.date, start: rec.end, end: minToTime(timeToMin(rec.end) + state.settings.breakMin), status: 'planned', subjectId: null, chapterId: null }
    if (validateSession(b).length) toast('Séance ajoutée, mais la pause n’a pas pu être placée (conflit d’horaire).', 'warn')
    else await save('sessions', b)
  }
  form.value = null
  cursor.value = f.date; selDate.value = f.date
  toast(f.id ? 'Séance modifiée.' : 'Séance ajoutée au planning.', 'ok')
}

/* ---- Actions sur une séance ---- */
const openSession = (id) => { const s = state.sessions.find((x) => x.id === id); if (s) act.value = { type: 'detail', session: s } }
function onSelect(it) { if (it.kind !== 'course') openSession(it.id) }
function onCreate(date, min) { openForm(null, { date, start: minToTime(min) }) }
function openAct(type, s) { errors.value = []; act.value = { type, session: s, date: s.date, start: s.start } }
async function startSession(s) {
  if (state.timer) { toast('Une séance est déjà en cours : termine-la d’abord.', 'warn'); router.push('/chrono'); return }
  if (await timerStart({ sessionId: s.id, plannedMin: sessionMinutes(s) })) router.push('/chrono')
}
async function doMove() {
  const { session: s, date, start } = act.value
  const moved = { ...s, date, start, end: minToTime(timeToMin(start) + sessionMinutes(s)) }
  errors.value = validateSession(moved)
  if (errors.value.length) return
  if (await save('sessions', moved)) { act.value = null; toast('Séance déplacée.', 'ok') }
}
async function doPostpone() {
  const { session: s, date, start } = act.value
  const r = await postponeSession(s.id, date, start, minToTime(timeToMin(start) + sessionMinutes(s)))
  if (r?.errors) { errors.value = r.errors; return }
  act.value = null; toast('Séance reportée. Elle reste à faire.', 'ok')
}
async function doDuplicate() {
  const r = await duplicateSession(act.value.session.id, act.value.date)
  if (r?.errors) { errors.value = r.errors; return }
  act.value = null; toast('Séance dupliquée.', 'ok')
}
const setStatus = async (s, status) => { if (await save('sessions', { ...s, status })) act.value = null }
async function del(s) {
  if (await confirmDialog({ title: 'Supprimer cette séance ?', message: s.status === 'done' ? 'Le temps chronométré reste dans ton historique et tes statistiques.' : 'Elle disparaîtra de ton planning.', danger: true, confirmLabel: 'Supprimer' })) { await removeItem('sessions', s.id); act.value = null }
}

function handleQuery() {
  const q = route.query
  if (q.date) { cursor.value = q.date; selDate.value = q.date }
  if (q.new) openForm(null, { subjectId: q.subject || state.subjects[0]?.id || '', chapterId: q.chapter || '', ...(q.date ? { date: q.date } : {}), ...(q.start ? { start: q.start } : {}) })
  if (q.new || q.date) router.replace({ path: '/planning' })
}
onMounted(handleQuery)
watch(() => route.query, handleQuery)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div><h1>Planning de révision</h1><p>Ton programme personnel, bâti autour de tes cours.</p></div>
      <button class="btn primary" @click="openForm(null)"><Icon name="plus" :size="18" /> Ajouter une séance</button>
    </div>

    <div v-if="missed.length" class="card soft" style="margin-bottom:14px"><div class="row wrap"><Icon name="alert" /><span class="grow"><b>{{ missed.length }} séance{{ missed.length > 1 ? 's' : '' }} passée{{ missed.length > 1 ? 's' : '' }} non réalisée{{ missed.length > 1 ? 's' : '' }}.</b> Elles ne comptent pas comme terminées.</span><button class="btn sm" @click="act = { type: 'missed' }">Les traiter</button></div></div>

    <div class="row wrap between" style="margin-bottom:14px">
      <div class="row"><button class="icon-btn" aria-label="Précédent" @click="shift(-1)"><Icon name="chevL" /></button><button class="btn sm" @click="goToday">Aujourd'hui</button><button class="icon-btn" aria-label="Suivant" @click="shift(1)"><Icon name="chevR" /></button><h2 style="margin-left:6px;text-transform:capitalize">{{ title }}</h2></div>
      <div class="seg"><button :class="{ on: mode === 'day' }" @click="mode = 'day'">Jour</button><button :class="{ on: mode === 'week' }" @click="mode = 'week'">Semaine</button><button :class="{ on: mode === 'month' }" @click="mode = 'month'">Mois</button></div>
    </div>

    <TimeGrid v-if="mode !== 'month'" :columns="columns" :items="items" :start-hour="state.settings.dayStartHour" :end-hour="state.settings.dayEndHour" @select="onSelect" @create="onCreate" />
    <div v-else class="card flat">
      <div class="mgrid" style="margin-bottom:4px"><div v-for="i in 7" :key="i" class="small muted center">{{ DAYS_SHORT[(state.settings.weekStart - 1 + i - 1) % 7] }}</div></div>
      <div class="mgrid">
        <button v-for="d in cells" :key="d" type="button" class="mcell" :class="{ out: parseDate(d).getMonth() !== curMonth, today: d === today(), sel: d === selDate }" @click="selDate = d">
          <b class="small">{{ parseDate(d).getDate() }}</b>
          <span v-if="cellInfo(d).n" class="pill accent tiny">{{ cellInfo(d).n }} séance{{ cellInfo(d).n > 1 ? 's' : '' }}</span>
          <span v-if="cellInfo(d).ev" class="pill warn tiny">Éval.</span>
        </button>
      </div>
    </div>
    <p class="small muted" style="margin-top:8px">Les blocs unis sont tes cours ; les blocs en pointillés sont tes séances de révision. Clique sur la grille pour créer une séance.</p>

    <div class="grid g-main" style="margin-top:16px;align-items:start">
      <div class="card">
        <div class="card-head"><h2>{{ mode === 'month' ? `Séances du ${fmtDate(selDate, { day: 'numeric', month: 'long' })}` : 'Séances de la période' }}</h2><button v-if="mode === 'month'" class="btn sm" @click="openForm(null, { date: selDate })"><Icon name="plus" :size="15" /> Ajouter</button></div>
        <EmptyState v-if="!listSessions.length" icon="planning" title="Aucune séance planifiée" text="Ajoute une séance pour décider quand tu travailles quel chapitre.">
          <button class="btn primary" @click="openForm(null)"><Icon name="plus" :size="18" /> Planifier une séance</button>
        </EmptyState>
        <div v-else class="list">
          <div v-for="s in listSessions" :key="s.id" class="item click" @click="openSession(s.id)">
            <div class="sub-badge" :style="{ background: subjectById(s.subjectId)?.color || 'var(--ink-3)' }"><Icon :name="s.kind === 'pause' ? 'clock' : subjectById(s.subjectId)?.icon || 'book'" :size="18" /></div>
            <div class="grow"><div class="t">{{ sessionTitle(s) }}</div><div class="s">{{ listDates.length > 1 ? fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' : '' }}{{ s.start }}–{{ s.end }}<span v-if="s.kind === 'study'"> · prévu {{ fmtMin(sessionMinutes(s)) }}<span v-if="s.status === 'done'"> · réel {{ fmtMin(s.actualMin || 0) }}</span></span></div></div>
            <span class="pill" :class="display(s).tone">{{ display(s).label }}</span>
          </div>
        </div>
      </div>
      <div v-if="mode !== 'week'" class="card">
        <div class="card-head"><h2>Créneaux libres</h2></div>
        <p v-if="!free.length" class="small muted">Aucun créneau libre sur cette journée.</p>
        <div class="col"><button v-for="f in free" :key="f.start" class="btn" style="justify-content:space-between" @click="openForm(null, { date: mode === 'day' ? cursor : selDate, start: f.start, durationMin: Math.min(state.settings.sessionMin, f.minutes) })"><span>{{ f.start }} – {{ f.end }}</span><span class="muted small">{{ fmtMin(f.minutes) }} · planifier</span></button></div>
      </div>
    </div>

    <!-- Création / modification -->
    <Modal v-if="form" :title="form.id ? 'Modifier la séance' : 'Nouvelle séance'" @close="form = null">
      <div v-if="errors.length" class="err-list"><span v-for="e in errors" :key="e">{{ e }}</span></div>
      <div class="form-grid">
        <div v-if="!form.id" class="field full"><div class="seg"><button type="button" :class="{ on: form.kind === 'study' }" @click="form.kind = 'study'">Séance d'étude</button><button type="button" :class="{ on: form.kind === 'pause' }" @click="form.kind = 'pause'">Pause</button></div></div>
        <template v-if="form.kind === 'study'">
          <div class="field"><label for="ps">Matière</label><select id="ps" v-model="form.subjectId" class="select"><option v-if="!state.subjects.length" value="">Crée d'abord une matière</option><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
          <div class="field"><label for="pc">Chapitre</label><select id="pc" v-model="form.chapterId" class="select"><option value="">Aucun chapitre précis</option><option v-for="c in chaptersOf(form.subjectId)" :key="c.id" :value="c.id">{{ c.title }}</option></select></div>
        </template>
        <div class="field"><label for="pd">Date</label><input id="pd" v-model="form.date" type="date" class="input" /></div>
        <div class="field"><label for="pt">Heure de début</label><input id="pt" v-model="form.start" type="time" class="input" /></div>
        <div class="field"><label for="pm">Durée (minutes)</label><input id="pm" v-model.number="form.durationMin" type="number" min="5" step="5" class="input" /></div>
        <div class="field"><label>Fin</label><div class="input" style="background:var(--surface-2)">{{ endOf(form) }}</div></div>
        <template v-if="form.kind === 'study'">
          <div class="field"><label for="pty">Type de travail</label><select id="pty" v-model="form.type" class="select"><option v-for="t in SESSION_TYPES" :key="t">{{ t }}</option></select></div>
          <div class="field"><label for="ppr">Priorité</label><select id="ppr" v-model="form.priority" class="select"><option v-for="p in PRIORITY_LEVELS" :key="p.key" :value="p.key">{{ p.label }}</option></select></div>
          <div class="field full"><label for="pg">Objectif personnel (facultatif)</label><textarea id="pg" v-model="form.goal" class="textarea" style="min-height:60px" placeholder="Ex. : refaire les exercices 3 à 6" /></div>
          <label v-if="!form.id" class="row full small"><input v-model="form.addBreak" type="checkbox" /> Ajouter une pause de {{ state.settings.breakMin }} min après cette séance</label>
        </template>
      </div>
      <template #footer><button class="btn" @click="form = null">Annuler</button><button class="btn primary" @click="submit">Enregistrer</button></template>
    </Modal>

    <!-- Détail & actions -->
    <Modal v-if="act?.type === 'detail'" :title="sessionTitle(act.session)" @close="act = null">
      <div class="row wrap"><span class="pill" :class="display(act.session).tone">{{ display(act.session).label }}</span><span v-if="act.session.postponedCount" class="pill warn">Reportée {{ act.session.postponedCount }}×</span><span v-if="act.session.kind === 'study'" class="pill">Priorité {{ PRIORITY_LEVELS.find((p) => p.key === act.session.priority)?.label }}</span></div>
      <div class="col" style="gap:4px"><div><b>{{ fmtDate(act.session.date) }}</b>, {{ act.session.start }}–{{ act.session.end }}</div>
        <div v-if="act.session.kind === 'study'" class="muted">{{ act.session.type }}</div>
        <div v-if="act.session.goal" class="muted" style="white-space:pre-line">Objectif : {{ act.session.goal }}</div>
        <div v-if="act.session.kind === 'study'" class="num">Prévu : {{ fmtMin(sessionMinutes(act.session)) }}<span v-if="act.session.status === 'done'"> · Réellement travaillé : <b>{{ fmtMin(act.session.actualMin || 0) }}</b> ({{ (act.session.actualMin || 0) - sessionMinutes(act.session) >= 0 ? '+' : '−' }}{{ fmtMin(Math.abs((act.session.actualMin || 0) - sessionMinutes(act.session))) }})</span></div>
        <div v-if="act.session.endedEarly" class="small muted">Terminée avant la durée prévue.</div></div>
      <template #footer>
        <button class="btn danger" style="margin-right:auto" @click="del(act.session)"><Icon name="trash" :size="16" /> Supprimer</button>
        <template v-if="act.session.status !== 'done' && act.session.status !== 'running'">
          <button v-if="act.session.status !== 'cancelled'" class="btn" @click="openForm(act.session)"><Icon name="edit" :size="16" /> Modifier</button>
          <button v-if="act.session.status !== 'cancelled'" class="btn" @click="openAct('move', act.session)"><Icon name="move" :size="16" /> Déplacer</button>
          <button v-if="act.session.kind === 'study' && act.session.status !== 'cancelled'" class="btn" @click="openAct('postpone', act.session)"><Icon name="postpone" :size="16" /> Reporter</button>
          <button v-if="act.session.status !== 'cancelled'" class="btn" @click="setStatus(act.session, 'cancelled')">Annuler</button>
          <button v-else class="btn" @click="setStatus(act.session, 'planned')">Rétablir</button>
        </template>
        <button class="btn" @click="openAct('duplicate', act.session)"><Icon name="copy" :size="16" /> Dupliquer</button>
        <button v-if="act.session.kind === 'study' && (act.session.status === 'planned' || act.session.status === 'postponed')" class="btn primary" @click="startSession(act.session)"><Icon name="play" :size="16" /> Démarrer</button>
        <button v-if="act.session.status === 'running'" class="btn primary" @click="router.push('/chrono')">Ouvrir le chronomètre</button>
      </template>
    </Modal>

    <Modal v-if="act && ['move', 'postpone', 'duplicate'].includes(act.type)" :title="{ move: 'Déplacer la séance', postpone: 'Reporter la séance', duplicate: 'Dupliquer la séance' }[act.type]" @close="act = null">
      <div v-if="errors.length" class="err-list"><span v-for="e in errors" :key="e">{{ e }}</span></div>
      <p v-if="act.type === 'postpone'" class="muted">La séance sera déplacée à la nouvelle date et restera marquée « reportée » tant qu'elle n'est pas faite.</p>
      <div class="form-grid"><div class="field"><label for="ad">Date</label><input id="ad" v-model="act.date" type="date" class="input" /></div><div v-if="act.type !== 'duplicate'" class="field"><label for="as">Heure de début</label><input id="as" v-model="act.start" type="time" class="input" /></div></div>
      <template #footer><button class="btn" @click="act = null">Annuler</button><button class="btn primary" @click="{ move: doMove, postpone: doPostpone, duplicate: doDuplicate }[act.type]()">Confirmer</button></template>
    </Modal>

    <Modal v-if="act?.type === 'missed'" title="Séances non réalisées" wide @close="act = null">
      <div class="list"><div v-for="s in missed" :key="s.id" class="item"><div class="grow"><div class="t">{{ sessionTitle(s) }}</div><div class="s">{{ fmtDate(s.date) }}, {{ s.start }}–{{ s.end }}</div></div><button class="btn sm" @click="openAct('postpone', s)">Reporter</button><button class="btn sm" @click="setStatus(s, 'cancelled')">Annuler</button></div></div>
      <p v-if="!missed.length" class="muted">Tout est à jour.</p>
    </Modal>
  </div>
</template>
