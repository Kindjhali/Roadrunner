<template>
  <Modal
    :show="show"
    title="Import Settings"
    @close="$emit('close')"
  >
    <div class="space-y-6">
      <!-- Import Method Selection -->
      <div class="setting-group">
        <label class="setting-label">Import Method</label>
        <div class="space-y-2">
          <label class="setting-radio">
            <input
              v-model="importMethod"
              type="radio"
              value="file"
            />
            <span class="radio-mark"></span>
            Import from File
          </label>
          <label class="setting-radio">
            <input
              v-model="importMethod"
              type="radio"
              value="url"
            />
            <span class="radio-mark"></span>
            Import from URL
          </label>
          <label class="setting-radio">
            <input
              v-model="importMethod"
              type="radio"
              value="text"
            />
            <span class="radio-mark"></span>
            Import from Text
          </label>
        </div>
      </div>

      <!-- File Import -->
      <div v-if="importMethod === 'file'" class="setting-group">
        <label class="setting-label">Select Settings File</label>
        <input
          ref="fileInput"
          type="file"
          accept=".json,.yaml,.yml"
          class="setting-file-input"
          @change="handleFileSelect"
        />
        <p class="setting-description">
          Select a JSON or YAML file containing exported settings
        </p>
      </div>

      <!-- URL Import -->
      <div v-if="importMethod === 'url'" class="setting-group">
        <label class="setting-label">Settings URL</label>
        <input
          v-model="importUrl"
          type="url"
          placeholder="https://example.com/settings.json"
          class="setting-input"
        />
        <p class="setting-description">
          Enter a URL pointing to a settings file
        </p>
      </div>

      <!-- Text Import -->
      <div v-if="importMethod === 'text'" class="setting-group">
        <label class="setting-label">Settings Data</label>
        <textarea
          v-model="importText"
          rows="10"
          placeholder="Paste your settings JSON or YAML here..."
          class="setting-textarea"
        ></textarea>
        <p class="setting-description">
          Paste the settings data directly
        </p>
      </div>

      <!-- Import Options -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Import Options</h3>
        
        <div class="space-y-3">
          <label class="setting-checkbox">
            <input
              v-model="mergeSettings"
              type="checkbox"
            />
            <span class="checkmark"></span>
            Merge with existing settings
          </label>
          <p class="setting-description">
            If unchecked, existing settings will be completely replaced
          </p>

          <label class="setting-checkbox">
            <input
              v-model="backupBeforeImport"
              type="checkbox"
            />
            <span class="checkmark"></span>
            Create backup before import
          </label>
          <p class="setting-description">
            Automatically backup current settings before importing
          </p>

          <label class="setting-checkbox">
            <input
              v-model="validateSettings"
              type="checkbox"
            />
            <span class="checkmark"></span>
            Validate settings before import
          </label>
          <p class="setting-description">
            Check settings for errors before applying them
          </p>
        </div>
      </div>

      <!-- Preview -->
      <div v-if="previewData" class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Preview</h3>
        <div class="preview-container">
          <pre class="preview-content">{{ JSON.stringify(previewData, null, 2) }}</pre>
        </div>
      </div>

      <!-- Import Status -->
      <div v-if="importStatus" class="setting-group">
        <div class="status-message" :class="importStatus.type">
          <Icon :name="importStatus.type === 'success' ? 'check' : 'error'" class="w-5 h-5" />
          <span>{{ importStatus.message }}</span>
        </div>
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
          :disabled="!canImport"
          :loading="importing"
          @click="performImport"
        >
          Import Settings
        </BaseButton>
      </div>
    </template>
  </Modal>
</template>

<script>
import { ref, computed, watch } from 'vue'
import Modal from '../shared/Modal.vue'
import BaseButton from '../shared/BaseButton.vue'
import Icon from '../shared/Icon.vue'
import { useSettingsStore } from '../../stores/settingsStore'

export default {
  name: 'ImportSettingsModal',
  components: {
    Modal,
    BaseButton,
    Icon
  },
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'imported'],
  setup(props, { emit }) {
    const settingsStore = useSettingsStore()

    // Import method and data
    const importMethod = ref('file')
    const importUrl = ref('')
    const importText = ref('')
    const selectedFile = ref(null)
    const fileInput = ref(null)

    // Import options
    const mergeSettings = ref(true)
    const backupBeforeImport = ref(true)
    const validateSettings = ref(true)

    // State
    const importing = ref(false)
    const previewData = ref(null)
    const importStatus = ref(null)

    // Computed
    const canImport = computed(() => {
      switch (importMethod.value) {
        case 'file':
          return selectedFile.value !== null
        case 'url':
          return importUrl.value.length > 0
        case 'text':
          return importText.value.length > 0
        default:
          return false
      }
    })

    // Methods
    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        selectedFile.value = file
        readFileContent(file)
      }
    }

    const readFileContent = (file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target.result
          const data = file.name.endsWith('.json') 
            ? JSON.parse(content)
            : parseYAML(content) // You'd need a YAML parser
          previewData.value = data
          importStatus.value = null
        } catch (error) {
          importStatus.value = {
            type: 'error',
            message: `Failed to parse file: ${error.message}`
          }
          previewData.value = null
        }
      }
      reader.readAsText(file)
    }

    const parseYAML = (content) => {
      // Simple YAML parser - in a real app you'd use a proper YAML library
      try {
        return JSON.parse(content)
      } catch {
        throw new Error('YAML parsing not implemented - please use JSON format')
      }
    }

    const fetchFromUrl = async () => {
      try {
        const response = await fetch(importUrl.value)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const data = await response.json()
        previewData.value = data
        importStatus.value = null
      } catch (error) {
        importStatus.value = {
          type: 'error',
          message: `Failed to fetch from URL: ${error.message}`
        }
        previewData.value = null
      }
    }

    const parseTextData = () => {
      try {
        const data = JSON.parse(importText.value)
        previewData.value = data
        importStatus.value = null
      } catch (error) {
        importStatus.value = {
          type: 'error',
          message: `Failed to parse text data: ${error.message}`
        }
        previewData.value = null
      }
    }

    const validateSettingsData = (data) => {
      // Basic validation - check for required structure
      if (!data || typeof data !== 'object') {
        throw new Error('Settings data must be an object')
      }
      
      // Add more specific validation as needed
      return true
    }

    const performImport = async () => {
      importing.value = true
      importStatus.value = null

      try {
        let data = previewData.value

        // Get data based on import method
        if (importMethod.value === 'url' && !data) {
          await fetchFromUrl()
          data = previewData.value
        } else if (importMethod.value === 'text' && !data) {
          parseTextData()
          data = previewData.value
        }

        if (!data) {
          throw new Error('No data to import')
        }

        // Validate settings if requested
        if (validateSettings.value) {
          validateSettingsData(data)
        }

        // Create backup if requested
        if (backupBeforeImport.value) {
          await settingsStore.createBackup()
        }

        // Import settings
        if (mergeSettings.value) {
          await settingsStore.mergeSettings(data)
        } else {
          await settingsStore.replaceSettings(data)
        }

        importStatus.value = {
          type: 'success',
          message: 'Settings imported successfully!'
        }

        // Emit success event
        emit('imported', data)

        // Close modal after a short delay
        setTimeout(() => {
          emit('close')
        }, 1500)

      } catch (error) {
        importStatus.value = {
          type: 'error',
          message: error.message
        }
      } finally {
        importing.value = false
      }
    }

    // Watch for changes to trigger preview updates
    watch(importUrl, () => {
      if (importMethod.value === 'url' && importUrl.value) {
        fetchFromUrl()
      }
    })

    watch(importText, () => {
      if (importMethod.value === 'text' && importText.value) {
        parseTextData()
      }
    })

    // Reset state when modal is closed
    watch(() => props.show, (newShow) => {
      if (!newShow) {
        importMethod.value = 'file'
        importUrl.value = ''
        importText.value = ''
        selectedFile.value = null
        previewData.value = null
        importStatus.value = null
        importing.value = false
        if (fileInput.value) {
          fileInput.value.value = ''
        }
      }
    })

    return {
      importMethod,
      importUrl,
      importText,
      selectedFile,
      fileInput,
      mergeSettings,
      backupBeforeImport,
      validateSettings,
      importing,
      previewData,
      importStatus,
      canImport,
      handleFileSelect,
      performImport
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

.setting-description {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.setting-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.setting-textarea {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
  @apply font-mono text-sm;
}

.setting-file-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.setting-radio {
  @apply flex items-center space-x-3 cursor-pointer;
}

.setting-radio input[type="radio"] {
  @apply sr-only;
}

.radio-mark {
  @apply w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-full;
  @apply flex items-center justify-center transition-colors;
}

.setting-radio input[type="radio"]:checked + .radio-mark {
  @apply bg-blue-500 border-blue-500;
}

.setting-radio input[type="radio"]:checked + .radio-mark::after {
  content: '';
  @apply w-2 h-2 bg-white rounded-full;
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

.preview-container {
  @apply max-h-64 overflow-auto border border-gray-300 dark:border-gray-600 rounded-md;
  @apply bg-gray-50 dark:bg-gray-800;
}

.preview-content {
  @apply p-4 text-sm font-mono text-gray-900 dark:text-white;
}

.status-message {
  @apply flex items-center space-x-2 p-3 rounded-md;
}

.status-message.success {
  @apply bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200;
}

.status-message.error {
  @apply bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200;
}
</style>
