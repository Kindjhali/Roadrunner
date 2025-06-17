<template>
  <SettingsSection
    title="Advanced Features"
    description="Configure advanced features and experimental settings"
    icon="tools"
  >
    <div class="space-y-6">
      <!-- Experimental Features -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="experimentalFeatures"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Enable Experimental Features
        </label>
        <p class="setting-description">
          Enable experimental features that may be unstable
        </p>
      </div>

      <!-- Advanced Logging -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="advancedLogging"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Advanced Logging
        </label>
        <p class="setting-description">
          Enable detailed logging for debugging purposes
        </p>
      </div>

      <!-- Developer Mode -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="developerMode"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Developer Mode
        </label>
        <p class="setting-description">
          Enable developer tools and debugging features
        </p>
      </div>

      <!-- Custom Scripts -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="customScripts"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Allow Custom Scripts
        </label>
        <p class="setting-description">
          Allow execution of custom user scripts
        </p>
      </div>

      <!-- Beta Features -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="betaFeatures"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Beta Features
        </label>
        <p class="setting-description">
          Enable beta features that are in testing
        </p>
      </div>

      <!-- Advanced AI Features -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="advancedAI"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Advanced AI Features
        </label>
        <p class="setting-description">
          Enable advanced AI capabilities and models
        </p>
      </div>

      <!-- Memory Optimization -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="memoryOptimization"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Memory Optimization
        </label>
        <p class="setting-description">
          Enable aggressive memory optimization techniques
        </p>
      </div>

      <!-- Parallel Processing -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="parallelProcessing"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Parallel Processing
        </label>
        <p class="setting-description">
          Enable parallel processing for better performance
        </p>
      </div>

      <!-- Advanced Caching -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="advancedCaching"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Advanced Caching
        </label>
        <p class="setting-description">
          Enable advanced caching strategies
        </p>
      </div>

      <!-- Telemetry -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="telemetry"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Send Telemetry Data
        </label>
        <p class="setting-description">
          Send anonymous usage data to help improve the application
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
  name: 'AdvancedFeatures',
  components: {
    SettingsSection
  },
  setup() {
    const settingsStore = useSettingsStore()

    // Advanced feature settings
    const experimentalFeatures = ref(settingsStore.advanced.experimentalFeatures || false)
    const advancedLogging = ref(settingsStore.advanced.advancedLogging || false)
    const developerMode = ref(settingsStore.advanced.developerMode || false)
    const customScripts = ref(settingsStore.advanced.customScripts || false)
    const betaFeatures = ref(settingsStore.advanced.betaFeatures || false)
    const advancedAI = ref(settingsStore.advanced.advancedAI || false)
    const memoryOptimization = ref(settingsStore.advanced.memoryOptimization || false)
    const parallelProcessing = ref(settingsStore.advanced.parallelProcessing || false)
    const advancedCaching = ref(settingsStore.advanced.advancedCaching || false)
    const telemetry = ref(settingsStore.advanced.telemetry || false)

    // Watch for changes and update store
    watch([
      experimentalFeatures, advancedLogging, developerMode, customScripts,
      betaFeatures, advancedAI, memoryOptimization, parallelProcessing,
      advancedCaching, telemetry
    ], () => {
      settingsStore.updateAdvancedSettings({
        experimentalFeatures: experimentalFeatures.value,
        advancedLogging: advancedLogging.value,
        developerMode: developerMode.value,
        customScripts: customScripts.value,
        betaFeatures: betaFeatures.value,
        advancedAI: advancedAI.value,
        memoryOptimization: memoryOptimization.value,
        parallelProcessing: parallelProcessing.value,
        advancedCaching: advancedCaching.value,
        telemetry: telemetry.value
      })
    })

    return {
      experimentalFeatures,
      advancedLogging,
      developerMode,
      customScripts,
      betaFeatures,
      advancedAI,
      memoryOptimization,
      parallelProcessing,
      advancedCaching,
      telemetry
    }
  }
}
</script>

<style scoped>
.setting-group {
  @apply space-y-2;
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
