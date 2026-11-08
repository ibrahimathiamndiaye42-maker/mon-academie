const p2 = (n) => String(n).padStart(2, '0')
export const uid = () =>
  (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10))

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function toDateStr(d) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` }
export const todayStr = () => toDateStr(new Date())
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d) }
export function diffDays(a, b) { // nombre de jours de a vers b
  const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}
export function isoDow(s) { const g = parseDate(s).getDay(); return g === 0 ? 7 : g } // 1 = lundi … 7 = dimanche
export function startOfWeek(s, weekStart = 1) { return addDays(s, -((isoDow(s) - weekStart + 7) % 7)) }
export function weekDates(s, weekStart = 1) { const st = startOfWeek(s, weekStart); return Array.from({ length: 7 }, (_, i) => addDays(st, i)) }
export const dateOfTs = (ts) => toDateStr(new Date(ts))

export function timeToMin(t) { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0) }
export function minToTime(m) { m = Math.max(0, Math.min(1439, Math.round(m))); return `${p2(Math.floor(m / 60))}:${p2(m % 60)}` }
export const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE

export function fmtMin(min) {
  min = Math.round(min || 0)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${p2(m)}` : `${h} h`
}
export function fmtHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`
}
export function fmtDate(s, opts) {
  return parseDate(s).toLocaleDateString('fr-FR', opts || { weekday: 'long', day: 'numeric', month: 'long' })
}
export const fmtDateShort = (s) => fmtDate(s, { day: 'numeric', month: 'short' })
export function fmtTs(ts) { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
export function relDays(s, today = todayStr()) {
  const n = diffDays(today, s)
  if (n === 0) return "aujourd'hui"
  if (n === 1) return 'demain'
  if (n === -1) return 'hier'
  return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`
}
// Grille de mois : 6 semaines de 7 dates.
export function monthGrid(year, month, weekStart = 1) {
  const first = toDateStr(new Date(year, month, 1))
  const st = startOfWeek(first, weekStart)
  return Array.from({ length: 42 }, (_, i) => addDays(st, i))
}
