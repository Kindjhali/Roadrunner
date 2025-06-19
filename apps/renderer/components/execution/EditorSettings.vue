<template>
  <Modal
    :show="show"
    title="Editor Settings"
    @close="$emit('close')"
  >
    <div class="space-y-6">
      <!-- Editor Theme -->
      <div class="setting-group">
        <label class="setting-label">Editor Theme</label>
        <select v-model="editorTheme" class="setting-select">
          <option value="vs-dark">Dark</option>
          <option value="vs-light">Light</option>
          <option value="hc-black">High Contrast</option>
        </select>
      </div>

      <!-- Font Settings -->
      <div class="setting-group">
        <label class="setting-label">Font Family</label>
        <select v-model="fontFamily" class="setting-select">
          <option value="'Fira Code', monospace">Fira Code</option>
          <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
          <option value="'Source Code Pro', monospace">Source Code Pro</option>
          <option value="'Consolas', monospace">Consolas</option>
          <option value="'Monaco', monospace">Monaco</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">Font Size</label>
        <input
          v-model.number="fontSize"
          type="number"
          min="10"
          max="24"
          class="setting-input"
        />
      </div>

      <!-- Editor Behavior -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="wordWrap"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Word Wrap
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="lineNumbers"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Show Line Numbers
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="minimap"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Show Minimap
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="autoComplete"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Auto Complete
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="formatOnSave"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Format on Save
        </label>
      </div>

      <!-- Tab Settings -->
      <div class="setting-group">
        <label class="setting-label">Tab Size</label>
        <input
          v-model.number="tabSize"
          type="number"
          min="2"
          max="8"
          class="setting-input"
        />
      </div>

      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="insertSpaces"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Insert Spaces (instead of tabs)
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-3">
        <BaseButton
          variant="secondary"
          @click="$emit('close')"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          @click="saveSettings"
        >
          Save Settings
        </BaseButton>
      </div>
    </template>
  </Modal>
</template>

<script>
import { ref, watch } from 'vue'
import Modal from '../shared/Modal.vue'
import BaseButton from '../shared/BaseButton.vue'

export default {
  name: 'EditorSettings',
  components: {
    Modal,
    BaseButton
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    settings: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['close', 'save'],
  setup(props, { emit }) {
    // Editor settings
    const editorTheme = ref(props.settings.theme || 'vs-dark')
    const fontFamily = ref(props.settings.fontFamily || "'Fira Code', monospace")
    const fontSize = ref(props.settings.fontSize || 14)
    const wordWrap = ref(props.settings.wordWrap || false)
    const lineNumbers = ref(props.settings.lineNumbers !== false)
    const minimap = ref(props.settings.minimap !== false)
    const autoComplete = ref(props.settings.autoComplete !== false)
    const formatOnSave = ref(props.settings.formatOnSave || false)
    const tabSize = ref(props.settings.tabSize || 2)
    const insertSpaces = ref(props.settings.insertSpaces !== false)

    // Watch for prop changes
    watch(() => props.settings, (newSettings) => {
      editorTheme.value = newSettings.theme || 'vs-dark'
      fontFamily.value = newSettings.fontFamily || "'Fira Code', monospace"
      fontSize.value = newSettings.fontSize || 14
      wordWrap.value = newSettings.wordWrap || false
      lineNumbers.value = newSettings.lineNumbers !== false
      minimap.value = newSettings.minimap !== false
      autoComplete.value = newSettings.autoComplete !== false
      formatOnSave.value = newSettings.formatOnSave || false
      tabSize.value = newSettings.tabSize || 2
      insertSpaces.value = newSettings.insertSpaces !== false
    }, { deep: true })

    const saveSettings = () => {
      const settings = {
        theme: editorTheme.value,
        fontFamily: fontFamily.value,
        fontSize: fontSize.value,
        wordWrap: wordWrap.value,
        lineNumbers: lineNumbers.value,
        minimap: minimap.value,
        autoComplete: autoComplete.value,
        formatOnSave: formatOnSave.value,
        tabSize: tabSize.value,
        insertSpaces: insertSpaces.value
      }
      
      emit('save', settings)
      emit('close')
    }

    return {
      editorTheme,
      fontFamily,
      fontSize,
      wordWrap,
      lineNumbers,
      minimap,
      autoComplete,
      formatOnSave,
      tabSize,
      insertSpaces,
      saveSettings
    }
  }
}
</script>

<style scoped>
.setting-group {
  @apply space-y-2;
}

.setting-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.setting-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.setting-select {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.setting-checkbox {
  @apply flex items-center space-x-3 cursor-pointer;
}

.setting-checkbox input[type="checkbox"] {
  @apply sr-only;
}

.checkmark {
  @apply w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded;
  @apply flex items-center justify-center transition-colors;
}

.setting-checkbox input[type="checkbox"]:checked + .checkmark {
  @apply bg-blue-500 border-blue-500;
}

.setting-checkbox input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  @apply text-white text-sm font-bold;
}
</style>
