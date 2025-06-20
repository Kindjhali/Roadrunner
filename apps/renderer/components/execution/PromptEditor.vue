<template>
  <div class="prompt-editor">
    <div ref="editorContainer" class="codemirror-container"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, basicSetup } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Enter prompt...' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const editorContainer = ref(null)
let view = null

function updateValue(value) {
  emit('update:modelValue', value)
}

onMounted(() => {
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      oneDark,
      EditorView.editable.of(!props.disabled),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          const text = update.state.doc.toString()
          updateValue(text)
        }
      })
    ]
  })
  view = new EditorView({ state, parent: editorContainer.value })
})

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
    view = null
  }
})

watch(() => props.modelValue, v => {
  if (view && v !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
  }
})

watch(() => props.disabled, val => {
  if (view) {
    view.dispatch({ effects: EditorView.editable.of(!val) })
  }
})
</script>

<style scoped>
.codemirror-container {
  @apply w-full h-60 bg-surface-elevated border border-border rounded custom-scrollbar;
  font-family: 'JetBrains Mono', monospace;
}
</style>
