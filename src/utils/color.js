// Outils de couleur : mélange, contraste WCAG, texte lisible automatiquement.
export function normHex(s) {
  s = String(s || '').trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toLowerCase() : null
}
export const toRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
export const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
export const mix = (a, b, t) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)) }
export function luminance(h) {
  const [r, g, b] = toRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a, b) { const l1 = luminance(a), l2 = luminance(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
// Rapproche fg de blanc/noir jusqu'à atteindre le contraste demandé sur bg.
export function readableOn(fg, bg, min = 4.5) {
  if (contrast(fg, bg) >= min) return fg
  const target = luminance(bg) < 0.3 ? '#ffffff' : '#000000'
  for (let t = 0.05; t <= 1.0001; t += 0.05) { const c = mix(fg, target, t); if (contrast(c, bg) >= min) return c }
  return target
}
// Encre (blanc ou quasi noir) la plus lisible sur toutes les couleurs données.
export function inkOn(...bgs) {
  const w = Math.min(...bgs.map((b) => contrast('#ffffff', b))), d = Math.min(...bgs.map((b) => contrast('#0b0b14', b)))
  return w >= d ? '#ffffff' : '#0b0b14'
}
export const rgba = (h, a) => { const [r, g, b] = toRgb(h); return `rgba(${r},${g},${b},${a})` }
