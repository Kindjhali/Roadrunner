<!--
  PlanningTab.vue - Main planning interface tab
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="planning-tab">
    <!-- Header -->
    <div class="tab-header">
      <h2 class="tab-title">
        <Icon name="corvidae-plan" size="lg" />
        Planning & Strategy
      </h2>
      <p class="tab-description">
        Create, validate, and optimize execution plans with AI assistance
      </p>
    </div>

    <!-- Main Content -->
    <div class="tab-content">
      <!-- Model Selection -->
      <div class="section">
        <h3 class="section-title">Planning Model</h3>
        <SimpleModelDropdown
          v-model="selectedModel"
          category="planning"
          @model-changed="handleModelChanged"
        />
      </div>

      <!-- Quick Plan Generation -->
      <div class="section">
        <h3 class="section-title">Quick Plan Generation</h3>
        <div class="quick-plan-section">
          <div class="plan-input">
            <textarea
              v-model="planDescription"
              class="plan-textarea"
              placeholder="Describe what you want to build (e.g., 'Create a Vue.js todo app with local storage')"
              rows="3"
            ></textarea>
          </div>
          <div class="plan-actions">
            <BaseButton
              variant="primary"
              size="lg"
              icon="corvidae-plan"
              @click="generatePlan"
              :loading="isGenerating"
              :disabled="!planDescription.trim()"
            >
              Generate Plan
            </BaseButton>
            <BaseButton
              variant="outline"
              size="lg"
              icon="tyrannidae-close"
              @click="clearPlan"
              :disabled="!planDescription.trim()"
            >
              Clear
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Terminal Window -->
      <div v-if="showTerminal" class="section">
        <h3 class="section-title">
          <Icon name="piciformes-terminal" size="sm" />
          Generation Process
        </h3>
        <div class="terminal-window">
          <div class="terminal-header">
            <div class="terminal-controls">
              <span class="terminal-dot red"></span>
              <span class="terminal-dot yellow"></span>
              <span class="terminal-dot green"></span>
            </div>
            <span class="terminal-title">Plan Generation Terminal</span>
            <BaseButton
              variant="ghost"
              size="xs"
              icon="tyrannidae-close"
              @click="closeTerminal"
            />
          </div>
          <div class="terminal-content">
            <div
              v-for="(log, index) in terminalLogs"
              :key="index"
              class="terminal-line"
              :class="`terminal-${log.type}`"
            >
              <span class="terminal-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
              <span class="terminal-message">{{ log.message }}</span>
            </div>
            <div v-if="isGenerating" class="terminal-line terminal-info">
              <span class="terminal-timestamp">{{ formatTimestamp(Date.now()) }}</span>
              <span class="terminal-message">
                <Icon name="loading" size="xs" animation="spin" />
                Processing...
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Generated Plan Display -->
      <div v-if="generatedPlan" class="section">
        <h3 class="section-title">Generated Plan</h3>
        <div class="plan-result-card">
          <div class="plan-card-header">
            <div class="plan-card-title">
              <Icon name="corvidae-validate" size="sm" class="text-success" />
              <h4>{{ generatedPlan.name || 'Generated Plan' }}</h4>
            </div>
            <div class="plan-card-actions">
              <BaseButton
                variant="ghost"
                size="xs"
                icon="passeriformes-copy"
                @click="copyPlan"
                title="Copy Plan"
              />
              <BaseButton
                variant="ghost"
                size="xs"
                icon="turdus-export"
                @click="exportPlan"
                title="Export Plan"
              />
              <BaseButton
                variant="ghost"
                size="xs"
                icon="tyrannidae-close"
                @click="closePlan"
                title="Close Plan"
              />
            </div>
          </div>
          
          <div class="plan-card-content">
            <div v-if="generatedPlan.description" class="plan-description">
              <p>{{ generatedPlan.description }}</p>
            </div>
            
            <div v-if="generatedPlan.steps && generatedPlan.steps.length" class="plan-steps">
              <h5 class="steps-title">
                <Icon name="corvidae-list" size="sm" />
                Execution Steps ({{ generatedPlan.steps.length }})
              </h5>
              <div class="steps-list">
                <div 
                  v-for="(step, index) in generatedPlan.steps" 
                  :key="index"
                  class="step-item"
                >
                  <div class="step-number">{{ index + 1 }}</div>
                  <div class="step-content">
                    <h6 class="step-title">{{ step.title || step.name || `Step ${index + 1}` }}</h6>
                    <p class="step-description">{{ step.description || step.content || 'No description provided' }}</p>
                    <div v-if="step.type" class="step-meta">
                      <span class="step-type">{{ step.type }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else-if="generatedPlan.content" class="plan-raw-content">
              <h5 class="content-title">
                <Icon name="passeriformes-text" size="sm" />
                Plan Content
              </h5>
              <div class="content-display">
                <pre class="plan-text">{{ generatedPlan.content }}</pre>
              </div>
            </div>
            
            <div v-else class="plan-fallback">
              <p class="text-muted">Plan generated successfully but no detailed content available.</p>
            </div>
          </div>
          
          <div class="plan-card-footer">
            <div class="plan-stats">
              <span v-if="generatedPlan.steps" class="stat-item">
                <Icon name="corvidae-list" size="xs" />
                {{ generatedPlan.steps.length }} steps
              </span>
              <span v-if="generatedPlan.estimatedTime" class="stat-item">
                <Icon name="passeriformes-clock" size="xs" />
                ~{{ generatedPlan.estimatedTime }}
              </span>
              <span class="stat-item">
                <Icon name="corvidae-model" size="xs" />
                {{ selectedModel?.name || 'Default Model' }}
              </span>
            </div>
            <div class="plan-actions">
              <BaseButton
                variant="primary"
                icon="corvidae-execute"
                @click="executePlan"
              >
                Execute Plan
              </BaseButton>
              <BaseButton
                variant="outline"
                icon="passeriformes-save"
                @click="savePlan"
              >
                Save Plan
              </BaseButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Plan Builder -->
      <div class="section">
        <h3 class="section-title">Visual Plan Builder</h3>
        <PlanBuilder
          :engine="engine"
          :selected-model="selectedModel"
          @plan-created="handlePlanCreated"
          @plan-validated="handlePlanValidated"
          @generate-plan="generatePlanFromBuilder"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import Icon from '../shared/Icon.vue'
import BaseButton from '../shared/BaseButton.vue'
import SimpleModelDropdown from '../shared/SimpleModelDropdown.vue'
import PlanBuilder from './PlanBuilder.vue'

export default {
  name: 'PlanningTab',
  
  components: {
    Icon,
    BaseButton,
    SimpleModelDropdown,
    PlanBuilder
  },
  
  props: {
    engine: {
      type: Object,
      required: false,
      default: null
    }
  },
  
  emits: ['plan-created', 'plan-executed'],
  
  setup(props, { emit }) {
    // State
    const selectedModel = ref(null)
    const planDescription = ref('')
    const isGenerating = ref(false)
    const generatedPlan = ref(null)
    const showTerminal = ref(false)
    const terminalLogs = ref([])
    
    // Terminal functionality
    const addTerminalLog = (message, type = 'info') => {
      terminalLogs.value.push({
        message,
        type,
        timestamp: Date.now()
      })
    }
    
    const closeTerminal = () => {
      showTerminal.value = false
    }
    
    const formatTimestamp = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString()
    }
    
    // Event handlers
    const handleModelChanged = (model) => {
      console.log('Planning model changed:', model)
    }
    
    const handlePlanCreated = (plan) => {
      console.log('Plan created:', plan)
      emit('plan-created', plan)
    }
    
    const handlePlanValidated = (validation) => {
      console.log('Plan validated:', validation)
    }
    
    // Generate Plan functionality
    const generatePlan = async () => {
      if (!planDescription.value.trim()) return
      
      isGenerating.value = true
      showTerminal.value = true
      terminalLogs.value = []
      
      addTerminalLog('Starting plan generation...', 'info')
      addTerminalLog(`Description: ${planDescription.value}`, 'info')
      addTerminalLog(`Model: ${selectedModel.value?.name || 'Default Model'}`, 'info')
      
      try {
        addTerminalLog('Connecting to planning service...', 'info')
        
        const response = await fetch('http://localhost:3333/api/planning/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Generated Plan',
            description: planDescription.value,
            model: selectedModel.value?.name || selectedModel.value || 'mistral-nemo:latest'
          })
        })
        
        addTerminalLog('Received response from server...', 'info')
        
        const result = await response.json()
        
        if (result.success) {
          addTerminalLog('Plan generated successfully!', 'success')
          addTerminalLog(`Generated ${result.plan?.steps?.length || 'unknown'} steps`, 'success')
          generatedPlan.value = result.plan
          emit('plan-created', result.plan)
        } else {
          addTerminalLog(`Error: ${result.error}`, 'error')
          console.error('Failed to generate plan:', result.error)
        }
        
      } catch (error) {
        addTerminalLog(`Connection error: ${error.message}`, 'error')
        console.error('Error generating plan:', error)
      } finally {
        isGenerating.value = false
        addTerminalLog('Plan generation completed.', 'info')
      }
    }
    
    // Generate plan from builder
    const generatePlanFromBuilder = async (builderData) => {
      isGenerating.value = true
      showTerminal.value = true
      terminalLogs.value = []
      
      addTerminalLog('Starting plan generation from visual builder...', 'info')
      addTerminalLog(`Builder data: ${JSON.stringify(builderData)}`, 'info')
      
      try {
        addTerminalLog('Processing visual plan data...', 'info')
        
        const response = await fetch('http://localhost:3333/api/planning/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Visual Plan',
            description: 'Plan created from visual builder',
            builderData: builderData,
            model: selectedModel.value?.name || selectedModel.value || 'mistral-nemo:latest'
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          addTerminalLog('Visual plan generated successfully!', 'success')
          generatedPlan.value = result.plan
          emit('plan-created', result.plan)
        } else {
          addTerminalLog(`Error: ${result.error}`, 'error')
        }
        
      } catch (error) {
        addTerminalLog(`Error: ${error.message}`, 'error')
      } finally {
        isGenerating.value = false
        addTerminalLog('Visual plan generation completed.', 'info')
      }
    }
    
    const clearPlan = () => {
      planDescription.value = ''
      generatedPlan.value = null
      showTerminal.value = false
      terminalLogs.value = []
    }
    
    const closePlan = () => {
      generatedPlan.value = null
    }
    
    const copyPlan = async () => {
      if (generatedPlan.value) {
        try {
          const planText = JSON.stringify(generatedPlan.value, null, 2)
          await navigator.clipboard.writeText(planText)
          addTerminalLog('Plan copied to clipboard', 'success')
        } catch (error) {
          addTerminalLog('Failed to copy plan', 'error')
        }
      }
    }
    
    const exportPlan = () => {
      if (generatedPlan.value) {
        const planText = JSON.stringify(generatedPlan.value, null, 2)
        const blob = new Blob([planText], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        
        const a = document.createElement('a')
        a.href = url
        a.download = `plan-${Date.now()}.json`
        a.click()
        
        URL.revokeObjectURL(url)
        addTerminalLog('Plan exported successfully', 'success')
      }
    }
    
    const executePlan = () => {
      if (generatedPlan.value) {
        console.log('Executing plan:', generatedPlan.value)
        emit('plan-executed', generatedPlan.value)
        addTerminalLog('Plan execution started', 'info')
      }
    }
    
    const savePlan = () => {
      if (generatedPlan.value) {
        console.log('Saving plan:', generatedPlan.value)
        // Could implement actual save functionality here
        addTerminalLog('Plan saved successfully', 'success')
      }
    }
    
    // Lifecycle
    onMounted(() => {
      // Set default model if available
      if (props.engine?.modelManager) {
        selectedModel.value = props.engine.modelManager.getDefaultModel('planning')
      }
    })
    
    return {
      selectedModel,
      planDescription,
      isGenerating,
      generatedPlan,
      showTerminal,
      terminalLogs,
      handleModelChanged,
      handlePlanCreated,
      handlePlanValidated,
      generatePlan,
      generatePlanFromBuilder,
      clearPlan,
      closePlan,
      copyPlan,
      exportPlan,
      executePlan,
      savePlan,
      closeTerminal,
      formatTimestamp,
      addTerminalLog
    }
  }
}
</script>

<style scoped>
.planning-tab {
  @apply h-full flex flex-col;
}

.tab-header {
  @apply p-6 border-b border-border;
}

.tab-title {
  @apply flex items-center gap-3 text-2xl font-bold text-primary mb-2;
}

.tab-description {
  @apply text-muted;
}

.tab-content {
  @apply flex-1 overflow-y-auto p-6 space-y-8;
}

.section {
  @apply space-y-4;
}

.section-title {
  @apply text-lg font-semibold text-primary;
}

.quick-plan-section {
  @apply space-y-4;
}

.plan-input {
  @apply w-full;
}

.plan-textarea {
  @apply w-full px-4 py-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-surface text-primary;
}

.plan-actions {
  @apply flex gap-3;
}

/* Terminal Window Styles */
.terminal-window {
  @apply bg-gray-900 rounded-lg overflow-hidden border border-gray-700;
}

.terminal-header {
  @apply flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700;
}

.terminal-controls {
  @apply flex items-center gap-2;
}

.terminal-dot {
  @apply w-3 h-3 rounded-full;
}

.terminal-dot.red {
  @apply bg-red-500;
}

.terminal-dot.yellow {
  @apply bg-yellow-500;
}

.terminal-dot.green {
  @apply bg-green-500;
}

.terminal-title {
  @apply text-sm font-medium text-gray-300;
}

.terminal-content {
  @apply p-4 max-h-64 overflow-y-auto font-mono text-sm;
}

.terminal-line {
  @apply flex items-start gap-3 mb-1;
}

.terminal-timestamp {
  @apply text-gray-500 text-xs min-w-20;
}

.terminal-message {
  @apply flex-1;
}

.terminal-info {
  @apply text-blue-400;
}

.terminal-success {
  @apply text-green-400;
}

.terminal-error {
  @apply text-red-400;
}

/* Plan Result Card Styles */
.plan-result-card {
  @apply bg-surface-card border border-border rounded-lg overflow-hidden;
}

.plan-card-header {
  @apply flex items-center justify-between p-4 bg-surface-hover border-b border-border;
}

.plan-card-title {
  @apply flex items-center gap-2;
}

.plan-card-title h4 {
  @apply text-lg font-semibold text-primary;
}

.plan-card-actions {
  @apply flex items-center gap-1;
}

.plan-card-content {
  @apply p-4 space-y-4;
}

.plan-description {
  @apply text-secondary;
}

.plan-steps {
  @apply space-y-3;
}

.steps-title {
  @apply flex items-center gap-2 font-medium text-primary mb-3;
}

.steps-list {
  @apply space-y-3;
}

.step-item {
  @apply flex gap-3 p-3 bg-surface-elevated rounded-lg border border-border;
}

.step-number {
  @apply flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium;
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

.step-meta {
  @apply flex items-center gap-2 mt-2;
}

.step-type {
  @apply px-2 py-1 bg-info bg-opacity-10 text-info text-xs rounded;
}

.plan-raw-content {
  @apply space-y-3;
}

.content-title {
  @apply flex items-center gap-2 font-medium text-primary;
}

.content-display {
  @apply bg-surface-elevated rounded-lg p-4 border border-border;
}

.plan-text {
  @apply text-sm text-secondary font-mono whitespace-pre-wrap;
}

.plan-fallback {
  @apply text-center py-8;
}

.plan-card-footer {
  @apply flex items-center justify-between p-4 bg-surface-hover border-t border-border;
}

.plan-stats {
  @apply flex items-center gap-4 text-sm text-muted;
}

.stat-item {
  @apply flex items-center gap-1;
}

.plan-actions {
  @apply flex items-center gap-2;
}

@media (max-width: 768px) {
  .plan-card-header {
    @apply flex-col gap-3 items-start;
  }
  
  .plan-card-footer {
    @apply flex-col gap-3 items-start;
  }
  
  .plan-stats {
    @apply flex-wrap;
  }
  
  .step-item {
    @apply flex-col gap-2;
  }
  
  .step-number {
    @apply self-start;
  }
}
</style>
