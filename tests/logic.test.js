import { describe, it, expect } from 'vitest'
import { toOn20, subjectAverage, generalAverage } from '../src/utils/grades'
import * as T from '../src/utils/timer'
import { courseConflicts, sessionConflicts, freeSlots } from '../src/utils/schedule'
import { computePriorities, subjectProgress } from '../src/utils/priorities'
import { addDays, startOfWeek, isoDow, fmtMin, timeToMin } from '../src/utils/time'
import { minutesByDate, weeklyReport } from '../src/utils/stats'

describe('Notes (test 7)', () => {
  it('convertit sur 20 sans confondre les bases', () => {
    expect(toOn20(8, 10)).toBe(16)
    expect(toOn20(12, 20)).toBe(12)
    expect(toOn20(30, 60)).toBe(10)
    expect(toOn20(null, 20)).toBeNull()
  })
  it('moyenne pondérée par coefficient', () => {
    const ev = [{ score: 8, max: 10, coef: 1 }, { score: 12, max: 20, coef: 3 }, { score: null, max: 20, coef: 5 }]
    // (16*1 + 12*3) / 4 = 13
    expect(subjectAverage(ev).avg).toBeCloseTo(13)
  })
  it('moyenne générale pondérée par coefficient de matière', () => {
    const subjects = [{ id: 'a', coef: 2 }, { id: 'b', coef: 1 }, { id: 'c', coef: 5 }]
    const evals = [{ subjectId: 'a', score: 14, max: 20, coef: 1 }, { subjectId: 'b', score: 8, max: 20, coef: 1 }]
    expect(generalAverage(subjects, evals)).toBeCloseTo((14 * 2 + 8) / 3)
  })
})

describe('Chronomètre (tests 3 et 4)', () => {
  it('ne compte pas les pauses dans le temps de travail', () => {
    let t = T.startTimer({ plannedMin: 60 }, 0)
    t = T.pauseTimer(t, 10 * 60000)           // 10 min de travail
    expect(T.workElapsed(t, 40 * 60000)).toBe(10 * 60000) // 30 min de pause
    t = T.resumeTimer(t, 40 * 60000)
    const f = T.finishTimer(t, 55 * 60000)    // 15 min de plus
    expect(f.workMs).toBe(25 * 60000)
    expect(f.pauseMs).toBe(30 * 60000)
    expect(f.early).toBe(true)
  })
  it('terminer pendant une pause conserve le bon temps', () => {
    let t = T.startTimer({}, 0)
    t = T.pauseTimer(t, 5 * 60000)
    const f = T.finishTimer(t, 20 * 60000)
    expect(f.workMs).toBe(5 * 60000)
    expect(f.pauseMs).toBe(15 * 60000)
  })
  it("survit à une sérialisation (fermeture de l'app)", () => {
    let t = T.startTimer({}, 1000)
    t = JSON.parse(JSON.stringify(T.pauseTimer(t, 61000)))
    t = T.resumeTimer(t, 121000)
    expect(T.workElapsed(t, 181000)).toBe(120000)
  })
})

describe('Emploi du temps et planning (tests 1 et 2)', () => {
  const tt = [{ id: '1', day: 1, kind: 'course', start: '08:00', end: '10:00', subjectId: 'x' }]
  it('détecte les cours qui se chevauchent', () => {
    expect(courseConflicts({ id: 'n', day: 1, start: '09:00', end: '11:00' }, tt)).toHaveLength(1)
    expect(courseConflicts({ id: 'n', day: 1, start: '10:00', end: '11:00' }, tt)).toHaveLength(0)
    expect(courseConflicts({ id: 'n', day: 2, start: '09:00', end: '11:00' }, tt)).toHaveLength(0)
  })
  it('refuse une séance pendant un cours', () => {
    const lundi = '2026-11-09'
    expect(isoDow(lundi)).toBe(1)
    expect(sessionConflicts({ id: 's', date: lundi, start: '09:00', end: '10:00' }, tt, []).courses).toHaveLength(1)
    expect(sessionConflicts({ id: 's', date: lundi, start: '10:00', end: '11:00' }, tt, []).any).toBe(false)
  })
  it('calcule les créneaux libres', () => {
    const slots = freeSlots('2026-11-09', tt, [{ date: '2026-11-09', start: '12:00', end: '13:00', status: 'planned' }], 8, 14)
    expect(slots.map((s) => `${s.start}-${s.end}`)).toEqual(['10:00-12:00', '13:00-14:00'])
  })
})

describe('Priorités', () => {
  it("fait remonter la matière dont l'examen approche avec des chapitres non maîtrisés", () => {
    const today = '2026-11-08'
    const subjects = [{ id: 'bd', name: 'Bases de données' }, { id: 'ang', name: 'Anglais' }]
    const chapters = [
      { id: 'c1', subjectId: 'bd', status: 'non_commence' }, { id: 'c2', subjectId: 'bd', status: 'difficile' },
      { id: 'c3', subjectId: 'ang', status: 'maitrise' }
    ]
    const evaluations = [{ id: 'e', subjectId: 'bd', title: 'Examen', date: '2026-11-11', score: null, max: 20, coef: 2 }]
    const p = computePriorities({ subjects, chapters, evaluations, sessions: [], logs: [], today })
    expect(p[0].subject.id).toBe('bd')
    expect(p[0].level).toBe('high')
    expect(p[0].reasons.join(' ')).toMatch(/approche/)
  })
  it('progression : un chapitre ouvert n’est pas maîtrisé', () => {
    expect(subjectProgress([{ status: 'en_cours' }, { status: 'maitrise' }])).toBe(63)
    expect(subjectProgress([])).toBe(0)
  })
})

describe('Statistiques (test 8)', () => {
  it('additionne uniquement le temps réel par jour', () => {
    const logs = [{ date: '2026-11-08', workMs: 30 * 60000, subjectId: 'a' }, { date: '2026-11-08', workMs: 15 * 60000, subjectId: 'a' }, { date: '2026-11-07', workMs: 60000, subjectId: 'a' }]
    expect(minutesByDate(logs, ['2026-11-07', '2026-11-08'])).toEqual([1, 45])
  })
  it('bilan de semaine', () => {
    const r = weeklyReport({
      weekStart: '2026-11-02', subjects: [{ id: 'a', name: 'A' }], chapters: [{ id: 'c', subjectId: 'a' }],
      sessions: [{ kind: 'study', date: '2026-11-03', status: 'done', start: '08:00', end: '09:00' }, { kind: 'study', date: '2026-11-04', status: 'planned', start: '08:00', end: '09:00' }],
      logs: [{ date: '2026-11-03', workMs: 3600000, subjectId: 'a', chapterId: 'c' }], evaluations: [], today: '2026-11-08'
    })
    expect(r.totalMin).toBe(60); expect(r.done).toBe(1); expect(r.missed).toBe(1); expect(r.chapters).toHaveLength(1)
  })
})

describe('Dates', () => {
  it('semaine commençant le lundi', () => { expect(startOfWeek('2026-11-08', 1)).toBe('2026-11-02'); expect(addDays('2026-11-30', 1)).toBe('2026-12-01'); expect(fmtMin(95)).toBe('1 h 35'); expect(timeToMin('01:30')).toBe(90) })
})
