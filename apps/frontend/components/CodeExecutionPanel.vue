<template>
  <div>
    <select v-model="selectedTemplate" @change="loadTemplate" class="mb-2 p-1 bg-surface-card text-primary">
      <option disabled value="">Select Template</option>
      <option v-for="t in templates" :key="t" :value="t">{{ t }}</option>
    </select>
    <div v-if="paramNames.length" class="mb-2 space-y-1">
      <div v-for="p in paramNames" :key="p">
        <label class="block text-sm mb-1">{{ p }}</label>
        <input v-model="params[p]" class="w-full p-1 bg-surface-card text-primary" />
      </div>
    </div>
    <div ref="editor" class="border border-border h-48"></div>
    <button @click="run" class="mt-2 px-3 py-1 bg-primary text-white">Run</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { EditorView, basicSetup } from '@codemirror/basic-setup'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import Handlebars from 'handlebars'
import { renderTemplate } from '../composables/useTemplateInjection'
import { usePromptExecutor } from '../hooks/usePromptExecutor'

const templates = ref<string[]>([])
const selectedTemplate = ref('')
const editor = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null
const { executePrompt } = usePromptExecutor()
const params = ref<Record<string, string>>({})
const paramNames = ref<string[]>([])

onMounted(async () => {
  const res = await fetch('/api/templates')
  templates.value = await res.json()
})

async function loadTemplate() {
  if (!selectedTemplate.value) return
  const content = await renderTemplate(selectedTemplate.value, {})
  extractParams(content)
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
  const merged = Handlebars.compile(content)(params.value)
  executePrompt(merged)
}

function extractParams(text: string) {
  const matches = text.match(/{{\s*([\w.]+)\s*}}/g) || []
  const names = matches.map(m => m.replace(/{{|}}/g, '').trim())
  paramNames.value = Array.from(new Set(names))
  params.value = Object.fromEntries(paramNames.value.map(p => [p, '']))
}
</script>
