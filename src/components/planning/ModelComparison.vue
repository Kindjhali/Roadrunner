<template>
  <div class="model-comparison">
    <div class="comparison-header">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        Model Comparison
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Compare selected models side by side
      </p>
    </div>

    <div v-if="models.length === 0" class="empty-state">
      <Icon name="corvidae-code" size="lg" class="text-gray-400" />
      <p class="text-gray-500">Select models to compare</p>
    </div>

    <div v-else class="comparison-grid">
      <div 
        v-for="model in models" 
        :key="model.id"
        class="model-comparison-card"
      >
        <!-- Model Header -->
        <div class="model-header">
          <div class="model-info">
            <h4 class="font-medium text-gray-900 dark:text-white">
              {{ model.name }}
            </h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ model.provider }}
            </p>
          </div>
          <button
            @click="removeModel(model.id)"
            class="remove-button"
          >
            <Icon name="fi-ss-cross" size="sm" />
          </button>
        </div>

        <!-- Model Specs -->
        <div class="model-specs">
          <div class="spec-row">
            <span class="spec-label">Context Length</span>
            <span class="spec-value">{{ formatContextLength(model.contextLength) }}</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Max Tokens</span>
            <span class="spec-value">{{ formatNumber(model.maxTokens) }}</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Cost/1K tokens</span>
            <span class="spec-value">${{ model.costPer1K || 'N/A' }}</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Speed</span>
            <span class="spec-value">{{ model.speed || 'Unknown' }}</span>
          </div>
        </div>

        <!-- Model Capabilities -->
        <div class="model-capabilities">
          <h5 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Capabilities
          </h5>
          <div class="capabilities-tags">
            <span 
              v-for="capability in model.capabilities" 
              :key="capability"
              class="capability-tag"
            >
              {{ capability }}
            </span>
          </div>
        </div>

        <!-- Model Rating -->
        <div class="model-rating">
          <div class="rating-item">
            <span class="rating-label">Performance</span>
            <div class="rating-bar">
              <div 
                class="rating-fill"
                :style="{ width: `${model.performance || 0}%` }"
              ></div>
            </div>
          </div>
          <div class="rating-item">
            <span class="rating-label">Cost Efficiency</span>
            <div class="rating-bar">
              <div 
                class="rating-fill"
                :style="{ width: `${model.costEfficiency || 0}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div class="model-actions">
          <BaseButton
            variant="primary"
            size="sm"
            @click="selectModel(model)"
            :disabled="!model.available"
          >
            Select
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Comparison Actions -->
    <div v-if="models.length > 0" class="comparison-actions">
      <BaseButton
        variant="outline"
        icon="turdus-export"
        @click="exportComparison"
      >
        Export Comparison
      </BaseButton>
      
      <BaseButton
        variant="outline"
        icon="refresh"
        @click="clearComparison"
      >
        Clear All
      </BaseButton>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import Icon from '../shared/Icon.vue'
import BaseButton from '../shared/BaseButton.vue'

export default {
  name: 'ModelComparison',
  
  components: {
    Icon,
    BaseButton
  },
  
  props: {
    models: {
      type: Array,
      default: () => []
    }
  },
  
  emits: ['remove-model', 'select-model', 'clear-all'],
  
  setup(props, { emit }) {
    // Helper functions
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
    const removeModel = (modelId) => {
      emit('remove-model', modelId)
    }
    
    const selectModel = (model) => {
      emit('select-model', model)
    }
    
    const clearComparison = () => {
      emit('clear-all')
    }
    
    const exportComparison = () => {
      const comparisonData = {
        models: props.models,
        timestamp: new Date().toISOString(),
        comparison: 'model-comparison'
      }
      
      const blob = new Blob([JSON.stringify(comparisonData, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `model-comparison-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      
      URL.revokeObjectURL(url)
    }
    
    return {
      formatContextLength,
      formatNumber,
      removeModel,
      selectModel,
      clearComparison,
      exportComparison
    }
  }
}
</script>

<style scoped>
.model-comparison {
  @apply space-y-6;
}

.comparison-header {
  @apply space-y-1;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-12 space-y-3;
}

.comparison-grid {
  @apply grid gap-4 md:grid-cols-2 lg:grid-cols-3;
}

.model-comparison-card {
  @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4;
}

.model-header {
  @apply flex items-start justify-between;
}

.model-info {
  @apply flex-1;
}

.remove-button {
  @apply p-1 text-gray-400 hover:text-red-500 transition-colors;
}

.model-specs {
  @apply space-y-2;
}

.spec-row {
  @apply flex justify-between items-center;
}

.spec-label {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.spec-value {
  @apply text-sm font-medium text-gray-900 dark:text-white;
}

.model-capabilities {
  @apply space-y-2;
}

.capabilities-tags {
  @apply flex flex-wrap gap-1;
}

.capability-tag {
  @apply px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded;
}

.model-rating {
  @apply space-y-2;
}

.rating-item {
  @apply space-y-1;
}

.rating-label {
  @apply text-xs text-gray-600 dark:text-gray-400;
}

.rating-bar {
  @apply w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden;
}

.rating-fill {
  @apply h-full bg-blue-500 transition-all duration-300;
}

.model-actions {
  @apply pt-2 border-t border-gray-200 dark:border-gray-700;
}

.comparison-actions {
  @apply flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700;
}
</style>
