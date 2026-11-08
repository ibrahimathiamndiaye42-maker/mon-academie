<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { state, saveSettingsNow } from './store'
import { startReminders } from './notify'
import { workElapsed } from './utils/timer'
import { fmtHMS } from './utils/time'
import Icon from './components/Icon.vue'
import Modal from './components/Modal.vue'

const route = useRoute()
const NAV = [
  { to: '/', label: 'Tableau de bord', short: 'Accueil', icon: 'dashboard' },
  { to: '/emploi-du-temps', label: 'Emploi du temps', icon: 'timetable' },
  { to: '/planning', label: 'Planning de révision', short: 'Planning', icon: 'planning' },
  { to: '/chrono', label: 'Chronomètre', short: 'Chrono', icon: 'timer' },
  { to: '/cours', label: 'Mes cours', short: 'Cours', icon: 'book' },
  { to: '/matieres', label: 'Matières et chapitres', icon: 'layers' },
  { to: '/notes', label: 'Notes et évaluations', icon: 'grades' },
  { to: '/priorites', label: 'Priorités', icon: 'flag' },
  { to: '/statistiques', label: 'Statistiques', icon: 'chart' },
  { to: '/parametres', label: 'Paramètres', icon: 'settings' }
]
const bottom = NAV.filter((n) => n.short)
const more = NAV.filter((n) => !n.short)
const moreOpen = ref(false)
const bare = computed(() => !!route.meta.bare)
watch(() => route.fullPath, () => { moreOpen.value = false })

// Horloge de l'application : 1 s pendant une séance chronométrée, sinon 30 s.
let tick = 0, iv
onMounted(() => {
  iv = setInterval(() => { tick++; if (state.timer || tick % 30 === 0) state.now = Date.now() }, 1000)
  document.addEventListener('visibilitychange', () => { state.now = Date.now() })
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installEvent = e })
  window.addEventListener('appinstalled', () => { state.installEvent = null })
  window.addEventListener('pagehide', saveSettingsNow)
  startReminders()
})
onUnmounted(() => clearInterval(iv))
watch(() => [state.timer, state.now], () => {
  const t = state.timer
  document.title = t ? `${t.status === 'paused' ? '⏸' : '⏱'} ${fmtHMS(workElapsed(t, state.now))} — MON ACADÉMIE` : 'MON ACADÉMIE'
})
async function install() {
  const e = state.installEvent
  if (!e) return
  e.prompt(); await e.userChoice; state.installEvent = null
}

/* Confirmation globale */
const typed = ref('')
const dlg = computed(() => state.confirmDlg)
watch(dlg, () => { typed.value = '' })
const canConfirm = computed(() => !dlg.value?.requireText || typed.value.trim() === dlg.value.requireText)
function answer(v) { const d = state.confirmDlg; state.confirmDlg = null; d?.resolve(v) }
</script>

<template>
  <div v-if="state.loadError" class="page"><div class="card"><h2>Stockage indisponible</h2><p class="muted" style="margin-top:8px">{{ state.loadError }}</p><p class="small muted" style="margin-top:10px">Vérifie que la navigation privée est désactivée et que le navigateur autorise le stockage local, puis recharge la page.</p></div></div>
  <div v-else-if="!state.ready" class="page"><p class="muted">Chargement de ton espace…</p></div>
  <template v-else>
    <router-view v-if="bare" :key="route.params.id" />
    <div v-else class="shell">
      <aside class="sidebar" aria-label="Navigation principale">
        <div class="brand"><div class="brand-mark"><Icon name="book" :size="22" /></div><div><div class="brand-name">MON ACADÉMIE</div><div class="brand-sub">Ton année, organisée</div></div></div>
        <router-link v-for="n in NAV" :key="n.to" :to="n.to" class="nav-link" :exact-active-class="n.to === '/' ? 'router-link-active' : ''" :active-class="n.to === '/' ? '' : 'router-link-active'">
          <Icon :name="n.icon" /><span>{{ n.label }}</span><i v-if="n.to === '/chrono' && state.timer" class="nav-dot" />
        </router-link>
        <div class="sidebar-foot"><button v-if="state.installEvent" class="btn sm" style="width:100%" @click="install"><Icon name="download" :size="16" /> Installer l'application</button></div>
      </aside>
      <main>
        <router-view v-slot="{ Component }"><transition name="page" mode="out-in"><component :is="Component" /></transition></router-view>
      </main>
    </div>
    <nav v-if="!bare" class="bottom-nav" aria-label="Navigation mobile">
      <router-link v-for="n in bottom" :key="n.to" :to="n.to" class="bn-item" :exact-active-class="n.to === '/' ? 'router-link-active' : ''" :active-class="n.to === '/' ? '' : 'router-link-active'">
        <Icon :name="n.icon" :size="22" /><span>{{ n.short }}</span><i v-if="n.to === '/chrono' && state.timer" class="nav-dot" />
      </router-link>
      <button class="bn-item" :class="{ on: moreOpen }" @click="moreOpen = true"><Icon name="menu" :size="22" /><span>Plus</span></button>
    </nav>
    <Modal v-if="moreOpen" title="Toutes les rubriques" @close="moreOpen = false">
      <router-link v-for="n in more" :key="n.to" :to="n.to" class="nav-link"><Icon :name="n.icon" /><span>{{ n.label }}</span></router-link>
      <button v-if="state.installEvent" class="btn" @click="install"><Icon name="download" :size="16" /> Installer l'application</button>
    </Modal>
  </template>

  <Modal v-if="dlg" :title="dlg.title" @close="answer(false)">
    <p style="white-space:pre-line">{{ dlg.message }}</p>
    <div v-if="dlg.requireText" class="field"><label>Pour confirmer, écris « {{ dlg.requireText }} »</label><input v-model="typed" class="input" autocomplete="off" /></div>
    <template #footer><button class="btn" @click="answer(false)">Annuler</button><button class="btn" :class="dlg.danger ? 'danger solid' : 'primary'" :disabled="!canConfirm" @click="answer(true)">{{ dlg.confirmLabel }}</button></template>
  </Modal>
  <div class="toasts" aria-live="polite"><div v-for="t in state.toasts" :key="t.id" class="toast" :class="t.tone">{{ t.message }}</div></div>
</template>
