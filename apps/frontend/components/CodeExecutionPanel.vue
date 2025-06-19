<template>
  <div>
    <select v-model="selectedTemplate" @change="loadTemplate" class="mb-2 p-1 bg-surface-card text-primary">
      <option disabled value="">Select Template</option>
      <option v-for="t in templates" :key="t" :value="t">{{ t }}</option>
    </select>
    <div ref="editor" class="border border-border h-48"></div>
    <button @click="run" class="mt-2 px-3 py-1 bg-primary text-white">Run</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { EditorView, basicSetup } from '@codemirror/basic-setup'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { renderTemplate } from '../composables/useTemplateInjection'
import { usePromptExecutor } from '../hooks/usePromptExecutor'

const templates = ref<string[]>([])
const selectedTemplate = ref('')
const editor = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null
const { executePrompt } = usePromptExecutor()

onMounted(async () => {
  const res = await fetch('/api/templates')
  templates.value = await res.json()
})

async function loadTemplate() {
  if (!selectedTemplate.value) return
  const content = await renderTemplate(selectedTemplate.value, {})
  initEditor(content)
}

function initEditor(content: string) {
  if (!editor.value) return
  view?.destroy()
  view = new EditorView({
    state: EditorState.create({ doc: content, extensions: [basicSetup, javascript()] }),
    parent: editor.value
  })
}

function run() {
  const content = view?.state.doc.toString() || ''
  executePrompt(content)
}
</script>
