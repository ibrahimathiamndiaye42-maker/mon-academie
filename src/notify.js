// Rappels : fonctionnent pendant que l'application est ouverte (onglet ou application installée).
// Un navigateur ne permet pas d'envoyer des rappels application fermée sans serveur : c'est une limite connue.
import { state, toast } from './store'
import { todayStr, timeToMin, diffDays, fmtDate } from './utils/time'
import { isGraded } from './utils/grades'
import { workMinutes } from './store'

const KEY = 'mon-academie-notified'
function seen(key) {
  try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return m[key] } catch { return false }
}
function mark(key) {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || '{}')
    m[key] = Date.now()
    const keep = Object.entries(m).filter(([, t]) => Date.now() - t < 14 * 86400000)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep)))
  } catch { /* stockage indisponible : on ignore */ }
}
export const notificationPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
export async function askPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.requestPermission()
}
function fire(key, title, body) {
  if (seen(key)) return
  mark(key)
  toast(`${title} — ${body}`, 'info', 8000)
  if (notificationPermission() === 'granted') {
    try {
      if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: './icons/icon-192.png', tag: key }))
      else new Notification(title, { body, icon: './icons/icon-192.png', tag: key })
    } catch { /* ignoré */ }
  }
}
export function checkReminders(now = new Date()) {
  if (!state.ready) return
  const n = state.settings.notif
  const today = todayStr()
  const curMin = now.getHours() * 60 + now.getMinutes()
  if (n.sessions) {
    for (const s of state.sessions) {
      if (s.kind !== 'study' || s.date !== today || (s.status !== 'planned' && s.status !== 'postponed')) continue
      const d = timeToMin(s.start) - curMin
      if (d >= 0 && d <= n.remindBeforeMin) {
        const sub = state.subjects.find((x) => x.id === s.subjectId)
        fire(`s-${s.id}-${today}`, 'Séance de révision', `${sub?.name || 'Révision'} à ${s.start}`)
      }
    }
  }
  if (n.evaluations) {
    for (const e of state.evaluations) {
      if (isGraded(e)) continue
      const d = diffDays(today, e.date)
      if (d === 1 || d === 3) {
        const sub = state.subjects.find((x) => x.id === e.subjectId)
        fire(`e-${e.id}-${d}`, 'Évaluation à venir', `${sub?.name || ''} : ${e.title} (${fmtDate(e.date)})`)
      }
    }
  }
  if (n.postponed) {
    const missed = state.sessions.filter((s) => s.kind === 'study' && (s.status === 'postponed') && s.date <= today).length
    if (missed && curMin >= 9 * 60) fire(`p-${today}`, 'Séances reportées', `${missed} séance${missed > 1 ? 's' : ''} reportée${missed > 1 ? 's' : ''} à rattraper`)
  }
  if (n.daily && curMin >= n.dailyHour * 60) {
    const done = workMinutes(today, today)
    if (done < state.settings.dailyGoalMin) fire(`d-${today}`, 'Objectif du jour', `${Math.round(done)} min sur ${state.settings.dailyGoalMin} min visées`)
  }
}
let iv = null
export function startReminders() {
  if (iv) return
  checkReminders()
  iv = setInterval(checkReminders, 30000)
}
