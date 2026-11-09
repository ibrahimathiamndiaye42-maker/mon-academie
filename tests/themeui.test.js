import { describe, it, expect, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as S from '../src/store'
import * as db from '../src/db'
import { PRESETS, skinFromPreset } from '../src/utils/theme'
import ThemeEditor from '../src/components/ThemeEditor.vue'

const { state } = S
const css = (k) => document.documentElement.style.getPropertyValue(k)
beforeAll(async () => { await S.init() })

describe('Personnalisation (jsdom)', () => {
  it('thème par défaut : Violet Premium sombre', () => {
    expect(state.settings.skin.preset).toBe('violet'); expect(state.settings.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark'); expect(css('--accent')).toBe('#8b5cf6')
  })
  it('les 8 thèmes changent instantanément les variables, en clair et en sombre', () => {
    for (const id of Object.keys(PRESETS)) for (const mode of ['dark', 'light']) {
      state.settings.theme = mode; state.settings.skin = skinFromPreset(id); S.applyAppearance()
      expect(css('--accent'), `${id}/${mode}`).toBe(PRESETS[id].primary)
      expect(document.documentElement.dataset.theme).toBe(mode)
    }
  })
  it('aperçu → Appliquer → persistance après rechargement ; Annuler restaure', async () => {
    state.settings.theme = 'dark'; state.settings.skin = skinFromPreset('violet'); S.applyAppearance()
    const w = mount(ThemeEditor, { attachTo: document.body })
    await w.findAll('.theme-card')[1].trigger('click') // Ocean Blue
    await flushPromises()
    expect(css('--accent')).toBe('#0ea5e9')            // aperçu immédiat
    expect(state.settings.skin.preset).toBe('violet')  // pas encore enregistré
    await w.findAll('button').find((b) => b.text() === 'Annuler').trigger('click'); await flushPromises()
    expect(css('--accent')).toBe('#8b5cf6')
    await w.findAll('.theme-card')[1].trigger('click'); await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Appliquer').trigger('click'); await flushPromises()
    expect(state.settings.skin.preset).toBe('ocean')
    await S.init()                                      // simule la réouverture de l'application
    expect(state.settings.skin.preset).toBe('ocean'); expect(css('--accent')).toBe('#0ea5e9')
    w.unmount()
  })
  it('couleur HEX libre : valide, passe en « Personnalisé », invalide ignorée', async () => {
    const w = mount(ThemeEditor, { attachTo: document.body })
    const hex = w.find('input[aria-label="Couleur principale (HEX)"]')
    await hex.setValue('#ff00aa'); await flushPromises()
    expect(css('--accent')).toBe('#ff00aa')
    await hex.setValue('#zz'); await flushPromises()
    expect(css('--accent')).toBe('#ff00aa'); expect(w.text()).toContain('HEX invalide')
    w.unmount(); await flushPromises()
    expect(css('--accent')).toBe('#0ea5e9')            // quitter sans appliquer = aperçu annulé
  })
  it('réinitialiser puis appliquer revient à Violet Premium', async () => {
    const w = mount(ThemeEditor, { attachTo: document.body })
    await w.findAll('button').find((b) => b.text().startsWith('Réinitialiser')).trigger('click'); await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Appliquer').trigger('click'); await flushPromises()
    expect(state.settings.skin.preset).toBe('violet'); w.unmount()
  })
  it('migration : anciens réglages sans « skin » → Violet Premium sombre, données conservées', async () => {
    await db.put('kv', { key: 'settings', value: { name: 'Awa', theme: 'auto', accent: 'navy', dailyGoalMin: 120 } })
    await S.init()
    expect(state.settings.skin.preset).toBe('violet'); expect(state.settings.theme).toBe('dark')
    expect(state.settings.name).toBe('Awa'); expect(state.settings.dailyGoalMin).toBe(120)
  })
})
