<!--
  PlanStep.vue - Individual plan step component
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="plan-step" :class="{ active: isActive, completed: isCompleted }">
    <div class="step-header">
      <div class="step-number">{{ stepNumber }}</div>
      <div class="step-info">
        <h4 class="step-title">{{ step.title }}</h4>
        <p class="step-description">{{ step.description }}</p>
      </div>
      <div class="step-actions">
        <button class="btn-icon" @click="editStep" title="Edit">
          <Icon name="passeriformes-edit" size="sm" />
        </button>
        <button class="btn-icon" @click="deleteStep" title="Delete">
          <Icon name="passeriformes-delete" size="sm" />
        </button>
      </div>
    </div>
    
    <div v-if="step.details" class="step-details">
      <div class="detail-item" v-for="(value, key) in step.details" :key="key">
        <span class="detail-label">{{ formatLabel(key) }}:</span>
        <span class="detail-value">{{ value }}</span>
      </div>
    </div>
    
    <div class="step-status">
      <span class="status-badge" :class="statusClass">
        {{ step.status || 'pending' }}
      </span>
      <span v-if="step.estimatedTime" class="time-estimate">
        ~{{ step.estimatedTime }}
      </span>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import Icon from '../shared/Icon.vue'

export default {
  name: 'PlanStep',
  
  components: {
    Icon
  },
  
  props: {
    step: {
      type: Object,
      required: true
    },
    stepNumber: {
      type: Number,
      required: true
    },
    isActive: {
      type: Boolean,
      default: false
    },
    isCompleted: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['edit', 'delete'],
  
  setup(props, { emit }) {
    const statusClass = computed(() => {
      const status = props.step.status || 'pending'
      return `status-${status}`
    })
    
    const editStep = () => {
      emit('edit', props.step)
    }
    
    const deleteStep = () => {
      emit('delete', props.step)
    }
    
    const formatLabel = (key) => {
      return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    }
    
    return {
      statusClass,
      editStep,
      deleteStep,
      formatLabel
    }
  }
}
</script>

<style scoped>
.plan-step {
  @apply p-4 border border-gray-300 rounded-lg mb-3 transition-all duration-200;
}

.plan-step.active {
  @apply border-blue-500 bg-blue-50;
}

.plan-step.completed {
  @apply border-green-500 bg-green-50;
}

.step-header {
  @apply flex items-start gap-3;
}

.step-number {
  @apply w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold;
}

.plan-step.active .step-number {
  @apply bg-blue-500 text-white;
}

.plan-step.completed .step-number {
  @apply bg-green-500 text-white;
}

.step-info {
  @apply flex-1;
}

.step-title {
  @apply text-lg font-semibold mb-1;
}

.step-description {
  @apply text-gray-600 text-sm;
}

.step-actions {
  @apply flex gap-1;
}

.btn-icon {
  @apply p-1 rounded hover:bg-gray-100 transition-colors;
}

.step-details {
  @apply mt-3 pl-11 space-y-1;
}

.detail-item {
  @apply flex gap-2 text-sm;
}

.detail-label {
  @apply font-medium text-gray-700 min-w-20;
}

.detail-value {
  @apply text-gray-600;
}

.step-status {
  @apply mt-3 pl-11 flex items-center gap-3;
}

.status-badge {
  @apply px-2 py-1 rounded-full text-xs font-medium;
}

.status-pending {
  @apply bg-gray-100 text-gray-700;
}

.status-running {
  @apply bg-blue-100 text-blue-700;
}

.status-completed {
  @apply bg-green-100 text-green-700;
}

.status-failed {
  @apply bg-red-100 text-red-700;
}

.time-estimate {
  @apply text-xs text-gray-500;
}
</style>
