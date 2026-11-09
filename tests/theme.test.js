import { describe, it, expect } from 'vitest'
import { PRESETS, skinFromPreset, buildTheme } from '../src/utils/theme'
import { contrast, normHex } from '../src/utils/color'

describe('Thèmes : lisibilité (8 thèmes × clair/sombre)', () => {
  for (const id of [...Object.keys(PRESETS), 'custom']) {
    for (const dark of [true, false]) {
      it(`${id} (${dark ? 'sombre' : 'clair'})`, () => {
        const t = buildTheme(skinFromPreset(id === 'custom' ? 'violet' : id), dark)
        const v = t.vars
        expect(contrast(v['--ink'], v['--surface'])).toBeGreaterThan(7)
        expect(contrast(v['--ink-2'], v['--surface'])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--ink-3'], v['--surface'])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--accent-text'], v['--surface'])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--active-text'], v['--surface'])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--btn-ink'], t.primary)).toBeGreaterThanOrEqual(4.5)
        for (const k of ['--danger', '--ok', '--warn', '--info']) expect(contrast(v[k], v['--surface'])).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
  it('un fond personnalisé clair en « mode sombre » reste lisible', () => {
    const t = buildTheme({ ...skinFromPreset('violet'), bg: '#ffffff' }, true)
    expect(t.dark).toBe(false); expect(contrast(t.vars['--ink'], t.vars['--surface'])).toBeGreaterThan(7)
  })
  it('valide les couleurs HEX saisies', () => { expect(normHex('#ABC')).toBe('#aabbcc'); expect(normHex('zzz')).toBeNull(); expect(normHex('7c3aed')).toBe('#7c3aed') })
  it('réglages extrêmes sans erreur', () => {
    const t = buildTheme({ ...skinFromPreset('gold'), gradient: 0, glow: 0, shadow: 0, radius: 6 }, true)
    expect(t.vars['--glow']).toBe('none'); expect(t.vars['--shadow']).toBe('none')
  })
})
