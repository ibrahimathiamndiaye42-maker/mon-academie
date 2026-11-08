import { timeToMin, minToTime, overlaps, isoDow } from './time'

export const sessionEnd = (s) => timeToMin(s.end)
export const sessionMinutes = (s) => Math.max(0, timeToMin(s.end) - timeToMin(s.start))
// Une séance « occupe » le créneau tant qu'elle n'est ni annulée ni déplacée ailleurs.
const occupies = (s) => s.status !== 'cancelled'

// Conflits d'un cours de l'emploi du temps avec les autres entrées du même jour.
export function courseConflicts(cand, timetable) {
  const a = timeToMin(cand.start), b = timeToMin(cand.end)
  return timetable.filter((c) => c.id !== cand.id && c.day === cand.day && overlaps(a, b, timeToMin(c.start), timeToMin(c.end)))
}

// Conflits d'une séance (étude ou pause) avec les cours universitaires et les autres séances du même jour.
export function sessionConflicts(cand, timetable, sessions) {
  const a = timeToMin(cand.start), b = timeToMin(cand.end)
  const dow = isoDow(cand.date)
  const courses = timetable.filter((c) => c.kind === 'course' && c.day === dow && overlaps(a, b, timeToMin(c.start), timeToMin(c.end)))
  const others = sessions.filter((s) => s.id !== cand.id && s.date === cand.date && occupies(s) && overlaps(a, b, timeToMin(s.start), timeToMin(s.end)))
  return { courses, sessions: others, any: courses.length + others.length > 0 }
}

// Créneaux libres d'une journée (hors cours, pauses d'emploi du temps et séances).
export function freeSlots(date, timetable, sessions, dayStart, dayEnd, minLen = 15) {
  const dow = isoDow(date)
  const busy = [
    ...timetable.filter((c) => c.day === dow && c.kind !== 'free').map((c) => [timeToMin(c.start), timeToMin(c.end)]),
    ...sessions.filter((s) => s.date === date && occupies(s)).map((s) => [timeToMin(s.start), timeToMin(s.end)])
  ].sort((x, y) => x[0] - y[0])
  const slots = []
  let cur = dayStart * 60
  const end = dayEnd * 60
  for (const [s, e] of busy) {
    if (s > cur) slots.push([cur, Math.min(s, end)])
    cur = Math.max(cur, e)
    if (cur >= end) break
  }
  if (cur < end) slots.push([cur, end])
  return slots.filter(([s, e]) => e - s >= minLen).map(([s, e]) => ({ start: minToTime(s), end: minToTime(e), minutes: e - s }))
}
