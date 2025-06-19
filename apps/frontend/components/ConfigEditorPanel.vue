<template>
  <div>
    <select v-model="file" @change="load" class="mb-2 p-1 bg-surface-card text-primary">
      <option disabled value="">Select Config</option>
      <option v-for="f in files" :key="f" :value="f">{{ f }}</option>
    </select>
    <div ref="editor" class="border border-border h-48"></div>
    <div v-if="error" class="text-error text-sm mt-1">{{ error }}</div>
    <button :disabled="!valid" @click="save" class="mt-2 px-3 py-1 bg-primary text-white">Save</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EditorView, basicSetup } from '@codemirror/basic-setup'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { useEditableConfig } from '../hooks/useEditableConfig'

const files = [
  'agent_instructions_template.json',
  'conference_agent_instructions.json',
  'backend_config.json',
  'model_categories.json',
  'fsAgent.config.json'
]

const file = ref('')
const editor = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null
const { content, valid, error, load: loadFile, save: saveFile, validate } = useEditableConfig(file)

async function load() {
  if (!file.value) return
  await loadFile()
  initEditor(content.value)
}

function initEditor(text: string) {
  if (!editor.value) return
  view?.destroy()
  view = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: [
        basicSetup,
        json(),
        EditorView.updateListener.of(() => validateContent())
      ]
    }),
    parent: editor.value
  })
  view.dispatch()
  validateContent()
}

function validateContent() {
  if (view) {
    const t = view.state.doc.toString()
    content.value = t
    validate()
  }
}

function save() {
  if (!view) return
  content.value = view.state.doc.toString()
  validate()
  if (valid.value) {
    saveFile()
  }
}
</script>
