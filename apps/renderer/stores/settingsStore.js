/**
 * settingsStore.js - Settings state management store
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // State management
  const isLoading = ref(false)
  const lastSaved = ref(null)
  const isDirty = ref(false)
  const lastError = ref(null)
  
  // Settings object
  const settings = reactive({
    // General settings
    general: {
      theme: 'dark', // dark, light, auto
      language: 'en',
      autoSave: true,
      autoSaveInterval: 30, // seconds
      enableNotifications: true,
      enableAnalytics: false,
      enableTelemetry: false,
      maxHistorySize: 1000,
      debugMode: false
    },
    
    // UI settings
    ui: {
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      compactMode: false,
      showLineNumbers: true,
      showMinimap: true,
      wordWrap: true,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      cursorStyle: 'line',
      cursorBlinking: 'blink'
    },
    
    // Model settings
    models: {
      defaultPlanningModel: 'codellama',
      defaultBrainstormingModel: 'codellama',
      defaultExecutionModel: 'codellama',
      defaultConferenceModel: 'codellama',
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      timeout: 30000, // 30 seconds
      retryAttempts: 3
    },
    
    // Advanced settings
    advanced: {
      enableExperimentalFeatures: false,
      enableBetaFeatures: false,
      logLevel: 'info', // debug, info, warn, error
      maxConcurrentRequests: 5,
      requestTimeout: 30000,
      enableCaching: true,
      cacheSize: 100,
      enableCompression: true,
      enableEncryption: false,
      customApiEndpoint: '',
      customHeaders: {}
    },
    
    // Keyboard shortcuts
    shortcuts: {
      save: 'Ctrl+S',
      saveAs: 'Ctrl+Shift+S',
      open: 'Ctrl+O',
      newFile: 'Ctrl+N',
      execute: 'F5',
      debug: 'F9',
      toggleTerminal: 'Ctrl+`',
      toggleSidebar: 'Ctrl+B',
      find: 'Ctrl+F',
      replace: 'Ctrl+H',
      formatDocument: 'Shift+Alt+F',
      commentLine: 'Ctrl+/',
      duplicateLine: 'Shift+Alt+Down',
      deleteLine: 'Ctrl+Shift+K'
    },
    
    // Performance settings
    performance: {
      enableVirtualScrolling: true,
      enableLazyLoading: true,
      maxRenderItems: 1000,
      debounceDelay: 300,
      throttleDelay: 100,
      enableWorkers: true,
      maxWorkers: 4,
      enableGPUAcceleration: false
    },
    
    // Security settings
    security: {
      enableSandbox: true,
      allowUnsafeEval: false,
      allowExternalRequests: false,
      trustedDomains: [],
      enableCSP: true,
      enableCORS: false,
      sessionTimeout: 3600000, // 1 hour
      enableTwoFactor: false
    }
  })
  
  // Model configurations
  const modelConfigurations = ref([])
  
  // Computed properties
  const isAutoSaveEnabled = computed(() => {
    return settings.general.autoSave && settings.general.autoSaveInterval > 0
  })
  
  const isDarkTheme = computed(() => {
    if (settings.general.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return settings.general.theme === 'dark'
  })
  
  const settingsHash = computed(() => {
    return btoa(JSON.stringify(settings)).slice(0, 16)
  })
  
  // Actions
  
  /**
   * Load settings from backend API
   */
  async function loadSettings() {
    try {
      isLoading.value = true
      
      // Just use defaults - no backend calls
      const savedSettings = localStorage.getItem('roadrunner-settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        Object.assign(settings, parsed)
      }
      
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Save settings to backend and localStorage
   */
  async function saveSettings() {
    try {
      isLoading.value = true
      
      // Try to save to backend first
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.saveSettings(settings)
      
      if (response.success) {
        console.log('Settings saved to backend successfully')
      } else {
        console.warn('Failed to save to backend, saving to localStorage only')
      }
      
      // Always save to localStorage as backup
      localStorage.setItem('roadrunner-settings', JSON.stringify(settings))
      
      lastSaved.value = new Date().toISOString()
      isDirty.value = false
      
    } catch (error) {
      lastError.value = error
      console.error('Failed to save settings to backend, using localStorage:', error)
      
      // Fallback to localStorage
      try {
        localStorage.setItem('roadrunner-settings', JSON.stringify(settings))
        lastSaved.value = new Date().toISOString()
        isDirty.value = false
      } catch (localError) {
        console.error('Failed to save settings to localStorage:', localError)
        throw localError
      }
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Load model configurations from backend
   */
  async function loadModelConfigurations() {
    try {
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.getModels()
      
      if (response.success) {
        modelConfigurations.value = response.models || []
      }
      
    } catch (error) {
      console.error('Failed to load model configurations:', error)
      // Use default configurations
      modelConfigurations.value = [
        {
          id: 'codellama',
          name: 'CodeLlama',
          provider: 'ollama',
          category: 'code',
          description: 'Code generation model'
        }
      ]
    }
  }
  
  /**
   * Test connection to backend
   */
  async function testConnection() {
    try {
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.testConnection('ollama')
      
      return response
      
    } catch (error) {
      console.error('Failed to test connection:', error)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Reset settings to defaults
   */
  async function resetSettings() {
    try {
      // Reset all settings to defaults
      Object.assign(settings, {
        general: {
          theme: 'dark',
          language: 'en',
          autoSave: true,
          autoSaveInterval: 30,
          enableNotifications: true,
          enableAnalytics: false,
          enableTelemetry: false,
          maxHistorySize: 1000,
          debugMode: false
        },
        ui: {
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          compactMode: false,
          showLineNumbers: true,
          showMinimap: true,
          wordWrap: true,
          tabSize: 2,
          insertSpaces: true,
          renderWhitespace: 'selection',
          cursorStyle: 'line',
          cursorBlinking: 'blink'
        },
        models: {
          defaultPlanningModel: 'codellama',
          defaultBrainstormingModel: 'codellama',
          defaultExecutionModel: 'codellama',
          defaultConferenceModel: 'codellama',
          maxTokens: 4096,
          temperature: 0.7,
          topP: 0.9,
          frequencyPenalty: 0,
          presencePenalty: 0,
          timeout: 30000,
          retryAttempts: 3
        },
        advanced: {
          enableExperimentalFeatures: false,
          enableBetaFeatures: false,
          logLevel: 'info',
          maxConcurrentRequests: 5,
          requestTimeout: 30000,
          enableCaching: true,
          cacheSize: 100,
          enableCompression: true,
          enableEncryption: false,
          customApiEndpoint: '',
          customHeaders: {}
        },
        shortcuts: {
          save: 'Ctrl+S',
          saveAs: 'Ctrl+Shift+S',
          open: 'Ctrl+O',
          newFile: 'Ctrl+N',
          execute: 'F5',
          debug: 'F9',
          toggleTerminal: 'Ctrl+`',
          toggleSidebar: 'Ctrl+B',
          find: 'Ctrl+F',
          replace: 'Ctrl+H',
          formatDocument: 'Shift+Alt+F',
          commentLine: 'Ctrl+/',
          duplicateLine: 'Shift+Alt+Down',
          deleteLine: 'Ctrl+Shift+K'
        },
        performance: {
          enableVirtualScrolling: true,
          enableLazyLoading: true,
          maxRenderItems: 1000,
          debounceDelay: 300,
          throttleDelay: 100,
          enableWorkers: true,
          maxWorkers: 4,
          enableGPUAcceleration: false
        },
        security: {
          enableSandbox: true,
          allowUnsafeEval: false,
          allowExternalRequests: false,
          trustedDomains: [],
          enableCSP: true,
          enableCORS: false,
          sessionTimeout: 3600000,
          enableTwoFactor: false
        }
      })
      
      isDirty.value = true
      await saveSettings()
      
      console.log('Settings reset to defaults')
      
    } catch (error) {
      lastError.value = error
      console.error('Failed to reset settings:', error)
      throw error
    }
  }
  
  /**
   * Update specific setting
   * 
   * @param {string} section - Settings section
   * @param {string} key - Setting key
   * @param {any} value - New value
   */
  function updateSetting(section, key, value) {
    if (!settings[section]) {
      throw new Error(`Invalid settings section: ${section}`)
    }
    
    if (!(key in settings[section])) {
      throw new Error(`Invalid setting key: ${key} in section ${section}`)
    }
    
    settings[section][key] = value
    isDirty.value = true
    
    console.log(`Setting updated: ${section}.${key} = ${value}`)
  }
  
  /**
   * Update multiple settings
   * 
   * @param {Object} newSettings - Settings to update
   */
  function updateSettings(newSettings) {
    Object.assign(settings, newSettings)
    isDirty.value = true
  }
  
  /**
   * Export settings
   * 
   * @param {string} format - Export format (json)
   */
  function exportSettings(format = 'json') {
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      settings
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
  
  /**
   * Import settings
   * 
   * @param {string} data - Settings data
   * @param {string} format - Data format (json)
   */
  async function importSettings(data, format = 'json') {
    try {
      let parsedData
      
      switch (format) {
        case 'json':
          parsedData = JSON.parse(data)
          break
        
        default:
          throw new Error(`Unsupported import format: ${format}`)
      }
      
      if (parsedData.settings) {
        updateSettings(parsedData.settings)
        await saveSettings()
        console.log('Settings imported successfully')
      }
      
    } catch (error) {
      lastError.value = error
      console.error('Failed to import settings:', error)
      throw error
    }
  }
  
  /**
   * Validate settings
   */
  function validateSettings() {
    const errors = []
    
    // Validate general settings
    if (settings.general.autoSaveInterval < 1 || settings.general.autoSaveInterval > 3600) {
      errors.push('Auto-save interval must be between 1 and 3600 seconds')
    }
    
    if (settings.general.maxHistorySize < 10 || settings.general.maxHistorySize > 10000) {
      errors.push('Max history size must be between 10 and 10000')
    }
    
    // Validate UI settings
    if (settings.ui.fontSize < 8 || settings.ui.fontSize > 72) {
      errors.push('Font size must be between 8 and 72')
    }
    
    if (settings.ui.tabSize < 1 || settings.ui.tabSize > 8) {
      errors.push('Tab size must be between 1 and 8')
    }
    
    // Validate model settings
    if (settings.models.maxTokens < 1 || settings.models.maxTokens > 32768) {
      errors.push('Max tokens must be between 1 and 32768')
    }
    
    if (settings.models.temperature < 0 || settings.models.temperature > 2) {
      errors.push('Temperature must be between 0 and 2')
    }
    
    return errors
  }
  
  /**
   * Get setting value
   * 
   * @param {string} path - Setting path (e.g., 'general.theme')
   */
  function getSetting(path) {
    const parts = path.split('.')
    let value = settings
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        return undefined
      }
    }
    
    return value
  }
  
  // Watch for changes to mark as dirty
  watch(settings, () => {
    isDirty.value = true
  }, { deep: true })
  
  // Auto-save functionality
  let autoSaveTimer = null
  
  watch(
    () => [isAutoSaveEnabled.value, isDirty.value],
    ([enabled, dirty]) => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
      }
      
      if (enabled && dirty) {
        autoSaveTimer = setTimeout(() => {
          saveSettings()
        }, settings.general.autoSaveInterval * 1000)
      }
    }
  )
  
  return {
    // State
    isLoading,
    lastSaved,
    isDirty,
    lastError,
    settings,
    modelConfigurations,
    
    // Computed
    isAutoSaveEnabled,
    isDarkTheme,
    settingsHash,
    
    // Actions
    loadSettings,
    saveSettings,
    loadModelConfigurations,
    testConnection,
    resetSettings,
    updateSetting,
    updateSettings,
    exportSettings,
    importSettings,
    validateSettings,
    getSetting
  }
})

export default useSettingsStore
