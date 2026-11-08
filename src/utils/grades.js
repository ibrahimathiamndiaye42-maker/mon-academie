// Calculs de notes. Toute note est ramenée sur 20 avant d'être pondérée.
export function toOn20(score, max) {
  if (score === null || score === undefined || score === '' || !(max > 0)) return null
  return (Number(score) / Number(max)) * 20
}
export const isGraded = (e) => !!e && e.score !== null && e.score !== undefined && e.score !== '' && Number(e.max) > 0

// Moyenne pondérée d'une matière : Σ(note sur 20 × coef) ÷ Σ coef
export function subjectAverage(evals) {
  let sum = 0, coefs = 0, count = 0
  for (const e of evals) {
    if (!isGraded(e)) continue
    const c = e.coef > 0 ? Number(e.coef) : 1
    sum += toOn20(e.score, e.max) * c
    coefs += c
    count++
  }
  return { avg: coefs ? sum / coefs : null, coefs, count }
}

// Moyenne générale : moyennes de matières pondérées par le coefficient de matière (1 si absent).
export function generalAverage(subjects, evals) {
  let sum = 0, coefs = 0
  for (const s of subjects) {
    const { avg } = subjectAverage(evals.filter((e) => e.subjectId === s.id))
    if (avg === null) continue
    const c = s.coef > 0 ? Number(s.coef) : 1
    sum += avg * c
    coefs += c
  }
  return coefs ? sum / coefs : null
}

export const fmtGrade = (n, digits = 2) => (n === null || n === undefined ? '—' : n.toFixed(digits).replace('.', ','))
