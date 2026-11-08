// Chronomètre basé sur des horodatages persistants : aucun compteur ne dépend de la page ouverte.
// État : { status:'running'|'paused', subjectId, chapterId, sessionId, plannedMin, startTs,
//          workMs, lastStart, pauseMs, pauseStart, pauses:[{start,end}], notes }
// workMs = travail accumulé avant le dernier démarrage ; lastStart = début du segment de travail en cours.
export function startTimer({ subjectId = null, chapterId = null, sessionId = null, plannedMin = 0, notes = '' }, now = Date.now()) {
  return { status: 'running', subjectId, chapterId, sessionId, plannedMin, startTs: now, workMs: 0, lastStart: now, pauseMs: 0, pauseStart: null, pauses: [], notes }
}
export const workElapsed = (t, now = Date.now()) => t.workMs + (t.status === 'running' ? Math.max(0, now - t.lastStart) : 0)
export const pauseElapsed = (t, now = Date.now()) => t.pauseMs + (t.status === 'paused' ? Math.max(0, now - t.pauseStart) : 0)

export function pauseTimer(t, now = Date.now()) {
  if (t.status !== 'running') return t
  return { ...t, status: 'paused', workMs: t.workMs + Math.max(0, now - t.lastStart), pauseStart: now, pauses: [...t.pauses, { start: now, end: null }] }
}
export function resumeTimer(t, now = Date.now()) {
  if (t.status !== 'paused') return t
  const pauses = t.pauses.map((p, i) => (i === t.pauses.length - 1 ? { ...p, end: now } : p))
  return { ...t, status: 'running', pauseMs: t.pauseMs + Math.max(0, now - t.pauseStart), pauseStart: null, lastStart: now, pauses }
}
// Termine la séance et renvoie les durées finales. Le temps de pause n'entre jamais dans workMs.
export function finishTimer(t, now = Date.now()) {
  const workMs = workElapsed(t, now)
  const pauseMs = pauseElapsed(t, now)
  const pauses = t.pauses.map((p, i) => (p.end == null && i === t.pauses.length - 1 ? { ...p, end: now } : p))
  return {
    startTs: t.startTs, endTs: now, workMs, pauseMs, pauses,
    early: !!t.plannedMin && workMs < t.plannedMin * 60000
  }
}
