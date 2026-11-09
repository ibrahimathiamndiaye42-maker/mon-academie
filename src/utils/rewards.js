import { addDays, todayStr } from './time'
import { generalAverage, isGraded } from './grades'

// Niveau et récompenses calculés uniquement à partir de l'activité réelle (jamais de données fictives).
export const LEVELS = [{ min: 0, name: 'Débutant' }, { min: 100, name: 'Apprenti' }, { min: 300, name: 'Studieux' }, { min: 700, name: 'Confirmé' }, { min: 1500, name: 'Expert' }, { min: 3000, name: 'Maître' }]

export const totalMin = (logs) => logs.reduce((a, l) => a + l.workMs / 60000, 0)
// Points : 10 par heure travaillée, 5 par séance terminée, 20 par chapitre maîtrisé, 5 par note enregistrée.
export function xpOf({ logs, sessions, chapters, evaluations }) {
  return Math.round(totalMin(logs) / 6 + sessions.filter((s) => s.kind === 'study' && s.status === 'done').length * 5 + chapters.filter((c) => c.status === 'maitrise').length * 20 + evaluations.filter(isGraded).length * 5)
}
export function levelInfo(xp) {
  let i = 0
  LEVELS.forEach((l, k) => { if (xp >= l.min) i = k })
  const next = LEVELS[i + 1]
  return { level: i + 1, name: LEVELS[i].name, xp, next: next?.min ?? null, nextName: next?.name ?? null, pct: next ? Math.round(((xp - LEVELS[i].min) / (next.min - LEVELS[i].min)) * 100) : 100 }
}
// Jours consécutifs avec du travail (la série reste vivante si tu as travaillé hier).
export function streakOf(logs, today = todayStr()) {
  const days = new Set(logs.filter((l) => l.workMs >= 60000).map((l) => l.date))
  let d = days.has(today) ? today : addDays(today, -1), n = 0
  while (days.has(d)) { n++; d = addDays(d, -1) }
  return n
}
export function bestStreak(logs) {
  const days = [...new Set(logs.filter((l) => l.workMs >= 60000).map((l) => l.date))].sort()
  let best = 0, cur = 0, prev = null
  for (const d of days) { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d }
  return best
}
export function badgesOf({ logs, chapters, evaluations, annotations, subjects, dailyGoalMin }) {
  const total = totalMin(logs), best = bestStreak(logs)
  const perDay = {}
  for (const l of logs) perDay[l.date] = (perDay[l.date] || 0) + l.workMs / 60000
  const mastered = chapters.filter((c) => c.status === 'maitrise').length
  const avg = generalAverage(subjects, evaluations)
  return [
    { id: 'first', label: 'Premier pas', desc: 'Terminer une première séance', icon: 'play', earned: logs.length >= 1 },
    { id: 'h1', label: '1 heure', desc: '1 h de travail cumulée', icon: 'clock', earned: total >= 60 },
    { id: 'h10', label: '10 heures', desc: '10 h de travail cumulées', icon: 'timer', earned: total >= 600 },
    { id: 'h50', label: '50 heures', desc: '50 h de travail cumulées', icon: 'flame', earned: total >= 3000 },
    { id: 's3', label: 'Série de 3', desc: '3 jours consécutifs', icon: 'flame', earned: best >= 3 },
    { id: 's7', label: 'Série de 7', desc: '7 jours consécutifs', icon: 'flame', earned: best >= 7 },
    { id: 'goal', label: 'Objectif atteint', desc: 'Atteindre l’objectif quotidien', icon: 'target', earned: Object.values(perDay).some((m) => m >= dailyGoalMin) },
    { id: 'm1', label: 'Chapitre maîtrisé', desc: 'Maîtriser un chapitre', icon: 'shield', earned: mastered >= 1 },
    { id: 'm5', label: 'Maître de 5', desc: '5 chapitres maîtrisés', icon: 'layers', earned: mastered >= 5 },
    { id: 'n1', label: 'Première note', desc: 'Enregistrer une note', icon: 'grades', earned: evaluations.some(isGraded) },
    { id: 'a14', label: 'Moyenne ≥ 14', desc: 'Moyenne générale d’au moins 14/20', icon: 'chart', earned: avg !== null && avg >= 14 },
    { id: 'ann', label: 'Annotateur', desc: '10 annotations dans tes cours', icon: 'highlight', earned: annotations.length >= 10 }
  ]
}
