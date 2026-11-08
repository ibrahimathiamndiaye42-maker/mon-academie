<script setup>
import { ref, computed } from 'vue'
import { state, workMinutes } from '../store'
import { addDays, todayStr, startOfWeek, fmtMin, fmtDateShort, parseDate, DAYS_SHORT, isoDow } from '../utils/time'
import { minutesByDate, minutesBySubject, plannedVsActual, avgSessionMin, averageEvolution, weeklyReport } from '../utils/stats'
import { subjectAverage, generalAverage, fmtGrade } from '../utils/grades'
import { subjectProgress } from '../utils/priorities'
import Icon from '../components/Icon.vue'
import BarChart from '../components/BarChart.vue'
import LineChart from '../components/LineChart.vue'
import Donut from '../components/Donut.vue'
import EmptyState from '../components/EmptyState.vue'
import ProgressBar from '../components/ProgressBar.vue'

const range = ref(14)
const today = todayStr()
const days = computed(() => Array.from({ length: range.value }, (_, i) => addDays(today, i - range.value + 1)))
const lab = (d) => `${DAYS_SHORT[isoDow(d) - 1]} ${parseDate(d).getDate()}`
const daily = computed(() => minutesByDate(state.logs, days.value))
const week7 = computed(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)))
const pva = computed(() => plannedVsActual(state.sessions, state.logs, week7.value))
const mStart = today.slice(0, 7) + '-01'
const tot = computed(() => ({ all: state.logs.reduce((a, l) => a + l.workMs / 60000, 0), day: workMinutes(today, today), week: workMinutes(startOfWeek(today, state.settings.weekStart), today), month: workMinutes(mStart, today) }))
const bySub = computed(() => { const m = minutesBySubject(state.logs, days.value[0], today); return state.subjects.map((s) => ({ label: s.name, value: m[s.id] || 0, color: s.color })).filter((x) => x.value > 0) })
const doneN = computed(() => state.sessions.filter((s) => s.kind === 'study' && s.status === 'done').length)
const postN = computed(() => state.sessions.filter((s) => s.kind === 'study' && (s.status === 'postponed' || s.postponedCount > 0)).length)
const evo = computed(() => averageEvolution(state.subjects, state.evaluations).map((p) => ({ label: fmtDateShort(p.date), value: p.avg })))
const prog = computed(() => state.subjects.map((s) => { const c = state.chapters.filter((x) => x.subjectId === s.id); return { s, p: subjectProgress(c), n: c.length, m: c.filter((x) => x.status === 'maitrise').length, avg: subjectAverage(state.evaluations.filter((e) => e.subjectId === s.id)).avg } }))
const chapStats = computed(() => ({ studied: state.chapters.filter((c) => c.status === 'etudie').length, mastered: state.chapters.filter((c) => c.status === 'maitrise').length, review: state.chapters.filter((c) => c.status === 'a_revoir' || c.status === 'difficile').length }))

const weekOff = ref(0)
const wStart = computed(() => addDays(startOfWeek(today, state.settings.weekStart), weekOff.value * 7))
const report = computed(() => weeklyReport({ weekStart: wStart.value, weekStartDay: state.settings.weekStart, subjects: state.subjects, chapters: state.chapters, sessions: state.sessions, logs: state.logs, evaluations: state.evaluations }))
const delta = computed(() => (report.value.avgBefore !== null && report.value.avgAfter !== null ? report.value.avgAfter - report.value.avgBefore : null))
const empty = computed(() => !state.logs.length)
</script>
<template>
  <div class="page">
    <div class="page-head"><div><h1>Statistiques</h1><p>Uniquement ton temps de travail réel : les pauses ne comptent jamais.</p></div><div class="seg"><button :class="{ on: range === 7 }" @click="range = 7">7 jours</button><button :class="{ on: range === 14 }" @click="range = 14">14 jours</button><button :class="{ on: range === 30 }" @click="range = 30">30 jours</button></div></div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><span class="l">Aujourd'hui</span><span class="v">{{ fmtMin(tot.day) }}</span></div>
      <div class="card stat"><span class="l">Cette semaine</span><span class="v">{{ fmtMin(tot.week) }}</span></div>
      <div class="card stat"><span class="l">Ce mois</span><span class="v">{{ fmtMin(tot.month) }}</span></div>
      <div class="card stat"><span class="l">Total</span><span class="v">{{ fmtMin(tot.all) }}</span></div>
      <div class="card stat"><span class="l">Séances réalisées</span><span class="v">{{ doneN }}</span></div>
      <div class="card stat"><span class="l">Séances reportées</span><span class="v">{{ postN }}</span></div>
      <div class="card stat"><span class="l">Durée moyenne</span><span class="v">{{ fmtMin(avgSessionMin(state.logs)) }}</span></div>
      <div class="card stat"><span class="l">Moyenne générale</span><span class="v">{{ fmtGrade(generalAverage(state.subjects, state.evaluations)) }}</span></div>
    </div>
    <EmptyState v-if="empty" icon="chart" title="Pas encore de données" text="Termine une séance au chronomètre : les graphiques se rempliront avec ton temps réel." ><router-link class="btn primary" to="/chrono">Ouvrir le chronomètre</router-link></EmptyState>
    <div v-else class="grid g2" style="margin-bottom:16px">
      <div class="card"><div class="card-head"><h2>Temps de travail par jour</h2></div><BarChart :labels="days.map(lab)" :series="[{ name: 'Travail réel', color: 'var(--accent)', values: daily }]" /></div>
      <div class="card"><div class="card-head"><h2>Répartition par matière</h2></div><Donut :items="bySub" /></div>
      <div class="card"><div class="card-head"><h2>Prévu et réalisé (7 jours)</h2></div><BarChart :labels="week7.map(lab)" :series="[{ name: 'Prévu', color: 'var(--ink-3)', values: pva.planned }, { name: 'Réalisé', color: 'var(--accent)', values: pva.actual }]" /><div class="row small muted"><i class="dot" style="background:var(--ink-3)" /> Prévu <i class="dot" style="background:var(--accent)" /> Réalisé</div></div>
      <div class="card"><div class="card-head"><h2>Évolution de la moyenne</h2></div><p v-if="!evo.length" class="small muted">Aucune note enregistrée.</p><LineChart v-else :points="evo" /></div>
    </div>
    <div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Progression des chapitres</h2><span class="small muted">{{ chapStats.mastered }} maîtrisés · {{ chapStats.studied }} étudiés · {{ chapStats.review }} à revoir</span></div>
      <p v-if="!prog.length" class="small muted">Aucune matière.</p><div class="col"><div v-for="p in prog" :key="p.s.id"><div class="row small"><b class="grow">{{ p.s.name }}</b><span class="muted">{{ p.m }}/{{ p.n }} maîtrisés · moyenne {{ fmtGrade(p.avg) }} · {{ p.p }}%</span></div><ProgressBar :value="p.p" :color="p.s.color" /></div></div></div>

    <div class="card"><div class="card-head"><h2>Bilan de la semaine</h2><div class="row"><button class="icon-btn" aria-label="Semaine précédente" @click="weekOff--"><Icon name="chevL" /></button><span class="small">{{ fmtDateShort(report.from) }} – {{ fmtDateShort(report.to) }}</span><button class="icon-btn" aria-label="Semaine suivante" :disabled="weekOff >= 0" @click="weekOff++"><Icon name="chevR" /></button></div></div>
      <div class="grid g4"><div class="stat"><span class="v">{{ fmtMin(report.totalMin) }}</span><span class="l">travaillées</span></div><div class="stat"><span class="v">{{ report.done }}</span><span class="l">séances terminées</span></div><div class="stat"><span class="v">{{ report.missed }}</span><span class="l">manquées</span></div><div class="stat"><span class="v">{{ report.postponed }}</span><span class="l">reportées</span></div></div>
      <div class="grid g2" style="margin-top:16px">
        <div><h3>Les plus travaillées</h3><p v-if="!report.most.length" class="small muted">Aucun travail enregistré.</p><div v-for="m in report.most" :key="m.subject.id" class="small row"><i class="dot" :style="{ background: m.subject.color }" />{{ m.subject.name }} <span class="right muted">{{ fmtMin(m.min) }}</span></div></div>
        <div><h3>Les moins travaillées</h3><div v-for="m in report.least" :key="m.subject.id" class="small row"><i class="dot" :style="{ background: m.subject.color }" />{{ m.subject.name }} <span class="right muted">{{ fmtMin(m.min) }}</span></div></div>
        <div><h3>Chapitres étudiés</h3><p v-if="!report.chapters.length" class="small muted">Aucun chapitre précis travaillé.</p><div class="row wrap"><span v-for="c in report.chapters" :key="c.id" class="pill">{{ c.title }}</span></div></div>
        <div><h3>Résultats</h3><p v-if="!report.newGrades.length" class="small muted">Aucune nouvelle note cette semaine.</p><p v-else class="small">{{ report.newGrades.length }} nouvelle{{ report.newGrades.length > 1 ? 's' : '' }} note{{ report.newGrades.length > 1 ? 's' : '' }}<span v-if="delta !== null"> · moyenne générale {{ delta >= 0 ? '+' : '−' }}{{ fmtGrade(Math.abs(delta)) }} pt ({{ fmtGrade(report.avgAfter) }}/20)</span>.</p></div></div></div>
  </div>
</template>
