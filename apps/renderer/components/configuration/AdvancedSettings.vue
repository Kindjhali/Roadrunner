<!--
  AdvancedSettings.vue - Comprehensive configuration management interface
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="turdus-settings-grid">
    <!-- Settings Header -->
    <div class="settings-header">
      <h2 class="text-xl font-semibold text-primary">Advanced Settings</h2>
      <p class="text-sm text-muted">Configure models, themes, and application preferences</p>
      
      <div class="settings-actions">
        <BaseButton
          variant="ghost"
          size="sm"
          icon="turdus-export"
          @click="exportSettings"
        >
          Export
        </BaseButton>
        
        <BaseButton
          variant="ghost"
          size="sm"
          icon="turdus-import"
          @click="importSettings"
        >
          Import
        </BaseButton>
        
        <BaseButton
          variant="outline"
          size="sm"
          icon="corvidae-validate"
          @click="resetToDefaults"
        >
          Reset to Defaults
        </BaseButton>
      </div>
    </div>

    <!-- Settings Grid -->
    <div class="settings-grid">
      <!-- Model Configuration Section -->
      <SettingsSection 
        title="Model Configuration"
        description="Configure AI models and providers"
        icon="corvidae-analyze"
      >
        <ModelConfiguration 
          :settings="settings.models"
          @update="updateModelSettings"
        />
      </SettingsSection>

      <!-- Theme Customization Section -->
      <SettingsSection 
        title="Theme & Appearance"
        description="Customize colors, fonts, and layout"
        icon="passeriformes-edit"
      >
        <ThemeCustomizer 
          :settings="settings.theme"
          @update="updateThemeSettings"
        />
      </SettingsSection>

      <!-- Editor Configuration Section -->
      <SettingsSection 
        title="Code Editor"
        description="Configure editor behavior and appearance"
        icon="corvidae-code"
      >
        <EditorConfiguration 
          :settings="settings.editor"
          @update="updateEditorSettings"
        />
      </SettingsSection>

      <!-- Performance Settings Section -->
      <SettingsSection 
        title="Performance"
        description="Optimize application performance"
        icon="accipiter-optimize"
      >
        <PerformanceSettings 
          :settings="settings.performance"
          @update="updatePerformanceSettings"
        />
      </SettingsSection>

      <!-- Security & Privacy Section -->
      <SettingsSection 
        title="Security & Privacy"
        description="Configure security and privacy options"
        icon="accipiter-shield"
      >
        <SecuritySettings 
          :settings="settings.security"
          @update="updateSecuritySettings"
        />
      </SettingsSection>

      <!-- Advanced Features Section -->
      <SettingsSection 
        title="Advanced Features"
        description="Enable experimental and advanced features"
        icon="corvidae-experiment"
      >
        <AdvancedFeatures 
          :settings="settings.advanced"
          @update="updateAdvancedSettings"
        />
      </SettingsSection>

      <!-- Keyboard Shortcuts Section -->
      <SettingsSection 
        title="Keyboard Shortcuts"
        description="Customize keyboard shortcuts"
        icon="piciformes-keyboard"
      >
        <KeyboardShortcuts 
          :settings="settings.shortcuts"
          @update="updateShortcutSettings"
        />
      </SettingsSection>

      <!-- Integration Settings Section -->
      <SettingsSection 
        title="Integrations"
        description="Configure external service integrations"
        icon="piciformes-api"
      >
        <IntegrationSettings 
          :settings="settings.integrations"
          @update="updateIntegrationSettings"
        />
      </SettingsSection>
    </div>

    <!-- Settings Footer -->
    <div class="settings-footer">
      <div class="settings-status">
        <Icon 
          :name="hasUnsavedChanges ? 'warning' : 'corvidae-validate'" 
          size="sm" 
          :class="hasUnsavedChanges ? 'text-warning' : 'text-success'"
        />
        <span :class="hasUnsavedChanges ? 'text-warning' : 'text-success'">
          {{ hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved' }}
        </span>
      </div>
      
      <div class="settings-footer-actions">
        <BaseButton
          v-if="hasUnsavedChanges"
          variant="ghost"
          size="sm"
          @click="discardChanges"
        >
          Discard Changes
        </BaseButton>
        
        <BaseButton
          variant="primary"
          size="sm"
          icon="accipiter-save"
          @click="saveSettings"
          :loading="isSaving"
          :disabled="!hasUnsavedChanges"
        >
          Save Settings
        </BaseButton>
      </div>
    </div>

    <!-- Import Modal -->
    <Modal
      v-if="showImportModal"
      title="Import Settings"
      @close="showImportModal = false"
    >
      <ImportSettingsModal
        @import="handleImportSettings"
        @close="showImportModal = false"
      />
    </Modal>

    <!-- Reset Confirmation Modal -->
    <Modal
      v-if="showResetModal"
      title="Reset to Defaults"
      @close="showResetModal = false"
    >
      <div class="reset-confirmation">
        <Icon name="warning" size="xl" class="text-warning mb-4" />
        <h3 class="text-lg font-semibold text-primary mb-2">Reset All Settings?</h3>
        <p class="text-secondary mb-6">
          This will reset all settings to their default values. This action cannot be undone.
        </p>
        
        <div class="flex gap-3 justify-end">
          <BaseButton
            variant="ghost"
            @click="showResetModal = false"
          >
            Cancel
          </BaseButton>
          
          <BaseButton
            variant="danger"
            @click="confirmReset"
          >
            Reset Settings
          </BaseButton>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useNotifications } from '../../composables/useNotifications.js'
import SettingsSection from './SettingsSection.vue'
import ModelConfiguration from './ModelConfiguration.vue'
import ThemeCustomizer from './ThemeCustomizer.vue'
import EditorConfiguration from './EditorConfiguration.vue'
import PerformanceSettings from './PerformanceSettings.vue'
import SecuritySettings from './SecuritySettings.vue'
import AdvancedFeatures from './AdvancedFeatures.vue'
import KeyboardShortcuts from './KeyboardShortcuts.vue'
import IntegrationSettings from './IntegrationSettings.vue'
import ImportSettingsModal from './ImportSettingsModal.vue'
import BaseButton from '../shared/BaseButton.vue'
import Icon from '../shared/Icon.vue'
import Modal from '../shared/Modal.vue'

/**
 * AdvancedSettings Component
 * 
 * Comprehensive settings management interface:
 * 1. Organized settings sections
 * 2. Real-time validation
 * 3. Import/export functionality
 * 4. Change tracking and persistence
 */
export default {
  name: 'AdvancedSettings',
  
  components: {
    SettingsSection,
    ModelConfiguration,
    ThemeCustomizer,
    EditorConfiguration,
    PerformanceSettings,
    SecuritySettings,
    AdvancedFeatures,
    KeyboardShortcuts,
    IntegrationSettings,
    ImportSettingsModal,
    BaseButton,
    Icon,
    Modal
  },
  
  setup() {
    // Stores and composables
    const settingsStore = useSettingsStore()
    const { showNotification } = useNotifications()
    
    // Component state
    const settings = ref({})
    const originalSettings = ref({})
    const isSaving = ref(false)
    const showImportModal = ref(false)
    const showResetModal = ref(false)
    
    // Computed properties
    const hasUnsavedChanges = computed(() => {
      return JSON.stringify(settings.value) !== JSON.stringify(originalSettings.value)
    })

    // Methods
    
    /**
     * Load settings from store
     * Question → Explore → Apply pattern
     */
    async function loadSettings() {
      try {
        // Question: Are settings available?
        await settingsStore.loadSettings()
        
        // Explore: Get current settings
        const currentSettings = settingsStore.getAllSettings()
        
        // Apply: Update component state
        settings.value = JSON.parse(JSON.stringify(currentSettings))
        originalSettings.value = JSON.parse(JSON.stringify(currentSettings))
        
      } catch (error) {
        console.error('Failed to load settings:', error)
        showNotification('Failed to load settings', 'error')
      }
    }
    
    /**
     * Save settings to store
     * Input → Process → Output pattern
     */
    async function saveSettings() {
      try {
        // Input: Validate settings
        const validationResult = validateSettings(settings.value)
        if (!validationResult.isValid) {
          showNotification(`Invalid settings: ${validationResult.errors.join(', ')}`, 'error')
          return
        }
        
        isSaving.value = true
        
        // Process: Save to store
        await settingsStore.updateSettings(settings.value)
        
        // Output: Update original settings
        originalSettings.value = JSON.parse(JSON.stringify(settings.value))
        
        showNotification('Settings saved successfully', 'success')
        
      } catch (error) {
        console.error('Failed to save settings:', error)
        showNotification('Failed to save settings', 'error')
      } finally {
        isSaving.value = false
      }
    }
    
    /**
     * Discard unsaved changes
     */
    function discardChanges() {
      settings.value = JSON.parse(JSON.stringify(originalSettings.value))
      showNotification('Changes discarded', 'info')
    }
    
    /**
     * Export settings to file
     * Prompt → Validate → Result pattern
     */
    function exportSettings() {
      try {
        // Prompt: Prepare export data
        const exportData = {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          settings: settings.value
        }
        
        // Validate: Create blob
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
          type: 'application/json' 
        })
        
        // Result: Download file
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `roadrunner-settings-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        
        URL.revokeObjectURL(url)
        
        showNotification('Settings exported successfully', 'success')
        
      } catch (error) {
        console.error('Failed to export settings:', error)
        showNotification('Failed to export settings', 'error')
      }
    }
    
    /**
     * Import settings from file
     */
    function importSettings() {
      showImportModal.value = true
    }
    
    /**
     * Handle imported settings
     */
    async function handleImportSettings(importedSettings) {
      try {
        // Validate imported settings
        const validationResult = validateSettings(importedSettings)
        if (!validationResult.isValid) {
          showNotification(`Invalid settings file: ${validationResult.errors.join(', ')}`, 'error')
          return
        }
        
        // Update settings
        settings.value = { ...settings.value, ...importedSettings }
        
        showNotification('Settings imported successfully', 'success')
        showImportModal.value = false
        
      } catch (error) {
        console.error('Failed to import settings:', error)
        showNotification('Failed to import settings', 'error')
      }
    }
    
    /**
     * Reset settings to defaults
     */
    function resetToDefaults() {
      showResetModal.value = true
    }
    
    /**
     * Confirm reset to defaults
     */
    async function confirmReset() {
      try {
        const defaultSettings = settingsStore.getDefaultSettings()
        settings.value = JSON.parse(JSON.stringify(defaultSettings))
        
        showNotification('Settings reset to defaults', 'success')
        showResetModal.value = false
        
      } catch (error) {
        console.error('Failed to reset settings:', error)
        showNotification('Failed to reset settings', 'error')
      }
    }
    
    /**
     * Update model settings
     */
    function updateModelSettings(modelSettings) {
      settings.value.models = { ...settings.value.models, ...modelSettings }
    }
    
    /**
     * Update theme settings
     */
    function updateThemeSettings(themeSettings) {
      settings.value.theme = { ...settings.value.theme, ...themeSettings }
    }
    
    /**
     * Update editor settings
     */
    function updateEditorSettings(editorSettings) {
      settings.value.editor = { ...settings.value.editor, ...editorSettings }
    }
    
    /**
     * Update performance settings
     */
    function updatePerformanceSettings(performanceSettings) {
      settings.value.performance = { ...settings.value.performance, ...performanceSettings }
    }
    
    /**
     * Update security settings
     */
    function updateSecuritySettings(securitySettings) {
      settings.value.security = { ...settings.value.security, ...securitySettings }
    }
    
    /**
     * Update advanced settings
     */
    function updateAdvancedSettings(advancedSettings) {
      settings.value.advanced = { ...settings.value.advanced, ...advancedSettings }
    }
    
    /**
     * Update shortcut settings
     */
    function updateShortcutSettings(shortcutSettings) {
      settings.value.shortcuts = { ...settings.value.shortcuts, ...shortcutSettings }
    }
    
    /**
     * Update integration settings
     */
    function updateIntegrationSettings(integrationSettings) {
      settings.value.integrations = { ...settings.value.integrations, ...integrationSettings }
    }
    
    /**
     * Validate settings object
     */
    function validateSettings(settingsObj) {
      const errors = []
      
      // Basic structure validation
      if (!settingsObj || typeof settingsObj !== 'object') {
        errors.push('Settings must be an object')
        return { isValid: false, errors }
      }
      
      // Validate required sections
      const requiredSections = ['models', 'theme', 'editor', 'performance', 'security']
      for (const section of requiredSections) {
        if (!settingsObj[section]) {
          errors.push(`Missing required section: ${section}`)
        }
      }
      
      // Validate theme colors
      if (settingsObj.theme && settingsObj.theme.colors) {
        const colors = settingsObj.theme.colors
        if (colors.primary && !isValidColor(colors.primary)) {
          errors.push('Invalid primary color format')
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      }
    }
    
    /**
     * Validate color format
     */
    function isValidColor(color) {
      const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
      const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/
      const hslRegex = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/
      
      return hexRegex.test(color) || rgbRegex.test(color) || hslRegex.test(color)
    }

    // Watchers
    watch(hasUnsavedChanges, (hasChanges) => {
      if (hasChanges) {
        // Auto-save after 5 seconds of inactivity
        setTimeout(() => {
          if (hasUnsavedChanges.value) {
            saveSettings()
          }
        }, 5000)
      }
    })

    // Lifecycle
    onMounted(() => {
      loadSettings()
    })

    return {
      // State
      settings,
      isSaving,
      showImportModal,
      showResetModal,
      
      // Computed
      hasUnsavedChanges,
      
      // Methods
      saveSettings,
      discardChanges,
      exportSettings,
      importSettings,
      handleImportSettings,
      resetToDefaults,
      confirmReset,
      updateModelSettings,
      updateThemeSettings,
      updateEditorSettings,
      updatePerformanceSettings,
      updateSecuritySettings,
      updateAdvancedSettings,
      updateShortcutSettings,
      updateIntegrationSettings
    }
  }
}
</script>

<style scoped>
.turdus-settings-grid {
  @apply h-full flex flex-col bg-surface;
}

.settings-header {
  @apply flex items-start justify-between p-6 border-b border-border bg-surface-hover;
}

.settings-header h2 {
  @apply text-xl font-semibold text-primary mb-1;
}

.settings-header p {
  @apply text-sm text-muted;
}

.settings-actions {
  @apply flex items-center gap-2;
}

.settings-grid {
  @apply flex-1 overflow-y-auto custom-scrollbar p-6;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  align-content: start;
}

.settings-footer {
  @apply flex items-center justify-between p-6 border-t border-border bg-surface-hover;
}

.settings-status {
  @apply flex items-center gap-2;
}

.settings-footer-actions {
  @apply flex items-center gap-2;
}

.reset-confirmation {
  @apply text-center p-6;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .settings-header {
    @apply flex-col gap-4;
  }
  
  .settings-footer {
    @apply flex-col gap-4;
  }
}

@media (max-width: 768px) {
  .turdus-settings-grid {
    @apply p-4;
  }
  
  .settings-header,
  .settings-footer {
    @apply p-4;
  }
  
  .settings-grid {
    @apply p-4;
  }
}
</style>
