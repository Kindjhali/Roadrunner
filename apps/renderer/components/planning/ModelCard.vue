<!--
  ModelCard.vue - Model selection card component
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div 
    class="model-card" 
    :class="{ selected: isSelected, recommended: model.isRecommended }"
    @click="selectModel"
  >
    <div class="model-header">
      <div class="model-info">
        <h4 class="model-name">{{ model.name }}</h4>
        <p class="model-provider">{{ model.provider }}</p>
      </div>
      <div class="model-status">
        <span v-if="model.isRecommended" class="recommended-badge">
          <Icon name="corvidae-validate" size="xs" />
          Recommended
        </span>
        <span class="status-indicator" :class="statusClass"></span>
      </div>
    </div>
    
    <div class="model-details">
      <div class="model-capabilities">
        <span 
          v-for="capability in model.capabilities" 
          :key="capability"
          class="capability-tag"
        >
          {{ formatCapability(capability) }}
        </span>
      </div>
      
      <div class="model-metrics">
        <div class="metric">
          <span class="metric-label">Performance:</span>
          <div class="metric-bar">
            <div 
              class="metric-fill" 
              :style="{ width: `${model.performanceScore || 0}%` }"
            ></div>
          </div>
          <span class="metric-value">{{ model.performanceScore || 0 }}%</span>
        </div>
        
        <div v-if="model.contextLength" class="metric">
          <span class="metric-label">Context:</span>
          <span class="metric-value">{{ formatContextLength(model.contextLength) }}</span>
        </div>
        
        <div v-if="model.lastUsed" class="metric">
          <span class="metric-label">Last used:</span>
          <span class="metric-value">{{ formatLastUsed(model.lastUsed) }}</span>
        </div>
      </div>
    </div>
    
    <div v-if="model.description" class="model-description">
      {{ model.description }}
    </div>
    
    <div class="model-actions">
      <button 
        class="btn btn-sm btn-primary"
        @click.stop="selectModel"
        :disabled="!model.available"
      >
        {{ isSelected ? 'Selected' : 'Select' }}
      </button>
      
      <button 
        class="btn btn-sm btn-outline"
        @click.stop="showDetails"
      >
        Details
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import Icon from '../shared/Icon.vue'

export default {
  name: 'ModelCard',
  
  components: {
    Icon
  },
  
  props: {
    model: {
      type: Object,
      required: true
    },
    isSelected: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['select', 'show-details'],
  
  setup(props, { emit }) {
    const statusClass = computed(() => {
      if (!props.model.available) return 'status-unavailable'
      if (props.model.isLoading) return 'status-loading'
      return 'status-available'
    })
    
    const selectModel = () => {
      if (props.model.available) {
        emit('select', props.model)
      }
    }
    
    const showDetails = () => {
      emit('show-details', props.model)
    }
    
    const formatCapability = (capability) => {
      return capability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
    
    const formatContextLength = (length) => {
      if (length >= 1000) {
        return `${(length / 1000).toFixed(0)}k tokens`
      }
      return `${length} tokens`
    }
    
    const formatLastUsed = (timestamp) => {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now - date
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`
      return date.toLocaleDateString()
    }
    
    return {
      statusClass,
      selectModel,
      showDetails,
      formatCapability,
      formatContextLength,
      formatLastUsed
    }
  }
}
</script>

<style scoped>
.model-card {
  @apply p-4 border border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md;
}

.model-card.selected {
  @apply border-blue-500 bg-blue-50 shadow-md;
}

.model-card.recommended {
  @apply border-green-400;
}

.model-card:hover {
  @apply border-gray-400;
}

.model-card.selected:hover {
  @apply border-blue-600;
}

.model-header {
  @apply flex justify-between items-start mb-3;
}

.model-info {
  @apply flex-1;
}

.model-name {
  @apply text-lg font-semibold mb-1;
}

.model-provider {
  @apply text-sm text-gray-600 capitalize;
}

.model-status {
  @apply flex items-center gap-2;
}

.recommended-badge {
  @apply flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full;
}

.status-indicator {
  @apply w-3 h-3 rounded-full;
}

.status-available {
  @apply bg-green-500;
}

.status-loading {
  @apply bg-yellow-500 animate-pulse;
}

.status-unavailable {
  @apply bg-red-500;
}

.model-details {
  @apply space-y-3 mb-3;
}

.model-capabilities {
  @apply flex flex-wrap gap-1;
}

.capability-tag {
  @apply px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full;
}

.model-metrics {
  @apply space-y-2;
}

.metric {
  @apply flex items-center gap-2 text-sm;
}

.metric-label {
  @apply font-medium text-gray-700 min-w-20;
}

.metric-bar {
  @apply flex-1 h-2 bg-gray-200 rounded-full overflow-hidden;
}

.metric-fill {
  @apply h-full bg-blue-500 transition-all duration-300;
}

.metric-value {
  @apply text-gray-600 min-w-12 text-right;
}

.model-description {
  @apply text-sm text-gray-600 mb-3 line-clamp-2;
}

.model-actions {
  @apply flex gap-2;
}

.btn {
  @apply px-3 py-1 rounded font-medium transition-colors;
}

.btn-sm {
  @apply text-sm;
}

.btn-primary {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.btn-primary:disabled {
  @apply bg-gray-300 text-gray-500 cursor-not-allowed;
}

.btn-outline {
  @apply border border-gray-300 text-gray-700 hover:bg-gray-50;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
