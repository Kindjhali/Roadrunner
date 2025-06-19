<template>
  <div class="model-details">
    <div v-if="!model" class="no-model">
      <Icon name="corvidae-code" size="lg" class="text-gray-400" />
      <p class="text-gray-500">Select a model to view details</p>
    </div>
    
    <div v-else class="model-info">
      <!-- Model Header -->
      <div class="model-header">
        <div class="model-icon">
          <Icon :name="getModelIcon(model)" size="lg" />
        </div>
        <div class="model-title">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ model.name }}
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ model.provider }} • {{ model.type }}
          </p>
        </div>
        <div class="model-status">
          <span 
            :class="[
              'px-2 py-1 text-xs rounded-full',
              model.available 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            ]"
          >
            {{ model.available ? 'Available' : 'Unavailable' }}
          </span>
        </div>
      </div>

      <!-- Model Description -->
      <div class="model-description">
        <p class="text-gray-700 dark:text-gray-300">
          {{ model.description }}
        </p>
      </div>

      <!-- Model Specifications -->
      <div class="model-specs">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Specifications
        </h4>
        <div class="specs-grid">
          <div class="spec-item">
            <span class="spec-label">Context Length</span>
            <span class="spec-value">{{ formatContextLength(model.contextLength) }}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Max Tokens</span>
            <span class="spec-value">{{ formatNumber(model.maxTokens) }}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Cost per 1K tokens</span>
            <span class="spec-value">${{ model.costPer1K || 'N/A' }}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Speed</span>
            <span class="spec-value">{{ model.speed || 'Unknown' }}</span>
          </div>
        </div>
      </div>

      <!-- Model Capabilities -->
      <div class="model-capabilities">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Capabilities
        </h4>
        <div class="capabilities-list">
          <div 
            v-for="capability in model.capabilities" 
            :key="capability"
            class="capability-tag"
          >
            {{ capability }}
          </div>
        </div>
      </div>

      <!-- Model Configuration -->
      <div class="model-config">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Configuration
        </h4>
        <div class="config-options">
          <div class="config-item">
            <label class="config-label">Temperature</label>
            <input 
              v-model.number="localConfig.temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              class="config-slider"
              @input="updateConfig"
            />
            <span class="config-value">{{ localConfig.temperature }}</span>
          </div>
          
          <div class="config-item">
            <label class="config-label">Max Tokens</label>
            <input 
              v-model.number="localConfig.maxTokens"
              type="number"
              min="1"
              :max="model.maxTokens"
              class="config-input"
              @input="updateConfig"
            />
          </div>
          
          <div class="config-item">
            <label class="config-label">Top P</label>
            <input 
              v-model.number="localConfig.topP"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="config-slider"
              @input="updateConfig"
            />
            <span class="config-value">{{ localConfig.topP }}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="model-actions">
        <BaseButton
          variant="primary"
          icon="corvidae-code"
          @click="selectModel"
          :disabled="!model.available"
        >
          Select Model
        </BaseButton>
        
        <BaseButton
          variant="outline"
          icon="piciformes-settings"
          @click="openAdvancedConfig"
        >
          Advanced Config
        </BaseButton>
        
        <BaseButton
          variant="ghost"
          icon="passeriformes-test"
          @click="testModel"
          :disabled="!model.available"
        >
          Test Model
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, watch } from 'vue'
import Icon from '../shared/Icon.vue'
import BaseButton from '../shared/BaseButton.vue'

export default {
  name: 'ModelDetails',
  
  components: {
    Icon,
    BaseButton
  },
  
  props: {
    model: {
      type: Object,
      default: null
    },
    config: {
      type: Object,
      default: () => ({})
    }
  },
  
  emits: ['select', 'config-change', 'test'],
  
  setup(props, { emit }) {
    // Local configuration state
    const localConfig = reactive({
      temperature: props.config.temperature || 0.7,
      maxTokens: props.config.maxTokens || 2048,
      topP: props.config.topP || 0.9
    })
    
    // Watch for prop changes
    watch(() => props.config, (newConfig) => {
      Object.assign(localConfig, {
        temperature: newConfig.temperature || 0.7,
        maxTokens: newConfig.maxTokens || 2048,
        topP: newConfig.topP || 0.9
      })
    }, { deep: true })
    
    // Helper functions
    const getModelIcon = (model) => {
      const iconMap = {
        'openai': 'corvidae-code',
        'anthropic': 'corvidae-brain',
        'local': 'piciformes-server',
        'huggingface': 'tyrannidae-grid'
      }
      return iconMap[model.provider?.toLowerCase()] || 'corvidae-code'
    }
    
    const formatContextLength = (length) => {
      if (length >= 1000000) {
        return `${(length / 1000000).toFixed(1)}M`
      } else if (length >= 1000) {
        return `${(length / 1000).toFixed(0)}K`
      }
      return length.toString()
    }
    
    const formatNumber = (num) => {
      return new Intl.NumberFormat().format(num)
    }
    
    // Event handlers
    const updateConfig = () => {
      emit('config-change', { ...localConfig })
    }
    
    const selectModel = () => {
      emit('select', props.model)
    }
    
    const openAdvancedConfig = () => {
      // Open advanced configuration modal
      console.log('Opening advanced config for:', props.model.name)
    }
    
    const testModel = () => {
      emit('test', props.model)
    }
    
    return {
      localConfig,
      getModelIcon,
      formatContextLength,
      formatNumber,
      updateConfig,
      selectModel,
      openAdvancedConfig,
      testModel
    }
  }
}
</script>

<style scoped>
.model-details {
  @apply h-full flex flex-col;
}

.no-model {
  @apply flex-1 flex flex-col items-center justify-center space-y-3;
}

.model-info {
  @apply space-y-6;
}

.model-header {
  @apply flex items-start gap-4;
}

.model-icon {
  @apply flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center;
}

.model-title {
  @apply flex-1;
}

.model-status {
  @apply flex-shrink-0;
}

.model-description {
  @apply text-sm;
}

.model-specs {
  @apply space-y-3;
}

.specs-grid {
  @apply grid grid-cols-2 gap-3;
}

.spec-item {
  @apply flex flex-col space-y-1;
}

.spec-label {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.spec-value {
  @apply text-sm font-medium text-gray-900 dark:text-white;
}

.model-capabilities {
  @apply space-y-3;
}

.capabilities-list {
  @apply flex flex-wrap gap-2;
}

.capability-tag {
  @apply px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded;
}

.model-config {
  @apply space-y-3;
}

.config-options {
  @apply space-y-4;
}

.config-item {
  @apply space-y-2;
}

.config-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.config-slider {
  @apply w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer;
}

.config-slider::-webkit-slider-thumb {
  @apply appearance-none w-4 h-4 bg-blue-600 rounded-full cursor-pointer;
}

.config-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.config-value {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.model-actions {
  @apply flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700;
}
</style>
