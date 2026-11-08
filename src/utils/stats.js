import { addDays, weekDates, todayStr, diffDays } from './time'
import { generalAverage, isGraded } from './grades'

const min = (l) => l.workMs / 60000

export function minutesInRange(logs, from, to) {
  let t = 0
  for (const l of logs) if (l.date >= from && l.date <= to) t += min(l)
  return t
}
export function minutesByDate(logs, dates) {
  const m = Object.fromEntries(dates.map((d) => [d, 0]))
  for (const l of logs) if (l.date in m) m[l.date] += min(l)
  return dates.map((d) => m[d])
}
export function minutesBySubject(logs, from, to) {
  const m = {}
  for (const l of logs) if (l.date >= from && l.date <= to) m[l.subjectId] = (m[l.subjectId] || 0) + min(l)
  return m
}
// Prévu vs réalisé : le « prévu » vient des séances d'étude non annulées de la date, le « réalisé » du temps réel chronométré.
export function plannedVsActual(sessions, logs, dates) {
  const planned = Object.fromEntries(dates.map((d) => [d, 0]))
  for (const s of sessions) {
    if (s.kind !== 'study' || s.status === 'cancelled' || !(s.date in planned)) continue
    const [h1, m1] = s.start.split(':').map(Number), [h2, m2] = s.end.split(':').map(Number)
    planned[s.date] += Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1))
  }
  return { planned: dates.map((d) => planned[d]), actual: minutesByDate(logs, dates) }
}
export function avgSessionMin(logs) { return logs.length ? logs.reduce((a, l) => a + min(l), 0) / logs.length : 0 }

// Évolution de la moyenne générale à chaque date où une note a été obtenue.
export function averageEvolution(subjects, evaluations) {
  const graded = evaluations.filter(isGraded).sort((a, b) => a.date.localeCompare(b.date))
  const dates = [...new Set(graded.map((e) => e.date))]
  return dates.map((d) => ({ date: d, avg: generalAverage(subjects, graded.filter((e) => e.date <= d)) }))
}

export function weeklyReport({ weekStart, weekStartDay = 1, subjects, chapters, sessions, logs, evaluations, today = todayStr() }) {
  const days = weekDates(weekStart, weekStartDay)
  const from = days[0], to = days[6]
  const wl = logs.filter((l) => l.date >= from && l.date <= to)
  const by = minutesBySubject(logs, from, to)
  const bySubject = subjects.map((s) => ({ subject: s, min: by[s.id] || 0 })).sort((a, b) => b.min - a.min)
  const ws = sessions.filter((s) => s.kind === 'study' && s.date >= from && s.date <= to)
  const studied = new Set(wl.filter((l) => l.chapterId).map((l) => l.chapterId))
  const prevEval = evaluations.filter((e) => e.date < from)
  const upToEval = evaluations.filter((e) => e.date <= to)
  const newGrades = evaluations.filter((e) => isGraded(e) && e.date >= from && e.date <= to)
  const before = generalAverage(subjects, prevEval), after = generalAverage(subjects, upToEval)
  return {
    from, to, totalMin: wl.reduce((a, l) => a + min(l), 0), logCount: wl.length,
    bySubject, most: bySubject.filter((x) => x.min > 0).slice(0, 3), least: [...bySubject].reverse().slice(0, 3),
    done: ws.filter((s) => s.status === 'done').length,
    missed: ws.filter((s) => (s.status === 'planned' || s.status === 'postponed') && s.date < today).length,
    postponed: ws.filter((s) => s.status === 'postponed' || s.postponedCount > 0).length,
    chapters: chapters.filter((c) => studied.has(c.id)),
    newGrades, avgBefore: before, avgAfter: after,
    complete: diffDays(to, today) > 0
  }
}
