<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../store'
import { computePriorities, recommendations } from '../utils/priorities'
import { weekDates, todayStr } from '../utils/time'
import Icon from '../components/Icon.vue'
import EmptyState from '../components/EmptyState.vue'
import SubjectBadge from '../components/SubjectBadge.vue'

const router = useRouter()
const list = computed(() => computePriorities({ subjects: state.subjects, chapters: state.chapters, evaluations: state.evaluations, sessions: state.sessions, logs: state.logs, boosts: state.settings.priorityBoost }))
const recos = computed(() => recommendations(list.value, state.sessions, todayStr(), weekDates(todayStr(), state.settings.weekStart)))
const LV = { high: { l: 'Haute', t: 'danger' }, mid: { l: 'Moyenne', t: 'warn' }, low: { l: 'Normale', t: '' } }
function boost(id, d) { const b = state.settings.priorityBoost; b[id] = Math.max(-1, Math.min(2, (b[id] || 0) + d)); if (!b[id]) delete b[id] }
const plan = (p, c) => router.push({ path: '/planning', query: { new: 1, subject: p.subject.id, ...(c ? { chapter: c.chapter.id } : {}) } })
</script>
<template>
  <div class="page">
    <div class="page-head"><div><h1>Mes priorités</h1><p>Ce qui mérite ton attention en premier, d'après tes données réelles.</p></div></div>
    <EmptyState v-if="!state.subjects.length" icon="flag" title="Pas encore de priorités" text="Ajoute tes matières, chapitres et évaluations : les priorités se calculent à partir d'eux."><router-link class="btn primary" to="/matieres">Ajouter une matière</router-link></EmptyState>
    <template v-else>
      <div v-if="recos.length" class="card soft" style="margin-bottom:16px"><div class="card-head"><h2>Recommandations</h2></div><div class="col"><div v-for="(r, i) in recos" :key="i" class="row"><Icon name="flame" :size="17" /><span>{{ r.text }}</span></div></div></div>
      <div class="col" style="gap:14px">
        <div v-for="(p, i) in list" :key="p.subject.id" class="card">
          <div class="row wrap"><span class="serif muted" style="font-size:1.3rem;width:26px">{{ i + 1 }}</span><SubjectBadge :subject="p.subject" /><div class="grow"><div style="font-weight:600">{{ p.subject.name }}</div><div class="small muted">Indice de priorité : {{ p.score }}</div></div><span class="pill" :class="LV[p.level].t">{{ LV[p.level].l }}</span>
            <span class="row" style="gap:0"><button class="icon-btn" aria-label="Descendre dans les priorités" @click="boost(p.subject.id, -1)">−</button><button class="icon-btn" aria-label="Remonter dans les priorités" @click="boost(p.subject.id, 1)"><Icon name="plus" :size="16" /></button></span>
            <button class="btn sm" @click="plan(p)"><Icon name="planning" :size="15" /> Planifier</button></div>
          <ul v-if="p.reasons.length" class="small muted" style="margin:10px 0 0 40px;padding-left:16px"><li v-for="r in p.reasons" :key="r">{{ r }}</li></ul>
          <p v-else class="small muted" style="margin:10px 0 0 40px">Rien d'urgent ici.</p>
          <div v-if="p.chapters.length" style="margin:12px 0 0 40px"><div class="small" style="font-weight:600;margin-bottom:6px">Chapitres à travailler</div>
            <div v-for="c in p.chapters.slice(0, 4)" :key="c.chapter.id" class="row small" style="padding:4px 0"><span class="grow">{{ c.chapter.title }}<span v-if="c.reasons[0]" class="muted"> — {{ c.reasons[0] }}</span></span><button class="btn sm ghost" @click="plan(p, c)">Planifier</button></div></div>
        </div>
      </div>
      <p class="small muted" style="margin-top:14px">Règles : évaluation proche, faible moyenne, chapitres difficiles ou non maîtrisés, matière peu révisée, séances reportées et équilibre du temps sur la semaine. Les boutons +/− te laissent ajuster l'ordre.</p>
    </template>
  </div>
</template>
