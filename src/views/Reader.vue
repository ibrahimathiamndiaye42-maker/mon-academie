<script setup>
import { ref, shallowRef, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state, save, removeItem, loadPdfData, subjectById, chapterById, toast, confirmDialog } from '../store'
import { ANNOT_COLORS } from '../constants'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'

const route = useRoute(), router = useRouter()
const docId = route.params.id
const doc = computed(() => state.documents.find((d) => d.id === docId))
const loading = ref(true), error = ref('')
const pdf = shallowRef(null)
const numPages = ref(0), page = ref(1), zoom = ref(1)
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
const scroller = ref(null), wrap = ref(null), canvas = ref(null), textEl = ref(null)
const size = ref({ w: 600, h: 800 })
const noText = ref(false)
const panelOpen = ref(window.innerWidth > 900)
const panelTab = ref('ann')
const fullscreen = ref(false)
let lib = null, renderToken = 0, renderTask = null

async function loadLib() {
  if (lib) return lib
  lib = await import('pdfjs-dist')
  lib.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  return lib
}

/* ---------- Chargement et reprise de lecture ---------- */
async function load() {
  if (!doc.value) { error.value = 'Ce document est introuvable.'; loading.value = false; return }
  try {
    const buf = await loadPdfData(docId)
    if (!buf) throw new Error('Le fichier PDF est introuvable dans le stockage de cet appareil.')
    const L = await loadLib()
    try { pdf.value = await L.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise }
    catch (e) { throw new Error(e?.name === 'PasswordException' ? 'Ce PDF est protégé par un mot de passe : il ne peut pas être ouvert ici.' : "Impossible d'ouvrir ce PDF : le fichier semble corrompu.") }
    numPages.value = pdf.value.numPages
    const wanted = Number(route.query.page)
    page.value = Math.min(numPages.value, Math.max(1, wanted || doc.value.lastPage || 1))
    zoom.value = doc.value.scale || 1
    await save('documents', { ...doc.value, pages: numPages.value, lastOpenedAt: Date.now() })
    loading.value = false
    await nextTick()
    await renderPage()
    if (!wanted && doc.value.lastScroll) {
      await new Promise((r) => requestAnimationFrame(r))
      const s = scroller.value
      s.scrollTop = doc.value.lastScroll * Math.max(0, s.scrollHeight - s.clientHeight)
    }
    if (route.query.ann) flash(route.query.ann)
  } catch (e) { error.value = e.message || String(e); loading.value = false }
}

let posTimer = null
function schedulePos() { clearTimeout(posTimer); posTimer = setTimeout(savePos, 700) }
function savePos() {
  clearTimeout(posTimer)
  if (!pdf.value || !doc.value || !scroller.value) return
  const s = scroller.value
  const max = s.scrollHeight - s.clientHeight
  save('documents', { ...doc.value, lastPage: page.value, lastScroll: max > 0 ? s.scrollTop / max : 0, scale: zoom.value })
}

/* ---------- Rendu d'une page ---------- */
async function renderPage() {
  if (!pdf.value || !canvas.value) return
  const token = ++renderToken
  const p = await pdf.value.getPage(page.value)
  if (token !== renderToken) return
  const base = p.getViewport({ scale: 1 })
  const fit = Math.max(240, scroller.value.clientWidth - 36) / base.width
  const sc = fit * zoom.value
  const vpt = p.getViewport({ scale: sc })
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const cv = canvas.value
  cv.width = Math.floor(vpt.width * dpr); cv.height = Math.floor(vpt.height * dpr)
  cv.style.width = vpt.width + 'px'; cv.style.height = vpt.height + 'px'
  size.value = { w: vpt.width, h: vpt.height }
  renderTask?.cancel()
  const task = p.render({ canvasContext: cv.getContext('2d'), viewport: vpt, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null })
  renderTask = task
  try { await task.promise } catch (e) { if (e?.name === 'RenderingCancelledException') return; throw e }
  if (token !== renderToken) return
  const tl = textEl.value
  tl.replaceChildren()
  tl.style.setProperty('--scale-factor', String(sc))
  const layer = new lib.TextLayer({ textContentSource: p.streamTextContent(), container: tl, viewport: vpt })
  await layer.render()
  if (token !== renderToken) return
  noText.value = !tl.querySelector('span')
  markHits()
}
watch(page, async () => { sel.value = null; await renderPage(); if (scroller.value && !restoring) scroller.value.scrollTop = 0; schedulePos() })
watch(zoom, async () => { await renderPage(); schedulePos() })
let restoring = false
function goPage(n) { n = Math.min(numPages.value, Math.max(1, Math.round(Number(n) || 1))); if (n !== page.value) page.value = n }
const zoomIn = () => { const i = ZOOMS.findIndex((z) => z > zoom.value + 0.001); if (i >= 0) zoom.value = ZOOMS[i] }
const zoomOut = () => { const c = [...ZOOMS].reverse().find((z) => z < zoom.value - 0.001); if (c) zoom.value = c }
const fitWidth = () => { zoom.value = 1 }

/* ---------- Annotations ---------- */
const anns = computed(() => state.annotations.filter((a) => a.docId === docId).sort((a, b) => a.page - b.page || a.createdAt - b.createdAt))
const pageAnns = computed(() => anns.value.filter((a) => a.page === page.value))
const filter = ref('all')
const shownAnns = computed(() => anns.value.filter((a) => filter.value === 'all' || (filter.value === 'note' ? a.type === 'note' || a.comment : a.color === filter.value && a.type !== 'note')))
const marks = computed(() => state.bookmarks.filter((b) => b.docId === docId).sort((a, b) => a.page - b.page))
const hasMark = computed(() => marks.value.some((b) => b.page === page.value))
const activeColor = ref('yellow')
const sel = ref(null)
const noteForm = ref(null)
const flashId = ref(null)

let selTimer = null
function onSelChange() { clearTimeout(selTimer); selTimer = setTimeout(readSelection, 140) }
function readSelection() {
  const s = document.getSelection()
  const tl = textEl.value
  if (!s || s.isCollapsed || !s.rangeCount || !tl || !tl.contains(s.getRangeAt(0).commonAncestorContainer)) { sel.value = null; return }
  const wr = wrap.value.getBoundingClientRect()
  let rects = [...s.getRangeAt(0).getClientRects()]
    .map((c) => ({ x: (c.left - wr.left) / wr.width, y: (c.top - wr.top) / wr.height, w: c.width / wr.width, h: c.height / wr.height }))
    .filter((c) => c.w > 0.002 && c.h > 0.002)
  const t = 0.0015
  rects = rects.filter((a, i) => !rects.some((b, j) => i !== j && b.x <= a.x + t && b.y <= a.y + t && b.x + b.w >= a.x + a.w - t && b.y + b.h >= a.y + a.h - t && (b.w > a.w || b.h > a.h || j < i)))
  rects = rects.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 1e5) / 1e5])))
  sel.value = rects.length ? { text: s.toString().replace(/\s+/g, ' ').trim(), rects, page: page.value } : null
}
function clearSelection() { document.getSelection()?.removeAllRanges(); sel.value = null }
async function annotate(type, color = activeColor.value) {
  if (!sel.value) return
  const base = { docId, page: sel.value.page, type, color, rects: sel.value.rects, text: sel.value.text, comment: '' }
  clearSelection()
  if (type === 'note') { noteForm.value = { ...base, isNew: true }; return }
  if (await save('annotations', base)) toast(type === 'underline' ? 'Passage souligné.' : `Surligné en ${ANNOT_COLORS[color].label.toLowerCase()} (${ANNOT_COLORS[color].meaning.toLowerCase()}).`, 'ok', 2200)
}
function pageNote() { noteForm.value = { docId, page: page.value, type: 'note', color: activeColor.value, rects: [], text: '', comment: '', isNew: true } }
async function saveNote() {
  const f = { ...noteForm.value }
  if (!f.comment.trim() && f.type === 'note') { toast('Écris ta note avant d’enregistrer.', 'warn'); return }
  delete f.isNew
  if (await save('annotations', { ...f, comment: f.comment.trim() })) noteForm.value = null
}
async function delAnn(a) { if (await confirmDialog({ title: 'Supprimer cette annotation ?', message: a.text ? `« ${a.text.slice(0, 120)} »` : a.comment, danger: true, confirmLabel: 'Supprimer' })) await removeItem('annotations', a.id) }
function flash(id) { flashId.value = id; setTimeout(() => { if (flashId.value === id) flashId.value = null }, 3500) }
function goAnn(a) { goPage(a.page); flash(a.id); if (window.innerWidth <= 900) panelOpen.value = false }
async function toggleMark() {
  const m = marks.value.find((b) => b.page === page.value)
  if (m) await removeItem('bookmarks', m.id)
  else if (await save('bookmarks', { docId, page: page.value, label: `Page ${page.value}` })) toast('Signet ajouté.', 'ok', 1800)
}
const rectClass = (a) => (a.type === 'underline' ? `u u-${a.color}` : a.type === 'note' ? 'n' : `h h-${a.color}`)

/* ---------- Recherche ---------- */
const query = ref(''), results = ref([]), searching = ref(false), searchDone = ref(false)
let hitQuery = '', searchTok = 0
const texts = {}
async function pageText(n) { if (texts[n] === undefined) { const c = await (await pdf.value.getPage(n)).getTextContent(); texts[n] = c.items.map((i) => i.str).join(' ') } return texts[n] }
async function search() {
  const q = query.value.trim()
  if (q.length < 2) return
  const tok = ++searchTok
  searching.value = true; searchDone.value = false; results.value = []; hitQuery = q.toLowerCase()
  const lq = hitQuery
  for (let n = 1; n <= numPages.value && tok === searchTok; n++) {
    const t = await pageText(n)
    const i = t.toLowerCase().indexOf(lq)
    if (i >= 0) results.value.push({ page: n, snippet: '…' + t.slice(Math.max(0, i - 40), i + q.length + 70).trim() + '…' })
  }
  if (tok === searchTok) { searching.value = false; searchDone.value = true; markHits() }
}
function markHits() {
  const tl = textEl.value
  if (!tl) return
  for (const s of tl.querySelectorAll('span:not(.markedContent)')) s.classList.toggle('hit', !!hitQuery && s.textContent.toLowerCase().includes(hitQuery))
}

/* ---------- Divers ---------- */
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.()
  else document.documentElement.requestFullscreen?.().catch(() => toast('Le plein écran n’est pas disponible sur ce navigateur.', 'warn'))
}
const onFs = () => { fullscreen.value = !!document.fullscreenElement; nextTick(renderPage) }
function onKey(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || noteForm.value) return
  if (e.key === 'ArrowRight' || e.key === 'PageDown') goPage(page.value + 1)
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPage(page.value - 1)
  else if (e.key === '+' || e.key === '=') zoomIn()
  else if (e.key === '-') zoomOut()
}
const onHide = () => { if (document.visibilityState === 'hidden') savePos() }
let ro, roTimer, lastW = 0
function back() { savePos(); router.push('/cours') }
onMounted(() => {
  load()
  document.addEventListener('selectionchange', onSelChange)
  document.addEventListener('fullscreenchange', onFs)
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', savePos)
  window.addEventListener('keydown', onKey)
  ro = new ResizeObserver(() => {
    const w = scroller.value?.clientWidth || 0
    if (Math.abs(w - lastW) < 8) return
    lastW = w; clearTimeout(roTimer); roTimer = setTimeout(renderPage, 200)
  })
  nextTick(() => scroller.value && ro.observe(scroller.value))
})
onBeforeUnmount(() => {
  savePos()
  document.removeEventListener('selectionchange', onSelChange); document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('visibilitychange', onHide)
  window.removeEventListener('pagehide', savePos); window.removeEventListener('keydown', onKey)
  ro?.disconnect(); renderTask?.cancel(); pdf.value?.destroy?.()
  if (document.fullscreenElement) document.exitFullscreen?.()
})
const pct = computed(() => Math.round(zoom.value * 100))
</script>

<template>
  <div class="reader" :class="{ nopanel: !panelOpen }">
    <div class="reader-main">
      <div class="reader-bar">
        <button class="icon-btn" aria-label="Retour à mes cours" @click="back"><Icon name="chevL" /></button>
        <div class="grow" style="min-width:90px;overflow:hidden"><div style="font-weight:600;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">{{ doc?.title }}</div><div class="tiny muted" style="white-space:nowrap;text-overflow:ellipsis;overflow:hidden">{{ subjectById(doc?.subjectId)?.name }}<span v-if="doc?.chapterId"> · {{ chapterById(doc.chapterId)?.title }}</span></div></div>
        <button class="icon-btn" aria-label="Page précédente" :disabled="page <= 1" @click="goPage(page - 1)"><Icon name="chevL" /></button>
        <div class="row" style="gap:4px"><input :value="page" type="number" min="1" :max="numPages" class="input" style="width:62px;min-height:34px;padding:4px 8px;text-align:center" aria-label="Numéro de page" @change="goPage($event.target.value)" /><span class="small muted num">/ {{ numPages || '…' }}</span></div>
        <button class="icon-btn" aria-label="Page suivante" :disabled="page >= numPages" @click="goPage(page + 1)"><Icon name="chevR" /></button>
        <button class="icon-btn" aria-label="Zoom arrière" @click="zoomOut"><Icon name="zoomOut" /></button>
        <button class="btn sm ghost num" aria-label="Ajuster à la largeur" @click="fitWidth">{{ pct }}%</button>
        <button class="icon-btn" aria-label="Zoom avant" @click="zoomIn"><Icon name="zoomIn" /></button>
        <button class="icon-btn" :class="{ on: hasMark }" aria-label="Ajouter ou retirer un signet" @click="toggleMark"><Icon name="bookmark" /></button>
        <button class="icon-btn" aria-label="Rechercher dans le document" @click="panelOpen = true; panelTab = 'search'"><Icon name="search" /></button>
        <button class="icon-btn" :class="{ on: fullscreen }" aria-label="Plein écran" @click="toggleFullscreen"><Icon name="fullscreen" /></button>
        <button class="icon-btn" :class="{ on: panelOpen }" aria-label="Afficher le panneau des annotations" @click="panelOpen = !panelOpen"><Icon name="list" /></button>
      </div>
      <div ref="scroller" class="reader-scroll" @scroll.passive="schedulePos">
        <div v-if="loading" class="muted" style="margin:auto">Ouverture du document…</div>
        <div v-else-if="error" class="card" style="margin:auto;max-width:440px"><h2>Lecture impossible</h2><p class="muted" style="margin:8px 0 14px">{{ error }}</p><button class="btn" @click="back">Retour à mes cours</button></div>
        <div v-show="!loading && !error" ref="wrap" class="page-wrap" :style="{ width: size.w + 'px', height: size.h + 'px' }">
          <canvas ref="canvas" />
          <div class="annot-layer"><template v-for="a in pageAnns" :key="a.id"><div v-for="(r, i) in a.rects" :key="i" class="a" :class="[rectClass(a), { flash: flashId === a.id }]" :style="{ left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%', background: a.type === 'note' ? 'rgba(167,139,250,.38)' : undefined }" /></template></div>
          <div ref="textEl" class="textLayer" />
        </div>
      </div>
      <div v-if="noText && !loading && !error" class="small" style="padding:8px 14px;background:var(--surface);border-top:1px solid var(--line)"><Icon name="alert" :size="15" /> Cette page ne contient pas de texte sélectionnable (document scanné). Le surlignage n'est pas possible ici ; tu peux ajouter une note de page. La reconnaissance de texte (OCR) n'est pas incluse dans cette version.</div>
    </div>

    <aside v-if="panelOpen" class="reader-panel" aria-label="Annotations">
      <div class="tabs" style="margin:0;padding:0 8px"><button :class="{ on: panelTab === 'ann' }" @click="panelTab = 'ann'">Annotations ({{ anns.length }})</button><button :class="{ on: panelTab === 'marks' }" @click="panelTab = 'marks'">Signets ({{ marks.length }})</button><button :class="{ on: panelTab === 'search' }" @click="panelTab = 'search'">Recherche</button><button class="icon-btn right" aria-label="Fermer le panneau" @click="panelOpen = false"><Icon name="x" :size="18" /></button></div>
      <div class="body">
        <template v-if="panelTab === 'ann'">
          <div class="row wrap" style="gap:6px"><select v-model="filter" class="select" style="min-height:34px;width:auto;flex:1" aria-label="Filtrer les annotations"><option value="all">Toutes</option><option v-for="(c, k) in ANNOT_COLORS" :key="k" :value="k">{{ c.label }} · {{ c.meaning }}</option><option value="note">Notes personnelles</option></select><button class="btn sm" @click="pageNote"><Icon name="note" :size="15" /> Note de page</button></div>
          <p v-if="!shownAnns.length" class="small muted">{{ anns.length ? 'Aucune annotation de ce type.' : 'Sélectionne un passage du texte pour le surligner, le souligner ou y ajouter une note. Jaune : à retenir · Vert : définition · Bleu : exemple · Rouge : à revoir.' }}</p>
          <div v-for="a in shownAnns" :key="a.id" class="ann-card" :class="'ann-' + a.color" role="button" tabindex="0" @click="goAnn(a)" @keydown.enter="goAnn(a)">
            <div class="row small muted"><span>Page {{ a.page }} · {{ a.type === 'note' ? 'Note' : a.type === 'underline' ? 'Souligné' : ANNOT_COLORS[a.color]?.meaning }}</span><span class="right row" style="gap:0"><button class="icon-btn" style="width:28px;height:28px" aria-label="Ajouter ou modifier la note" @click.stop="noteForm = { ...a }"><Icon name="note" :size="15" /></button><button class="icon-btn" style="width:28px;height:28px" aria-label="Supprimer l'annotation" @click.stop="delAnn(a)"><Icon name="trash" :size="15" /></button></span></div>
            <div v-if="a.text" class="small" style="white-space:pre-line">« {{ a.text.length > 220 ? a.text.slice(0, 220) + '…' : a.text }} »</div>
            <div v-if="a.comment" class="small" style="white-space:pre-line"><b>Note :</b> {{ a.comment }}</div>
          </div>
        </template>
        <template v-else-if="panelTab === 'marks'">
          <p v-if="!marks.length" class="small muted">Aucun signet. Utilise l'icône signet de la barre pour marquer la page courante.</p>
          <div v-for="m in marks" :key="m.id" class="ann-card" style="border-left-color:var(--accent)" role="button" tabindex="0" @click="goPage(m.page)" @keydown.enter="goPage(m.page)"><div class="row"><Icon name="bookmark" :size="16" /><span class="grow">{{ m.label }}</span><button class="icon-btn" style="width:28px;height:28px" aria-label="Supprimer le signet" @click.stop="removeItem('bookmarks', m.id)"><Icon name="trash" :size="15" /></button></div></div>
        </template>
        <template v-else>
          <form class="row" @submit.prevent="search"><input v-model="query" class="input" type="search" placeholder="Rechercher un mot…" aria-label="Rechercher dans le document" /><button class="btn primary" type="submit" :disabled="searching">Chercher</button></form>
          <p v-if="searching" class="small muted">Recherche en cours…</p>
          <p v-else-if="searchDone && !results.length" class="small muted">Aucun résultat. Si le PDF est un document scanné, il ne contient pas de texte à rechercher.</p>
          <div v-for="r in results" :key="r.page" class="ann-card" style="border-left-color:var(--accent)" role="button" tabindex="0" @click="goPage(r.page)" @keydown.enter="goPage(r.page)"><div class="small muted">Page {{ r.page }}</div><div class="small">{{ r.snippet }}</div></div>
        </template>
      </div>
    </aside>

    <div v-if="sel" class="sel-bar" role="toolbar" aria-label="Annoter la sélection">
      <button v-for="(c, k) in ANNOT_COLORS" :key="k" class="c" :style="{ background: c.css }" :title="`${c.label} — ${c.meaning}`" :aria-label="`Surligner en ${c.label.toLowerCase()} : ${c.meaning}`" @pointerdown.prevent @click="activeColor = k; annotate('highlight', k)" />
      <button class="t" title="Souligner" @pointerdown.prevent @click="annotate('underline')"><Icon name="underline" :size="17" /> Souligner</button>
      <button class="t" title="Ajouter une note" @pointerdown.prevent @click="annotate('note')"><Icon name="note" :size="17" /> Note</button>
    </div>

    <Modal v-if="noteForm" :title="noteForm.id ? 'Note sur ce passage' : noteForm.rects.length ? 'Note sur le passage sélectionné' : 'Note de la page ' + noteForm.page" @close="noteForm = null">
      <p v-if="noteForm.text" class="small muted">« {{ noteForm.text.slice(0, 200) }} »</p>
      <textarea v-model="noteForm.comment" class="textarea" style="min-height:120px" placeholder="Ta note ou ton commentaire…" autofocus />
      <template #footer><button class="btn" @click="noteForm = null">Annuler</button><button class="btn primary" @click="saveNote">Enregistrer</button></template>
    </Modal>
  </div>
</template>
