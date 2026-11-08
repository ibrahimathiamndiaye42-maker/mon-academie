<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { state, timerStart, timerPause, timerResume, timerFinish, timerAbort, timerSetNotes, save, removeItem, subjectById, chapterById, chaptersOf, confirmDialog, toast } from '../store'
import { workElapsed, pauseElapsed } from '../utils/timer'
import { fmtHMS, fmtMin, fmtTs, fmtDate, todayStr } from '../utils/time'
import { sessionMinutes } from '../utils/schedule'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const t = computed(() => state.timer)
const work = computed(() => (t.value ? workElapsed(t.value, state.now) : 0))
const pause = computed(() => (t.value ? pauseElapsed(t.value, state.now) : 0))
const plannedMs = computed(() => (t.value?.plannedMin || 0) * 60000)
const ratio = computed(() => (plannedMs.value ? Math.min(1, work.value / plannedMs.value) : 0))
const R = 138, C = 2 * Math.PI * R
const sub = computed(() => subjectById(t.value?.subjectId))
const ch = computed(() => chapterById(t.value?.chapterId))
const early = computed(() => plannedMs.value && work.value < plannedMs.value)

/* Choix avant démarrage */
const subjectId = ref(state.subjects[0]?.id || '')
const chapterId = ref('')
const plannedMin = ref(state.settings.sessionMin)
const notes = ref('')
watch(subjectId, () => { if (chapterId.value && chapterById(chapterId.value)?.subjectId !== subjectId.value) chapterId.value = '' })
const today = computed(() => state.sessions.filter((s) => s.kind === 'study' && s.date === todayStr() && (s.status === 'planned' || s.status === 'postponed')).sort((a, b) => a.start.localeCompare(b.start)))

async function startFree() {
  if (!subjectId.value) { toast('Choisis une matière pour démarrer.', 'warn'); return }
  await timerStart({ subjectId: subjectId.value, chapterId: chapterId.value || null, plannedMin: Number(plannedMin.value) || 0, notes: notes.value })
  notes.value = ''
}
const startPlanned = (s) => timerStart({ sessionId: s.id, plannedMin: sessionMinutes(s) })

const localNotes = ref('')
watch(() => t.value?.startTs, () => { localNotes.value = t.value?.notes || '' }, { immediate: true })
async function finish() {
  if (work.value < 60000 && !(await confirmDialog({ title: 'Séance de moins d’une minute', message: 'Cette séance sera quand même enregistrée dans ton historique. Continuer ?', confirmLabel: 'Enregistrer' }))) return
  const wasEarly = early.value
  const log = await timerFinish(localNotes.value)
  if (log) toast(`Séance enregistrée : ${fmtMin(log.workMs / 60000)} de travail effectif${wasEarly ? ' (terminée avant la durée prévue)' : ''}.`, 'ok', 6000)
}
async function abort() {
  if (await confirmDialog({ title: 'Abandonner cette séance ?', message: 'Le temps chronométré ne sera PAS enregistré.', danger: true, confirmLabel: 'Abandonner sans enregistrer' })) await timerAbort()
}

/* Reprendre ma révision : rouvre le dernier document du chapitre (ou de la matière), à la dernière page lue. */
function docFor(chapter, subject) {
  const byRecent = (a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)
  const c = chapter ? state.documents.filter((d) => d.chapterId === chapter).sort(byRecent) : []
  if (c.length) return c[0]
  const s = subject ? state.documents.filter((d) => d.subjectId === subject).sort(byRecent) : []
  return s[0] || null
}
const resumeDoc = computed(() => (t.value ? docFor(t.value.chapterId, t.value.subjectId) : docFor(lastLog.value?.chapterId, lastLog.value?.subjectId)))
const resume = () => resumeDoc.value && router.push(`/cours/${resumeDoc.value.id}`)

/* Historique */
const shown = ref(15)
const history = computed(() => [...state.logs].sort((a, b) => b.startTs - a.startTs))
const lastLog = computed(() => history.value[0] || null)
const editing = ref(null)
const label = (l) => [subjectById(l.subjectId)?.name || 'Matière supprimée', chapterById(l.chapterId)?.title].filter(Boolean).join(' · ')
async function saveNotes() { if (await save('logs', editing.value)) editing.value = null }
async function delLog(l) {
  if (await confirmDialog({ title: 'Supprimer cette séance de l’historique ?', message: 'Ce temps sera retiré de tes statistiques.', danger: true, confirmLabel: 'Supprimer' })) await removeItem('logs', l.id)
}
</script>

<template>
  <div class="page">
    <div class="page-head"><div><h1>Chronomètre</h1><p>Seul le temps de travail réel est compté : les pauses ne le sont jamais.</p></div></div>

    <div v-if="t" class="grid g-main" style="align-items:start">
      <div class="card center">
        <div class="row" style="justify-content:center;gap:10px"><span class="pill accent">{{ t.status === 'paused' ? 'En pause' : 'En cours' }}</span><span v-if="sub" class="pill"><i class="dot" :style="{ background: sub.color }" />{{ sub.name }}</span><span v-if="ch" class="pill">{{ ch.title }}</span></div>
        <div class="timer-face">
          <svg viewBox="0 0 300 300"><circle cx="150" cy="150" :r="R" fill="none" stroke="var(--surface-2)" stroke-width="12" /><circle cx="150" cy="150" :r="R" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - ratio)" style="transition: stroke-dashoffset .9s linear" /></svg>
          <div>
            <div class="timer-digits" :class="{ paused: t.status === 'paused' }">{{ fmtHMS(work) }}</div>
            <div class="small muted num">{{ plannedMs ? (work < plannedMs ? `reste ${fmtHMS(plannedMs - work)}` : `+${fmtMin((work - plannedMs) / 60000)} au-delà de l'objectif`) : 'sans durée prévue' }}</div>
            <div class="small faint num" style="margin-top:4px">Pauses : {{ fmtHMS(pause) }}</div>
          </div>
        </div>
        <div class="row wrap" style="justify-content:center;margin-top:8px">
          <button v-if="t.status === 'running'" class="btn lg" @click="timerPause"><Icon name="pause" /> Pause</button>
          <button v-else class="btn lg primary" @click="timerResume"><Icon name="play" /> Reprendre</button>
          <button class="btn lg" @click="finish"><Icon name="check" /> {{ early ? 'Terminer avant la durée prévue' : 'Terminer' }}</button>
        </div>
        <div class="row wrap" style="justify-content:center;margin-top:12px"><button v-if="resumeDoc" class="btn" @click="resume"><Icon name="book" :size="18" /> Reprendre ma révision</button><button class="btn ghost danger" @click="abort">Abandonner</button></div>
      </div>
      <div class="card"><div class="card-head"><h2>Observations</h2></div><textarea v-model="localNotes" class="textarea" style="min-height:140px" placeholder="Ce que tu as compris, ce qui bloque…" @blur="timerSetNotes(localNotes)" /><p class="small muted" style="margin-top:8px">Début à {{ fmtTs(t.startTs) }}. Tu peux fermer l'application : la séance continue d'être mesurée par l'heure de début, pas par la page ouverte.</p></div>
    </div>

    <div v-else class="grid g-main" style="align-items:start">
      <div class="card">
        <div class="card-head"><h2>Démarrer une séance libre</h2></div>
        <EmptyState v-if="!state.subjects.length" icon="layers" title="Crée une matière d'abord" text="Le chronomètre rattache chaque séance à une matière."><router-link class="btn primary" to="/matieres">Ajouter une matière</router-link></EmptyState>
        <div v-else class="form-grid">
          <div class="field"><label for="ts">Matière</label><select id="ts" v-model="subjectId" class="select"><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
          <div class="field"><label for="tc">Chapitre</label><select id="tc" v-model="chapterId" class="select"><option value="">Aucun chapitre précis</option><option v-for="c in chaptersOf(subjectId)" :key="c.id" :value="c.id">{{ c.title }}</option></select></div>
          <div class="field"><label for="tp">Durée prévue (min, 0 = libre)</label><input id="tp" v-model.number="plannedMin" type="number" min="0" step="5" class="input" /></div>
          <div class="field full"><button class="btn primary lg" @click="startFree"><Icon name="play" /> Démarrer</button></div>
        </div>
        <button v-if="resumeDoc" class="btn" style="margin-top:14px" @click="resume"><Icon name="book" :size="18" /> Reprendre ma révision <span class="muted small">— {{ resumeDoc.title }}</span></button>
      </div>
      <div class="card">
        <div class="card-head"><h2>Prévues aujourd'hui</h2></div>
        <p v-if="!today.length" class="small muted">Aucune séance planifiée pour aujourd'hui. <router-link to="/planning">Ouvrir le planning</router-link></p>
        <div class="list"><div v-for="s in today" :key="s.id" class="item"><div class="grow"><div class="t">{{ subjectById(s.subjectId)?.name }}</div><div class="s">{{ s.start }}–{{ s.end }} · {{ chapterById(s.chapterId)?.title || s.type }}</div></div><button class="btn sm primary" @click="startPlanned(s)"><Icon name="play" :size="14" /> Démarrer</button></div></div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Historique des séances</h2><span class="small muted">{{ history.length }} séance{{ history.length > 1 ? 's' : '' }}</span></div>
      <EmptyState v-if="!history.length" icon="timer" title="Aucune séance chronométrée" text="Chaque séance terminée apparaîtra ici avec son temps de travail effectif et ses pauses." />
      <div v-else class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Matière / chapitre</th><th>Horaire</th><th>Travail effectif</th><th>Pauses</th><th>Statut</th><th /></tr></thead>
        <tbody><tr v-for="l in history.slice(0, shown)" :key="l.id"><td>{{ fmtDate(l.date, { day: 'numeric', month: 'short' }) }}</td><td><b>{{ label(l) }}</b><div v-if="l.notes" class="small muted">{{ l.notes }}</div></td><td class="num">{{ fmtTs(l.startTs) }}–{{ fmtTs(l.endTs) }}</td><td class="num"><b>{{ fmtMin(l.workMs / 60000) }}</b></td><td class="num">{{ fmtMin(l.pauseMs / 60000) }}</td><td><span class="pill" :class="l.early ? 'warn' : 'ok'">{{ l.early ? 'Terminée avant la durée prévue' : 'Terminée' }}</span></td><td style="white-space:nowrap"><button class="icon-btn" aria-label="Modifier les observations" @click="editing = { ...l }"><Icon name="edit" :size="17" /></button><button class="icon-btn" aria-label="Supprimer" @click="delLog(l)"><Icon name="trash" :size="17" /></button></td></tr></tbody></table></div>
      <button v-if="history.length > shown" class="btn" style="margin-top:12px" @click="shown += 15">Afficher plus</button>
    </div>

    <Modal v-if="editing" title="Observations de la séance" @close="editing = null"><textarea v-model="editing.notes" class="textarea" style="min-height:120px" /><template #footer><button class="btn" @click="editing = null">Annuler</button><button class="btn primary" @click="saveNotes">Enregistrer</button></template></Modal>
  </div>
</template>
