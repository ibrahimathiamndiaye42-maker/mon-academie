<script setup>
import Icon from './Icon.vue'
defineProps({ subject: Object, size: { type: Number, default: 34 } })
</script>
<template><span class="sub-badge" :style="{ background: subject?.color || '#64748b', width: size + 'px', height: size + 'px' }"><Icon :name="subject?.icon || 'book'" :size="Math.round(size * 0.55)" /></span></template>
