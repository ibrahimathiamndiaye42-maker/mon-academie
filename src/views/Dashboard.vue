<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { state, workMinutes, timerStart, subjectById, chapterById } from '../store'
import { addDays, todayStr, weekDates, fmtDate, fmtMin, relDays, diffDays, timeToMin } from '../utils/time'
import { sessionMinutes } from '../utils/schedule'
import { computePriorities } from '../utils/priorities'
import { isGraded } from '../utils/grades'
import { statusInfo } from '../constants'
import Icon from '../components/Icon.vue'
import Ring from '../components/Ring.vue'
import SubjectBadge from '../components/SubjectBadge.vue'
import ProgressBar from '../components/ProgressBar.vue'

const router = useRouter()
const today = computed(() => { state.now; return todayStr() })
const hello = computed(() => { const h = new Date(state.now).getHours(); return (h < 18 ? 'Bonjour' : 'Bonsoir') + (state.settings.name ? `, ${state.settings.name}` : '') })
const week = computed(() => weekDates(today.value, state.settings.weekStart))
const dayMin = computed(() => workMinutes(today.value, today.value))
const weekMin = computed(() => workMinutes(week.value[0], week.value[6]))
const dayPct = computed(() => Math.min(100, (dayMin.value / state.settings.dailyGoalMin) * 100))
const weekPct = computed(() => Math.min(100, (weekMin.value / state.settings.weeklyGoalMin) * 100))
const todaySess = computed(() => state.sessions.filter((s) => s.kind === 'study' && s.date === today.value && s.status !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start)))
const doneToday = computed(() => todaySess.value.filter((s) => s.status === 'done').length)
const nowStr = computed(() => { const d = new Date(state.now); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` })
const next = computed(() => state.sessions.filter((s) => s.kind === 'study' && (s.status === 'planned' || s.status === 'postponed') && (s.date > today.value || (s.date === today.value && s.end > nowStr.value))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0])
const nextEval = computed(() => state.evaluations.filter((e) => !isGraded(e) && e.date >= today.value).sort((a, b) => a.date.localeCompare(b.date))[0])
const upCount = computed(() => state.evaluations.filter((e) => !isGraded(e) && e.date >= today.value).length)
const prios = computed(() => computePriorities({ subjects: state.subjects, chapters: state.chapters, evaluations: state.evaluations, sessions: state.sessions, logs: state.logs, boosts: state.settings.priorityBoost }).filter((p) => p.score > 0).slice(0, 3))
const review = computed(() => state.chapters.filter((c) => c.status === 'a_revoir' || c.status === 'difficile' || (c.nextReview && c.nextReview <= today.value && c.status !== 'maitrise')).slice(0, 6))
const mastered = computed(() => state.chapters.filter((c) => c.status === 'maitrise').length)
const globalProgress = computed(() => (state.chapters.length ? Math.round((mastered.value / state.chapters.length) * 100) : 0))
const lastWeek = computed(() => { const s = addDays(week.value[0], -7); const e = addDays(week.value[0], -1); return state.logs.some((l) => l.date >= s && l.date <= e) })
const backupOld = computed(() => (state.documents.length || state.logs.length) && (!state.settings.lastBackup || (state.now - new Date(state.settings.lastBackup).getTime()) > 30 * 86400000))
const resumeDoc = computed(() => [...state.documents].filter((d) => d.lastOpenedAt).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0])
const empty = computed(() => !state.subjects.length)

async function start(s) { if (state.timer) return router.push('/chrono'); if (await timerStart({ sessionId: s.id, plannedMin: sessionMinutes(s) })) router.push('/chrono') }
const q = (name, query) => router.push({ name, query })
</script>
<template>
  <div class="page">
    <div class="page-head"><div><h1>{{ hello }}</h1><p style="text-transform:capitalize">{{ fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}</p></div></div>

    <div v-if="empty" class="card soft" style="margin-bottom:16px"><h2>Mets ton année en place</h2><p class="muted" style="margin:6px 0 14px">Quatre étapes et tout fonctionne ensemble :</p>
      <div class="grid g4"><router-link class="card flat" to="/matieres"><b>1. Matières</b><div class="small muted">Crée tes matières et leurs chapitres.</div></router-link><router-link class="card flat" to="/emploi-du-temps"><b>2. Emploi du temps</b><div class="small muted">Saisis tes cours de la semaine.</div></router-link><router-link class="card flat" to="/planning"><b>3. Planning</b><div class="small muted">Place tes séances de révision.</div></router-link><router-link class="card flat" to="/cours"><b>4. Cours PDF</b><div class="small muted">Importe tes supports à annoter.</div></router-link></div></div>
    <div v-if="state.timer" class="card soft row wrap" style="margin-bottom:16px"><Icon name="timer" /><span class="grow"><b>Une séance est {{ state.timer.status === 'paused' ? 'en pause' : 'en cours' }}</b> — {{ subjectById(state.timer.subjectId)?.name }}</span><router-link class="btn primary sm" to="/chrono">Ouvrir le chronomètre</router-link></div>
    <div v-if="backupOld" class="card row wrap" style="margin-bottom:16px"><Icon name="download" /><span class="grow">Pense à sauvegarder tes données : {{ state.settings.lastBackup ? 'la dernière sauvegarde date de plus de 30 jours.' : 'tu n’as encore jamais exporté de sauvegarde.' }}</span><router-link class="btn sm" to="/parametres">Sauvegarder</router-link></div>

    <div class="grid g-main" style="align-items:start">
      <div class="col" style="gap:16px">
        <div class="card"><div class="row wrap" style="gap:22px"><Ring :value="dayPct" :size="132" :stroke="11"><div><div class="serif num" style="font-size:1.5rem">{{ fmtMin(dayMin) }}</div><div class="tiny muted">sur {{ fmtMin(state.settings.dailyGoalMin) }}</div></div></Ring>
          <div class="grow col" style="min-width:200px;gap:12px"><div><div class="row small"><span class="grow">Objectif du jour</span><b>{{ Math.round(dayPct) }}%</b></div><ProgressBar :value="dayPct" /></div><div><div class="row small"><span class="grow">Cette semaine · {{ fmtMin(weekMin) }} / {{ fmtMin(state.settings.weeklyGoalMin) }}</span><b>{{ Math.round(weekPct) }}%</b></div><ProgressBar :value="weekPct" /></div>
            <div class="small muted">{{ todaySess.length }} séance{{ todaySess.length > 1 ? 's' : '' }} prévue{{ todaySess.length > 1 ? 's' : '' }} · {{ doneToday }} terminée{{ doneToday > 1 ? 's' : '' }}</div></div></div></div>
        <div class="grid g3">
          <div class="card stat"><span class="ico"><Icon name="clock" :size="18" /></span><span class="v">{{ fmtMin(dayMin) }}</span><span class="l">Temps de travail aujourd'hui</span></div>
          <div class="card stat"><span class="ico"><Icon name="timer" :size="18" /></span><span class="v">{{ fmtMin(weekMin) }}</span><span class="l">Temps cette semaine</span></div>
          <div class="card stat"><span class="ico"><Icon name="check" :size="18" /></span><span class="v">{{ doneToday }}/{{ todaySess.length }}</span><span class="l">Séances terminées</span></div>
          <div class="card stat"><span class="ico"><Icon name="target" :size="18" /></span><span class="v">{{ globalProgress }}%</span><span class="l">Progression générale</span></div>
          <div class="card stat"><span class="ico"><Icon name="shield" :size="18" /></span><span class="v">{{ mastered }}</span><span class="l">Chapitres maîtrisés</span></div>
          <div class="card stat"><span class="ico"><Icon name="grades" :size="18" /></span><span class="v">{{ upCount }}</span><span class="l">Évaluations à venir</span></div>
        </div>
        <div class="card"><div class="card-head"><h2>Aujourd'hui</h2><router-link class="small" to="/planning">Voir le planning</router-link></div>
          <p v-if="!todaySess.length" class="muted small">Aucune séance prévue aujourd'hui.</p>
          <div class="list"><div v-for="s in todaySess" :key="s.id" class="item"><SubjectBadge :subject="subjectById(s.subjectId)" /><div class="grow"><div class="t">{{ subjectById(s.subjectId)?.name }}</div><div class="s">{{ s.start }}–{{ s.end }} · {{ chapterById(s.chapterId)?.title || s.type }}</div></div><span v-if="s.status === 'done'" class="pill ok">Terminée</span><button v-else-if="s.status !== 'running'" class="btn sm primary" @click="start(s)"><Icon name="play" :size="14" /> Démarrer</button><span v-else class="pill accent">En cours</span></div></div></div>
      </div>

      <div class="col" style="gap:16px">
        <div class="card"><div class="card-head"><h2>Actions rapides</h2></div><div class="grid g2" style="gap:8px">
          <button class="btn" @click="router.push('/chrono')"><Icon name="play" :size="16" /> Démarrer</button><button class="btn" @click="router.push('/planning')"><Icon name="planning" :size="16" /> Planning</button>
          <button class="btn" @click="q('planning', { new: 1 })"><Icon name="plus" :size="16" /> Séance</button><button class="btn" @click="router.push(resumeDoc ? `/cours/${resumeDoc.id}` : '/cours')"><Icon name="book" :size="16" /> {{ resumeDoc ? 'Reprendre le cours' : 'Ouvrir un cours' }}</button>
          <button class="btn" @click="q('grades', {})"><Icon name="grades" :size="16" /> Note</button><button class="btn" @click="router.push('/priorites')"><Icon name="flag" :size="16" /> Priorités</button></div></div>
        <div class="card"><div class="card-head"><h2>Prochaine séance</h2></div><div v-if="next"><b>{{ subjectById(next.subjectId)?.name }}</b><div class="small muted">{{ chapterById(next.chapterId)?.title || next.type }}</div><div class="small" style="margin-top:4px">{{ fmtDate(next.date, { weekday: 'long', day: 'numeric', month: 'short' }) }} · {{ next.start }}–{{ next.end }}</div></div><p v-else class="small muted">Rien de planifié à venir.</p></div>
        <div class="card"><div class="card-head"><h2>Prochaine évaluation</h2></div><div v-if="nextEval"><b>{{ subjectById(nextEval.subjectId)?.name }} — {{ nextEval.title }}</b><div class="small muted">{{ fmtDate(nextEval.date) }}</div><span class="pill" :class="diffDays(today, nextEval.date) <= 7 ? 'warn' : 'info'" style="margin-top:6px">{{ relDays(nextEval.date, today) }}</span></div><p v-else class="small muted">Aucune évaluation à venir.</p></div>
        <div class="card"><div class="card-head"><h2>Matières prioritaires</h2><router-link class="small" to="/priorites">Tout voir</router-link></div><p v-if="!prios.length" class="small muted">Aucune priorité pour le moment.</p><div class="list"><div v-for="p in prios" :key="p.subject.id" class="item"><SubjectBadge :subject="p.subject" :size="28" /><div class="grow"><div class="t">{{ p.subject.name }}</div><div class="s">{{ p.reasons[0] }}</div></div></div></div></div>
        <div class="card"><div class="card-head"><h2>Chapitres à revoir</h2></div><p v-if="!review.length" class="small muted">Rien à revoir : bravo.</p><div class="list"><div v-for="c in review" :key="c.id" class="item"><div class="grow"><div class="t">{{ c.title }}</div><div class="s">{{ subjectById(c.subjectId)?.name }}</div></div><span class="pill" :class="statusInfo(c.status).tone">{{ statusInfo(c.status).label }}</span></div></div></div>
        <div v-if="lastWeek" class="card soft"><b>Ton bilan de la semaine dernière est prêt.</b><div style="margin-top:8px"><router-link class="btn sm" to="/statistiques">Voir le bilan</router-link></div></div>
      </div>
    </div>
  </div>
</template>
