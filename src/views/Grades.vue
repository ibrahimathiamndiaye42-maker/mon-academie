<script setup>
import { ref, computed, watch } from 'vue'
import { state, save, removeItem, subjectById, chapterById, chaptersOf, confirmDialog, toast } from '../store'
import { EVAL_TYPES, statusInfo } from '../constants'
import { toOn20, isGraded, subjectAverage, generalAverage, fmtGrade } from '../utils/grades'
import { averageEvolution } from '../utils/stats'
import { todayStr, diffDays, fmtDate, fmtDateShort, relDays } from '../utils/time'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import EmptyState from '../components/EmptyState.vue'
import ProgressBar from '../components/ProgressBar.vue'
import LineChart from '../components/LineChart.vue'

const tab = ref('results')
const fSubject = ref('')
const form = ref(null), errors = ref([])

const graded = computed(() => state.evaluations.filter((e) => isGraded(e) && (!fSubject.value || e.subjectId === fSubject.value)).sort((a, b) => b.date.localeCompare(a.date)))
const upcoming = computed(() => state.evaluations.filter((e) => !isGraded(e)).sort((a, b) => a.date.localeCompare(b.date)))
const avgs = computed(() => state.subjects.map((s) => ({ s, ...subjectAverage(state.evaluations.filter((e) => e.subjectId === s.id)) })))
const general = computed(() => generalAverage(state.subjects, state.evaluations))
const evo = computed(() => averageEvolution(state.subjects, state.evaluations).map((p) => ({ label: fmtDateShort(p.date), value: p.avg })))

function prep(e) {
  const chs = (e.chapterIds || []).map(chapterById).filter(Boolean)
  return chs.length ? Math.round((100 * chs.reduce((a, c) => a + statusInfo(c.status).weight, 0)) / chs.length) : Number(e.prepared) || 0
}
function open(e) {
  errors.value = []
  form.value = e ? { ...e, score: e.score ?? '', chapterIds: [...(e.chapterIds || [])] } : { subjectId: state.subjects[0]?.id || '', title: '', type: 'Devoir', date: todayStr(), score: '', max: 20, coef: 1, note: '', chapterIds: [], prepared: 0 }
}
watch(() => form.value?.subjectId, (v, o) => { if (form.value && o) form.value.chapterIds = [] })
const preview = computed(() => (form.value && form.value.score !== '' ? toOn20(form.value.score, form.value.max) : null))
async function submit() {
  const f = form.value
  errors.value = []
  if (!f.subjectId) errors.value.push('Choisis une matière.')
  if (!f.title.trim()) errors.value.push("Donne un intitulé à l'évaluation.")
  if (!f.date) errors.value.push('Indique la date.')
  if (!(Number(f.max) > 0)) errors.value.push('La note maximale doit être supérieure à 0.')
  if (!(Number(f.coef) > 0)) errors.value.push('Le coefficient doit être supérieur à 0.')
  if (f.score !== '') {
    if (isNaN(Number(f.score)) || Number(f.score) < 0) errors.value.push('La note doit être un nombre positif.')
    else if (Number(f.score) > Number(f.max)) errors.value.push(`La note (${f.score}) dépasse la note maximale (${f.max}).`)
  }
  if (errors.value.length) return
  if (await save('evaluations', { ...f, title: f.title.trim(), score: f.score === '' ? null : Number(f.score), max: Number(f.max), coef: Number(f.coef), prepared: Number(f.prepared) || 0 })) { form.value = null; toast('Évaluation enregistrée. Les moyennes sont à jour.', 'ok') }
}
async function del(e) { if (await confirmDialog({ title: `Supprimer « ${e.title} » ?`, danger: true, confirmLabel: 'Supprimer', message: 'Les moyennes seront recalculées.' })) { await removeItem('evaluations', e.id); form.value = null } }
const toneOf = (v) => (v === null ? '' : v >= 14 ? 'ok' : v >= 10 ? 'info' : 'danger')
</script>

<template>
  <div class="page">
    <div class="page-head"><div><h1>Notes et évaluations</h1><p>Tes résultats, tes moyennes et ce qui arrive.</p></div><button class="btn primary" @click="open(null)"><Icon name="plus" :size="18" /> Ajouter une évaluation</button></div>
    <EmptyState v-if="!state.subjects.length" icon="grades" title="Crée une matière d'abord" text="Chaque évaluation est rattachée à une matière."><router-link class="btn primary" to="/matieres">Ajouter une matière</router-link></EmptyState>
    <template v-else>
      <div class="grid g3" style="margin-bottom:16px">
        <div class="card stat"><span class="l">Moyenne générale</span><span class="v">{{ fmtGrade(general) }}<small class="small muted" style="font-family:var(--sans)"> /20</small></span><span class="tiny faint">Moyennes de matières pondérées par leur coefficient (1 si non renseigné).</span></div>
        <div class="card stat"><span class="l">Notes enregistrées</span><span class="v">{{ state.evaluations.filter((e) => isGraded(e)).length }}</span></div>
        <div class="card stat"><span class="l">Évaluations à venir</span><span class="v">{{ upcoming.length }}</span></div>
      </div>
      <div class="tabs"><button :class="{ on: tab === 'results' }" @click="tab = 'results'">Résultats</button><button :class="{ on: tab === 'upcoming' }" @click="tab = 'upcoming'">À venir ({{ upcoming.length }})</button><button :class="{ on: tab === 'avg' }" @click="tab = 'avg'">Moyennes</button></div>

      <template v-if="tab === 'results'">
        <select v-model="fSubject" class="select" style="width:auto;margin-bottom:12px" aria-label="Filtrer par matière"><option value="">Toutes les matières</option><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select>
        <EmptyState v-if="!graded.length" icon="grades" title="Aucune note" text="Ajoute une évaluation avec sa note pour calculer tes moyennes." />
        <div v-else class="card table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Matière</th><th>Évaluation</th><th>Note</th><th>Sur 20</th><th>Coef.</th><th /></tr></thead><tbody>
          <tr v-for="e in graded" :key="e.id"><td>{{ fmtDateShort(e.date) }}</td><td><i class="dot" :style="{ background: subjectById(e.subjectId)?.color }" /> {{ subjectById(e.subjectId)?.name }}</td><td><b>{{ e.title }}</b> <span class="small muted">{{ e.type }}</span><div v-if="e.note" class="small muted">{{ e.note }}</div></td><td class="num">{{ fmtGrade(e.score, 2) }} / {{ e.max }}</td><td><span class="pill" :class="toneOf(toOn20(e.score, e.max))">{{ fmtGrade(toOn20(e.score, e.max)) }}</span></td><td class="num">{{ e.coef }}</td><td style="white-space:nowrap"><button class="icon-btn" :aria-label="`Modifier ${e.title}`" @click="open(e)"><Icon name="edit" :size="17" /></button><button class="icon-btn" :aria-label="`Supprimer ${e.title}`" @click="del(e)"><Icon name="trash" :size="17" /></button></td></tr></tbody></table></div>
      </template>

      <template v-else-if="tab === 'upcoming'">
        <EmptyState v-if="!upcoming.length" icon="planning" title="Aucune évaluation à venir" text="Ajoute un devoir ou un examen sans note : il apparaîtra ici avec le décompte des jours." />
        <div v-else class="grid g2"><div v-for="e in upcoming" :key="e.id" class="card"><div class="row"><span class="dot" :style="{ background: subjectById(e.subjectId)?.color }" /><b class="grow">{{ subjectById(e.subjectId)?.name }}</b><span class="pill" :class="diffDays(todayStr(), e.date) < 0 ? 'danger' : diffDays(todayStr(), e.date) <= 7 ? 'warn' : 'info'">{{ diffDays(todayStr(), e.date) < 0 ? 'Note à saisir' : relDays(e.date) }}</span></div>
          <div style="margin-top:6px"><div class="t" style="font-weight:600">{{ e.title }} <span class="small muted">· {{ e.type }}</span></div><div class="small muted">{{ fmtDate(e.date) }} · coef. {{ e.coef }}</div></div>
          <div style="margin-top:10px"><div class="small muted">Niveau de préparation : {{ prep(e) }}%</div><ProgressBar :value="prep(e)" :color="subjectById(e.subjectId)?.color" /></div>
          <div v-if="(e.chapterIds || []).length" class="row wrap" style="margin-top:8px"><span v-for="c in e.chapterIds.map(chapterById).filter(Boolean)" :key="c.id" class="pill">{{ c.title }}</span></div>
          <div class="row" style="margin-top:12px"><button class="btn sm" @click="open(e)"><Icon name="edit" :size="15" /> Modifier / saisir la note</button><button class="icon-btn" aria-label="Supprimer" @click="del(e)"><Icon name="trash" :size="17" /></button></div></div></div>
      </template>

      <template v-else>
        <div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Par matière</h2></div>
          <div class="list"><div v-for="a in avgs" :key="a.s.id" class="item"><i class="dot" :style="{ background: a.s.color }" /><div class="grow"><div class="t">{{ a.s.name }}</div><div class="s">{{ a.count }} note{{ a.count > 1 ? 's' : '' }} · somme des coefficients {{ a.coefs }}</div></div><span class="pill" :class="toneOf(a.avg)">{{ fmtGrade(a.avg) }} / 20</span></div></div>
          <p class="tiny faint" style="margin-top:12px">Calcul : moyenne de matière = Σ (note ÷ note maximale × 20 × coefficient) ÷ Σ coefficients. Moyenne générale = Σ (moyenne de matière × coefficient de matière) ÷ Σ coefficients de matière, sur les matières ayant au moins une note.</p></div>
        <div class="card"><div class="card-head"><h2>Évolution de la moyenne générale</h2></div><p v-if="!evo.length" class="muted small">Ajoute des notes à des dates différentes pour voir la courbe.</p><LineChart v-else :points="evo" :max="20" suffix=" /20" /></div>
      </template>
    </template>

    <Modal v-if="form" :title="form.id ? 'Modifier l’évaluation' : 'Nouvelle évaluation'" wide @close="form = null">
      <div v-if="errors.length" class="err-list"><span v-for="e in errors" :key="e">{{ e }}</span></div>
      <div class="form-grid">
        <div class="field"><label for="gs">Matière</label><select id="gs" v-model="form.subjectId" class="select"><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
        <div class="field"><label for="gt">Type</label><select id="gt" v-model="form.type" class="select"><option v-for="t in EVAL_TYPES" :key="t">{{ t }}</option></select></div>
        <div class="field full"><label for="gi">Intitulé</label><input id="gi" v-model="form.title" class="input" /></div>
        <div class="field"><label for="gd">Date</label><input id="gd" v-model="form.date" type="date" class="input" /></div>
        <div class="field"><label for="gc">Coefficient</label><input id="gc" v-model="form.coef" type="number" min="0" step="0.5" class="input" /></div>
        <div class="field"><label for="gn">Note obtenue (vide si à venir)</label><input id="gn" v-model="form.score" type="number" min="0" step="0.25" class="input" /></div>
        <div class="field"><label for="gm">Note maximale</label><input id="gm" v-model="form.max" type="number" min="1" step="1" class="input" /></div>
        <div v-if="preview !== null" class="field full"><span class="pill accent">Équivaut à {{ fmtGrade(preview) }} / 20</span></div>
        <div class="field full"><label>Chapitres concernés</label><div class="row wrap"><label v-for="c in chaptersOf(form.subjectId)" :key="c.id" class="row small"><input v-model="form.chapterIds" type="checkbox" :value="c.id" /> {{ c.title }}</label><span v-if="!chaptersOf(form.subjectId).length" class="small muted">Aucun chapitre dans cette matière.</span></div></div>
        <div v-if="!form.chapterIds.length && form.score === ''" class="field full"><label for="gp">Niveau de préparation : {{ form.prepared }}%</label><input id="gp" v-model="form.prepared" type="range" min="0" max="100" step="5" /></div>
        <div class="field full"><label for="go">Observation (facultatif)</label><textarea id="go" v-model="form.note" class="textarea" style="min-height:60px" /></div>
      </div>
      <template #footer><button v-if="form.id" class="btn danger" style="margin-right:auto" @click="del(form)">Supprimer</button><button class="btn" @click="form = null">Annuler</button><button class="btn primary" @click="submit">Enregistrer</button></template>
    </Modal>
  </div>
</template>
