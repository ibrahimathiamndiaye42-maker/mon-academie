<script setup>
import { onMounted, onUnmounted } from 'vue'
import Icon from './Icon.vue'
const props = defineProps({ title: String, wide: Boolean })
const emit = defineEmits(['close'])
const onKey = (e) => { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
<template>
  <Teleport to="body">
    <div class="overlay" @mousedown.self="emit('close')">
      <div class="modal" :class="{ wide }" role="dialog" aria-modal="true" :aria-label="title">
        <div class="modal-head">
          <h2>{{ title }}</h2>
          <button class="icon-btn" aria-label="Fermer" @click="emit('close')"><Icon name="x" /></button>
        </div>
        <div class="modal-body"><slot /></div>
        <div v-if="$slots.footer" class="modal-foot"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
