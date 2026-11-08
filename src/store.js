// Gestion centralisée des données : état réactif + persistance IndexedDB + règles métier.
import { reactive, watch } from 'vue'
import * as db from './db'
import { DEFAULT_SETTINGS, ACCENTS } from './constants'
import { uid, todayStr, dateOfTs, addDays, weekDates } from './utils/time'
import * as T from './utils/timer'
import { sessionConflicts, courseConflicts } from './utils/schedule'

export const COLLECTIONS = ['subjects', 'chapters', 'timetable', 'sessions', 'logs', 'evaluations', 'documents', 'annotations', 'bookmarks']
const clone = (o) => JSON.parse(JSON.stringify(o))

export const state = reactive({
  ready: false, loadError: null, now: Date.now(),
  settings: clone(DEFAULT_SETTINGS), timer: null,
  toasts: [], confirmDlg: null, installEvent: null,
  subjects: [], chapters: [], timetable: [], sessions: [], logs: [], evaluations: [], documents: [], annotations: [], bookmarks: []
})

/* ---------- Messages & confirmations ---------- */
export function toast(message, tone = 'info', ms = 4200) {
  const t = { id: uid(), message, tone }
  state.toasts.push(t)
  setTimeout(() => { const i = state.toasts.findIndex((x) => x.id === t.id); if (i >= 0) state.toasts.splice(i, 1) }, ms)
}
export function confirmDialog({ title = 'Confirmer', message = '', confirmLabel = 'Confirmer', danger = false, requireText = null }) {
  return new Promise((resolve) => { state.confirmDlg = { title, message, confirmLabel, danger, requireText, resolve } })
}
function report(e) {
  console.error(e)
  toast(db.isQuotaError(e) ? "Espace de stockage insuffisant : libère de la place ou exporte une sauvegarde." : `Erreur d'enregistrement : ${e.message || e}`, 'danger', 7000)
}

/* ---------- Réglages & apparence ---------- */
function mergeSettings(saved) {
  const s = clone(DEFAULT_SETTINGS)
  for (const k of Object.keys(saved || {})) {
    if (k === 'notif') s.notif = { ...s.notif, ...saved.notif }
    else s[k] = saved[k]
  }
  return s
}
let mql = null
export function applyAppearance() {
  if (typeof document === 'undefined') return
  const s = state.settings
  const root = document.documentElement
  const dark = s.theme === 'dark' || (s.theme === 'auto' && globalThis.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  const acc = ACCENTS[s.accent] || ACCENTS.navy
  root.style.setProperty('--accent', dark ? acc.dark : acc.light)
  root.style.setProperty('--accent-ink', dark ? '#0b1020' : '#ffffff')
  root.dataset.size = s.fontSize
  root.dataset.density = s.density
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0e1320' : acc.light)
}
let watching = false
function startWatchers() {
  if (watching) return
  watching = true
  let timer = null
  watch(() => state.settings, () => {
    applyAppearance()
    clearTimeout(timer)
    timer = setTimeout(saveSettingsNow, 250)
  }, { deep: true })
  if (globalThis.matchMedia) {
    mql = matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener?.('change', () => { if (state.settings.theme === 'auto') applyAppearance() })
  }
}
export async function saveSettingsNow() {
  try { await db.put('kv', { key: 'settings', value: clone(state.settings) }) } catch (e) { report(e) }
}

/* ---------- Chargement ---------- */
export async function init() {
  try {
    for (const c of COLLECTIONS) state[c] = await db.getAll(c)
    const kv = await db.getAll('kv')
    state.settings = mergeSettings(kv.find((k) => k.key === 'settings')?.value)
    state.timer = kv.find((k) => k.key === 'timer')?.value || null
    state.loadError = null
    state.ready = true
    applyAppearance()
    startWatchers()
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})
  } catch (e) {
    console.error(e)
    state.loadError = "Impossible d'ouvrir le stockage local de l'application : " + (e.message || e)
  }
}

/* ---------- CRUD générique ---------- */
export async function save(name, item) {
  const rec = clone(item)
  const now = Date.now()
  if (!rec.id) rec.id = uid()
  rec.createdAt = rec.createdAt || now
  rec.updatedAt = now
  try { await db.put(name, rec) } catch (e) { report(e); return null }
  const arr = state[name]
  const i = arr.findIndex((x) => x.id === rec.id)
  if (i >= 0) arr[i] = rec; else arr.push(rec)
  return rec
}
export async function removeItem(name, id) {
  try { await db.del(name, id) } catch (e) { report(e); return false }
  const arr = state[name]
  const i = arr.findIndex((x) => x.id === id)
  if (i >= 0) arr.splice(i, 1)
  return true
}
async function removeMany(name, ids) {
  if (!ids.length) return
  await db.delMany(name, ids)
  state[name] = state[name].filter((x) => !ids.includes(x.id))
}

/* ---------- Accès ---------- */
export const subjectById = (id) => state.subjects.find((s) => s.id === id) || null
export const chapterById = (id) => state.chapters.find((c) => c.id === id) || null
export const chaptersOf = (subjectId) => state.chapters.filter((c) => c.subjectId === subjectId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt)
export const docsOfChapter = (chapterId) => state.documents.filter((d) => d.chapterId === chapterId)

/* ---------- Suppressions en cascade ---------- */
export async function deleteSubject(id) {
  try {
    const chIds = state.chapters.filter((c) => c.subjectId === id).map((c) => c.id)
    await removeMany('chapters', chIds)
    await removeMany('timetable', state.timetable.filter((x) => x.subjectId === id).map((x) => x.id))
    await removeMany('sessions', state.sessions.filter((x) => x.subjectId === id).map((x) => x.id))
    await removeMany('logs', state.logs.filter((x) => x.subjectId === id).map((x) => x.id))
    await removeMany('evaluations', state.evaluations.filter((x) => x.subjectId === id).map((x) => x.id))
    for (const d of state.documents.filter((x) => x.subjectId === id)) await save('documents', { ...d, subjectId: null, chapterId: null }) // les PDF sont conservés
    if (state.timer?.subjectId === id) await timerAbort()
    await db.del('subjects', id)
    state.subjects = state.subjects.filter((s) => s.id !== id)
    if (state.settings.priorityBoost[id] !== undefined) delete state.settings.priorityBoost[id]
    return true
  } catch (e) { report(e); return false }
}
export async function deleteChapter(id) {
  try {
    for (const s of state.sessions.filter((x) => x.chapterId === id)) await save('sessions', { ...s, chapterId: null })
    for (const d of state.documents.filter((x) => x.chapterId === id)) await save('documents', { ...d, chapterId: null })
    for (const e of state.evaluations.filter((x) => (x.chapterIds || []).includes(id))) await save('evaluations', { ...e, chapterIds: e.chapterIds.filter((c) => c !== id) })
    await db.del('chapters', id)
    state.chapters = state.chapters.filter((c) => c.id !== id)
    return true
  } catch (e) { report(e); return false }
}
export async function deleteDocument(id) {
  try {
    await removeMany('annotations', state.annotations.filter((a) => a.docId === id).map((a) => a.id))
    await removeMany('bookmarks', state.bookmarks.filter((a) => a.docId === id).map((a) => a.id))
    await db.del(db.FILES, id)
    await db.del('documents', id)
    state.documents = state.documents.filter((d) => d.id !== id)
    return true
  } catch (e) { report(e); return false }
}

/* ---------- Documents PDF ---------- */
export async function importPdf(file, meta) {
  const buf = await file.arrayBuffer()
  const head = new TextDecoder().decode(new Uint8Array(buf.slice(0, 1024)))
  if (!head.includes('%PDF')) throw new Error("Ce fichier n'est pas un PDF valide.")
  const id = uid()
  try { await db.put(db.FILES, { id, name: file.name, type: 'application/pdf', size: file.size, data: buf }) } catch (e) { report(e); throw e }
  const doc = await save('documents', {
    id, title: meta.title || file.name.replace(/\.pdf$/i, ''), subjectId: meta.subjectId || null, chapterId: meta.chapterId || null,
    description: meta.description || '', fileName: file.name, size: file.size, pages: null, lastPage: 1, lastScroll: 0, scale: null, lastOpenedAt: null
  })
  if (!doc) { await db.del(db.FILES, id).catch(() => {}); throw new Error("Le document n'a pas pu être enregistré.") }
  return doc
}
export const loadPdfData = async (id) => (await db.get(db.FILES, id))?.data || null

/* ---------- Séances de révision ---------- */
export function validateSession(s) {
  const errors = []
  if (!s.date) errors.push('Choisis une date.')
  if (!s.start || !s.end) errors.push("Indique l'heure de début et de fin.")
  else if (s.end <= s.start) errors.push("L'heure de fin doit être après l'heure de début.")
  if (s.kind === 'study' && !s.subjectId) errors.push('Choisis une matière.')
  if (!errors.length) {
    const c = sessionConflicts(s, state.timetable, state.sessions)
    for (const x of c.courses) errors.push(`Conflit avec un cours (${subjectById(x.subjectId)?.name || 'Cours'}, ${x.start}–${x.end}).`)
    for (const x of c.sessions) errors.push(`Conflit avec une autre séance (${x.start}–${x.end}).`)
  }
  return errors
}
export function validateCourse(c) {
  const errors = []
  if (!c.subjectId && c.kind === 'course') errors.push('Choisis une matière.')
  if (!c.start || !c.end) errors.push("Indique l'heure de début et de fin.")
  else if (c.end <= c.start) errors.push("L'heure de fin doit être après l'heure de début.")
  return errors
}
export const courseConflictList = (c) => courseConflicts(c, state.timetable)

export async function postponeSession(id, date, start, end) {
  const s = state.sessions.find((x) => x.id === id)
  if (!s) return null
  const moved = { ...s, date, start: start || s.start, end: end || s.end, status: 'postponed', postponedCount: (s.postponedCount || 0) + 1, postponedFrom: s.postponedFrom || s.date }
  const errors = validateSession(moved)
  if (errors.length) return { errors }
  return { session: await save('sessions', moved) }
}
export async function duplicateSession(id, date) {
  const s = state.sessions.find((x) => x.id === id)
  if (!s) return null
  const copy = { ...s, id: undefined, createdAt: undefined, date: date || s.date, status: 'planned', postponedCount: 0, postponedFrom: null, actualMin: 0 }
  const errors = validateSession({ ...copy, id: 'new' })
  if (errors.length) return { errors }
  return { session: await save('sessions', copy) }
}

/* ---------- Chronomètre ---------- */
async function persistTimer() {
  try {
    if (state.timer) await db.put('kv', { key: 'timer', value: clone(state.timer) })
    else await db.del('kv', 'timer')
  } catch (e) { report(e) }
}
export async function timerStart(opts) {
  if (state.timer) { toast('Une séance est déjà en cours.', 'warn'); return false }
  const sess = opts.sessionId ? state.sessions.find((s) => s.id === opts.sessionId) : null
  const t = T.startTimer({
    subjectId: opts.subjectId ?? sess?.subjectId ?? null, chapterId: opts.chapterId ?? sess?.chapterId ?? null,
    sessionId: sess?.id ?? null, plannedMin: opts.plannedMin ?? 0, notes: opts.notes || ''
  })
  t.prevStatus = sess?.status || null
  state.timer = t
  await persistTimer()
  if (sess) await save('sessions', { ...sess, status: 'running' })
  return true
}
export async function timerPause() { if (state.timer) { state.timer = T.pauseTimer(state.timer); await persistTimer() } }
export async function timerResume() { if (state.timer) { state.timer = T.resumeTimer(state.timer); await persistTimer() } }
export async function timerSetNotes(notes) { if (state.timer) { state.timer = { ...state.timer, notes }; await persistTimer() } }

export async function timerFinish(notes) {
  const t = state.timer
  if (!t) return null
  const f = T.finishTimer(t)
  const log = await save('logs', {
    sessionId: t.sessionId, subjectId: t.subjectId, chapterId: t.chapterId, date: dateOfTs(t.startTs),
    startTs: f.startTs, endTs: f.endTs, workMs: f.workMs, pauseMs: f.pauseMs, pauseCount: t.pauses.length,
    plannedMin: t.plannedMin, early: f.early, notes: notes ?? t.notes ?? ''
  })
  if (!log) return null
  if (t.sessionId) {
    const s = state.sessions.find((x) => x.id === t.sessionId)
    if (s) {
      const total = state.logs.filter((l) => l.sessionId === s.id).reduce((a, l) => a + l.workMs, 0) / 60000
      await save('sessions', { ...s, status: 'done', actualMin: Math.round(total * 10) / 10, endedEarly: f.early })
    }
  }
  // Un chapitre travaillé passe de « non commencé » à « en cours » ; il n'est JAMAIS marqué « maîtrisé » automatiquement.
  const ch = t.chapterId ? chapterById(t.chapterId) : null
  if (ch) await save('chapters', { ...ch, lastReview: log.date, status: ch.status === 'non_commence' ? 'en_cours' : ch.status })
  state.timer = null
  await persistTimer()
  return log
}
export async function timerAbort() {
  const t = state.timer
  if (!t) return
  if (t.sessionId) {
    const s = state.sessions.find((x) => x.id === t.sessionId)
    if (s && s.status === 'running') await save('sessions', { ...s, status: t.prevStatus && t.prevStatus !== 'running' ? t.prevStatus : 'planned' })
  }
  state.timer = null
  await persistTimer()
}

// Minutes de travail réel sur une plage de dates, y compris la séance en cours (hors pauses).
export function workMinutes(from, to) {
  let m = state.logs.reduce((a, l) => (l.date >= from && l.date <= to ? a + l.workMs / 60000 : a), 0)
  if (state.timer) {
    const d = dateOfTs(state.timer.startTs)
    if (d >= from && d <= to) m += T.workElapsed(state.timer, state.now) / 60000
  }
  return m
}
export const weekRange = (date = todayStr()) => { const d = weekDates(date, state.settings.weekStart); return [d[0], d[6]] }

/* ---------- Restauration / réinitialisation ---------- */
export async function reloadAll() {
  state.ready = false
  await init()
}
export async function wipeEverything() {
  await db.clearAll()
  state.settings = clone(DEFAULT_SETTINGS)
  await reloadAll()
}
export async function markBackupDone() {
  state.settings.lastBackup = new Date().toISOString()
  await saveSettingsNow()
}
export { addDays }
