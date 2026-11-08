<script setup>
import Icon from './Icon.vue'
defineProps({ icon: { type: String, default: 'book' }, title: String, text: String })
</script>
<template><div class="empty"><div class="ei"><Icon :name="icon" :size="26" /></div><h3>{{ title }}</h3><p v-if="text">{{ text }}</p><slot /></div></template>
