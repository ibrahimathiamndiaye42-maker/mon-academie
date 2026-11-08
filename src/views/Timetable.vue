<script setup>
import { ref, computed, watch } from 'vue'
import { state, save, removeItem, validateCourse, courseConflictList, subjectById, confirmDialog, toast } from '../store'
import { DAYS, DAYS_SHORT, addDays, startOfWeek, todayStr, isoDow, minToTime, timeToMin, fmtMin } from '../utils/time'
import { freeSlots } from '../utils/schedule'
import { vp } from '../utils/viewport'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import TimeGrid from '../components/TimeGrid.vue'
import EmptyState from '../components/EmptyState.vue'

const mode = ref(vp.w <= 900 ? 'day' : 'week')
const selDay = ref(isoDow(todayStr()))
const form = ref(null), errors = ref([]), conflicts = ref([]), ack = ref(false)
const lastDay = computed(() => (state.settings.showWeekend ? 7 : 5))
const days = computed(() => Array.from({ length: lastDay.value }, (_, i) => i + 1))
const columns = computed(() => (mode.value === 'week' ? days.value : [Math.min(selDay.value, lastDay.value)]).map((d) => ({ key: d, label: DAYS[d - 1], today: d === isoDow(todayStr()) })))

const items = computed(() => state.timetable.map((c) => {
  const sub = subjectById(c.subjectId)
  return { id: c.id, col: c.day, start: c.start, end: c.end, kind: c.kind === 'pause' ? 'pause' : 'course', title: c.kind === 'pause' ? 'Pause' : sub?.name || 'Cours', sub: [c.room, c.teacher].filter(Boolean).join(' · '), color: sub?.color, conflict: courseConflictList(c).length > 0 }
}))
const conflictCount = computed(() => items.value.filter((i) => i.conflict).length)

// Périodes libres : calculées à partir d'une semaine réelle (même emploi du temps chaque semaine).
const weekStartDate = computed(() => startOfWeek(todayStr(), 1))
const freeByDay = computed(() => (mode.value === 'week' ? days.value : [selDay.value]).map((d) => ({ day: d, slots: freeSlots(addDays(weekStartDate.value, d - 1), state.timetable, [], state.settings.dayStartHour, state.settings.dayEndHour, 30) })))

function open(c) {
  errors.value = []; conflicts.value = []; ack.value = false
  form.value = c ? { ...c } : { kind: 'course', day: selDay.value, subjectId: state.subjects[0]?.id || '', start: '08:00', end: '10:00', room: '', teacher: '' }
}
function onCreate(day, min) { open(null); form.value.day = day; form.value.start = minToTime(min); form.value.end = minToTime(Math.min(min + 120, 23 * 60 + 45)) }
function onSelect(it) { open(state.timetable.find((c) => c.id === it.id)) }
watch(() => form.value && [form.value.day, form.value.start, form.value.end], () => { ack.value = false; conflicts.value = [] })

async function submit() {
  const f = form.value
  errors.value = validateCourse(f)
  if (errors.value.length) return
  const cl = courseConflictList(f)
  if (cl.length && !ack.value) {
    conflicts.value = cl
    ack.value = true // un second clic confirme l'enregistrement malgré le chevauchement
    return
  }
  if (await save('timetable', { ...f, subjectId: f.kind === 'pause' ? null : f.subjectId })) { form.value = null; toast('Emploi du temps mis à jour.', 'ok') }
}
async function remove() {
  const f = form.value
  if (await confirmDialog({ title: 'Supprimer ce créneau ?', message: 'Le cours disparaîtra de ton emploi du temps.', danger: true, confirmLabel: 'Supprimer' })) {
    await removeItem('timetable', f.id); form.value = null
  }
}
const label = (c) => (c.kind === 'pause' ? 'Pause' : subjectById(c.subjectId)?.name || 'Cours')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div><h1>Emploi du temps</h1><p>Les cours de ton établissement, semaine après semaine.</p></div>
      <div class="row wrap">
        <div class="seg" role="tablist"><button :class="{ on: mode === 'week' }" @click="mode = 'week'">Semaine</button><button :class="{ on: mode === 'day' }" @click="mode = 'day'">Jour</button></div>
        <button class="btn primary" @click="open(null)"><Icon name="plus" :size="18" /> Ajouter un cours</button>
      </div>
    </div>

    <EmptyState v-if="!state.subjects.length && !state.timetable.length" icon="timetable" title="Commence par créer tes matières" text="Chaque cours de l'emploi du temps est rattaché à une matière. Tu peux aussi ajouter des pauses sans matière.">
      <router-link class="btn primary" to="/matieres">Créer mes matières</router-link>
    </EmptyState>
    <template v-else>
      <div v-if="mode === 'day'" class="row wrap" style="margin-bottom:12px"><button v-for="d in days" :key="d" class="btn sm" :class="{ primary: selDay === d }" @click="selDay = d">{{ DAYS_SHORT[d - 1] }}</button></div>
      <div v-if="conflictCount" class="err-list" style="margin-bottom:12px"><span><Icon name="alert" :size="15" /> {{ conflictCount }} créneau{{ conflictCount > 1 ? 'x' : '' }} se chevauche{{ conflictCount > 1 ? 'nt' : '' }} (encadré{{ conflictCount > 1 ? 's' : '' }} en rouge). Clique dessus pour corriger l'horaire.</span></div>
      <TimeGrid :columns="columns" :items="items" :start-hour="state.settings.dayStartHour" :end-hour="state.settings.dayEndHour" @select="onSelect" @create="onCreate" />
      <p v-if="!state.timetable.length" class="small muted" style="margin-top:10px">Astuce : clique sur la grille pour ajouter un cours à l'heure voulue.</p>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><h2>Périodes libres</h2><span class="small muted">Utilisées pour planifier tes révisions</span></div>
        <div class="col">
          <div v-for="f in freeByDay" :key="f.day" class="row wrap"><b style="width:90px">{{ DAYS[f.day - 1] }}</b>
            <span v-if="!f.slots.length" class="small muted">Aucune période libre</span>
            <span v-for="s in f.slots" :key="s.start" class="pill">{{ s.start }}–{{ s.end }} · {{ fmtMin(s.minutes) }}</span>
          </div>
        </div>
      </div>
    </template>

    <Modal v-if="form" :title="form.id ? 'Modifier / déplacer le créneau' : 'Ajouter un créneau'" @close="form = null">
      <div v-if="errors.length" class="err-list"><span v-for="e in errors" :key="e">{{ e }}</span></div>
      <div v-if="conflicts.length" class="err-list"><b>Chevauchement détecté</b><span v-for="c in conflicts" :key="c.id">Même horaire que : {{ label(c) }} ({{ c.start }}–{{ c.end }})</span><span>Clique à nouveau sur « Enregistrer malgré le conflit » pour confirmer, ou change l'horaire.</span></div>
      <div class="form-grid">
        <div class="field"><label for="tk">Type</label><select id="tk" v-model="form.kind" class="select"><option value="course">Cours</option><option value="pause">Pause</option></select></div>
        <div class="field"><label for="td">Jour</label><select id="td" v-model.number="form.day" class="select"><option v-for="(d, i) in DAYS" :key="d" :value="i + 1">{{ d }}</option></select></div>
        <div v-if="form.kind === 'course'" class="field full"><label for="ts">Matière</label>
          <select id="ts" v-model="form.subjectId" class="select"><option v-if="!state.subjects.length" value="">Aucune matière : crée-en une d'abord</option><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
        <div class="field"><label for="t1">Début</label><input id="t1" v-model="form.start" type="time" class="input" /></div>
        <div class="field"><label for="t2">Fin</label><input id="t2" v-model="form.end" type="time" class="input" /></div>
        <div v-if="form.kind === 'course'" class="field"><label for="tr">Salle (facultatif)</label><input id="tr" v-model="form.room" class="input" /></div>
        <div v-if="form.kind === 'course'" class="field"><label for="te">Enseignant (facultatif)</label><input id="te" v-model="form.teacher" class="input" /></div>
      </div>
      <template #footer>
        <button v-if="form.id" class="btn danger" style="margin-right:auto" @click="remove"><Icon name="trash" :size="16" /> Supprimer</button>
        <button class="btn" @click="form = null">Annuler</button>
        <button class="btn primary" @click="submit">{{ conflicts.length ? 'Enregistrer malgré le conflit' : 'Enregistrer' }}</button>
      </template>
    </Modal>
  </div>
</template>
