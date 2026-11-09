<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { state, toast, saveSettingsNow, applyAppearance } from '../store'
import { PRESETS, skinFromPreset, DEFAULT_SKIN, presetLabel, buildTheme } from '../utils/theme'
import { normHex } from '../utils/color'
import Icon from './Icon.vue'

const s = state.settings
const draft = ref({ ...s.skin })
const hexText = ref({})
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(s.skin) || mode.value !== s.theme)
const mode = ref(s.theme)
// Aperçu instantané sur toute l'application ; rien n'est enregistré tant que « Appliquer » n'est pas cliqué.
watch([draft, mode], () => { state.preview = { ...draft.value }; s.theme === mode.value ? applyAppearance() : previewMode() }, { deep: true, immediate: false })
function previewMode() { const keep = s.theme; s.theme = mode.value; applyAppearance(); s.theme = keep }
onBeforeUnmount(() => { state.preview = null; applyAppearance() })

function choose(id) {
  if (id === 'custom') { draft.value = { ...draft.value, preset: 'custom' }; return }
  draft.value = skinFromPreset(id)
  if (PRESETS[id].mode) mode.value = PRESETS[id].mode
}
function setColor(k, v) {
  const h = normHex(v)
  hexText.value[k] = v
  if (h) draft.value = { ...draft.value, [k]: h, preset: 'custom' }
}
const colorOf = (k, fallback) => draft.value[k] || fallback
function setNum(k, v) { draft.value = { ...draft.value, [k]: Number(v), preset: draft.value.preset } }
function clearColor(k) { draft.value = { ...draft.value, [k]: '' }; hexText.value[k] = '' }
async function apply() {
  s.skin = { ...draft.value }
  s.theme = mode.value
  state.preview = null
  applyAppearance()
  await saveSettingsNow()
  toast('Thème appliqué et enregistré.', 'ok')
}
function reset() { draft.value = { ...DEFAULT_SKIN }; mode.value = 'dark'; hexText.value = {}; toast('Valeurs d’origine (Violet Premium) chargées en aperçu : clique sur Appliquer pour les enregistrer.', 'info', 6000) }
function cancel() { draft.value = { ...s.skin }; mode.value = s.theme; hexText.value = {}; state.preview = null; applyAppearance() }

const MAIN = [['primary', 'Couleur principale'], ['secondary', 'Couleur secondaire'], ['accent', "Couleur d'accentuation"]]
const FINE = [['button', 'Boutons', 'primary'], ['active', 'Éléments actifs', 'primary'], ['progress', 'Indicateurs de progression', 'primary'], ['bg', "Arrière-plan (vide = celui du thème)", '']]
const QUICK = { Violet: '#8b5cf6', Bleu: '#2563eb', 'Bleu nuit': '#1e3a8a', Vert: '#16a34a', Turquoise: '#14b8a6', Rose: '#ec4899', Orange: '#f97316', Rouge: '#ef4444' }
function swatch(id) {
  if (id === 'custom') return { background: `linear-gradient(135deg, ${draft.value.primary}, ${draft.value.secondary})`, border: '2px dashed var(--line)' }
  const p = PRESETS[id]
  return { background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }
}
const preview = computed(() => buildTheme(draft.value, mode.value === 'dark' || (mode.value === 'auto' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches)))
</script>

<template>
  <div class="card col" style="gap:18px">
    <div class="row wrap between"><h2>Personnalisation des couleurs</h2><span class="small muted">Thème actuel : <b>{{ presetLabel(s.skin.preset) }}</b></span></div>
    <div v-if="dirty" class="card soft row wrap preview-bar" style="padding:12px 16px"><Icon name="sun" :size="18" /><span class="grow small"><b>Aperçu en direct</b> — rien n'est enregistré tant que tu n'as pas cliqué sur Appliquer.</span><button class="btn sm" @click="cancel">Annuler</button><button class="btn sm primary" @click="apply">Appliquer</button></div>

    <div class="field"><label>Mode d'affichage</label><div class="seg"><button :class="{ on: mode === 'dark' }" @click="mode = 'dark'"><Icon name="moon" :size="15" /> Sombre</button><button :class="{ on: mode === 'light' }" @click="mode = 'light'"><Icon name="sun" :size="15" /> Clair</button><button :class="{ on: mode === 'auto' }" @click="mode = 'auto'">Automatique</button></div></div>

    <div class="field"><label>Thèmes prédéfinis</label>
      <div class="grid g4" style="gap:10px"><button v-for="id in [...Object.keys(PRESETS), 'custom']" :key="id" class="theme-card" :class="{ on: draft.preset === id }" :aria-pressed="draft.preset === id" @click="choose(id)"><div class="sw" :style="swatch(id)" /><b class="small">{{ presetLabel(id) }}</b></button></div></div>

    <div class="field"><label>Couleur principale — raccourcis</label><div class="row wrap"><button v-for="(c, n) in QUICK" :key="n" class="btn sm" @click="setColor('primary', c)"><i class="dot" :style="{ background: c }" /> {{ n }}</button></div></div>

    <div class="grid g3" style="gap:14px">
      <div v-for="[k, l] in MAIN" :key="k" class="field"><label :for="'c-' + k">{{ l }}</label><div class="row"><input :id="'c-' + k" type="color" :value="draft[k]" @input="setColor(k, $event.target.value)" /><input class="input" :value="hexText[k] ?? draft[k]" maxlength="7" spellcheck="false" :aria-label="l + ' (HEX)'" @input="setColor(k, $event.target.value)" /></div><span v-if="hexText[k] && !normHex(hexText[k])" class="tiny" style="color:var(--danger)">Code HEX invalide (ex. #7c3aed).</span></div>
    </div>
    <details><summary style="cursor:pointer;font-weight:600">Couleurs avancées (boutons, éléments actifs, progression, arrière-plan)</summary>
      <div class="grid g2" style="gap:14px;margin-top:12px"><div v-for="[k, l, fb] in FINE" :key="k" class="field"><label :for="'c-' + k">{{ l }}</label><div class="row"><input :id="'c-' + k" type="color" :value="colorOf(k, k === 'bg' ? preview.bg : draft.primary)" @input="setColor(k, $event.target.value)" /><input class="input" :value="hexText[k] ?? draft[k]" placeholder="auto" maxlength="7" spellcheck="false" :aria-label="l + ' (HEX)'" @input="setColor(k, $event.target.value)" /><button class="btn sm" :disabled="!draft[k]" @click="clearColor(k)">Auto</button></div></div></div></details>

    <div class="grid g2" style="gap:14px">
      <div class="field"><label for="r1">Intensité des dégradés : {{ draft.gradient }}%</label><input id="r1" type="range" min="0" max="100" :value="draft.gradient" @input="setNum('gradient', $event.target.value)" /></div>
      <div class="field"><label for="r2">Effets lumineux : {{ draft.glow }}%</label><input id="r2" type="range" min="0" max="100" :value="draft.glow" @input="setNum('glow', $event.target.value)" /></div>
      <div class="field"><label for="r3">Arrondi des composants : {{ draft.radius }} px</label><input id="r3" type="range" min="6" max="32" :value="draft.radius" @input="setNum('radius', $event.target.value)" /></div>
      <div class="field"><label for="r4">Intensité des ombres : {{ draft.shadow }}%</label><input id="r4" type="range" min="0" max="100" :value="draft.shadow" @input="setNum('shadow', $event.target.value)" /></div>
    </div>
    <div class="field"><label>Style des cartes</label><div class="seg"><button :class="{ on: draft.cardStyle === 'solid' }" @click="draft = { ...draft, cardStyle: 'solid' }">Unies</button><button :class="{ on: draft.cardStyle === 'glass' }" @click="draft = { ...draft, cardStyle: 'glass' }">Verre</button><button :class="{ on: draft.cardStyle === 'outline' }" @click="draft = { ...draft, cardStyle: 'outline' }">Contour</button></div></div>

    <div class="field"><label>Aperçu</label>
      <div class="card flat" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><button class="btn primary">Bouton principal</button><button class="btn">Secondaire</button><span class="pill accent">Actif</span><div style="flex:1;min-width:140px"><div class="bar"><i style="width:68%" /></div></div><span class="small muted">Texte secondaire lisible</span></div></div>

    <div class="row wrap"><button class="btn primary" :disabled="!dirty" @click="apply">Appliquer</button><button class="btn" :disabled="!dirty" @click="cancel">Annuler l'aperçu</button><button class="btn ghost" style="margin-left:auto" @click="reset">Réinitialiser (Violet Premium)</button></div>
    <p class="tiny faint">Le contraste des textes est ajusté automatiquement pour rester lisible, quelles que soient les couleurs choisies. Tes préférences sont enregistrées sur cet appareil.</p>
  </div>
</template>
