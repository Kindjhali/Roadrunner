<template>
  <SettingsSection
    title="Editor Configuration"
    description="Configure code editor settings and preferences"
    icon="edit"
  >
    <div class="space-y-6">
      <!-- Theme Settings -->
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
        <input
          v-model="fontFamily"
          type="text"
          class="setting-input"
          placeholder="'Fira Code', 'Monaco', monospace"
        />
      </div>

      <div class="setting-group">
        <label class="setting-label">Font Size</label>
        <input
          v-model.number="fontSize"
          type="number"
          min="8"
          max="32"
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
            v-model="lineNumbers"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Show Line Numbers
        </label>
      </div>

      <!-- Tab Settings -->
      <div class="setting-group">
        <label class="setting-label">Tab Size</label>
        <select v-model.number="tabSize" class="setting-select">
          <option :value="2">2 spaces</option>
          <option :value="4">4 spaces</option>
          <option :value="8">8 spaces</option>
        </select>
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

      <!-- Auto-save -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="autoSave"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Auto Save
        </label>
      </div>

      <!-- Language-specific settings -->
      <div class="setting-group">
        <label class="setting-label">Default Language</label>
        <select v-model="defaultLanguage" class="setting-select">
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="vue">Vue</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
        </select>
      </div>
    </div>
  </SettingsSection>
</template>

<script>
import { ref, watch } from 'vue'
import SettingsSection from './SettingsSection.vue'
import { useSettingsStore } from '../../stores/settingsStore'

export default {
  name: 'EditorConfiguration',
  components: {
    SettingsSection
  },
  setup() {
    const settingsStore = useSettingsStore()

    // Editor settings
    const editorTheme = ref(settingsStore.editor.theme || 'vs-dark')
    const fontFamily = ref(settingsStore.editor.fontFamily || "'Fira Code', 'Monaco', monospace")
    const fontSize = ref(settingsStore.editor.fontSize || 14)
    const wordWrap = ref(settingsStore.editor.wordWrap || false)
    const minimap = ref(settingsStore.editor.minimap || true)
    const lineNumbers = ref(settingsStore.editor.lineNumbers || true)
    const tabSize = ref(settingsStore.editor.tabSize || 2)
    const insertSpaces = ref(settingsStore.editor.insertSpaces || true)
    const autoSave = ref(settingsStore.editor.autoSave || false)
    const defaultLanguage = ref(settingsStore.editor.defaultLanguage || 'javascript')

    // Watch for changes and update store
    watch([
      editorTheme, fontFamily, fontSize, wordWrap, minimap,
      lineNumbers, tabSize, insertSpaces, autoSave, defaultLanguage
    ], () => {
      settingsStore.updateEditorSettings({
        theme: editorTheme.value,
        fontFamily: fontFamily.value,
        fontSize: fontSize.value,
        wordWrap: wordWrap.value,
        minimap: minimap.value,
        lineNumbers: lineNumbers.value,
        tabSize: tabSize.value,
        insertSpaces: insertSpaces.value,
        autoSave: autoSave.value,
        defaultLanguage: defaultLanguage.value
      })
    })

    return {
      editorTheme,
      fontFamily,
      fontSize,
      wordWrap,
      minimap,
      lineNumbers,
      tabSize,
      insertSpaces,
      autoSave,
      defaultLanguage
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
