/**
 * useModelManager.js - Composable for model management
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { ModelService } from '../services/ModelService.js'
import { usePlanningStore } from '../stores/planningStore.js'

/**
 * Model Manager Composable
 * 
 * Provides reactive model management functionality:
 * 1. Model discovery and categorization
 * 2. Model selection and comparison
 * 3. Performance benchmarking
 * 4. Provider status monitoring
 */
export function useModelManager(config = {}) {
  // Services and stores
  const modelService = new ModelService(config)
  const planningStore = usePlanningStore()
  
  // Reactive state
  const categorizedModels = ref({
    coding: [],
    reasoning: [],
    creative: [],
    general: [],
    multimodal: [],
    uncategorized: []
  })
  
  const selectedModel = ref(null)
  const comparisonModels = ref([])
  const benchmarkResults = ref(new Map())
  const providerStatus = ref(new Map())
  const isLoading = ref(false)
  const lastError = ref(null)
  
  // Model selection state
  const modelSelection = reactive({
    planning: null,
    execution: null,
    brainstorming: null,
    coding: null
  })
  
  // Computed properties
  const availableModels = computed(() => {
    const all = []
    Object.values(categorizedModels.value).forEach(category => {
      all.push(...category)
    })
    return all
  })
  
  const totalModelsCount = computed(() => availableModels.value.length)
  
  const activeProviders = computed(() => {
    return Array.from(providerStatus.value.entries())
      .filter(([_, status]) => status.available)
      .map(([provider, _]) => provider)
  })
  
  const hasSelectedModel = computed(() => selectedModel.value !== null)
  
  const canCompareModels = computed(() => comparisonModels.value.length >= 2)

  // Actions - Model Discovery
  
  /**
   * Load available models from all providers
   * Question → Explore → Apply pattern
   */
  async function loadModels() {
    try {
      // Question: What models are available?
      isLoading.value = true
      lastError.value = null
      
      // Explore: Initialize service and get models
      await modelService.initialize()
      const models = modelService.getCategorizedModels()
      const allModels = modelService.getAvailableModels()
      
      // Apply: Update reactive state
      categorizedModels.value = models
      
      // Auto-select first available model as default
      if (!selectedModel.value && allModels.length > 0) {
        console.log('Auto-selecting default model:', allModels[0].name)
        setSelectedModel(allModels[0])
      }
      
      return models
      
    } catch (error) {
      lastError.value = error
      console.error('Failed to load models:', error)
      
      // Load fallback models if Ollama fails
      loadFallbackModels()
      
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Refresh model list and provider status
   * Input → Process → Output pattern
   */
  async function refreshModels() {
    try {
      // Input: Clear current state
      categorizedModels.value = {
        coding: [],
        reasoning: [],
        creative: [],
        general: [],
        multimodal: [],
        uncategorized: []
      }
      
      // Process: Reload models
      await loadModels()
      
      // Output: Update provider status
      const status = modelService.state.providerStatus
      providerStatus.value = new Map(status)
      
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  // Actions - Model Selection
  
  /**
   * Set the selected model
   * Prompt → Validate → Result pattern
   * 
   * @param {Object} model - Model to select
   */
  function setSelectedModel(model) {
    try {
      // Prompt: Validate model
      if (!model || !model.id) {
        throw new Error('Invalid model object')
      }
      
      // Validate: Check if model is available
      const isAvailable = availableModels.value.find(m => m.id === model.id)
      if (!isAvailable) {
        throw new Error('Model is not available')
      }
      
      // Result: Set selected model
      selectedModel.value = model
      
      // Update planning store
      if (planningStore.selectedModels) {
        const index = planningStore.selectedModels.findIndex(m => m.category === model.category)
        if (index !== -1) {
          planningStore.selectedModels[index] = model
        } else {
          planningStore.selectedModels.push(model)
        }
      }
      
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  /**
   * Set model for specific use case
   * 
   * @param {string} useCase - Use case (planning, execution, brainstorming, coding)
   * @param {Object} model - Model to set
   */
  function setModelForUseCase(useCase, model) {
    if (!['planning', 'execution', 'brainstorming', 'coding'].includes(useCase)) {
      throw new Error('Invalid use case')
    }
    
    modelSelection[useCase] = model
    
    // Also set as selected model if it's the first selection
    if (!selectedModel.value) {
      setSelectedModel(model)
    }
  }

  /**
   * Get model for specific use case
   * 
   * @param {string} useCase - Use case
   * @returns {Object|null} Selected model for use case
   */
  function getModelForUseCase(useCase) {
    return modelSelection[useCase] || selectedModel.value
  }

  // Actions - Model Comparison
  
  /**
   * Add model to comparison
   * 
   * @param {Object} model - Model to add to comparison
   */
  function addToComparison(model) {
    if (!comparisonModels.value.find(m => m.id === model.id)) {
      comparisonModels.value.push(model)
    }
  }

  /**
   * Remove model from comparison
   * 
   * @param {string} modelId - Model ID to remove
   */
  function removeFromComparison(modelId) {
    const index = comparisonModels.value.findIndex(m => m.id === modelId)
    if (index !== -1) {
      comparisonModels.value.splice(index, 1)
    }
  }

  /**
   * Clear comparison list
   */
  function clearComparison() {
    comparisonModels.value = []
  }

  /**
   * Compare selected models
   * 
   * @param {Array} testPrompts - Custom test prompts (optional)
   * @returns {Promise<Object>} Comparison results
   */
  async function compareModels(testPrompts = null) {
    try {
      if (comparisonModels.value.length < 2) {
        throw new Error('At least 2 models required for comparison')
      }
      
      const modelIds = comparisonModels.value.map(m => m.id)
      const comparison = await modelService.compareModels(modelIds, testPrompts)
      
      return comparison
      
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  // Actions - Benchmarking
  
  /**
   * Benchmark a specific model
   * 
   * @param {string} modelId - Model to benchmark
   * @param {Array} testPrompts - Custom test prompts (optional)
   * @returns {Promise<Object>} Benchmark results
   */
  async function benchmarkModel(modelId, testPrompts = null) {
    try {
      const results = await modelService.benchmarkModel(modelId, testPrompts)
      benchmarkResults.value.set(modelId, results)
      return results
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  /**
   * Get benchmark results for a model
   * 
   * @param {string} modelId - Model ID
   * @returns {Object|null} Benchmark results
   */
  function getBenchmarkResults(modelId) {
    return benchmarkResults.value.get(modelId) || null
  }

  /**
   * Get model capabilities
   * 
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} Model capabilities
   */
  async function getModelCapabilities(modelId) {
    try {
      return await modelService.getModelCapabilities(modelId)
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  // Actions - Filtering and Search
  
  /**
   * Filter models by criteria
   * 
   * @param {Object} criteria - Filter criteria
   * @returns {Array} Filtered models
   */
  function filterModels(criteria = {}) {
    let filtered = availableModels.value
    
    if (criteria.category) {
      filtered = categorizedModels.value[criteria.category] || []
    }
    
    if (criteria.provider) {
      filtered = filtered.filter(m => m.provider === criteria.provider)
    }
    
    if (criteria.capabilities) {
      filtered = filtered.filter(m => 
        criteria.capabilities.every(cap => 
          m.capabilities && m.capabilities.includes(cap)
        )
      )
    }
    
    if (criteria.search) {
      const searchTerm = criteria.search.toLowerCase()
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(searchTerm) ||
        m.id.toLowerCase().includes(searchTerm)
      )
    }
    
    return filtered
  }

  /**
   * Get recommended models for a task
   * 
   * @param {string} taskType - Type of task
   * @returns {Array} Recommended models
   */
  function getRecommendedModels(taskType) {
    const recommendations = {
      'code_generation': categorizedModels.value.coding,
      'planning': categorizedModels.value.reasoning,
      'brainstorming': categorizedModels.value.creative,
      'general': categorizedModels.value.general,
      'multimodal': categorizedModels.value.multimodal
    }
    
    return recommendations[taskType] || categorizedModels.value.general
  }

  /**
   * Load fallback models when service fails
   */
  function loadFallbackModels() {
    console.log('Loading fallback models...')
    
    const fallbackModels = [
      {
        id: 'llama2',
        name: 'Llama 2',
        provider: 'ollama',
        category: 'general',
        capabilities: ['text', 'conversation'],
        size: '7B'
      },
      {
        id: 'codellama',
        name: 'Code Llama',
        provider: 'ollama', 
        category: 'coding',
        capabilities: ['code', 'programming'],
        size: '7B'
      },
      {
        id: 'mistral',
        name: 'Mistral',
        provider: 'ollama',
        category: 'reasoning',
        capabilities: ['text', 'reasoning'],
        size: '7B'
      }
    ]
    
    // Update categorized models with fallbacks
    categorizedModels.value = {
      coding: [fallbackModels[1]],
      reasoning: [fallbackModels[2]],
      creative: [],
      general: [fallbackModels[0]],
      multimodal: [],
      uncategorized: []
    }
    
    // Auto-select first fallback model
    if (!selectedModel.value && fallbackModels.length > 0) {
      console.log('Auto-selecting fallback model:', fallbackModels[0].name)
      selectedModel.value = fallbackModels[0]
    }
  }

  // Event handlers
  function handleModelServiceEvents() {
    modelService.on('benchmarkStarted', ({ modelId }) => {
      console.log(`Benchmark started for ${modelId}`)
    })
    
    modelService.on('benchmarkCompleted', ({ modelId, results }) => {
      benchmarkResults.value.set(modelId, results)
    })
    
    modelService.on('benchmarkError', ({ modelId, error }) => {
      console.error(`Benchmark failed for ${modelId}:`, error)
    })
    
    modelService.on('error', (error) => {
      lastError.value = error
    })
  }

  // Lifecycle
  onMounted(async () => {
    handleModelServiceEvents()
    await loadModels()
  })
  
  onUnmounted(() => {
    modelService.removeAllListeners()
    modelService.destroy?.()
  })

  // Return composable interface
  return {
    // State
    categorizedModels,
    selectedModel,
    comparisonModels,
    benchmarkResults,
    providerStatus,
    isLoading,
    lastError,
    modelSelection,
    
    // Computed
    availableModels,
    totalModelsCount,
    activeProviders,
    hasSelectedModel,
    canCompareModels,
    
    // Actions
    loadModels,
    refreshModels,
    setSelectedModel,
    setModelForUseCase,
    getModelForUseCase,
    addToComparison,
    removeFromComparison,
    clearComparison,
    compareModels,
    benchmarkModel,
    getBenchmarkResults,
    getModelCapabilities,
    filterModels,
    getRecommendedModels
  }
}

export default useModelManager
