<template>
  <SettingsSection
    title="Keyboard Shortcuts"
    description="Configure keyboard shortcuts and hotkeys"
    icon="keyboard"
  >
    <div class="space-y-6">
      <!-- Global Shortcuts -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Global Shortcuts</h3>
        
        <div class="shortcut-item">
          <label class="shortcut-label">New Plan</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">N</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Save Plan</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">S</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Open Plan</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">O</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Settings</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">,</kbd>
          </div>
        </div>
      </div>

      <!-- Planning Shortcuts -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Planning Shortcuts</h3>
        
        <div class="shortcut-item">
          <label class="shortcut-label">Add Step</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">Enter</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Delete Step</label>
          <div class="shortcut-input">
            <kbd class="kbd">Delete</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Move Step Up</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">↑</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Move Step Down</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">↓</kbd>
          </div>
        </div>
      </div>

      <!-- Execution Shortcuts -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Execution Shortcuts</h3>
        
        <div class="shortcut-item">
          <label class="shortcut-label">Run Plan</label>
          <div class="shortcut-input">
            <kbd class="kbd">F5</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Stop Execution</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">C</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Pause/Resume</label>
          <div class="shortcut-input">
            <kbd class="kbd">Space</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Step Forward</label>
          <div class="shortcut-input">
            <kbd class="kbd">F10</kbd>
          </div>
        </div>
      </div>

      <!-- Editor Shortcuts -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Editor Shortcuts</h3>
        
        <div class="shortcut-item">
          <label class="shortcut-label">Find</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">F</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Replace</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">H</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Format Code</label>
          <div class="shortcut-input">
            <kbd class="kbd">Shift</kbd> + <kbd class="kbd">Alt</kbd> + <kbd class="kbd">F</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Toggle Comment</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">/</kbd>
          </div>
        </div>
      </div>

      <!-- Navigation Shortcuts -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Navigation Shortcuts</h3>
        
        <div class="shortcut-item">
          <label class="shortcut-label">Switch to Planning</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">1</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Switch to Brainstorming</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">2</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Switch to Execution</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">3</kbd>
          </div>
        </div>

        <div class="shortcut-item">
          <label class="shortcut-label">Switch to Configuration</label>
          <div class="shortcut-input">
            <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">4</kbd>
          </div>
        </div>
      </div>

      <!-- Custom Shortcuts -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="enableCustomShortcuts"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Enable Custom Shortcuts
        </label>
        <p class="setting-description">
          Allow customization of keyboard shortcuts
        </p>
      </div>
    </div>
  </SettingsSection>
</template>

<script>
import { ref, watch } from 'vue'
import SettingsSection from './SettingsSection.vue'
import { useSettingsStore } from '../../stores/settingsStore'

export default {
  name: 'KeyboardShortcuts',
  components: {
    SettingsSection
  },
  setup() {
    const settingsStore = useSettingsStore()

    // Keyboard shortcut settings
    const enableCustomShortcuts = ref(settingsStore.shortcuts.enableCustomShortcuts || false)

    // Watch for changes and update store
    watch([enableCustomShortcuts], () => {
      settingsStore.updateShortcutSettings({
        enableCustomShortcuts: enableCustomShortcuts.value
      })
    })

    return {
      enableCustomShortcuts
    }
  }
}
</script>

<style scoped>
.setting-group {
  @apply space-y-4;
}

.shortcut-item {
  @apply flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg;
}

.shortcut-label {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300;
}

.shortcut-input {
  @apply flex items-center space-x-1;
}

.kbd {
  @apply inline-flex items-center px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700;
  @apply border border-gray-300 dark:border-gray-600 rounded shadow-sm;
  @apply text-gray-700 dark:text-gray-300;
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

.setting-description {
  @apply text-xs text-gray-500 dark:text-gray-400;
}
</style>
