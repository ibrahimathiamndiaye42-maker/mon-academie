<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { state, workMinutes, timerStart, subjectById, chapterById } from '../store'
import { addDays, todayStr, weekDates, fmtDate, fmtMin, relDays, diffDays, DAYS_SHORT, isoDow, parseDate } from '../utils/time'
import { sessionMinutes } from '../utils/schedule'
import { computePriorities, recommendations, subjectProgress, evalPreparation } from '../utils/priorities'
import { isGraded, subjectAverage, generalAverage, fmtGrade } from '../utils/grades'
import { xpOf, levelInfo, streakOf, badgesOf } from '../utils/rewards'
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
const nowStr = computed(() => new Date(state.now).toTimeString().slice(0, 5))
const next = computed(() => state.sessions.filter((s) => s.kind === 'study' && (s.status === 'planned' || s.status === 'postponed') && (s.date > today.value || (s.date === today.value && s.end > nowStr.value))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0])
const exams = computed(() => state.evaluations.filter((e) => !isGraded(e) && e.date >= today.value).sort((a, b) => a.date.localeCompare(b.date)))
const prios = computed(() => computePriorities({ subjects: state.subjects, chapters: state.chapters, evaluations: state.evaluations, sessions: state.sessions, logs: state.logs, boosts: state.settings.priorityBoost }))
const tasks = computed(() => {
  const t = []
  for (const p of prios.value) for (const c of p.chapters.slice(0, 2)) t.push({ subject: p.subject, chapter: c.chapter, reason: c.reasons[0] || p.reasons[0] || statusInfo(c.chapter.status).label, score: p.score + c.score })
  return t.sort((a, b) => b.score - a.score).slice(0, 4)
})
const recos = computed(() => recommendations(prios.value, state.sessions, today.value, week.value))
const perf = computed(() => state.subjects.map((s) => { const chs = state.chapters.filter((c) => c.subjectId === s.id); return { s, p: subjectProgress(chs), avg: subjectAverage(state.evaluations.filter((e) => e.subjectId === s.id)).avg } }))
const general = computed(() => generalAverage(state.subjects, state.evaluations))
const globalProgress = computed(() => (state.subjects.length ? Math.round(perf.value.reduce((a, x) => a + x.p, 0) / state.subjects.length) : 0))
const mastered = computed(() => state.chapters.filter((c) => c.status === 'maitrise').length)
const lvl = computed(() => levelInfo(xpOf(state)))
const streak = computed(() => streakOf(state.logs, today.value))
const badges = computed(() => badgesOf({ ...state, subjects: state.subjects, dailyGoalMin: state.settings.dailyGoalMin }))
const earned = computed(() => badges.value.filter((b) => b.earned).length)
const strip = computed(() => { const mins = week.value.map((d) => workMinutes(d, d)); const max = Math.max(state.settings.dailyGoalMin, ...mins, 1); return week.value.map((d, i) => ({ d, min: mins[i], h: Math.round((mins[i] / max) * 100), n: state.sessions.filter((s) => s.kind === 'study' && s.date === d && s.status !== 'cancelled').length })) })
const lastWeek = computed(() => { const s = addDays(week.value[0], -7), e = addDays(week.value[0], -1); return state.logs.some((l) => l.date >= s && l.date <= e) })
const backupOld = computed(() => (state.documents.length || state.logs.length) && (!state.settings.lastBackup || state.now - new Date(state.settings.lastBackup).getTime() > 30 * 86400000))
const resumeDoc = computed(() => [...state.documents].filter((d) => d.lastOpenedAt).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0])
const empty = computed(() => !state.subjects.length)

async function start(s) { if (state.timer) return router.push('/chrono'); if (await timerStart({ sessionId: s.id, plannedMin: sessionMinutes(s) })) router.push('/chrono') }
const plan = (t) => router.push({ path: '/planning', query: { new: 1, subject: t.subject.id, chapter: t.chapter.id } })
</script>
<template>
  <div class="page">
    <div class="card hero" style="margin-bottom:16px">
      <div class="level-row">
        <div class="grow" style="min-width:230px">
          <p class="small" style="text-transform:capitalize">{{ fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
          <h1 style="margin:4px 0 12px">{{ hello }} 👋</h1>
          <div class="row wrap" style="margin-bottom:8px"><span class="pill" style="background:rgba(255,255,255,.2);color:inherit;border-color:transparent"><Icon name="target" :size="14" /> Niveau {{ lvl.level }} · {{ lvl.name }}</span><span v-if="streak" class="pill" style="background:rgba(255,255,255,.2);color:inherit;border-color:transparent"><Icon name="flame" :size="14" /> {{ streak }} jour{{ streak > 1 ? 's' : '' }} d'affilée</span></div>
          <div style="max-width:380px"><div class="row small"><span class="grow">{{ lvl.xp }} points</span><span v-if="lvl.next">prochain niveau : {{ lvl.nextName }} ({{ lvl.next }})</span><span v-else>niveau maximal</span></div><ProgressBar :value="lvl.pct" /></div>
          <div class="row wrap" style="margin-top:16px"><button class="btn" @click="router.push(state.timer ? '/chrono' : next ? '/planning' : '/chrono')"><Icon name="play" :size="16" /> {{ state.timer ? 'Ouvrir le chronomètre' : 'Démarrer une révision' }}</button><button v-if="resumeDoc" class="btn" @click="router.push(`/cours/${resumeDoc.id}`)"><Icon name="book" :size="16" /> Reprendre le cours</button></div>
        </div>
        <Ring :value="globalProgress" :size="150" :stroke="13" color="currentColor" track="rgba(255,255,255,.25)"><div><div class="num" style="font-size:2rem;font-weight:800">{{ globalProgress }}%</div><div class="tiny" style="opacity:.85">progression générale</div></div></Ring>
      </div>
    </div>

    <div v-if="empty" class="card soft" style="margin-bottom:16px"><h2>Mets ton année en place</h2><p class="muted" style="margin:6px 0 14px">Quatre étapes et tout fonctionne ensemble :</p>
      <div class="grid g4"><router-link class="card flat" to="/matieres"><b>1. Matières</b><div class="small muted">Crée tes matières et leurs chapitres.</div></router-link><router-link class="card flat" to="/emploi-du-temps"><b>2. Emploi du temps</b><div class="small muted">Saisis tes cours de la semaine.</div></router-link><router-link class="card flat" to="/planning"><b>3. Planning</b><div class="small muted">Place tes séances de révision.</div></router-link><router-link class="card flat" to="/cours"><b>4. Cours PDF</b><div class="small muted">Importe tes supports à annoter.</div></router-link></div></div>
    <div v-if="state.timer" class="card soft row wrap" style="margin-bottom:16px"><Icon name="timer" /><span class="grow"><b>Une séance est {{ state.timer.status === 'paused' ? 'en pause' : 'en cours' }}</b> — {{ subjectById(state.timer.subjectId)?.name }}</span><router-link class="btn primary sm" to="/chrono">Ouvrir le chronomètre</router-link></div>
    <div v-if="backupOld" class="card row wrap" style="margin-bottom:16px"><Icon name="download" /><span class="grow">Pense à sauvegarder tes données : {{ state.settings.lastBackup ? 'la dernière sauvegarde date de plus de 30 jours.' : 'tu n’as encore jamais exporté de sauvegarde.' }}</span><router-link class="btn sm" to="/parametres">Sauvegarder</router-link></div>

    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><span class="ico"><Icon name="clock" :size="18" /></span><span class="v">{{ fmtMin(dayMin) }}</span><span class="l">Travail aujourd'hui</span></div>
      <div class="card stat"><span class="ico"><Icon name="timer" :size="18" /></span><span class="v">{{ fmtMin(weekMin) }}</span><span class="l">Cette semaine</span></div>
      <div class="card stat"><span class="ico"><Icon name="shield" :size="18" /></span><span class="v">{{ mastered }}</span><span class="l">Chapitres maîtrisés</span></div>
      <div class="card stat"><span class="ico"><Icon name="chart" :size="18" /></span><span class="v">{{ fmtGrade(general, 1) }}</span><span class="l">Moyenne générale /20</span></div>
    </div>

    <div class="grid g-main" style="align-items:start">
      <div class="col" style="gap:16px">
        <div class="card"><div class="card-head"><h2>Programme du jour</h2><router-link class="small" to="/planning">Planning</router-link></div>
          <p v-if="!todaySess.length" class="muted small">Aucune séance prévue aujourd'hui. <router-link :to="{ path: '/planning', query: { new: 1 } }">Planifier une séance</router-link></p>
          <div class="list"><div v-for="s in todaySess" :key="s.id" class="item"><SubjectBadge :subject="subjectById(s.subjectId)" /><div class="grow"><div class="t">{{ subjectById(s.subjectId)?.name }}</div><div class="s">{{ s.start }}–{{ s.end }} · {{ chapterById(s.chapterId)?.title || s.type }}</div></div><span v-if="s.status === 'done'" class="pill ok">Terminée</span><button v-else-if="s.status !== 'running'" class="btn sm primary" @click="start(s)"><Icon name="play" :size="14" /> Démarrer</button><span v-else class="pill accent">En cours</span></div></div>
          <div v-if="todaySess.length" class="small muted" style="margin-top:10px">{{ doneToday }} sur {{ todaySess.length }} terminée{{ doneToday > 1 ? 's' : '' }}</div></div>
        <div class="card"><div class="card-head"><h2>Tâches prioritaires</h2><router-link class="small" to="/priorites">Toutes les priorités</router-link></div>
          <p v-if="!tasks.length" class="muted small">Rien d'urgent : ajoute des chapitres pour que les priorités se calculent.</p>
          <div v-for="t in tasks" :key="t.chapter.id" class="task"><SubjectBadge :subject="t.subject" :size="32" /><div class="grow"><div style="font-weight:600">{{ t.chapter.title }}</div><div class="small muted">{{ t.subject.name }} — {{ t.reason }}</div></div><button class="btn sm" @click="plan(t)">Planifier</button></div></div>
        <div class="card"><div class="card-head"><h2>Aperçu de la semaine</h2><span class="small muted">{{ fmtMin(weekMin) }} / {{ fmtMin(state.settings.weeklyGoalMin) }}</span></div>
          <div class="week-strip"><button v-for="d in strip" :key="d.d" class="wd" :class="{ today: d.d === today }" :aria-label="`${fmtDate(d.d)} : ${fmtMin(d.min)}`" @click="router.push({ path: '/planning', query: { date: d.d } })"><span class="tiny muted">{{ DAYS_SHORT[isoDow(d.d) - 1] }}</span><span class="col-bar"><i :style="{ height: d.h + '%' }" /></span><b class="small">{{ parseDate(d.d).getDate() }}</b><span class="tiny muted">{{ d.n }} séance{{ d.n > 1 ? 's' : '' }}</span></button></div></div>
        <div class="card"><div class="card-head"><h2>Performances par matière</h2><router-link class="small" to="/statistiques">Statistiques</router-link></div>
          <p v-if="!perf.length" class="muted small">Aucune matière pour l'instant.</p>
          <div class="col" style="gap:14px"><div v-for="x in perf.slice(0, 6)" :key="x.s.id"><div class="row small"><SubjectBadge :subject="x.s" :size="24" /><b class="grow">{{ x.s.name }}</b><span class="muted">moyenne {{ fmtGrade(x.avg, 1) }} · progression {{ x.p }}%</span></div><div style="margin-top:6px"><ProgressBar :value="x.p" :color="x.s.color" /></div></div></div></div>
      </div>

      <div class="col" style="gap:16px">
        <div class="card"><div class="card-head"><h2>Objectifs personnels</h2></div>
          <div class="row" style="gap:18px;justify-content:space-around"><div class="center"><Ring :value="dayPct" :size="104" :stroke="10"><div class="num" style="font-weight:800">{{ Math.round(dayPct) }}%</div></Ring><div class="small muted" style="margin-top:6px">Jour · {{ fmtMin(dayMin) }}</div><div class="tiny faint">objectif {{ fmtMin(state.settings.dailyGoalMin) }}</div></div><div class="center"><Ring :value="weekPct" :size="104" :stroke="10"><div class="num" style="font-weight:800">{{ Math.round(weekPct) }}%</div></Ring><div class="small muted" style="margin-top:6px">Semaine · {{ fmtMin(weekMin) }}</div><div class="tiny faint">objectif {{ fmtMin(state.settings.weeklyGoalMin) }}</div></div></div></div>
        <div class="card"><div class="card-head"><h2>Prochains examens</h2><router-link class="small" to="/notes">Notes</router-link></div>
          <p v-if="!exams.length" class="muted small">Aucune évaluation à venir.</p>
          <div class="col" style="gap:14px"><div v-for="e in exams.slice(0, 3)" :key="e.id"><div class="row"><SubjectBadge :subject="subjectById(e.subjectId)" :size="30" /><div class="grow"><div style="font-weight:600">{{ e.title }}</div><div class="small muted">{{ subjectById(e.subjectId)?.name }} · {{ fmtDate(e.date, { day: 'numeric', month: 'short' }) }}</div></div><span class="pill" :class="diffDays(today, e.date) <= 7 ? 'warn' : 'info'">{{ relDays(e.date, today) }}</span></div><div class="small muted" style="margin:6px 0 4px">Préparation : {{ evalPreparation(e, state.chapters) }}%</div><ProgressBar :value="evalPreparation(e, state.chapters)" /></div></div></div>
        <div class="card"><div class="card-head"><h2>Conseils du jour</h2></div>
          <p v-if="!recos.length" class="muted small">Pas d'alerte : continue sur ta lancée.</p>
          <div class="col"><div v-for="(r, i) in recos" :key="i" class="row small" style="align-items:flex-start"><Icon name="flame" :size="16" /><span>{{ r.text }}</span></div></div>
          <p class="tiny faint" style="margin-top:10px">Conseils calculés par des règles simples à partir de tes données, sans IA.</p></div>
        <div class="card"><div class="card-head"><h2>Récompenses</h2><span class="small muted">{{ earned }} / {{ badges.length }}</span></div>
          <div class="badges"><div v-for="b in badges" :key="b.id" class="badge" :class="{ locked: !b.earned }" :title="b.desc"><span class="bi"><Icon :name="b.icon" :size="20" /></span><b class="small">{{ b.label }}</b><span class="tiny muted">{{ b.earned ? 'Obtenu' : b.desc }}</span></div></div></div>
        <div v-if="lastWeek" class="card soft"><b>Ton bilan de la semaine dernière est prêt.</b><div style="margin-top:8px"><router-link class="btn sm" to="/statistiques">Voir le bilan</router-link></div></div>
      </div>
    </div>
  </div>
</template>
