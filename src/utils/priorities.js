import { diffDays, todayStr, relDays, addDays } from './time'
import { statusInfo } from '../constants'
import { subjectAverage, isGraded, fmtGrade } from './grades'

// Progression d'une matière = moyenne des poids de statut de ses chapitres (un chapitre n'est « maîtrisé » que si l'utilisateur le décide).
export function subjectProgress(chapters) {
  if (!chapters.length) return 0
  return Math.round((100 * chapters.reduce((a, c) => a + statusInfo(c.status).weight, 0)) / chapters.length)
}
export const chapterIsMastered = (c) => c.status === 'maitrise'

const BASE = { difficile: 30, a_revoir: 25, en_cours: 10, non_commence: 8, etudie: 5, maitrise: 0 }

export function chapterPriority(ch, today = todayStr()) {
  let score = BASE[ch.status] ?? 0
  const reasons = []
  if (ch.status === 'difficile') reasons.push('Chapitre marqué comme difficile.')
  if (ch.status === 'a_revoir') reasons.push('Chapitre à revoir.')
  if (ch.status === 'non_commence') reasons.push('Chapitre pas encore commencé.')
  if (ch.status !== 'maitrise') score += (100 - (Number(ch.mastery) || 0)) * 0.1
  if (ch.nextReview && ch.nextReview <= today) { score += 20; reasons.push(`Révision prévue ${relDays(ch.nextReview, today)}.`) }
  if (ch.status !== 'maitrise' && ch.status !== 'non_commence' && ch.lastReview) {
    const d = diffDays(ch.lastReview, today)
    if (d >= 14) { score += 10; reasons.push(`Ce chapitre n'a pas été révisé depuis ${d} jours.`) }
  }
  return { chapter: ch, score: Math.round(score), reasons }
}

export function computePriorities({ subjects, chapters, evaluations, sessions, logs, boosts = {}, today = todayStr() }) {
  const weekAgo = addDays(today, -7)
  const min7 = {}
  let total7 = 0
  const lastWork = {}
  for (const l of logs) {
    if (l.date >= weekAgo) { min7[l.subjectId] = (min7[l.subjectId] || 0) + l.workMs / 60000; total7 += l.workMs / 60000 }
    if (!lastWork[l.subjectId] || l.date > lastWork[l.subjectId]) lastWork[l.subjectId] = l.date
  }
  const n = subjects.length
  const res = subjects.map((s) => {
    const chs = chapters.filter((c) => c.subjectId === s.id)
    const evs = evaluations.filter((e) => e.subjectId === s.id)
    const unmasteredFrac = chs.length ? chs.filter((c) => c.status !== 'maitrise').length / chs.length : 0.5
    let score = 0
    const reasons = []

    const upcoming = evs.filter((e) => !isGraded(e) && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    if (upcoming) {
      const d = diffDays(today, upcoming.date)
      const urgency = d <= 3 ? 40 : d <= 7 ? 30 : d <= 14 ? 18 : d <= 30 ? 8 : 0
      if (urgency) {
        score += urgency * (0.5 + 0.5 * unmasteredFrac)
        reasons.push(`Ton évaluation « ${upcoming.title} » approche (${relDays(upcoming.date, today)}).`)
      }
    }
    const { avg } = subjectAverage(evs)
    if (avg !== null && avg < 10) {
      score += Math.min(30, (10 - avg) * 3)
      reasons.push(`Ta moyenne est de ${fmtGrade(avg)}/20 : cette matière nécessite davantage de travail.`)
    }
    const hard = chs.filter((c) => c.status === 'difficile' || c.status === 'a_revoir').length
    if (hard) { score += Math.min(25, hard * 6); reasons.push(`${hard} chapitre${hard > 1 ? 's' : ''} difficile${hard > 1 ? 's' : ''} ou à revoir.`) }
    const unm = chs.filter((c) => c.status !== 'maitrise').length
    if (chs.length && unm) { score += unmasteredFrac * 15; reasons.push(`${unm} chapitre${unm > 1 ? 's' : ''} sur ${chs.length} pas encore maîtrisé${unm > 1 ? 's' : ''}.`) }

    const last = lastWork[s.id]
    if (!last) { if (chs.length) { score += 8; reasons.push('Aucune séance de travail enregistrée pour cette matière.') } }
    else {
      const d = diffDays(last, today)
      if (d >= 7 && unmasteredFrac > 0) { score += Math.min(20, (d - 3) * 2); reasons.push(`Cette matière n'a pas été révisée depuis ${d} jours.`) }
    }
    const post = sessions.filter((x) => x.subjectId === s.id && x.kind === 'study' && (x.status === 'postponed' || (x.postponedCount > 0 && x.status !== 'done' && x.status !== 'cancelled')) && x.date >= addDays(today, -14)).length
    if (post) { score += Math.min(12, post * 4); reasons.push(`${post} séance${post > 1 ? 's' : ''} reportée${post > 1 ? 's' : ''} récemment.`) }

    if (n >= 2 && total7 > 0 && (min7[s.id] || 0) / total7 < 0.5 / n && unmasteredFrac > 0) {
      score += 8; reasons.push('Peu de temps consacré à cette matière cette semaine par rapport aux autres.')
    }
    const boost = boosts[s.id] || 0
    if (boost) { score += boost * 15; reasons.push(boost > 0 ? 'Tu as choisi de la remonter dans tes priorités.' : 'Tu as choisi de la descendre dans tes priorités.') }

    score = Math.max(0, Math.round(score))
    const level = score >= 55 ? 'high' : score >= 30 ? 'mid' : 'low'
    const chPrio = chs.map((c) => chapterPriority(c, today)).filter((x) => x.chapter.status !== 'maitrise').sort((a, b) => b.score - a.score)
    return { subject: s, score, level, reasons, chapters: chPrio, boost, average: avg, upcoming }
  })
  return res.sort((a, b) => b.score - a.score)
}

export function recommendations(priorities, sessions, today = todayStr(), weekDays = []) {
  const out = []
  for (const p of priorities.slice(0, 4)) if (p.reasons.length && p.score >= 30) out.push({ subject: p.subject, text: `${p.subject.name} : ${p.reasons[0]}` })
  const postponedWeek = sessions.filter((s) => s.kind === 'study' && s.postponedCount > 0 && weekDays.includes(s.date)).length
  if (postponedWeek >= 2) out.push({ subject: null, text: `Tu as reporté ${postponedWeek} séances cette semaine.` })
  const missed = sessions.filter((s) => s.kind === 'study' && (s.status === 'planned' || s.status === 'postponed') && s.date < today).length
  if (missed) out.push({ subject: null, text: `${missed} séance${missed > 1 ? 's' : ''} passée${missed > 1 ? 's' : ''} n'${missed > 1 ? 'ont' : 'a'} pas été réalisée${missed > 1 ? 's' : ''}.` })
  return out
}

// Niveau de préparation d'une évaluation : état réel des chapitres liés, sinon valeur saisie.
export function evalPreparation(e, chapters) {
  const chs = (e.chapterIds || []).map((id) => chapters.find((c) => c.id === id)).filter(Boolean)
  return chs.length ? Math.round((100 * chs.reduce((a, c) => a + statusInfo(c.status).weight, 0)) / chs.length) : Number(e.prepared) || 0
}
