<script setup>
defineProps({ value: { type: Number, default: 0 }, color: String })
</script>
<template><div class="bar" role="progressbar" :aria-valuenow="Math.round(value)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: Math.min(100, Math.max(0, value)) + '%', background: color || undefined }" /></div></template>
