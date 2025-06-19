<template>
  <div class="border border-border p-2 h-40 overflow-y-auto custom-scrollbar">
    <div v-for="(msg, index) in logs" :key="index" class="text-sm whitespace-pre-wrap">{{ msg }}</div>
  </div>
  <div class="mt-2 space-x-2">
    <button @click="clear" class="px-2 py-1 bg-border text-primary">Clear</button>
    <button @click="togglePause" class="px-2 py-1 bg-border text-primary">
      {{ paused ? 'Resume' : 'Pause' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useLogs } from '../hooks/useLogs'

const { logs, clear, pause, paused } = useLogs()

function togglePause() {
  pause(!paused.value)
}
</script>
