<script setup>
import { ref, computed } from 'vue'
import { state, wipeEverything, reloadAll, markBackupDone, confirmDialog, toast } from '../store'
import { ACCENTS } from '../constants'
import { buildBackup, parseBackup, applyBackup, downloadBytes, backupFilename } from '../utils/backup'
import { notificationPermission, askPermission } from '../notify'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'

const s = state.settings
const fileInput = ref(null)
const parsed = ref(null)
const busy = ref(false)
const usage = ref(null)
const perm = ref(notificationPermission())
const mode = ref('merge')

async function refreshUsage() { try { const e = await navigator.storage?.estimate?.(); usage.value = e ? { used: e.usage, quota: e.quota } : null } catch { usage.value = null } }
refreshUsage()
const mb = (n) => (n / 1048576).toFixed(1).replace('.', ',') + ' Mo'
const lastBackup = computed(() => (s.lastBackup ? new Date(s.lastBackup).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : 'Jamais'))

async function exportData() {
  busy.value = true
  try { const { bytes } = await buildBackup(); downloadBytes(bytes, backupFilename()); await markBackupDone(); toast(`Sauvegarde créée (${mb(bytes.length)}). Garde-la hors de cet appareil (clé USB, e-mail, cloud).`, 'ok', 7000) }
  catch (e) { toast('Échec de la sauvegarde : ' + (e.message || e), 'danger', 7000) }
  finally { busy.value = false }
}
async function pickRestore(e) {
  const f = e.target.files[0]; e.target.value = ''
  if (!f) return
  busy.value = true
  try { parsed.value = await parseBackup(new Uint8Array(await f.arrayBuffer())); mode.value = 'merge' }
  catch (err) { toast(err.message, 'danger', 9000) }
  finally { busy.value = false }
}
async function doRestore() {
  const p = parsed.value
  if (mode.value === 'replace') {
    const ok = await confirmDialog({ title: 'Remplacer toutes tes données ?', danger: true, confirmLabel: 'Remplacer', message: 'Tout le contenu actuel de cette application sera remplacé par la sauvegarde. Une sauvegarde de sécurité de tes données actuelles va d’abord être téléchargée.' })
    if (!ok) return
    try { const cur = await buildBackup(); downloadBytes(cur.bytes, `mon-academie-avant-restauration-${Date.now()}.zip`) } catch { toast('Impossible de créer la sauvegarde de sécurité : restauration annulée.', 'danger'); return }
  }
  busy.value = true
  try {
    const r = await applyBackup(p, mode.value)
    await reloadAll(); parsed.value = null; refreshUsage()
    const sk = Object.values(r.skipped || {}).reduce((a, b) => a + b, 0)
    toast(mode.value === 'replace' ? 'Sauvegarde restaurée.' : `Sauvegarde fusionnée : ${sk} élément(s) déjà présents ont été conservés tels quels.`, 'ok', 7000)
  } catch (e) { toast('La restauration a échoué, tes données actuelles n’ont pas été modifiées : ' + (e.message || e), 'danger', 9000) }
  finally { busy.value = false }
}
async function wipe() {
  if (await confirmDialog({ title: 'Supprimer toutes les données ?', danger: true, confirmLabel: 'Tout supprimer', requireText: 'SUPPRIMER', message: 'Matières, planning, historique, notes, PDF et annotations seront effacés de cet appareil, définitivement. Exporte une sauvegarde avant si tu hésites.' })) { await wipeEverything(); toast('Toutes les données ont été supprimées.', 'ok') }
}
async function enableNotif() { perm.value = await askPermission(); if (perm.value === 'denied') toast('Notifications bloquées : autorise-les dans les réglages du navigateur.', 'warn') }
async function install() { const e = state.installEvent; if (e) { e.prompt(); await e.userChoice; state.installEvent = null } }
const labels = { added: 'ajoutés' }
const rows = [['subjects', 'Matières'], ['chapters', 'Chapitres'], ['timetable', 'Cours / pauses'], ['sessions', 'Séances planifiées'], ['logs', 'Séances chronométrées'], ['evaluations', 'Évaluations'], ['documents', 'Documents'], ['annotations', 'Annotations'], ['bookmarks', 'Signets'], ['files', 'Fichiers PDF']]
</script>
<template>
  <div class="page">
    <div class="page-head"><div><h1>Paramètres</h1><p>Tout est enregistré automatiquement sur cet appareil.</p></div></div>
    <div class="grid g2" style="align-items:start">
      <div class="card col" style="gap:16px"><h2>Apparence</h2>
        <div class="field"><label>Thème</label><div class="seg"><button :class="{ on: s.theme === 'light' }" @click="s.theme = 'light'"><Icon name="sun" :size="15" /> Clair</button><button :class="{ on: s.theme === 'dark' }" @click="s.theme = 'dark'"><Icon name="moon" :size="15" /> Sombre</button><button :class="{ on: s.theme === 'auto' }" @click="s.theme = 'auto'">Automatique</button></div></div>
        <div class="field"><label>Couleur d'accentuation</label><div class="row wrap"><button v-for="(a, k) in ACCENTS" :key="k" class="btn sm" :class="{ primary: s.accent === k }" @click="s.accent = k"><i class="dot" :style="{ background: a.light }" /> {{ a.label }}</button></div></div>
        <div class="field"><label>Taille du texte</label><div class="seg"><button :class="{ on: s.fontSize === 'sm' }" @click="s.fontSize = 'sm'">Petite</button><button :class="{ on: s.fontSize === 'md' }" @click="s.fontSize = 'md'">Normale</button><button :class="{ on: s.fontSize === 'lg' }" @click="s.fontSize = 'lg'">Grande</button></div></div>
        <div class="field"><label>Densité</label><div class="seg"><button :class="{ on: s.density === 'comfortable' }" @click="s.density = 'comfortable'">Confortable</button><button :class="{ on: s.density === 'compact' }" @click="s.density = 'compact'">Compacte</button></div></div>
        <div class="field"><label for="nm">Ton prénom (pour l'accueil)</label><input id="nm" v-model="s.name" class="input" maxlength="40" /></div>
      </div>
      <div class="card col" style="gap:14px"><h2>Organisation</h2>
        <div class="form-grid"><div class="field"><label for="d1">Objectif quotidien (min)</label><input id="d1" v-model.number="s.dailyGoalMin" type="number" min="15" step="15" class="input" /></div><div class="field"><label for="d2">Objectif hebdomadaire (min)</label><input id="d2" v-model.number="s.weeklyGoalMin" type="number" min="30" step="30" class="input" /></div>
          <div class="field"><label for="d3">Durée habituelle d'une séance (min)</label><input id="d3" v-model.number="s.sessionMin" type="number" min="5" step="5" class="input" /></div><div class="field"><label for="d4">Durée d'une pause (min)</label><input id="d4" v-model.number="s.breakMin" type="number" min="1" step="1" class="input" /></div>
          <div class="field"><label for="d5">La semaine commence le</label><select id="d5" v-model.number="s.weekStart" class="select"><option :value="1">Lundi</option><option :value="7">Dimanche</option><option :value="6">Samedi</option></select></div><div class="field"><label>Emploi du temps</label><label class="row small"><input v-model="s.showWeekend" type="checkbox" /> Afficher samedi et dimanche</label></div>
          <div class="field"><label for="d6">Calendrier : début (h)</label><input id="d6" v-model.number="s.dayStartHour" type="number" min="0" max="12" class="input" /></div><div class="field"><label for="d7">Calendrier : fin (h)</label><input id="d7" v-model.number="s.dayEndHour" type="number" min="13" max="24" class="input" /></div></div>
      </div>
      <div class="card col" style="gap:12px"><h2>Notifications</h2>
        <p class="small muted">Les rappels s'affichent tant que l'application est ouverte (navigateur ou application installée). Un navigateur ne peut pas t'alerter application fermée sans serveur.</p>
        <label class="row"><input v-model="s.notif.sessions" type="checkbox" /> Séances de révision <input v-model.number="s.notif.remindBeforeMin" type="number" min="1" max="120" class="input" style="width:70px;min-height:32px" aria-label="Minutes avant" /> min avant</label>
        <label class="row"><input v-model="s.notif.evaluations" type="checkbox" /> Évaluations à venir (3 jours et 1 jour avant)</label>
        <label class="row"><input v-model="s.notif.postponed" type="checkbox" /> Séances reportées à rattraper</label>
        <label class="row"><input v-model="s.notif.daily" type="checkbox" /> Objectif du jour, à partir de <input v-model.number="s.notif.dailyHour" type="number" min="8" max="23" class="input" style="width:70px;min-height:32px" aria-label="Heure" /> h</label>
        <div v-if="perm !== 'granted' && perm !== 'unsupported'"><button class="btn" @click="enableNotif"><Icon name="alert" :size="16" /> Autoriser les notifications du navigateur</button></div>
        <p v-else-if="perm === 'unsupported'" class="small muted">Ce navigateur ne gère pas les notifications système : seuls les messages dans l'application s'affichent.</p>
        <p v-else class="small" style="color:var(--ok)">Notifications du navigateur autorisées.</p>
      </div>
      <div class="card col" style="gap:12px"><h2>Application</h2>
        <button v-if="state.installEvent" class="btn primary" @click="install"><Icon name="download" :size="16" /> Installer MON ACADÉMIE</button>
        <p v-else class="small muted">Pour l'installer : menu du navigateur → « Installer l'application » (Android, Chrome ou Edge sur Windows). Elle fonctionne ensuite hors connexion.</p>
        <div v-if="usage" class="small">Espace utilisé : <b>{{ mb(usage.used) }}</b> sur {{ mb(usage.quota) }} disponibles.</div>
      </div>
    </div>

    <div class="card col" style="gap:14px;margin-top:16px"><h2>Mes données</h2>
      <p class="muted">Tes données vivent uniquement sur cet appareil. Si tu le perds ou vides le navigateur, elles disparaissent : exporte régulièrement une sauvegarde et range-la ailleurs.</p>
      <div class="small">Dernière sauvegarde : <b>{{ lastBackup }}</b></div>
      <div class="row wrap"><button class="btn primary" :disabled="busy" @click="exportData"><Icon name="download" :size="16" /> Exporter mes données</button><input ref="fileInput" type="file" accept=".zip,application/zip" class="hide" @change="pickRestore" /><button class="btn" :disabled="busy" @click="fileInput.click()"><Icon name="upload" :size="16" /> Restaurer une sauvegarde</button><button class="btn danger" style="margin-left:auto" @click="wipe"><Icon name="trash" :size="16" /> Supprimer toutes les données</button></div>
    </div>

    <Modal v-if="parsed" title="Restaurer cette sauvegarde" wide @close="parsed = null">
      <p class="small muted">Créée le {{ new Date(parsed.manifest.exportedAt).toLocaleString('fr-FR') }} · intégrité vérifiée.</p>
      <div class="grid g3"><div v-for="[k, l] in rows" :key="k" class="small"><b>{{ parsed.counts[k] ?? 0 }}</b> {{ l }}</div></div>
      <div v-if="parsed.warnings.length" class="err-list"><span v-for="w in parsed.warnings" :key="w">{{ w }}</span></div>
      <div class="field"><label class="row"><input v-model="mode" type="radio" value="merge" /> <span><b>Fusionner</b> — ajoute ce qui manque, ne modifie ni n'écrase rien de l'existant.</span></label><label class="row"><input v-model="mode" type="radio" value="replace" /> <span><b>Remplacer</b> — met ton application exactement dans l'état de la sauvegarde (une copie de sécurité de l'état actuel est téléchargée d'abord).</span></label></div>
      <template #footer><button class="btn" @click="parsed = null">Annuler</button><button class="btn primary" :disabled="busy" @click="doRestore">Restaurer</button></template>
    </Modal>
  </div>
</template>
