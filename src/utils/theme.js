import { normHex, mix, luminance, readableOn, inkOn, rgba } from './color'

// Thèmes prédéfinis. Chaque thème fournit un fond sombre et un fond clair ; le mode (clair/sombre/auto) choisit lequel.
export const PRESETS = {
  violet:   { label: 'Violet Premium', primary: '#8b5cf6', secondary: '#d946ef', accent: '#c4b5fd', bgDark: '#0f0a1f', bgLight: '#f4f0ff', gradient: 70, glow: 60, radius: 22, shadow: 45, cardStyle: 'glass' },
  ocean:    { label: 'Ocean Blue', primary: '#0ea5e9', secondary: '#14b8a6', accent: '#67e8f9', bgDark: '#06131f', bgLight: '#edf8fc', gradient: 65, glow: 45, radius: 20, shadow: 40, cardStyle: 'solid' },
  emerald:  { label: 'Emerald', primary: '#10b981', secondary: '#0d9488', accent: '#a7f3d0', bgDark: '#04150f', bgLight: '#edf9f3', gradient: 55, glow: 40, radius: 20, shadow: 40, cardStyle: 'solid' },
  midnight: { label: 'Midnight', primary: '#4f6df5', secondary: '#8b5cf6', accent: '#a78bfa', bgDark: '#090d24', bgLight: '#eef0fb', gradient: 70, glow: 55, radius: 22, shadow: 50, cardStyle: 'glass' },
  rose:     { label: 'Rose Luxury', primary: '#ec4899', secondary: '#be185d', accent: '#fbcfe8', bgDark: '#1a0a14', bgLight: '#fdf0f6', gradient: 60, glow: 50, radius: 24, shadow: 40, cardStyle: 'solid' },
  gold:     { label: 'Gold Prestige', primary: '#d9a521', secondary: '#a16207', accent: '#f5d77a', bgDark: '#0b0b0d', bgLight: '#faf6ea', gradient: 60, glow: 35, radius: 16, shadow: 55, cardStyle: 'outline', mode: 'dark' },
  arctic:   { label: 'Arctic', primary: '#2f80ed', secondary: '#56ccf2', accent: '#8a9bb0', bgDark: '#0e1620', bgLight: '#f3f7fb', gradient: 40, glow: 15, radius: 18, shadow: 25, cardStyle: 'solid', mode: 'light' }
}
export const PRESET_IDS = [...Object.keys(PRESETS), 'custom']
export const presetLabel = (id) => (id === 'custom' ? 'Personnalisé' : PRESETS[id]?.label || id)

export function skinFromPreset(id) {
  const p = PRESETS[id] || PRESETS.violet
  return { preset: PRESETS[id] ? id : 'violet', primary: p.primary, secondary: p.secondary, accent: p.accent, button: '', active: '', progress: '', bg: '', gradient: p.gradient, glow: p.glow, radius: p.radius, shadow: p.shadow, cardStyle: p.cardStyle }
}
export const DEFAULT_SKIN = skinFromPreset('violet')

// Construit toutes les variables CSS à partir de la « peau » choisie. Les textes sont corrigés automatiquement pour rester lisibles (contraste WCAG ≥ 4,5).
export function buildTheme(skin, wantDark = true) {
  const sk = { ...DEFAULT_SKIN, ...(skin || {}) }
  const base = PRESETS[sk.preset] || PRESETS.violet
  const primary = normHex(sk.primary) || DEFAULT_SKIN.primary
  const secondary = normHex(sk.secondary) || DEFAULT_SKIN.secondary
  const accent2 = normHex(sk.accent) || DEFAULT_SKIN.accent
  const bg = normHex(sk.bg) || (wantDark ? base.bgDark : base.bgLight)
  const dark = luminance(bg) < 0.3 // le texte s'adapte à la luminosité réelle du fond, même personnalisé
  const g = Math.max(0, Math.min(100, Number(sk.gradient))) / 100
  const gl = Math.max(0, Math.min(100, Number(sk.glow))) / 100
  const sh = Math.max(0, Math.min(100, Number(sk.shadow))) / 100
  const radius = Math.max(6, Math.min(36, Number(sk.radius) || 20))

  const surface = dark ? mix(bg, '#ffffff', 0.06) : mix(bg, '#ffffff', 0.78)
  const surface2 = dark ? mix(bg, '#ffffff', 0.115) : mix(bg, '#ffffff', 0.35)
  const line = dark ? mix(bg, '#ffffff', 0.17) : mix(bg, '#000000', 0.1)
  const ink = dark ? mix(bg, '#ffffff', 0.94) : mix(bg, '#000000', 0.9)
  const ink2 = readableOn(mix(ink, bg, 0.3), surface, 4.6)
  const ink3 = readableOn(mix(ink, bg, 0.5), surface, 4.5)

  const bcol = normHex(sk.button) || primary
  const bEnd = mix(bcol, secondary, g)
  const acol = normHex(sk.active) || primary
  const pcol = normHex(sk.progress) || primary
  const pEnd = mix(pcol, secondary, g)
  const gEnd = mix(primary, secondary, g)
  const soft = (c) => mix(surface, c, dark ? 0.2 : 0.1)

  const statusText = (c) => readableOn(c, surface, 4.5)
  const danger = statusText(dark ? '#ff7a70' : '#c2332b')
  const alpha = (dark ? 0.28 : 0.07) + sh * (dark ? 0.35 : 0.14)
  const cardBg = sk.cardStyle === 'glass' ? rgba(surface, dark ? 0.6 : 0.66) : sk.cardStyle === 'outline' ? 'transparent' : surface
  const cardBorder = sk.cardStyle === 'glass' ? (dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.8)') : sk.cardStyle === 'outline' ? mix(line, primary, 0.4) : line
  const a = gl * (dark ? 0.3 : 0.15)

  const vars = {
    '--bg': bg, '--surface': surface, '--surface-2': surface2, '--line': line, '--ink': ink, '--ink-2': ink2, '--ink-3': ink3,
    '--accent': primary, '--accent-ink': inkOn(primary), '--accent-text': readableOn(primary, surface, 4.5),
    '--accent-soft': soft(primary), '--accent-line': mix(line, primary, 0.45),
    '--secondary': secondary, '--accent2': accent2, '--accent2-text': readableOn(accent2, surface, 3),
    '--active': acol, '--active-soft': soft(acol), '--active-text': readableOn(acol, surface, 4.5), '--active-ink': inkOn(acol),
    '--grad': `linear-gradient(135deg, ${primary}, ${gEnd})`, '--grad-ink': inkOn(primary, gEnd),
    '--btn-grad': `linear-gradient(135deg, ${bcol}, ${bEnd})`, '--btn-ink': inkOn(bcol, bEnd),
    '--btn-glow': gl ? `0 6px ${Math.round(10 + gl * 22)}px ${rgba(bcol, 0.16 + gl * 0.3)}` : 'none',
    '--progress-grad': `linear-gradient(90deg, ${pcol}, ${pEnd})`,
    '--r-card': radius + 'px', '--r-ctl': Math.max(6, Math.round(radius * 0.5)) + 'px', '--r-modal': radius + 4 + 'px',
    '--shadow': sh ? `0 ${Math.round(2 + sh * 14)}px ${Math.round(6 + sh * 30)}px rgba(0,0,0,${alpha.toFixed(3)})` : 'none',
    '--shadow-lg': `0 ${Math.round(14 + sh * 14)}px ${Math.round(36 + sh * 30)}px rgba(0,0,0,${(alpha + 0.12).toFixed(3)})`,
    '--glow': gl ? `0 0 ${Math.round(10 + gl * 26)}px ${rgba(primary, 0.1 + gl * 0.22)}` : 'none',
    '--aurora': gl ? `radial-gradient(900px 520px at 8% -12%, ${rgba(primary, a)}, transparent 62%), radial-gradient(760px 460px at 100% 0%, ${rgba(secondary, a * 0.8)}, transparent 58%)` : 'linear-gradient(transparent, transparent)',
    '--card-bg': cardBg, '--card-border': cardBorder, '--card-blur': sk.cardStyle === 'glass' ? '16px' : '0px',
    '--chrome-bg': rgba(surface, 0.84),
    '--danger': danger, '--danger-ink': inkOn(danger), '--ok': statusText(dark ? '#3ddc97' : '#13804e'), '--warn': statusText(dark ? '#f5b04a' : '#a85f00'), '--info': statusText(dark ? '#6cb6ff' : '#1d63b0')
  }
  return { vars, dark, bg, surface, ink, ink2, ink3, primary, secondary }
}
