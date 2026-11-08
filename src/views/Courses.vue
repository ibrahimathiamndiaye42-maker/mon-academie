<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state, importPdf, save, deleteDocument, subjectById, chapterById, chaptersOf, confirmDialog, toast } from '../store'
import { ANNOT_COLORS } from '../constants'
import { fmtDateShort } from '../utils/time'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import EmptyState from '../components/EmptyState.vue'
import ProgressBar from '../components/ProgressBar.vue'

const route = useRoute(), router = useRouter()
const tab = ref('docs')
const q = ref(''), fSubject = ref(''), fChapter = ref('')
const queue = ref([]) // fichiers en attente d'import
const meta = ref(null)
const edit = ref(null)
const fileInput = ref(null)
const busy = ref(false)
const err = ref('')

onMounted(() => { if (route.query.chapitre) { const c = chapterById(route.query.chapitre); if (c) { fSubject.value = c.subjectId; fChapter.value = c.id } } })
watch(fSubject, () => { if (fChapter.value && chapterById(fChapter.value)?.subjectId !== fSubject.value) fChapter.value = '' })

const docs = computed(() => state.documents.filter((d) => {
  if (fSubject.value && d.subjectId !== fSubject.value) return false
  if (fChapter.value && d.chapterId !== fChapter.value) return false
  const s = q.value.trim().toLowerCase()
  return !s || (d.title + ' ' + (d.description || '') + ' ' + (subjectById(d.subjectId)?.name || '')).toLowerCase().includes(s)
}).sort((a, b) => a.title.localeCompare(b.title)))
const recent = computed(() => state.documents.filter((d) => d.lastOpenedAt).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 4))
const annCount = (id) => state.annotations.filter((a) => a.docId === id).length
const pct = (d) => (d.pages ? Math.round((d.lastPage / d.pages) * 100) : 0)

function pick(e) {
  const files = [...e.target.files]
  e.target.value = ''
  const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
  if (files.length !== pdfs.length) toast('Les fichiers qui ne sont pas des PDF ont été ignorés.', 'warn')
  if (!pdfs.length) return
  queue.value = pdfs
  next()
}
function next() {
  const f = queue.value[0]
  if (!f) { meta.value = null; return }
  err.value = ''
  meta.value = { file: f, title: f.name.replace(/\.pdf$/i, ''), subjectId: fSubject.value || '', chapterId: fChapter.value || '', description: '' }
}
async function doImport() {
  const m = meta.value
  if (!m.title.trim()) { err.value = 'Donne un titre au document.'; return }
  busy.value = true
  try { await importPdf(m.file, { ...m, title: m.title.trim() }); toast(`« ${m.title} » importé.`, 'ok'); queue.value.shift(); next() }
  catch (e) { err.value = e.message || String(e) }
  finally { busy.value = false }
}
function skip() { queue.value.shift(); next() }
function openEdit(d) { edit.value = { ...d } }
async function saveEdit() { if (!edit.value.title.trim()) return; if (await save('documents', { ...edit.value, title: edit.value.title.trim() })) edit.value = null }
async function del(d) {
  const n = annCount(d.id)
  if (await confirmDialog({ title: `Supprimer « ${d.title} » ?`, danger: true, confirmLabel: 'Supprimer le document', message: `Le PDF${n ? `, ses ${n} annotation(s)` : ''} et ses signets seront définitivement supprimés de cet appareil.` })) await deleteDocument(d.id)
}
const open = (d, extra = {}) => router.push({ path: `/cours/${d.id}`, query: extra })

/* Révision à partir des annotations */
const aKind = ref('all')
const aSubject = ref('')
const kinds = [{ k: 'all', l: 'Tout' }, { k: 'yellow', l: 'Jaunes · à retenir' }, { k: 'green', l: 'Vertes · définitions' }, { k: 'blue', l: 'Bleues · exemples' }, { k: 'red', l: 'Rouges · difficiles' }, { k: 'note', l: 'Notes personnelles' }]
const anns = computed(() => state.annotations.filter((a) => {
  const d = state.documents.find((x) => x.id === a.docId)
  if (!d) return false
  if (aSubject.value && d.subjectId !== aSubject.value) return false
  if (aKind.value === 'all') return true
  if (aKind.value === 'note') return !!a.comment || a.type === 'note'
  return a.color === aKind.value && a.type !== 'note'
}).sort((a, b) => a.docId.localeCompare(b.docId) || a.page - b.page))
const docTitle = (id) => state.documents.find((d) => d.id === id)?.title || ''
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div><h1>Mes cours</h1><p>Tes supports PDF, lus et annotés sans quitter l'application.</p></div>
      <div class="row"><input ref="fileInput" type="file" accept="application/pdf,.pdf" multiple class="hide" @change="pick" /><button class="btn primary" @click="fileInput.click()"><Icon name="upload" :size="18" /> Importer un PDF</button></div>
    </div>
    <div class="tabs"><button :class="{ on: tab === 'docs' }" @click="tab = 'docs'">Documents</button><button :class="{ on: tab === 'ann' }" @click="tab = 'ann'">Réviser mes annotations</button></div>

    <template v-if="tab === 'docs'">
      <div v-if="recent.length" class="card" style="margin-bottom:16px"><div class="card-head"><h2>Ouverts récemment</h2></div>
        <div class="grid g4"><button v-for="d in recent" :key="d.id" class="card flat" style="text-align:left;cursor:pointer" @click="open(d)"><div class="t" style="font-weight:600">{{ d.title }}</div><div class="small muted">{{ subjectById(d.subjectId)?.name || 'Sans matière' }} · page {{ d.lastPage }}<span v-if="d.pages"> / {{ d.pages }}</span></div><div style="margin-top:8px"><ProgressBar :value="pct(d)" /></div></button></div></div>

      <div class="row wrap" style="margin-bottom:14px">
        <div class="field grow" style="min-width:200px"><input v-model="q" class="input" type="search" placeholder="Rechercher un document…" aria-label="Rechercher un document" /></div>
        <select v-model="fSubject" class="select" style="width:auto" aria-label="Filtrer par matière"><option value="">Toutes les matières</option><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select>
        <select v-model="fChapter" class="select" style="width:auto" :disabled="!fSubject" aria-label="Filtrer par chapitre"><option value="">Tous les chapitres</option><option v-for="c in chaptersOf(fSubject)" :key="c.id" :value="c.id">{{ c.title }}</option></select>
      </div>

      <EmptyState v-if="!state.documents.length" icon="book" title="Ta bibliothèque est vide" text="Importe un PDF depuis ton téléphone ou ton ordinateur. Il reste stocké sur cet appareil, même hors connexion.">
        <button class="btn primary" @click="fileInput.click()"><Icon name="upload" :size="18" /> Importer mon premier PDF</button>
      </EmptyState>
      <EmptyState v-else-if="!docs.length" icon="search" title="Aucun document ne correspond" text="Change la recherche ou les filtres." />
      <div v-else class="grid g3">
        <div v-for="d in docs" :key="d.id" class="card" style="display:flex;flex-direction:column;gap:10px">
          <div class="row" style="align-items:flex-start"><div class="sub-badge" :style="{ background: subjectById(d.subjectId)?.color || 'var(--ink-3)' }"><Icon name="file" :size="18" /></div><div class="grow"><div style="font-weight:600;overflow-wrap:anywhere">{{ d.title }}</div><div class="small muted">{{ subjectById(d.subjectId)?.name || 'Sans matière' }}<span v-if="d.chapterId"> · {{ chapterById(d.chapterId)?.title }}</span></div></div></div>
          <p v-if="d.description" class="small muted">{{ d.description }}</p>
          <div class="small muted">{{ annCount(d.id) }} annotation{{ annCount(d.id) > 1 ? 's' : '' }}<span v-if="d.pages"> · lu à {{ pct(d) }}% (page {{ d.lastPage }}/{{ d.pages }})</span><span v-else> · pas encore ouvert</span></div>
          <div v-if="d.pages"><ProgressBar :value="pct(d)" /></div>
          <div class="row" style="margin-top:auto"><button class="btn primary sm grow" @click="open(d)"><Icon name="book" :size="16" /> {{ d.lastOpenedAt ? 'Reprendre' : 'Ouvrir' }}</button><button class="icon-btn" aria-label="Renommer ou modifier" @click="openEdit(d)"><Icon name="edit" :size="18" /></button><button class="icon-btn" aria-label="Supprimer" @click="del(d)"><Icon name="trash" :size="18" /></button></div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="row wrap" style="margin-bottom:14px"><div class="seg" style="flex-wrap:wrap"><button v-for="k in kinds" :key="k.k" :class="{ on: aKind === k.k }" @click="aKind = k.k">{{ k.l }}</button></div>
        <select v-model="aSubject" class="select" style="width:auto" aria-label="Filtrer par matière"><option value="">Toutes les matières</option><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
      <EmptyState v-if="!anns.length" icon="highlight" title="Aucune annotation à afficher" text="Ouvre un cours, sélectionne un passage et surligne-le : il apparaîtra ici pour tes révisions." />
      <div v-else class="col"><button v-for="a in anns" :key="a.id" type="button" class="ann-card" :class="'ann-' + a.color" style="text-align:left" @click="router.push({ path: `/cours/${a.docId}`, query: { page: a.page, ann: a.id } })">
        <div class="small muted">{{ docTitle(a.docId) }} · page {{ a.page }} · {{ a.type === 'note' ? 'Note' : ANNOT_COLORS[a.color]?.meaning }}</div>
        <div v-if="a.text" style="white-space:pre-line">« {{ a.text }} »</div><div v-if="a.comment" class="small" style="white-space:pre-line"><b>Note :</b> {{ a.comment }}</div></button></div>
    </template>

    <Modal v-if="meta" :title="`Importer un PDF${queue.length > 1 ? ` (1 sur ${queue.length})` : ''}`" @close="skip">
      <div v-if="err" class="err-list"><span>{{ err }}</span></div>
      <p class="small muted">Fichier : {{ meta.file.name }} ({{ (meta.file.size / 1048576).toFixed(1).replace('.', ',') }} Mo)</p>
      <div class="form-grid">
        <div class="field full"><label for="it">Titre</label><input id="it" v-model="meta.title" class="input" /></div>
        <div class="field"><label for="is">Matière</label><select id="is" v-model="meta.subjectId" class="select" @change="meta.chapterId = ''"><option value="">Aucune</option><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
        <div class="field"><label for="ic">Chapitre</label><select id="ic" v-model="meta.chapterId" class="select" :disabled="!meta.subjectId"><option value="">Aucun</option><option v-for="c in chaptersOf(meta.subjectId)" :key="c.id" :value="c.id">{{ c.title }}</option></select></div>
        <div class="field full"><label for="id">Description (facultatif)</label><textarea id="id" v-model="meta.description" class="textarea" style="min-height:60px" /></div>
      </div>
      <template #footer><button class="btn" @click="skip">Ignorer ce fichier</button><button class="btn primary" :disabled="busy" @click="doImport">{{ busy ? 'Import…' : 'Importer' }}</button></template>
    </Modal>
    <Modal v-if="edit" title="Modifier le document" @close="edit = null">
      <div class="form-grid">
        <div class="field full"><label for="et">Titre</label><input id="et" v-model="edit.title" class="input" /></div>
        <div class="field"><label for="es">Matière</label><select id="es" v-model="edit.subjectId" class="select" @change="edit.chapterId = null"><option :value="null">Aucune</option><option v-for="s in state.subjects" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
        <div class="field"><label for="ec">Chapitre</label><select id="ec" v-model="edit.chapterId" class="select" :disabled="!edit.subjectId"><option :value="null">Aucun</option><option v-for="c in chaptersOf(edit.subjectId)" :key="c.id" :value="c.id">{{ c.title }}</option></select></div>
        <div class="field full"><label for="ed">Description</label><textarea id="ed" v-model="edit.description" class="textarea" style="min-height:60px" /></div>
      </div>
      <template #footer><button class="btn" @click="edit = null">Annuler</button><button class="btn primary" @click="saveEdit">Enregistrer</button></template>
    </Modal>
  </div>
</template>
