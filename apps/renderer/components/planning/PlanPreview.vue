<template>
  <div class="plan-preview">
    <div class="preview-header">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        Plan Preview
      </h3>
      <div class="header-actions">
        <BaseButton
          variant="outline"
          size="sm"
          icon="fi-ss-refresh"
          @click="refreshPreview"
        >
          Refresh
        </BaseButton>
        <BaseButton
          variant="outline"
          size="sm"
          icon="turdus-export"
          @click="exportPlan"
        >
          Export
        </BaseButton>
      </div>
    </div>

    <div v-if="!plan || plan.steps.length === 0" class="empty-state">
      <Icon name="corvidae-code" size="lg" class="text-gray-400" />
      <p class="text-gray-500">No plan to preview</p>
      <p class="text-sm text-gray-400">Create steps in the plan builder to see a preview</p>
    </div>

    <div v-else class="preview-content">
      <!-- Plan Summary -->
      <div class="plan-summary">
        <div class="summary-item">
          <span class="label">Total Steps:</span>
          <span class="value">{{ plan.steps.length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Estimated Time:</span>
          <span class="value">{{ estimatedTime }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Complexity:</span>
          <span class="value" :class="complexityClass">{{ complexity }}</span>
        </div>
      </div>

      <!-- Plan Steps -->
      <div class="steps-preview">
        <h4 class="section-title">Execution Steps</h4>
        <div class="steps-list">
          <div
            v-for="(step, index) in plan.steps"
            :key="step.id"
            class="step-preview-item"
            :class="getStepStatusClass(step)"
          >
            <div class="step-number">{{ index + 1 }}</div>
            <div class="step-content">
              <div class="step-header">
                <h5 class="step-name">{{ step.name || `Step ${index + 1}` }}</h5>
                <div class="step-badges">
                  <span class="step-type-badge" :class="getTypeBadgeClass(step.type)">
                    {{ step.type || 'code' }}
                  </span>
                  <span v-if="step.async" class="async-badge">async</span>
                  <span v-if="step.optional" class="optional-badge">optional</span>
                </div>
              </div>
              <p v-if="step.description" class="step-description">
                {{ step.description }}
              </p>
              <div v-if="step.outputPath" class="step-output">
                <Icon name="fi-ss-folder" size="sm" class="text-gray-400" />
                <span class="output-path">{{ step.outputPath }}</span>
              </div>
              <div v-if="step.dependencies && step.dependencies.length > 0" class="step-dependencies">
                <Icon name="fi-ss-link" size="sm" class="text-gray-400" />
                <span class="dependencies-text">
                  Depends on: {{ step.dependencies.join(', ') }}
                </span>
              </div>
            </div>
            <div class="step-actions">
              <button
                @click="editStep(step)"
                class="action-button"
                title="Edit step"
              >
                <Icon name="fi-ss-edit" size="sm" />
              </button>
              <button
                @click="duplicateStep(step)"
                class="action-button"
                title="Duplicate step"
              >
                <Icon name="fi-ss-copy" size="sm" />
              </button>
              <button
                @click="deleteStep(step.id)"
                class="action-button text-red-500 hover:text-red-600"
                title="Delete step"
              >
                <Icon name="fi-ss-trash" size="sm" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Plan Validation -->
      <div class="plan-validation">
        <h4 class="section-title">Validation Results</h4>
        <div class="validation-results">
          <div
            v-for="result in validationResults"
            :key="result.id"
            class="validation-item"
            :class="getValidationClass(result.type)"
          >
            <Icon
              :name="getValidationIcon(result.type)"
              size="sm"
              :class="getValidationIconClass(result.type)"
            />
            <span class="validation-message">{{ result.message }}</span>
          </div>
        </div>
      </div>

      <!-- Generated Code Preview -->
      <div v-if="showCodePreview" class="code-preview">
        <h4 class="section-title">Generated Code Preview</h4>
        <div class="code-container">
          <pre class="code-block"><code>{{ generatedCode }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'
import Icon from '../shared/Icon.vue'
import BaseButton from '../shared/BaseButton.vue'

export default {
  name: 'PlanPreview',
  
  components: {
    Icon,
    BaseButton
  },
  
  props: {
    plan: {
      type: Object,
      default: null
    },
    showCodePreview: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['edit-step', 'duplicate-step', 'delete-step', 'export-plan'],
  
  setup(props, { emit }) {
    const generatedCode = ref('')
    const validationResults = ref([])
    
    // Computed properties
    const estimatedTime = computed(() => {
      if (!props.plan || !props.plan.steps.length) return '0 min'
      
      const totalMinutes = props.plan.steps.reduce((total, step) => {
        const stepTime = step.estimatedTime || 5 // Default 5 minutes per step
        return total + stepTime
      }, 0)
      
      if (totalMinutes < 60) {
        return `${totalMinutes} min`
      } else {
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        return `${hours}h ${minutes}m`
      }
    })
    
    const complexity = computed(() => {
      if (!props.plan || !props.plan.steps.length) return 'Simple'
      
      const stepCount = props.plan.steps.length
      const hasAsyncSteps = props.plan.steps.some(step => step.async)
      const hasDependencies = props.plan.steps.some(step => step.dependencies?.length > 0)
      
      if (stepCount > 10 || (hasAsyncSteps && hasDependencies)) {
        return 'Complex'
      } else if (stepCount > 5 || hasAsyncSteps || hasDependencies) {
        return 'Moderate'
      } else {
        return 'Simple'
      }
    })
    
    const complexityClass = computed(() => {
      switch (complexity.value) {
        case 'Complex': return 'text-red-600'
        case 'Moderate': return 'text-yellow-600'
        default: return 'text-green-600'
      }
    })
    
    // Methods
    const getStepStatusClass = (step) => {
      if (step.status === 'completed') return 'step-completed'
      if (step.status === 'running') return 'step-running'
      if (step.status === 'error') return 'step-error'
      return 'step-pending'
    }
    
    const getTypeBadgeClass = (type) => {
      switch (type) {
        case 'code': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        case 'file': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        case 'api': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
        case 'validation': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      }
    }
    
    const getValidationClass = (type) => {
      switch (type) {
        case 'error': return 'validation-error'
        case 'warning': return 'validation-warning'
        case 'info': return 'validation-info'
        default: return 'validation-success'
      }
    }
    
    const getValidationIcon = (type) => {
      switch (type) {
        case 'error': return 'fi-ss-cross-circle'
        case 'warning': return 'fi-ss-exclamation'
        case 'info': return 'fi-ss-info'
        default: return 'fi-ss-check'
      }
    }
    
    const getValidationIconClass = (type) => {
      switch (type) {
        case 'error': return 'text-red-500'
        case 'warning': return 'text-yellow-500'
        case 'info': return 'text-blue-500'
        default: return 'text-green-500'
      }
    }
    
    const validatePlan = () => {
      if (!props.plan || !props.plan.steps.length) {
        validationResults.value = []
        return
      }
      
      const results = []
      
      // Check for circular dependencies
      const stepIds = props.plan.steps.map(step => step.id)
      props.plan.steps.forEach(step => {
        if (step.dependencies) {
          step.dependencies.forEach(dep => {
            if (!stepIds.includes(dep)) {
              results.push({
                id: `missing-dep-${step.id}`,
                type: 'error',
                message: `Step "${step.name}" depends on missing step "${dep}"`
              })
            }
          })
        }
      })
      
      // Check for output path conflicts
      const outputPaths = new Set()
      props.plan.steps.forEach(step => {
        if (step.outputPath) {
          if (outputPaths.has(step.outputPath)) {
            results.push({
              id: `path-conflict-${step.id}`,
              type: 'warning',
              message: `Multiple steps write to "${step.outputPath}"`
            })
          } else {
            outputPaths.add(step.outputPath)
          }
        }
      })
      
      // Success message if no issues
      if (results.length === 0) {
        results.push({
          id: 'validation-success',
          type: 'success',
          message: 'Plan validation passed successfully'
        })
      }
      
      validationResults.value = results
    }
    
    const refreshPreview = () => {
      validatePlan()
      if (props.showCodePreview) {
        generateCodePreview()
      }
    }
    
    const generateCodePreview = () => {
      // Simple code generation preview
      if (!props.plan || !props.plan.steps.length) {
        generatedCode.value = ''
        return
      }
      
      const codeLines = [
        '// Generated Plan Execution Code',
        '// This is a preview of the generated execution plan',
        '',
        'async function executePlan() {',
        '  console.log("Starting plan execution...");',
        ''
      ]
      
      props.plan.steps.forEach((step, index) => {
        codeLines.push(`  // Step ${index + 1}: ${step.name || 'Unnamed Step'}`)
        if (step.description) {
          codeLines.push(`  // ${step.description}`)
        }
        
        if (step.async) {
          codeLines.push(`  await executeStep${index + 1}();`)
        } else {
          codeLines.push(`  executeStep${index + 1}();`)
        }
        codeLines.push('')
      })
      
      codeLines.push('  console.log("Plan execution completed!");')
      codeLines.push('}')
      
      generatedCode.value = codeLines.join('\n')
    }
    
    const editStep = (step) => {
      emit('edit-step', step)
    }
    
    const duplicateStep = (step) => {
      emit('duplicate-step', step)
    }
    
    const deleteStep = (stepId) => {
      emit('delete-step', stepId)
    }
    
    const exportPlan = () => {
      emit('export-plan', props.plan)
    }
    
    // Watch for plan changes
    watch(() => props.plan, () => {
      refreshPreview()
    }, { deep: true, immediate: true })
    
    return {
      generatedCode,
      validationResults,
      estimatedTime,
      complexity,
      complexityClass,
      getStepStatusClass,
      getTypeBadgeClass,
      getValidationClass,
      getValidationIcon,
      getValidationIconClass,
      refreshPreview,
      editStep,
      duplicateStep,
      deleteStep,
      exportPlan
    }
  }
}
</script>

<style scoped>
.plan-preview {
  @apply h-full flex flex-col;
}

.preview-header {
  @apply flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700;
}

.header-actions {
  @apply flex gap-2;
}

.empty-state {
  @apply flex-1 flex flex-col items-center justify-center space-y-3 p-8;
}

.preview-content {
  @apply flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6;
}

.plan-summary {
  @apply grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg;
}

.summary-item {
  @apply text-center;
}

.label {
  @apply block text-sm text-gray-600 dark:text-gray-400;
}

.value {
  @apply block text-lg font-semibold text-gray-900 dark:text-white;
}

.section-title {
  @apply text-sm font-medium text-gray-900 dark:text-white mb-3;
}

.steps-list {
  @apply space-y-3;
}

.step-preview-item {
  @apply flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg;
  @apply transition-colors duration-200;
}

.step-preview-item:hover {
  @apply bg-gray-50 dark:bg-gray-800;
}

.step-number {
  @apply flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200;
  @apply rounded-full flex items-center justify-center text-sm font-medium;
}

.step-content {
  @apply flex-1 space-y-2;
}

.step-header {
  @apply flex items-start justify-between;
}

.step-name {
  @apply font-medium text-gray-900 dark:text-white;
}

.step-badges {
  @apply flex gap-2;
}

.step-type-badge,
.async-badge,
.optional-badge {
  @apply px-2 py-1 text-xs rounded;
}

.async-badge {
  @apply bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200;
}

.optional-badge {
  @apply bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200;
}

.step-description {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.step-output,
.step-dependencies {
  @apply flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400;
}

.output-path,
.dependencies-text {
  @apply font-mono text-xs;
}

.step-actions {
  @apply flex gap-1;
}

.action-button {
  @apply p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors;
}

.validation-results {
  @apply space-y-2;
}

.validation-item {
  @apply flex items-center gap-2 p-2 rounded;
}

.validation-error {
  @apply bg-red-50 dark:bg-red-900/20;
}

.validation-warning {
  @apply bg-yellow-50 dark:bg-yellow-900/20;
}

.validation-info {
  @apply bg-blue-50 dark:bg-blue-900/20;
}

.validation-success {
  @apply bg-green-50 dark:bg-green-900/20;
}

.validation-message {
  @apply text-sm;
}

.code-container {
  @apply bg-gray-900 rounded-lg p-4 overflow-x-auto;
}

.code-block {
  @apply text-green-400 font-mono text-sm whitespace-pre;
}

.step-completed .step-number {
  @apply bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200;
}

.step-running .step-number {
  @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200;
}

.step-error .step-number {
  @apply bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200;
}

.step-pending .step-number {
  @apply bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200;
}
</style>
