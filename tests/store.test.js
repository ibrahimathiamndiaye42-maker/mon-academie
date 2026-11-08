// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as S from '../src/store'
import * as db from '../src/db'
import { buildBackup, parseBackup, applyBackup } from '../src/utils/backup'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { todayStr, addDays } from '../src/utils/time'

const { state } = S
let subj, chap, sess

beforeAll(async () => { await S.init() })

describe('Scénarios de bout en bout (store)', () => {
  it('crée matière, chapitre, cours et détecte le conflit (tests 1, 2)', async () => {
    subj = await S.save('subjects', { name: 'Bases de données', color: '#2563eb', icon: 'database', coef: 3, goal: 80 })
    chap = await S.save('chapters', { subjectId: subj.id, title: 'SQL', status: 'non_commence', mastery: 0 })
    await S.save('timetable', { kind: 'course', day: 1, subjectId: subj.id, start: '08:00', end: '10:00' })
    expect(S.courseConflictList({ day: 1, start: '09:00', end: '11:00' })).toHaveLength(1)
    const lundi = addDays(todayStr(), (8 - new Date().getDay()) % 7 || 7) // un prochain lundi
    expect(S.validateSession({ kind: 'study', subjectId: subj.id, date: lundi, start: '09:00', end: '10:00' }).join()).toMatch(/Conflit avec un cours/)
    sess = await S.save('sessions', { kind: 'study', subjectId: subj.id, chapterId: chap.id, date: lundi, start: '18:00', end: '19:00', status: 'planned', type: 'Exercices', priority: 2 })
    const r = await S.postponeSession(sess.id, addDays(lundi, 1), '18:00', '19:00')
    expect(r.session.status).toBe('postponed'); expect(r.session.postponedCount).toBe(1)
    sess = r.session
  })
  it('chronomètre : travail réel, séance terminée, chapitre jamais « maîtrisé » (tests 3, 8)', async () => {
    await S.timerStart({ sessionId: sess.id, plannedMin: 60 })
    expect(state.sessions.find((s) => s.id === sess.id).status).toBe('running')
    await S.timerPause(); await S.timerResume()
    const log = await S.timerFinish('ok')
    expect(log.early).toBe(true)
    expect(state.timer).toBeNull()
    expect(state.sessions.find((s) => s.id === sess.id).status).toBe('done')
    const c = S.chapterById(chap.id)
    expect(c.status).toBe('en_cours'); expect(c.lastReview).toBe(todayStr())
  })
  it("reprise après fermeture de l'application (test 4)", async () => {
    await S.timerStart({ subjectId: subj.id, plannedMin: 30 })
    const startTs = state.timer.startTs
    state.timer = null // simule la fermeture : l'état mémoire disparaît
    await S.init()
    expect(state.timer?.startTs).toBe(startTs)
    await S.timerAbort()
    expect(state.timer).toBeNull()
    await S.init(); expect(state.timer).toBeNull()
  })
  it('sauvegarde, suppression, restauration avec PDF (test 10)', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
    const file = { name: 'cours.pdf', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(0) }
    const doc = await S.importPdf(file, { title: 'Cours SQL', subjectId: subj.id, chapterId: chap.id })
    await S.save('annotations', { docId: doc.id, page: 2, type: 'highlight', color: 'yellow', rects: [{ x: .1, y: .1, w: .5, h: .02 }], text: 'SELECT', comment: '' })
    await S.save('evaluations', { subjectId: subj.id, title: 'Examen', date: todayStr(), score: 12, max: 20, coef: 2 })
    state.settings.accent = 'emerald'; await S.saveSettingsNow()
    const { bytes: zip, manifest } = await buildBackup()
    expect(manifest.counts.files).toBe(1)
    await S.wipeEverything()
    expect(state.subjects).toHaveLength(0)
    const parsed = await parseBackup(zip)
    expect(parsed.warnings).toHaveLength(0)
    await applyBackup(parsed, 'replace'); await S.reloadAll()
    expect(state.subjects).toHaveLength(1); expect(state.annotations).toHaveLength(1); expect(state.evaluations).toHaveLength(1)
    expect(state.settings.accent).toBe('emerald')
    const data = await S.loadPdfData(doc.id)
    expect(new TextDecoder().decode(new Uint8Array(data)).startsWith('%PDF')).toBe(true)
    // fusion : rien n'est écrasé
    const r = await applyBackup(await parseBackup(zip), 'merge')
    expect(Object.values(r.added).reduce((a, b) => a + b, 0)).toBe(0)
    expect(state.subjects).toHaveLength(1)
  })
  it('refuse une sauvegarde corrompue ou invalide', async () => {
    const { bytes } = await buildBackup()
    const files = unzipSync(bytes)
    const data = JSON.parse(strFromU8(files['data.json'])); data.subjects[0].name = 'Altéré'
    files['data.json'] = strToU8(JSON.stringify(data))
    await expect(parseBackup(zipSync(files))).rejects.toThrow(/intégrité/)
    await expect(parseBackup(new Uint8Array([1, 2, 3]))).rejects.toThrow(/valide/)
    const m = JSON.parse(strFromU8(files['manifest.json'])); m.formatVersion = 99; files['manifest.json'] = strToU8(JSON.stringify(m))
    await expect(parseBackup(zipSync(files))).rejects.toThrow(/plus récente/)
  })
  it("refuse un fichier qui n'est pas un PDF", async () => {
    const b = new TextEncoder().encode('hello')
    await expect(S.importPdf({ name: 'x.pdf', size: 5, arrayBuffer: async () => b.buffer }, { title: 'x' })).rejects.toThrow(/PDF/)
  })
})

