<!--
  ModelConfiguration.vue - Model configuration component
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="model-configuration">
    <SettingsSection
      title="Model Selection"
      description="Configure which models to use for different tasks"
      icon="corvidae-model"
      collapsible
    >
      <div class="model-settings">
        <!-- Planning Model -->
        <div class="setting-group">
          <label class="setting-label">Planning Model</label>
          <select
            v-model="localSettings.defaultPlanningModel"
            class="model-select"
            @change="updateSettings"
          >
            <option
              v-for="model in availableModels"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }} ({{ model.provider }})
            </option>
          </select>
          <p class="setting-description">
            Model used for generating and analyzing project plans
          </p>
        </div>
        
        <!-- Brainstorming Model -->
        <div class="setting-group">
          <label class="setting-label">Brainstorming Model</label>
          <select
            v-model="localSettings.defaultBrainstormingModel"
            class="model-select"
            @change="updateSettings"
          >
            <option
              v-for="model in availableModels"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }} ({{ model.provider }})
            </option>
          </select>
          <p class="setting-description">
            Model used for creative brainstorming and idea generation
          </p>
        </div>
        
        <!-- Execution Model -->
        <div class="setting-group">
          <label class="setting-label">Execution Model</label>
          <select
            v-model="localSettings.defaultExecutionModel"
            class="model-select"
            @change="updateSettings"
          >
            <option
              v-for="model in availableModels"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }} ({{ model.provider }})
            </option>
          </select>
          <p class="setting-description">
            Model used for code generation and execution tasks
          </p>
        </div>
        
        <!-- Conference Model -->
        <div class="setting-group">
          <label class="setting-label">Conference Model</label>
          <select
            v-model="localSettings.defaultConferenceModel"
            class="model-select"
            @change="updateSettings"
          >
            <option
              v-for="model in availableModels"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }} ({{ model.provider }})
            </option>
          </select>
          <p class="setting-description">
            Model used for multi-agent conferences and collaboration
          </p>
        </div>
      </div>
    </SettingsSection>
    
    <SettingsSection
      title="Model Parameters"
      description="Fine-tune model behavior and performance"
      icon="corvidae-settings"
      collapsible
    >
      <div class="parameter-settings">
        <!-- Max Tokens -->
        <div class="setting-group">
          <label class="setting-label">Max Tokens</label>
          <div class="range-input-group">
            <input
              v-model.number="localSettings.maxTokens"
              type="range"
              min="512"
              max="32768"
              step="512"
              class="range-input"
              @input="updateSettings"
            />
            <span class="range-value">{{ localSettings.maxTokens }}</span>
          </div>
          <p class="setting-description">
            Maximum number of tokens the model can generate
          </p>
        </div>
        
        <!-- Temperature -->
        <div class="setting-group">
          <label class="setting-label">Temperature</label>
          <div class="range-input-group">
            <input
              v-model.number="localSettings.temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              class="range-input"
              @input="updateSettings"
            />
            <span class="range-value">{{ localSettings.temperature }}</span>
          </div>
          <p class="setting-description">
            Controls randomness in model outputs (0 = deterministic, 2 = very random)
          </p>
        </div>
        
        <!-- Top P -->
        <div class="setting-group">
          <label class="setting-label">Top P</label>
          <div class="range-input-group">
            <input
              v-model.number="localSettings.topP"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="range-input"
              @input="updateSettings"
            />
            <span class="range-value">{{ localSettings.topP }}</span>
          </div>
          <p class="setting-description">
            Nucleus sampling parameter (lower values = more focused)
          </p>
        </div>
        
        <!-- Frequency Penalty -->
        <div class="setting-group">
          <label class="setting-label">Frequency Penalty</label>
          <div class="range-input-group">
            <input
              v-model.number="localSettings.frequencyPenalty"
              type="range"
              min="-2"
              max="2"
              step="0.1"
              class="range-input"
              @input="updateSettings"
            />
            <span class="range-value">{{ localSettings.frequencyPenalty }}</span>
          </div>
          <p class="setting-description">
            Penalizes frequent tokens (positive = less repetition)
          </p>
        </div>
        
        <!-- Presence Penalty -->
        <div class="setting-group">
          <label class="setting-label">Presence Penalty</label>
          <div class="range-input-group">
            <input
              v-model.number="localSettings.presencePenalty"
              type="range"
              min="-2"
              max="2"
              step="0.1"
              class="range-input"
              @input="updateSettings"
            />
            <span class="range-value">{{ localSettings.presencePenalty }}</span>
          </div>
          <p class="setting-description">
            Penalizes tokens based on presence (positive = more diverse topics)
          </p>
        </div>
      </div>
    </SettingsSection>
    
    <SettingsSection
      title="Performance Settings"
      description="Configure timeouts and retry behavior"
      icon="corvidae-performance"
      collapsible
    >
      <div class="performance-settings">
        <!-- Timeout -->
        <div class="setting-group">
          <label class="setting-label">Request Timeout (seconds)</label>
          <div class="range-input-group">
            <input
              v-model.number="localSettings.timeout"
              type="range"
              min="5"
              max="300"
              step="5"
              class="range-input"
              @input="updateSettings"
            />
            <span class="range-value">{{ Math.round(localSettings.timeout / 1000) }}s</span>
          </div>
          <p class="setting-description">
            Maximum time to wait for model responses
          </p>
        </div>
        
        <!-- Retry Attempts -->
        <div class="setting-group">
          <label class="setting-label">Retry Attempts</label>
          <div class="range-input-group">
            <input
              v-model.number="localSettings.retryAttempts"
              type="range"
              min="0"
              max="10"
              step="1"
              class="range-input"
              @input="updateSettings"
            />
            <span class="range-value">{{ localSettings.retryAttempts }}</span>
          </div>
          <p class="setting-description">
            Number of times to retry failed requests
          </p>
        </div>
      </div>
    </SettingsSection>
    
    <!-- Model Testing -->
    <SettingsSection
      title="Model Testing"
      description="Test model configurations and performance"
      icon="corvidae-test"
      collapsible
    >
      <div class="model-testing">
        <div class="test-controls">
          <textarea
            v-model="testPrompt"
            class="test-prompt"
            placeholder="Enter a test prompt to evaluate model performance..."
            rows="4"
          ></textarea>
          
          <div class="test-actions">
            <BaseButton
              variant="primary"
              icon="corvidae-play"
              :loading="isTesting"
              @click="runModelTest"
            >
              Test Models
            </BaseButton>
            
            <BaseButton
              variant="ghost"
              icon="corvidae-clear"
              @click="clearTestResults"
            >
              Clear Results
            </BaseButton>
          </div>
        </div>
        
        <div v-if="testResults.length > 0" class="test-results">
          <h4>Test Results</h4>
          <div
            v-for="result in testResults"
            :key="result.modelId"
            class="test-result"
          >
            <div class="result-header">
              <span class="model-name">{{ result.modelName }}</span>
              <span class="response-time">{{ result.responseTime }}ms</span>
            </div>
            <div class="result-content">{{ result.response }}</div>
          </div>
        </div>
      </div>
    </SettingsSection>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore.js'
import SettingsSection from './SettingsSection.vue'
import BaseButton from '../shared/BaseButton.vue'

export default {
  name: 'ModelConfiguration',
  
  components: {
    SettingsSection,
    BaseButton
  },
  
  emits: ['update'],
  
  setup(props, { emit }) {
    const settingsStore = useSettingsStore()
    
    // Local settings state
    const localSettings = reactive({
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
    })
    
    // Available models (loaded from backend)
    const availableModels = ref([])
    
    // Load models from backend
    const loadModels = async () => {
      try {
        const response = await fetch('http://localhost:3333/api/models')
        const result = await response.json()
        
        if (result.success && result.models) {
          availableModels.value = result.models.map(model => ({
            id: model.name || model.id,
            name: model.name || model.id,
            provider: model.provider || 'ollama',
            capabilities: model.capabilities || ['general']
          }))
          console.log('Loaded models for configuration:', availableModels.value.length)
        }
      } catch (error) {
        console.error('Failed to load models:', error)
        // Fallback models if API fails
        availableModels.value = [
          {
            id: 'llama2',
            name: 'Llama 2',
            provider: 'Ollama',
            capabilities: ['general', 'code']
          }
        ]
      }
    }
    
    // Testing state
    const testPrompt = ref('Write a simple function to calculate the factorial of a number.')
    const isTesting = ref(false)
    const testResults = ref([])
    
    // Methods
    const updateSettings = () => {
      settingsStore.updateSettings({
        models: localSettings
      })
      emit('update', localSettings)
    }
    
    const runModelTest = async () => {
      if (!testPrompt.value.trim()) return
      
      isTesting.value = true
      testResults.value = []
      
      try {
        // Test each model (mock implementation)
        for (const model of availableModels.value) {
          const startTime = Date.now()
          
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500))
          
          const responseTime = Date.now() - startTime
          const mockResponse = generateMockResponse(model, testPrompt.value)
          
          testResults.value.push({
            modelId: model.id,
            modelName: model.name,
            responseTime,
            response: mockResponse
          })
        }
      } catch (error) {
        console.error('Model testing failed:', error)
      } finally {
        isTesting.value = false
      }
    }
    
    const clearTestResults = () => {
      testResults.value = []
      testPrompt.value = ''
    }
    
    const generateMockResponse = (model, prompt) => {
      // Generate mock responses based on model capabilities
      const responses = {
        'codellama': `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)`,
        'gpt-4': `Here's a factorial function in Python:

def factorial(n):
    """Calculate the factorial of a number."""
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    if n <= 1:
        return 1
    return n * factorial(n - 1)`,
        'claude-3': `I'll provide a factorial function with error handling:

def factorial(n):
    if not isinstance(n, int):
        raise TypeError("Input must be an integer")
    if n < 0:
        raise ValueError("Factorial is undefined for negative numbers")
    if n <= 1:
        return 1
    return n * factorial(n - 1)`,
        'gemini-pro': `Here's a factorial implementation with multiple approaches:

# Recursive approach
def factorial_recursive(n):
    return 1 if n <= 1 else n * factorial_recursive(n - 1)

# Iterative approach
def factorial_iterative(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result`
      }
      
      return responses[model.id] || 'Mock response for ' + model.name
    }
    
    // Initialize settings from store
    onMounted(async () => {
      const storeSettings = settingsStore.models
      if (storeSettings) {
        Object.assign(localSettings, storeSettings)
      }
      
      // Load available models
      await loadModels()
    })
    
    return {
      localSettings,
      availableModels,
      testPrompt,
      isTesting,
      testResults,
      updateSettings,
      runModelTest,
      clearTestResults
    }
  }
}
</script>

<style scoped>
.model-configuration {
  @apply space-y-6;
}

.model-settings,
.parameter-settings,
.performance-settings {
  @apply space-y-4;
}

.setting-group {
  @apply space-y-2;
}

.setting-label {
  @apply block text-sm font-medium text-primary;
}

.model-select {
  @apply w-full px-3 py-2 border border-border rounded-lg bg-surface focus:ring-2 focus:ring-primary focus:border-transparent;
}

.range-input-group {
  @apply flex items-center gap-3;
}

.range-input {
  @apply flex-1;
}

.range-value {
  @apply text-sm font-mono text-secondary min-w-16 text-right;
}

.setting-description {
  @apply text-xs text-muted;
}

.model-testing {
  @apply space-y-4;
}

.test-controls {
  @apply space-y-3;
}

.test-prompt {
  @apply w-full px-3 py-2 border border-border rounded-lg bg-surface resize-none focus:ring-2 focus:ring-primary focus:border-transparent;
}

.test-actions {
  @apply flex gap-2;
}

.test-results {
  @apply space-y-3;
}

.test-results h4 {
  @apply text-lg font-semibold text-primary;
}

.test-result {
  @apply p-3 bg-surface-elevated rounded-lg border border-border;
}

.result-header {
  @apply flex justify-between items-center mb-2;
}

.model-name {
  @apply font-medium text-primary;
}

.response-time {
  @apply text-sm text-muted;
}

.result-content {
  @apply text-sm font-mono bg-surface p-2 rounded border border-border whitespace-pre-wrap;
}
</style>
