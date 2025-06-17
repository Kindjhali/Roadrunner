<template>
  <SettingsSection
    title="Performance Settings"
    description="Configure performance and optimization settings"
    icon="analyze"
  >
    <div class="space-y-6">
      <!-- Memory Settings -->
      <div class="setting-group">
        <label class="setting-label">Memory Limit (MB)</label>
        <input
          v-model.number="memoryLimit"
          type="number"
          min="512"
          max="8192"
          step="256"
          class="setting-input"
        />
        <p class="setting-description">
          Maximum memory allocation for the application
        </p>
      </div>

      <!-- Processing Settings -->
      <div class="setting-group">
        <label class="setting-label">Max Concurrent Tasks</label>
        <input
          v-model.number="maxConcurrentTasks"
          type="number"
          min="1"
          max="16"
          class="setting-input"
        />
        <p class="setting-description">
          Maximum number of tasks that can run simultaneously
        </p>
      </div>

      <!-- Cache Settings -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="enableCache"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Enable Caching
        </label>
        <p class="setting-description">
          Cache frequently used data to improve performance
        </p>
      </div>

      <div v-if="enableCache" class="setting-group">
        <label class="setting-label">Cache Size (MB)</label>
        <input
          v-model.number="cacheSize"
          type="number"
          min="50"
          max="1024"
          step="50"
          class="setting-input"
        />
      </div>

      <!-- Background Processing -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="backgroundProcessing"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Enable Background Processing
        </label>
        <p class="setting-description">
          Allow tasks to continue running in the background
        </p>
      </div>

      <!-- Auto-cleanup -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="autoCleanup"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Auto Cleanup
        </label>
        <p class="setting-description">
          Automatically clean up temporary files and unused resources
        </p>
      </div>

      <!-- Optimization Level -->
      <div class="setting-group">
        <label class="setting-label">Optimization Level</label>
        <select v-model="optimizationLevel" class="setting-select">
          <option value="low">Low (Faster startup)</option>
          <option value="medium">Medium (Balanced)</option>
          <option value="high">High (Better performance)</option>
        </select>
      </div>

      <!-- Debug Mode -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="debugMode"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Debug Mode
        </label>
        <p class="setting-description">
          Enable detailed logging and performance monitoring
        </p>
      </div>

      <!-- Performance Monitoring -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="performanceMonitoring"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Performance Monitoring
        </label>
        <p class="setting-description">
          Track and display performance metrics
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
  name: 'PerformanceSettings',
  components: {
    SettingsSection
  },
  setup() {
    const settingsStore = useSettingsStore()

    // Performance settings
    const memoryLimit = ref(settingsStore.performance.memoryLimit || 2048)
    const maxConcurrentTasks = ref(settingsStore.performance.maxConcurrentTasks || 4)
    const enableCache = ref(settingsStore.performance.enableCache || true)
    const cacheSize = ref(settingsStore.performance.cacheSize || 256)
    const backgroundProcessing = ref(settingsStore.performance.backgroundProcessing || true)
    const autoCleanup = ref(settingsStore.performance.autoCleanup || true)
    const optimizationLevel = ref(settingsStore.performance.optimizationLevel || 'medium')
    const debugMode = ref(settingsStore.performance.debugMode || false)
    const performanceMonitoring = ref(settingsStore.performance.performanceMonitoring || false)

    // Watch for changes and update store
    watch([
      memoryLimit, maxConcurrentTasks, enableCache, cacheSize,
      backgroundProcessing, autoCleanup, optimizationLevel,
      debugMode, performanceMonitoring
    ], () => {
      settingsStore.updatePerformanceSettings({
        memoryLimit: memoryLimit.value,
        maxConcurrentTasks: maxConcurrentTasks.value,
        enableCache: enableCache.value,
        cacheSize: cacheSize.value,
        backgroundProcessing: backgroundProcessing.value,
        autoCleanup: autoCleanup.value,
        optimizationLevel: optimizationLevel.value,
        debugMode: debugMode.value,
        performanceMonitoring: performanceMonitoring.value
      })
    })

    return {
      memoryLimit,
      maxConcurrentTasks,
      enableCache,
      cacheSize,
      backgroundProcessing,
      autoCleanup,
      optimizationLevel,
      debugMode,
      performanceMonitoring
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
