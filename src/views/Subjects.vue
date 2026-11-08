<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { state, save, deleteSubject, deleteChapter, chaptersOf, confirmDialog, toast } from '../store'
import { CHAPTER_STATUS, statusInfo, SUBJECT_COLORS, SUBJECT_ICONS } from '../constants'
import { subjectProgress } from '../utils/priorities'
import { subjectAverage, fmtGrade } from '../utils/grades'
import { fmtDateShort, todayStr } from '../utils/time'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import ProgressBar from '../components/ProgressBar.vue'
import EmptyState from '../components/EmptyState.vue'
import SubjectBadge from '../components/SubjectBadge.vue'

const router = useRouter()
const selectedId = ref(null)
const selected = computed(() => state.subjects.find((s) => s.id === selectedId.value) || null)
const sf = ref(null) // formulaire matière
const cf = ref(null) // formulaire chapitre
const errors = ref([])

const stats = (s) => {
  const chs = chaptersOf(s.id)
  return { chs, progress: subjectProgress(chs), mastered: chs.filter((c) => c.status === 'maitrise').length, avg: subjectAverage(state.evaluations.filter((e) => e.subjectId === s.id)).avg }
}
const detail = computed(() => (selected.value ? stats(selected.value) : null))

function newSubject() { errors.value = []; sf.value = { name: '', color: SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length], icon: 'book', description: '', coef: '', teacher: '', goal: 80 } }
function editSubject(s) { errors.value = []; sf.value = { ...s, coef: s.coef ?? '' } }
async function saveSubject() {
  const f = sf.value
  errors.value = []
  if (!f.name.trim()) errors.value.push('Le nom de la matière est obligatoire.')
  if (state.subjects.some((s) => s.id !== f.id && s.name.trim().toLowerCase() === f.name.trim().toLowerCase())) errors.value.push('Une matière porte déjà ce nom.')
  if (f.coef !== '' && !(Number(f.coef) > 0)) errors.value.push('Le coefficient doit être un nombre positif.')
  if (errors.value.length) return
  const rec = await save('subjects', { ...f, name: f.name.trim(), coef: f.coef === '' ? null : Number(f.coef), goal: Number(f.goal) || 0 })
  if (rec) { sf.value = null; selectedId.value = rec.id; toast('Matière enregistrée.', 'ok') }
}
async function removeSubject(s) {
  const n = { c: chaptersOf(s.id).length, e: state.evaluations.filter((e) => e.subjectId === s.id).length, l: state.logs.filter((l) => l.subjectId === s.id).length, d: state.documents.filter((d) => d.subjectId === s.id).length }
  const ok = await confirmDialog({
    title: `Supprimer « ${s.name} » ?`, danger: true, confirmLabel: 'Supprimer définitivement',
    message: `Seront supprimés : ${n.c} chapitre(s), ${n.e} évaluation(s), l'historique de ${n.l} séance(s) chronométrée(s), ses cours de l'emploi du temps et ses séances planifiées.\n${n.d ? `Les ${n.d} document(s) PDF et leurs annotations sont conservés (ils seront simplement détachés de la matière).` : ''}\nCette action est irréversible.`
  })
  if (ok && (await deleteSubject(s.id))) { selectedId.value = null; toast('Matière supprimée.', 'ok') }
}

function newChapter() { errors.value = []; cf.value = { subjectId: selected.value.id, title: '', description: '', status: 'non_commence', mastery: 0, lastReview: '', nextReview: '', notes: '', order: chaptersOf(selected.value.id).length } }
function editChapter(c) { errors.value = []; cf.value = { ...c, lastReview: c.lastReview || '', nextReview: c.nextReview || '' } }
async function saveChapter() {
  const f = cf.value
  errors.value = []
  if (!f.title.trim()) errors.value.push('Le titre du chapitre est obligatoire.')
  if (f.lastReview && f.nextReview && f.nextReview < f.lastReview) errors.value.push('La prochaine révision doit être après la dernière.')
  if (errors.value.length) return
  if (await save('chapters', { ...f, title: f.title.trim(), mastery: Number(f.mastery) || 0, lastReview: f.lastReview || null, nextReview: f.nextReview || null })) { cf.value = null; toast('Chapitre enregistré.', 'ok') }
}
async function removeChapter(c) {
  if (await confirmDialog({ title: `Supprimer « ${c.title} » ?`, danger: true, confirmLabel: 'Supprimer', message: 'Les documents associés sont conservés mais détachés du chapitre. Les évaluations liées perdent ce chapitre.' })) await deleteChapter(c.id)
}
const setStatus = (c, status) => save('chapters', { ...c, status })
const docCount = (c) => state.documents.filter((d) => d.chapterId === c.id).length
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div><h1>Matières et chapitres</h1><p>Le plan de ton année : ce que tu étudies et où tu en es.</p></div>
      <button class="btn primary" @click="newSubject"><Icon name="plus" :size="18" /> Ajouter une matière</button>
    </div>

    <EmptyState v-if="!state.subjects.length" icon="layers" title="Aucune matière pour l'instant" text="Crée tes matières, puis découpe-les en chapitres : tout le reste (planning, notes, priorités) s'appuie dessus.">
      <button class="btn primary" @click="newSubject"><Icon name="plus" :size="18" /> Ajouter ma première matière</button>
    </EmptyState>

    <div v-else class="grid" style="grid-template-columns: minmax(260px, 340px) 1fr; align-items: start">
      <div class="col" style="gap: 10px">
        <button v-for="s in state.subjects" :key="s.id" type="button" class="card flat click" :style="{ textAlign: 'left', cursor: 'pointer', borderColor: selectedId === s.id ? 'var(--accent)' : '', background: selectedId === s.id ? 'var(--accent-soft)' : '' }" @click="selectedId = s.id">
          <div class="row"><SubjectBadge :subject="s" /><div class="grow"><div style="font-weight:600">{{ s.name }}</div><div class="small muted">{{ stats(s).chs.length }} chapitre{{ stats(s).chs.length > 1 ? 's' : '' }} · moyenne {{ fmtGrade(stats(s).avg) }}</div></div><span class="num small">{{ stats(s).progress }}%</span></div>
          <div style="margin-top:10px"><ProgressBar :value="stats(s).progress" :color="s.color" /></div>
        </button>
      </div>

      <div v-if="selected" class="col" style="gap: 16px">
        <div class="card">
          <div class="row wrap">
            <SubjectBadge :subject="selected" :size="46" />
            <div class="grow"><h2 style="font-size:1.35rem;font-family:var(--serif)">{{ selected.name }}</h2><div class="small muted">{{ selected.teacher || 'Enseignant non renseigné' }}<span v-if="selected.coef"> · coefficient {{ selected.coef }}</span></div></div>
            <button class="btn sm" @click="editSubject(selected)"><Icon name="edit" :size="16" /> Modifier</button>
            <button class="btn sm danger" @click="removeSubject(selected)"><Icon name="trash" :size="16" /> Supprimer</button>
          </div>
          <p v-if="selected.description" class="muted" style="margin-top:10px">{{ selected.description }}</p>
          <div class="grid g3" style="margin-top:16px">
            <div><div class="small muted">Progression</div><div class="serif" style="font-size:1.5rem">{{ detail.progress }}% <span class="small muted" style="font-family:var(--sans)">/ objectif {{ selected.goal || 0 }}%</span></div><ProgressBar :value="detail.progress" :color="selected.color" /></div>
            <div><div class="small muted">Chapitres maîtrisés</div><div class="serif" style="font-size:1.5rem">{{ detail.mastered }} / {{ detail.chs.length }}</div></div>
            <div><div class="small muted">Moyenne</div><div class="serif" style="font-size:1.5rem">{{ fmtGrade(detail.avg) }}<span class="small muted" style="font-family:var(--sans)"> /20</span></div></div>
          </div>
          <p class="tiny faint" style="margin-top:12px">La progression se calcule à partir du statut de chaque chapitre (maîtrisé = 100 %, étudié = 60 %, à revoir = 40 %, en cours ou difficile = 25 %, non commencé = 0 %). Ouvrir ou lire un cours ne rend jamais un chapitre « maîtrisé » : c'est toi qui décides.</p>
        </div>

        <div class="card">
          <div class="card-head"><h2>Chapitres</h2><button class="btn sm primary" @click="newChapter"><Icon name="plus" :size="16" /> Ajouter un chapitre</button></div>
          <EmptyState v-if="!detail.chs.length" icon="list" title="Aucun chapitre" text="Ajoute les chapitres de cette matière pour suivre ta maîtrise de chacun." />
          <div v-else class="list">
            <div v-for="c in detail.chs" :key="c.id" class="item" style="align-items:flex-start;flex-wrap:wrap">
              <div class="grow" style="min-width:200px">
                <div class="t">{{ c.title }}</div>
                <div class="s">Maîtrise {{ c.mastery || 0 }}%<span v-if="c.lastReview"> · révisé le {{ fmtDateShort(c.lastReview) }}</span><span v-if="c.nextReview" :style="{ color: c.nextReview <= todayStr() ? 'var(--warn)' : '' }"> · à revoir le {{ fmtDateShort(c.nextReview) }}</span></div>
                <div v-if="c.notes" class="small muted" style="margin-top:4px;white-space:pre-line">{{ c.notes }}</div>
              </div>
              <select class="select" style="width:auto;min-height:34px" :value="c.status" :aria-label="`Statut de ${c.title}`" @change="setStatus(c, $event.target.value)">
                <option v-for="st in CHAPTER_STATUS" :key="st.key" :value="st.key">{{ st.label }}</option>
              </select>
              <button v-if="docCount(c)" class="btn sm" @click="router.push({ path: '/cours', query: { chapitre: c.id } })"><Icon name="file" :size="15" /> {{ docCount(c) }} PDF</button>
              <button class="icon-btn" :aria-label="`Modifier ${c.title}`" @click="editChapter(c)"><Icon name="edit" :size="18" /></button>
              <button class="icon-btn" :aria-label="`Supprimer ${c.title}`" @click="removeChapter(c)"><Icon name="trash" :size="18" /></button>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else icon="layers" title="Choisis une matière" text="Sélectionne une matière à gauche pour voir ses chapitres et sa progression." />
    </div>

    <Modal v-if="sf" :title="sf.id ? 'Modifier la matière' : 'Nouvelle matière'" @close="sf = null">
      <div v-if="errors.length" class="err-list"><span v-for="e in errors" :key="e">{{ e }}</span></div>
      <div class="form-grid">
        <div class="field full"><label for="sn">Nom</label><input id="sn" v-model="sf.name" class="input" maxlength="80" @keydown.enter="saveSubject" /></div>
        <div class="field full"><label>Couleur</label><div class="row wrap"><button v-for="c in SUBJECT_COLORS" :key="c" type="button" class="icon-btn" :aria-label="`Couleur ${c}`" :style="{ background: c, outline: sf.color === c ? '3px solid var(--accent)' : 'none', outlineOffset: '2px', borderRadius: '50%' }" @click="sf.color = c" /></div></div>
        <div class="field full"><label>Icône</label><div class="row wrap"><button v-for="i in SUBJECT_ICONS" :key="i" type="button" class="icon-btn" :class="{ on: sf.icon === i }" :aria-label="`Icône ${i}`" @click="sf.icon = i"><Icon :name="i" /></button></div></div>
        <div class="field"><label for="st">Enseignant (facultatif)</label><input id="st" v-model="sf.teacher" class="input" /></div>
        <div class="field"><label for="sc">Coefficient (facultatif)</label><input id="sc" v-model="sf.coef" class="input" type="number" min="0" step="0.5" /></div>
        <div class="field full"><label for="sg">Objectif de progression : {{ sf.goal }}%</label><input id="sg" v-model="sf.goal" type="range" min="10" max="100" step="5" /></div>
        <div class="field full"><label for="sd">Description (facultatif)</label><textarea id="sd" v-model="sf.description" class="textarea" /></div>
      </div>
      <template #footer><button class="btn" @click="sf = null">Annuler</button><button class="btn primary" @click="saveSubject">Enregistrer</button></template>
    </Modal>

    <Modal v-if="cf" :title="cf.id ? 'Modifier le chapitre' : 'Nouveau chapitre'" @close="cf = null">
      <div v-if="errors.length" class="err-list"><span v-for="e in errors" :key="e">{{ e }}</span></div>
      <div class="form-grid">
        <div class="field full"><label for="ct">Titre</label><input id="ct" v-model="cf.title" class="input" maxlength="120" @keydown.enter="saveChapter" /></div>
        <div class="field"><label for="cs">Statut</label><select id="cs" v-model="cf.status" class="select"><option v-for="st in CHAPTER_STATUS" :key="st.key" :value="st.key">{{ st.label }}</option></select></div>
        <div class="field"><label for="cm">Niveau de maîtrise : {{ cf.mastery }}%</label><input id="cm" v-model="cf.mastery" type="range" min="0" max="100" step="5" /></div>
        <div class="field"><label for="cl">Dernière révision</label><input id="cl" v-model="cf.lastReview" class="input" type="date" /></div>
        <div class="field"><label for="cn">Prochaine révision souhaitée</label><input id="cn" v-model="cf.nextReview" class="input" type="date" /></div>
        <div class="field full"><label for="cd">Description</label><textarea id="cd" v-model="cf.description" class="textarea" style="min-height:60px" /></div>
        <div class="field full"><label for="cno">Notes personnelles</label><textarea id="cno" v-model="cf.notes" class="textarea" /></div>
      </div>
      <template #footer><button class="btn" @click="cf = null">Annuler</button><button class="btn primary" @click="saveChapter">Enregistrer</button></template>
    </Modal>
  </div>
</template>
