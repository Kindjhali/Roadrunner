<!--
  SimplePlanBuilder.vue - Simple working plan builder
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic connects to backend APIs
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="simple-plan-builder">
    <!-- Header -->
    <div class="plan-builder-header">
      <h3 class="text-lg font-semibold text-primary">Plan Builder</h3>
      <p class="text-sm text-muted">Create and execute AI-powered plans</p>
    </div>

    <!-- Plan Creation Form -->
    <div class="plan-form">
      <div class="form-group">
        <label class="form-label">Plan Name</label>
        <input
          v-model="planName"
          type="text"
          placeholder="Enter plan name..."
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label class="form-label">Plan Description</label>
        <textarea
          v-model="planDescription"
          placeholder="Describe what you want to accomplish..."
          rows="4"
          class="form-textarea"
        />
      </div>

      <div class="form-actions">
        <button
          @click="generatePlan"
          :disabled="!planDescription.trim() || isGenerating"
          class="btn-primary"
        >
          {{ isGenerating ? 'Generating...' : 'Generate Plan' }}
        </button>

        <button
          v-if="currentPlan"
          @click="executePlan"
          :disabled="isExecuting"
          class="btn-secondary"
        >
          {{ isExecuting ? 'Executing...' : 'Execute Plan' }}
        </button>

        <button
          v-if="currentPlan"
          @click="savePlan"
          :disabled="isSaving"
          class="btn-outline"
        >
          {{ isSaving ? 'Saving...' : 'Save Plan' }}
        </button>

        <button
          @click="resetPlan"
          class="btn-outline"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Generated Plan Display -->
    <div v-if="currentPlan" class="plan-display">
      <div class="plan-header">
        <h4 class="plan-title">{{ currentPlan.name }}</h4>
        <span class="plan-status" :class="`status-${currentPlan.status}`">
          {{ currentPlan.status }}
        </span>
      </div>

      <div class="plan-description">
        {{ currentPlan.description }}
      </div>

      <div class="plan-steps">
        <h5 class="steps-title">Plan Steps</h5>
        <div
          v-for="(step, index) in currentPlan.steps"
          :key="index"
          class="step-item"
          :class="{ 'step-completed': step.completed, 'step-executing': step.executing }"
        >
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-content">
            <div class="step-title">{{ step.title }}</div>
            <div class="step-description">{{ step.description }}</div>
            <div v-if="step.estimatedTime" class="step-time">
              Est. {{ Math.round(step.estimatedTime / 1000) }}s
            </div>
          </div>
          <div class="step-status">
            <span v-if="step.completed" class="status-icon completed">✓</span>
            <span v-else-if="step.executing" class="status-icon executing">⟳</span>
            <span v-else class="status-icon pending">○</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Execution Progress -->
    <div v-if="isExecuting && executionProgress" class="execution-progress">
      <h5 class="progress-title">Execution Progress</h5>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: executionProgress.progress + '%' }"></div>
      </div>
      <div class="progress-text">
        {{ executionProgress.completedSteps }} / {{ executionProgress.totalSteps }} steps completed
      </div>
      <div v-if="executionProgress.currentStep" class="current-step">
        Current: {{ executionProgress.currentStep.title }}
      </div>
    </div>

    <!-- Execution Results -->
    <div v-if="executionResults.length > 0" class="execution-results">
      <h5 class="results-title">Execution Results</h5>
      <div
        v-for="(result, index) in executionResults"
        :key="index"
        class="result-item"
        :class="{ 'result-success': result.success, 'result-error': !result.success }"
      >
        <div class="result-header">
          <span class="result-step">Step {{ index + 1 }}</span>
          <span class="result-status">{{ result.success ? 'Success' : 'Error' }}</span>
        </div>
        <div class="result-content">{{ result.message || result.error }}</div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-display">
      <div class="error-header">Error</div>
      <div class="error-message">{{ error }}</div>
      <button @click="error = null" class="error-close">×</button>
    </div>

    <!-- Saved Plans -->
    <div v-if="savedPlans.length > 0" class="saved-plans">
      <h5 class="saved-title">Saved Plans</h5>
      <div
        v-for="plan in savedPlans"
        :key="plan.id"
        class="saved-plan-item"
        @click="loadPlan(plan)"
      >
        <div class="saved-plan-name">{{ plan.name }}</div>
        <div class="saved-plan-date">{{ formatDate(plan.saved) }}</div>
        <button @click.stop="deletePlan(plan.id)" class="delete-btn">×</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'SimplePlanBuilder',
  
  props: {
    selectedModel: {
      type: String,
      default: ''
    }
  },
  
  emits: ['plan-created', 'plan-executed', 'plan-saved'],
  
  setup(props, { emit }) {
    // State
    const planName = ref('')
    const planDescription = ref('')
    const currentPlan = ref(null)
    const savedPlans = ref([])
    const isGenerating = ref(false)
    const isExecuting = ref(false)
    const isSaving = ref(false)
    const executionProgress = ref(null)
    const executionResults = ref([])
    const error = ref(null)
    
    // Generate plan using backend API
    async function generatePlan() {
      if (!planDescription.value.trim()) return
      
      try {
        isGenerating.value = true
        error.value = null
        
        console.log('Generating plan:', planDescription.value)
        
        const response = await fetch('http://localhost:3333/api/planning/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: planName.value || 'Generated Plan',
            description: planDescription.value,
            model: props.selectedModel
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          currentPlan.value = result.plan
          console.log('Plan generated successfully:', result.plan)
          emit('plan-created', result.plan)
        } else {
          throw new Error(result.error || 'Failed to generate plan')
        }
        
      } catch (err) {
        console.error('Failed to generate plan:', err)
        error.value = err.message
      } finally {
        isGenerating.value = false
      }
    }
    
    // Execute plan using backend API
    async function executePlan() {
      if (!currentPlan.value) return
      
      try {
        isExecuting.value = true
        error.value = null
        executionResults.value = []
        executionProgress.value = null
        
        console.log('Executing plan:', currentPlan.value.name)
        
        const response = await fetch('http://localhost:3333/api/planning/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            planId: currentPlan.value.id,
            plan: currentPlan.value
          })
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        // Handle SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                handleExecutionEvent(data)
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError)
              }
            }
          }
        }
        
        emit('plan-executed', currentPlan.value)
        
      } catch (err) {
        console.error('Failed to execute plan:', err)
        error.value = err.message
      } finally {
        isExecuting.value = false
      }
    }
    
    // Handle execution events from SSE
    function handleExecutionEvent(data) {
      console.log('Execution event:', data)
      
      switch (data.type) {
        case 'step_start':
          if (currentPlan.value && currentPlan.value.steps[data.stepIndex]) {
            currentPlan.value.steps[data.stepIndex].executing = true
          }
          executionProgress.value = {
            ...executionProgress.value,
            currentStep: data.step,
            progress: data.progress || 0
          }
          break
          
        case 'step_complete':
          if (currentPlan.value && currentPlan.value.steps[data.stepIndex]) {
            currentPlan.value.steps[data.stepIndex].executing = false
            currentPlan.value.steps[data.stepIndex].completed = true
          }
          executionResults.value.push({
            success: true,
            message: `Step completed: ${data.step.title}`,
            result: data.result
          })
          executionProgress.value = {
            ...executionProgress.value,
            progress: data.progress || 0,
            completedSteps: (executionProgress.value?.completedSteps || 0) + 1
          }
          break
          
        case 'step_error':
          if (currentPlan.value && currentPlan.value.steps[data.stepIndex]) {
            currentPlan.value.steps[data.stepIndex].executing = false
          }
          executionResults.value.push({
            success: false,
            error: `Step failed: ${data.error}`,
            step: data.step
          })
          break
          
        case 'execution_complete':
          executionProgress.value = {
            ...executionProgress.value,
            progress: 100,
            completedSteps: data.completedSteps,
            totalSteps: data.totalSteps
          }
          if (currentPlan.value) {
            currentPlan.value.status = data.success ? 'completed' : 'failed'
          }
          break
          
        case 'error':
          error.value = data.error
          break
      }
    }
    
    // Save plan using backend API
    async function savePlan() {
      if (!currentPlan.value) return
      
      try {
        isSaving.value = true
        error.value = null
        
        console.log('Saving plan:', currentPlan.value.name)
        
        const response = await fetch('http://localhost:3333/api/planning/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            plan: currentPlan.value
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          currentPlan.value = result.plan
          await loadSavedPlans()
          console.log('Plan saved successfully')
          emit('plan-saved', result.plan)
        } else {
          throw new Error(result.error || 'Failed to save plan')
        }
        
      } catch (err) {
        console.error('Failed to save plan:', err)
        error.value = err.message
      } finally {
        isSaving.value = false
      }
    }
    
    // Load saved plans
    async function loadSavedPlans() {
      try {
        const response = await fetch('http://localhost:3333/api/planning/plans')
        const result = await response.json()
        
        if (result.success) {
          savedPlans.value = result.plans
        }
      } catch (err) {
        console.error('Failed to load saved plans:', err)
      }
    }
    
    // Load a saved plan
    function loadPlan(plan) {
      currentPlan.value = { ...plan }
      planName.value = plan.name
      planDescription.value = plan.description
      executionResults.value = []
      executionProgress.value = null
      error.value = null
    }
    
    // Delete a saved plan
    async function deletePlan(planId) {
      try {
        const response = await fetch(`http://localhost:3333/api/planning/plan/${planId}`, {
          method: 'DELETE'
        })
        
        const result = await response.json()
        
        if (result.success) {
          await loadSavedPlans()
        }
      } catch (err) {
        console.error('Failed to delete plan:', err)
        error.value = err.message
      }
    }
    
    // Reset plan
    function resetPlan() {
      planName.value = ''
      planDescription.value = ''
      currentPlan.value = null
      executionResults.value = []
      executionProgress.value = null
      error.value = null
    }
    
    // Format date for display
    function formatDate(dateString) {
      return new Date(dateString).toLocaleDateString()
    }
    
    // Lifecycle
    onMounted(() => {
      loadSavedPlans()
    })
    
    return {
      planName,
      planDescription,
      currentPlan,
      savedPlans,
      isGenerating,
      isExecuting,
      isSaving,
      executionProgress,
      executionResults,
      error,
      generatePlan,
      executePlan,
      savePlan,
      loadPlan,
      deletePlan,
      resetPlan,
      formatDate
    }
  }
}
</script>

<style scoped>
.simple-plan-builder {
  @apply space-y-6;
}

.plan-builder-header {
  @apply pb-4 border-b border-border;
}

.plan-form {
  @apply space-y-4;
}

.form-group {
  @apply space-y-2;
}

.form-label {
  @apply block text-sm font-medium text-primary;
}

.form-input,
.form-textarea {
  @apply w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
}

.form-textarea {
  resize: vertical;
}

.form-actions {
  @apply flex gap-3 flex-wrap;
}

.btn-primary {
  @apply px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-outline {
  @apply px-4 py-2 bg-surface border border-border text-primary font-medium rounded-lg hover:bg-surface-hover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
}

.plan-display {
  @apply p-4 bg-surface-card border border-border rounded-lg space-y-4;
}

.plan-header {
  @apply flex items-center justify-between;
}

.plan-title {
  @apply text-lg font-semibold text-primary;
}

.plan-status {
  @apply px-2 py-1 text-xs font-medium rounded-full;
}

.status-draft {
  @apply bg-gray-100 text-gray-800;
}

.status-completed {
  @apply bg-green-100 text-green-800;
}

.status-failed {
  @apply bg-red-100 text-red-800;
}

.plan-description {
  @apply text-secondary;
}

.steps-title {
  @apply text-md font-medium text-primary mb-3;
}

.step-item {
  @apply flex items-start gap-3 p-3 bg-surface border border-border rounded-lg mb-2 transition-all duration-200;
}

.step-completed {
  @apply bg-green-50 border-green-200;
}

.step-executing {
  @apply bg-blue-50 border-blue-200;
}

.step-number {
  @apply w-6 h-6 bg-surface-hover text-primary text-sm font-medium rounded-full flex items-center justify-center flex-shrink-0;
}

.step-content {
  @apply flex-1 space-y-1;
}

.step-title {
  @apply font-medium text-primary;
}

.step-description {
  @apply text-sm text-secondary;
}

.step-time {
  @apply text-xs text-muted;
}

.step-status {
  @apply flex-shrink-0;
}

.status-icon {
  @apply w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium;
}

.status-icon.completed {
  @apply bg-green-500 text-white;
}

.status-icon.executing {
  @apply bg-blue-500 text-white animate-spin;
}

.status-icon.pending {
  @apply bg-gray-300 text-gray-600;
}

.execution-progress {
  @apply p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3;
}

.progress-title {
  @apply text-md font-medium text-primary;
}

.progress-bar {
  @apply w-full bg-gray-200 rounded-full h-2;
}

.progress-fill {
  @apply bg-blue-500 h-2 rounded-full transition-all duration-300;
}

.progress-text {
  @apply text-sm text-secondary;
}

.current-step {
  @apply text-sm font-medium text-primary;
}

.execution-results {
  @apply space-y-3;
}

.results-title {
  @apply text-md font-medium text-primary;
}

.result-item {
  @apply p-3 border rounded-lg;
}

.result-success {
  @apply bg-green-50 border-green-200;
}

.result-error {
  @apply bg-red-50 border-red-200;
}

.result-header {
  @apply flex items-center justify-between mb-2;
}

.result-step {
  @apply text-sm font-medium;
}

.result-status {
  @apply text-xs px-2 py-1 rounded-full;
}

.result-success .result-status {
  @apply bg-green-100 text-green-800;
}

.result-error .result-status {
  @apply bg-red-100 text-red-800;
}

.result-content {
  @apply text-sm text-secondary;
}

.error-display {
  @apply relative p-4 bg-red-50 border border-red-200 rounded-lg;
}

.error-header {
  @apply font-medium text-red-800 mb-2;
}

.error-message {
  @apply text-sm text-red-700;
}

.error-close {
  @apply absolute top-2 right-2 w-6 h-6 text-red-500 hover:text-red-700 cursor-pointer;
}

.saved-plans {
  @apply space-y-3;
}

.saved-title {
  @apply text-md font-medium text-primary;
}

.saved-plan-item {
  @apply flex items-center justify-between p-3 bg-surface-card border border-border rounded-lg cursor-pointer hover:bg-surface-hover transition-all duration-200;
}

.saved-plan-name {
  @apply font-medium text-primary;
}

.saved-plan-date {
  @apply text-sm text-muted;
}

.delete-btn {
  @apply w-6 h-6 text-red-500 hover:text-red-700 cursor-pointer;
}

/* Dark theme support */
[data-theme="dark"] .step-completed {
  @apply bg-green-900 border-green-700;
}

[data-theme="dark"] .step-executing {
  @apply bg-blue-900 border-blue-700;
}

[data-theme="dark"] .execution-progress {
  @apply bg-blue-900 border-blue-700;
}

[data-theme="dark"] .result-success {
  @apply bg-green-900 border-green-700;
}

[data-theme="dark"] .result-error {
  @apply bg-red-900 border-red-700;
}

[data-theme="dark"] .error-display {
  @apply bg-red-900 border-red-700;
}
</style>
