<!--
  ConfigurationTab.vue - Essential LangChain and Agent Configuration
  
  Functional configuration for LangChain, agents, prompts, and model parameters
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="configuration-tab">
    <!-- Header -->
    <div class="tab-header">
      <h2 class="tab-title">
        <Icon name="config" size="lg" />
        Configuration
      </h2>
      <p class="tab-description">
        Configure LangChain, agents, prompts, and model parameters
      </p>
    </div>

    <!-- Main Content -->
    <div class="tab-content">
      <!-- Model Configuration -->
      <div class="section">
        <h3 class="section-title">Model Configuration</h3>
        <div class="config-grid">
          <div class="config-group">
            <label class="config-label">Default Model</label>
            <SimpleModelDropdown
              v-model="config.defaultModel"
              placeholder="Select default model"
            />
            <p class="config-description">
              The model used for autocoder tasks by default
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Temperature</label>
            <input
              v-model.number="config.temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              class="config-slider"
            />
            <div class="slider-value">{{ config.temperature }}</div>
            <p class="config-description">
              Controls randomness (0 = deterministic, 2 = very creative)
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Max Tokens</label>
            <input
              v-model.number="config.maxTokens"
              type="number"
              min="100"
              max="8192"
              step="100"
              class="config-input"
            />
            <p class="config-description">
              Maximum tokens per response (100-8192)
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Top P</label>
            <input
              v-model.number="config.topP"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="config-slider"
            />
            <div class="slider-value">{{ config.topP }}</div>
            <p class="config-description">
              Nucleus sampling parameter (0.1-1.0)
            </p>
          </div>
        </div>
      </div>

      <!-- LangChain Configuration -->
      <div class="section">
        <h3 class="section-title">LangChain Settings</h3>
        <div class="config-grid">
          <div class="config-group">
            <label class="config-label">Chain Type</label>
            <select v-model="config.chainType" class="config-select">
              <option value="stuff">Stuff Chain</option>
              <option value="map_reduce">Map Reduce</option>
              <option value="refine">Refine</option>
              <option value="map_rerank">Map Rerank</option>
            </select>
            <p class="config-description">
              LangChain processing strategy
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Chunk Size</label>
            <input
              v-model.number="config.chunkSize"
              type="number"
              min="500"
              max="4000"
              step="100"
              class="config-input"
            />
            <p class="config-description">
              Text chunk size for processing (500-4000)
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Chunk Overlap</label>
            <input
              v-model.number="config.chunkOverlap"
              type="number"
              min="0"
              max="500"
              step="50"
              class="config-input"
            />
            <p class="config-description">
              Overlap between chunks (0-500)
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.enableMemory"
                type="checkbox"
                class="config-checkbox"
              />
              Enable Conversation Memory
            </label>
            <p class="config-description">
              Remember conversation context across interactions
            </p>
          </div>
        </div>
      </div>

      <!-- Agent Configuration -->
      <div class="section">
        <h3 class="section-title">Agent Settings</h3>
        <div class="config-grid">
          <div class="config-group">
            <label class="config-label">Agent Type</label>
            <select v-model="config.agentType" class="config-select">
              <option value="zero-shot-react-description">Zero Shot React</option>
              <option value="react-docstore">React Docstore</option>
              <option value="self-ask-with-search">Self Ask with Search</option>
              <option value="conversational-react-description">Conversational React</option>
            </select>
            <p class="config-description">
              Agent reasoning strategy
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Max Iterations</label>
            <input
              v-model.number="config.maxIterations"
              type="number"
              min="1"
              max="20"
              step="1"
              class="config-input"
            />
            <p class="config-description">
              Maximum agent reasoning steps (1-20)
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Early Stopping</label>
            <select v-model="config.earlyStopping" class="config-select">
              <option value="force">Force</option>
              <option value="generate">Generate</option>
              <option value="never">Never</option>
            </select>
            <p class="config-description">
              When to stop agent execution
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.enableVerbose"
                type="checkbox"
                class="config-checkbox"
              />
              Verbose Logging
            </label>
            <p class="config-description">
              Show detailed agent reasoning steps
            </p>
          </div>
        </div>
      </div>

      <!-- Prompt Configuration -->
      <div class="section">
        <h3 class="section-title">Prompt Settings</h3>
        <div class="prompt-config">
          <div class="config-group">
            <label class="config-label">System Prompt</label>
            <textarea
              v-model="config.systemPrompt"
              rows="4"
              class="config-textarea"
              placeholder="Enter system prompt..."
            ></textarea>
            <p class="config-description">
              Base instructions for the AI agent
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Pre-prompt</label>
            <textarea
              v-model="config.prePrompt"
              rows="3"
              class="config-textarea"
              placeholder="Enter pre-prompt..."
            ></textarea>
            <p class="config-description">
              Text added before user input
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Post-prompt</label>
            <textarea
              v-model="config.postPrompt"
              rows="3"
              class="config-textarea"
              placeholder="Enter post-prompt..."
            ></textarea>
            <p class="config-description">
              Text added after user input
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.enablePromptTemplates"
                type="checkbox"
                class="config-checkbox"
              />
              Use Prompt Templates
            </label>
            <p class="config-description">
              Enable dynamic prompt templating
            </p>
          </div>
        </div>
      </div>

      <!-- Tool Configuration -->
      <div class="section">
        <h3 class="section-title">Tool Settings</h3>
        <div class="config-grid">
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.enableFileSystem"
                type="checkbox"
                class="config-checkbox"
              />
              File System Tools
            </label>
            <p class="config-description">
              Allow reading/writing files
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.enableCodeExecution"
                type="checkbox"
                class="config-checkbox"
              />
              Code Execution Tools
            </label>
            <p class="config-description">
              Allow running code snippets
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.enableWebSearch"
                type="checkbox"
                class="config-checkbox"
              />
              Web Search Tools
            </label>
            <p class="config-description">
              Allow internet searches
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.enableGitTools"
                type="checkbox"
                class="config-checkbox"
              />
              Git Tools
            </label>
            <p class="config-description">
              Allow git operations
            </p>
          </div>
        </div>
      </div>

      <!-- Safety & Performance -->
      <div class="section">
        <h3 class="section-title">Safety & Performance</h3>
        <div class="config-grid">
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.safetyMode"
                type="checkbox"
                class="config-checkbox"
              />
              Safety Mode
            </label>
            <p class="config-description">
              Require confirmation for destructive operations
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Request Timeout (seconds)</label>
            <input
              v-model.number="config.requestTimeout"
              type="number"
              min="10"
              max="300"
              step="5"
              class="config-input"
            />
            <p class="config-description">
              Maximum time to wait for responses (10-300)
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">Retry Attempts</label>
            <input
              v-model.number="config.retryAttempts"
              type="number"
              min="0"
              max="5"
              step="1"
              class="config-input"
            />
            <p class="config-description">
              Number of retry attempts on failure (0-5)
            </p>
          </div>
          
          <div class="config-group">
            <label class="config-label">
              <input
                v-model="config.enableNotifications"
                type="checkbox"
                class="config-checkbox"
              />
              Enable Notifications
            </label>
            <p class="config-description">
              Show notifications when tasks complete
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="section">
        <div class="action-buttons">
          <BaseButton
            variant="primary"
            icon="save"
            @click="saveConfiguration"
            :loading="isSaving"
          >
            {{ isSaving ? 'Saving...' : 'Save Configuration' }}
          </BaseButton>
          
          <BaseButton
            variant="outline"
            icon="refresh"
            @click="resetConfiguration"
          >
            Reset to Defaults
          </BaseButton>
          
          <BaseButton
            variant="outline"
            icon="download"
            @click="exportConfiguration"
          >
            Export Config
          </BaseButton>
          
          <BaseButton
            variant="outline"
            icon="upload"
            @click="importConfiguration"
          >
            Import Config
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import Icon from '../shared/Icon.vue'
import BaseButton from '../shared/BaseButton.vue'
import SimpleModelDropdown from '../shared/SimpleModelDropdown.vue'

export default {
  name: 'ConfigurationTab',
  
  components: {
    Icon,
    BaseButton,
    SimpleModelDropdown
  },
  
  props: {
    engine: {
      type: Object,
      required: true
    }
  },
  
  emits: ['config-updated'],
  
  setup(props, { emit }) {
    // State
    const isSaving = ref(false)
    
    // Configuration object with functional defaults
    const config = reactive({
      // Model Parameters
      defaultModel: 'mistral-nemo-6.6gb',
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
      
      // LangChain Settings
      chainType: 'stuff',
      chunkSize: 1000,
      chunkOverlap: 200,
      enableMemory: true,
      
      // Agent Settings
      agentType: 'zero-shot-react-description',
      maxIterations: 10,
      earlyStopping: 'force',
      enableVerbose: false,
      
      // Prompt Settings
      systemPrompt: 'You are a helpful AI assistant specialized in code generation and software development. Follow best practices and provide clear, well-documented code.',
      prePrompt: 'Task: ',
      postPrompt: '\n\nPlease provide a complete, working solution with explanations.',
      enablePromptTemplates: true,
      
      // Tool Settings
      enableFileSystem: true,
      enableCodeExecution: true,
      enableWebSearch: false,
      enableGitTools: true,
      
      // Safety & Performance
      safetyMode: true,
      requestTimeout: 60,
      retryAttempts: 3,
      enableNotifications: true
    })
    
    // Configuration actions
    const saveConfiguration = async () => {
      try {
        isSaving.value = true
        
        // Map frontend config to comprehensive backend settings format
        const backendSettings = {
          llmProvider: config.llmProvider || 'ollama',
          defaultOllamaModel: config.defaultModel,
          defaultOpenAIModel: config.defaultOpenAIModel || 'gpt-4',
          OLLAMA_BASE_URL: config.ollamaBaseUrl || 'http://localhost:11434',
          apiKey: config.openaiApiKey || '',
          
          // LangChain Configuration
          langchain: {
            chainType: config.chainType,
            chunkSize: config.chunkSize,
            chunkOverlap: config.chunkOverlap,
            enableMemory: config.enableMemory
          },
          
          // Agent Configuration
          agent: {
            type: config.agentType,
            maxIterations: config.maxIterations,
            earlyStopping: config.earlyStopping,
            enableVerbose: config.enableVerbose
          },
          
          // Model Parameters
          modelParams: {
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            topP: config.topP
          },
          
          // Prompt Configuration
          prompts: {
            systemPrompt: config.systemPrompt,
            prePrompt: config.prePrompt,
            postPrompt: config.postPrompt,
            enablePromptTemplates: config.enablePromptTemplates
          },
          
          // Tool Configuration
          tools: {
            enableFileSystem: config.enableFileSystem,
            enableCodeExecution: config.enableCodeExecution,
            enableWebSearch: config.enableWebSearch,
            enableGitTools: config.enableGitTools
          },
          
          // Safety & Performance
          safety: {
            safetyMode: config.safetyMode,
            requestTimeout: config.requestTimeout,
            retryAttempts: config.retryAttempts,
            enableNotifications: config.enableNotifications
          }
        }
        
        // Send configuration to real backend endpoint
        const response = await fetch('http://localhost:3333/api/config/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(backendSettings)
        })
        
        if (response.ok) {
          console.log('Configuration saved successfully')
          emit('config-updated', config)
        } else {
          throw new Error('Failed to save configuration')
        }
        
      } catch (error) {
        console.error('Failed to save configuration:', error)
        alert('Failed to save configuration. Please try again.')
      } finally {
        isSaving.value = false
      }
    }
    
    const resetConfiguration = () => {
      if (confirm('Are you sure you want to reset all settings to defaults?')) {
        Object.assign(config, {
          // Model Parameters
          defaultModel: 'mistral-nemo-6.6gb',
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
          
          // LangChain Settings
          chainType: 'stuff',
          chunkSize: 1000,
          chunkOverlap: 200,
          enableMemory: true,
          
          // Agent Settings
          agentType: 'zero-shot-react-description',
          maxIterations: 10,
          earlyStopping: 'force',
          enableVerbose: false,
          
          // Prompt Settings
          systemPrompt: 'You are a helpful AI assistant specialized in code generation and software development. Follow best practices and provide clear, well-documented code.',
          prePrompt: 'Task: ',
          postPrompt: '\n\nPlease provide a complete, working solution with explanations.',
          enablePromptTemplates: true,
          
          // Tool Settings
          enableFileSystem: true,
          enableCodeExecution: true,
          enableWebSearch: false,
          enableGitTools: true,
          
          // Safety & Performance
          safetyMode: true,
          requestTimeout: 60,
          retryAttempts: 3,
          enableNotifications: true
        })
        
        console.log('Configuration reset to defaults')
      }
    }
    
    const exportConfiguration = () => {
      const exportData = {
        config,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `roadrunner-config-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      
      URL.revokeObjectURL(url)
      console.log('Configuration exported')
    }
    
    const importConfiguration = () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      
      input.onchange = (event) => {
        const file = event.target.files[0]
        if (!file) return
        
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target.result)
            Object.assign(config, importedData.config)
            console.log('Configuration imported successfully')
          } catch (error) {
            console.error('Failed to import configuration:', error)
            alert('Invalid configuration file')
          }
        }
        reader.readAsText(file)
      }
      
      input.click()
    }
    
    const loadConfiguration = async () => {
      try {
        const response = await fetch('http://localhost:3333/api/config/settings')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.settings) {
            const settings = data.settings
            
            // Map backend settings to frontend config
            config.defaultModel = settings.defaultOllamaModel || config.defaultModel
            config.llmProvider = settings.llmProvider || config.llmProvider
            config.defaultOpenAIModel = settings.defaultOpenAIModel || config.defaultOpenAIModel
            config.ollamaBaseUrl = settings.OLLAMA_BASE_URL || config.ollamaBaseUrl
            config.openaiApiKey = settings.apiKey || config.openaiApiKey
            
            // LangChain Configuration
            if (settings.langchain) {
              config.chainType = settings.langchain.chainType || config.chainType
              config.chunkSize = settings.langchain.chunkSize || config.chunkSize
              config.chunkOverlap = settings.langchain.chunkOverlap || config.chunkOverlap
              config.enableMemory = settings.langchain.enableMemory !== undefined ? settings.langchain.enableMemory : config.enableMemory
            }
            
            // Agent Configuration
            if (settings.agent) {
              config.agentType = settings.agent.type || config.agentType
              config.maxIterations = settings.agent.maxIterations || config.maxIterations
              config.earlyStopping = settings.agent.earlyStopping || config.earlyStopping
              config.enableVerbose = settings.agent.enableVerbose !== undefined ? settings.agent.enableVerbose : config.enableVerbose
            }
            
            // Model Parameters
            if (settings.modelParams) {
              config.temperature = settings.modelParams.temperature !== undefined ? settings.modelParams.temperature : config.temperature
              config.maxTokens = settings.modelParams.maxTokens || config.maxTokens
              config.topP = settings.modelParams.topP !== undefined ? settings.modelParams.topP : config.topP
            }
            
            // Prompt Configuration
            if (settings.prompts) {
              config.systemPrompt = settings.prompts.systemPrompt || config.systemPrompt
              config.prePrompt = settings.prompts.prePrompt || config.prePrompt
              config.postPrompt = settings.prompts.postPrompt || config.postPrompt
              config.enablePromptTemplates = settings.prompts.enablePromptTemplates !== undefined ? settings.prompts.enablePromptTemplates : config.enablePromptTemplates
            }
            
            // Tool Configuration
            if (settings.tools) {
              config.enableFileSystem = settings.tools.enableFileSystem !== undefined ? settings.tools.enableFileSystem : config.enableFileSystem
              config.enableCodeExecution = settings.tools.enableCodeExecution !== undefined ? settings.tools.enableCodeExecution : config.enableCodeExecution
              config.enableWebSearch = settings.tools.enableWebSearch !== undefined ? settings.tools.enableWebSearch : config.enableWebSearch
              config.enableGitTools = settings.tools.enableGitTools !== undefined ? settings.tools.enableGitTools : config.enableGitTools
            }
            
            // Safety & Performance
            if (settings.safety) {
              config.safetyMode = settings.safety.safetyMode !== undefined ? settings.safety.safetyMode : config.safetyMode
              config.requestTimeout = settings.safety.requestTimeout || config.requestTimeout
              config.retryAttempts = settings.safety.retryAttempts !== undefined ? settings.safety.retryAttempts : config.retryAttempts
              config.enableNotifications = settings.safety.enableNotifications !== undefined ? settings.safety.enableNotifications : config.enableNotifications
            }
            
            console.log('Configuration loaded from backend:', settings)
          }
        }
      } catch (error) {
        console.log('Using default configuration (backend not available):', error.message)
      }
    }
    
    // Lifecycle
    onMounted(() => {
      loadConfiguration()
    })
    
    return {
      isSaving,
      config,
      saveConfiguration,
      resetConfiguration,
      exportConfiguration,
      importConfiguration
    }
  }
}
</script>

<style scoped>
.configuration-tab {
  @apply h-full flex flex-col bg-surface;
}

.tab-header {
  @apply p-6 border-b border-border bg-surface-card;
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
  @apply bg-surface-card p-6 rounded-lg border border-border space-y-4;
}

.section-title {
  @apply text-lg font-semibold text-primary mb-4;
}

.config-grid {
  @apply grid gap-6 md:grid-cols-2;
}

.prompt-config {
  @apply space-y-6;
}

.config-group {
  @apply space-y-2;
}

.config-label {
  @apply flex items-center gap-2 font-medium text-primary text-sm;
}

.config-description {
  @apply text-xs text-muted;
}

.config-checkbox {
  @apply w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500;
}

.config-input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900;
}

.config-select {
  @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900;
}

.config-textarea {
  @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900;
  resize: vertical;
}

.config-slider {
  @apply w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer;
}

.config-slider::-webkit-slider-thumb {
  @apply appearance-none w-4 h-4 bg-orange-500 rounded-full cursor-pointer;
}

.config-slider::-moz-range-thumb {
  @apply w-4 h-4 bg-orange-500 rounded-full cursor-pointer border-0;
}

.slider-value {
  @apply text-sm font-medium text-orange-600;
}

.action-buttons {
  @apply flex gap-3 flex-wrap;
}
</style>
