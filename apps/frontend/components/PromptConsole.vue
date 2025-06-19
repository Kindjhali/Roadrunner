<template>
  <div>
    <textarea v-model="prompt" class="w-full h-32 p-2 bg-surface-card text-primary"></textarea>
    <div class="mt-2 space-x-2">
      <button @click="run" class="px-3 py-1 bg-primary text-white">Run</button>
      <button @click="reset" class="px-3 py-1 bg-border text-primary">Reset</button>
    </div>
    <pre class="mt-2 whitespace-pre-wrap">{{ output }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePromptExecutor } from '../hooks/usePromptExecutor'

const { output, executePrompt } = usePromptExecutor()
const prompt = ref('')

function run() {
  executePrompt(prompt.value)
}
function reset() {
  prompt.value = ''
}
</script>
