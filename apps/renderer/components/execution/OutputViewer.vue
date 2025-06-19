<template>
  <div class="output-viewer custom-scrollbar">
    <div v-for="(log, index) in logs" :key="index" class="log-line">
      <span class="timestamp">{{ formatTime(log.timestamp) }}</span>
      <span class="message">{{ log.message }}</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  logs: { type: Array, default: () => [] }
})

function formatTime(ts) {
  const date = new Date(ts)
  return date.toLocaleTimeString()
}
</script>

<style scoped>
.output-viewer {
  @apply h-64 overflow-y-auto bg-surface-card border border-border rounded p-2 text-primary text-sm;
}
.log-line {
  @apply flex gap-2;
}
.timestamp {
  @apply text-muted;
}
.message {
  @apply flex-1;
}
</style>
