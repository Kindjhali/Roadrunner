<template>
  <main class="p-4 space-y-4">
    <PromptConsole />
    <CodeExecutionPanel />
    <AgentConfigPanel />
    <ConfigEditorPanel />
    <BackendLogViewer />
  </main>
</template>

<script setup lang="ts">
import PromptConsole from './components/PromptConsole.vue'
import CodeExecutionPanel from './components/CodeExecutionPanel.vue'
import AgentConfigPanel from './components/AgentConfigPanel.vue'
import ConfigEditorPanel from './components/ConfigEditorPanel.vue'
import BackendLogViewer from './components/BackendLogViewer.vue'
</script>

<style scoped>
main {
  @apply space-y-8;
}
</style>
