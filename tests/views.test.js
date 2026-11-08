import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as S from '../src/store'

import { beforeAll } from 'vitest'
beforeAll(async () => { await S.init() })

describe('Affichage des écrans (aucune erreur Vue)', () => {
  const routes = ['/', '/emploi-du-temps', '/planning', '/chrono', '/cours', '/matieres', '/notes', '/priorites', '/statistiques', '/parametres']
  for (const mode of ['avec données', 'vide']) {
    it(`monte toutes les pages (${mode})`, async () => {
      if (mode === 'vide') await S.wipeEverything()
      else { await S.save('subjects', { name: 'Réseaux', color: '#0f766e', icon: 'network' }) }
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      const router = (await import('../src/router')).default
      const App = (await import('../src/App.vue')).default
      const w = mount(App, { global: { plugins: [router] }, attachTo: document.body })
      for (const r of routes) {
        await router.push(r); await flushPromises(); await new Promise((x) => setTimeout(x, 30)); await flushPromises()
        expect(w.html().length, r).toBeGreaterThan(200)
      }
      expect(err.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([])
      expect(warn.mock.calls.filter((c) => String(c[0]).includes('Vue warn')).map((c) => String(c[0]).slice(0, 200))).toEqual([])
      w.unmount(); warn.mockRestore(); err.mockRestore()
    })
  }
})
