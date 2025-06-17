/**
 * ModelService.js - Real AI model management service
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 2.0.0
 * @author Roadrunner Autocoder System
 */

import { EventEmitter } from '../utils/EventEmitter.js'
import { apiService } from './ApiService.js'

/**
 * ModelService - Real implementation for AI model management
 * 
 * Responsibilities:
 * 1. Load and manage available AI models from Ollama
 * 2. Test model connections and performance
 * 3. Handle model pulling and installation
 * 4. Categorize models by capability and use case
 * 5. Monitor model status and health
 */
export class ModelService extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      defaultProvider: 'ollama',
      refreshInterval: 30000, // 30 seconds
      connectionTimeout: 10000, // 10 seconds
      enableAutoRefresh: true,
      enableModelPulling: true,
      ...config
    }
    
    this.state = {
      availableModels: new Map(),
      categorizedModels: new Map(),
      modelStatus: new Map(),
      connectionStatus: new Map(),
      isInitialized: false,
      lastRefresh: null,
      refreshTimer: null
    }
  }

  /**
   * Initialize the model service
   * Input → Process → Output pattern
   */
  async initialize() {
    try {
      // Input: Check if already initialized
      if (this.state.isInitialized) {
        return { success: true, message: 'Already initialized' }
      }

      // Process: Load models and verify connections
      await this.refreshModels()
      await this.testOllamaConnection()
      
      // Start auto-refresh if enabled
      if (this.config.enableAutoRefresh) {
        this._startAutoRefresh()
      }
      
      // Output: Mark as initialized
      this.state.isInitialized = true
      this.emit('initialized', { 
        timestamp: new Date().toISOString(),
        modelCount: this.state.availableModels.size
      })
      
      return { success: true, message: 'Model service initialized' }
      
    } catch (error) {
      console.error('Failed to initialize model service:', error)
      this.emit('initializationError', { error: error.message })
      throw error
    }
  }

  /**
   * Refresh available models from all providers
   * Question → Explore → Apply pattern
   */
  async refreshModels() {
    try {
      // Question: What models are available?
      this.emit('modelsRefreshStarted', { timestamp: new Date().toISOString() })

      // Explore: Load models from different sources
      const [ollamaModels, categorizedModels] = await Promise.allSettled([
        this._loadOllamaModels(),
        this._loadCategorizedModels()
      ])

      // Apply: Process and store results
      let totalModels = 0
      
      if (ollamaModels.status === 'fulfilled') {
        totalModels += ollamaModels.value.length
      } else {
        console.warn('Failed to load Ollama models:', ollamaModels.reason)
      }
      
      if (categorizedModels.status === 'fulfilled') {
        this._processCategorizedModels(categorizedModels.value)
      } else {
        console.warn('Failed to load categorized models:', categorizedModels.reason)
        this._loadFallbackModels()
      }

      this.state.lastRefresh = new Date().toISOString()
      
      this.emit('modelsRefreshed', { 
        timestamp: this.state.lastRefresh,
        totalModels,
        categories: Array.from(this.state.categorizedModels.keys())
      })
      
      return { 
        success: true, 
        totalModels,
        lastRefresh: this.state.lastRefresh 
      }
      
    } catch (error) {
      console.error('Failed to refresh models:', error)
      this.emit('modelsRefreshError', { error: error.message })
      throw error
    }
  }

  /**
   * Load Ollama models
   */
  async _loadOllamaModels() {
    try {
      const response = await apiService.getModels()
      
      if (response.success) {
        const models = response.models || []
        
        // Store models with metadata
        models.forEach(model => {
          this.state.availableModels.set(model.name, {
            ...model,
            provider: 'ollama',
            lastUpdated: new Date().toISOString(),
            status: 'available'
          })
        })
        
        return models
      } else {
        throw new Error(response.error || 'Failed to load Ollama models')
      }
      
    } catch (error) {
      console.error('Failed to load Ollama models:', error)
      return []
    }
  }

  /**
   * Load categorized models
   */
  async _loadCategorizedModels() {
    try {
      const response = await apiService.getCategorizedModels()
      
      if (response.success) {
        return response.categories || {}
      } else {
        throw new Error(response.error || 'Failed to load categorized models')
      }
      
    } catch (error) {
      console.error('Failed to load categorized models:', error)
      return {}
    }
  }

  /**
   * Process categorized models data
   */
  _processCategorizedModels(categories) {
    this.state.categorizedModels.clear()
    
    // Map backend categories to frontend categories
    const categoryMapping = {
      'coder': 'coding',
      'language': 'general', 
      'remote_chat': 'general'
    }
    
    for (const [backendCategory, models] of Object.entries(categories)) {
      const frontendCategory = categoryMapping[backendCategory] || backendCategory
      
      const categoryModels = models.map(model => ({
        ...model,
        category: frontendCategory,
        provider: model.type === 'ollama_local' ? 'ollama' : 
                 model.type === 'remote_openai' ? 'openai' : 'unknown',
        lastUpdated: new Date().toISOString()
      }))
      
      // Add to existing category or create new one
      const existing = this.state.categorizedModels.get(frontendCategory) || []
      this.state.categorizedModels.set(frontendCategory, [...existing, ...categoryModels])
      
      // Also add to available models
      categoryModels.forEach(model => {
        this.state.availableModels.set(model.name || model.id, model)
      })
    }
  }

  /**
   * Load fallback models when backend is unavailable
   */
  _loadFallbackModels() {
    const fallbackCategories = {
      'Code Generation': [
        {
          name: 'llama2',
          description: 'General purpose language model',
          size: '7B',
          capabilities: ['text', 'code'],
          provider: 'ollama'
        },
        {
          name: 'codellama',
          description: 'Code-focused language model',
          size: '7B',
          capabilities: ['code', 'programming'],
          provider: 'ollama'
        }
      ],
      'Text Generation': [
        {
          name: 'mistral',
          description: 'Fast and efficient text model',
          size: '7B',
          capabilities: ['text', 'conversation'],
          provider: 'ollama'
        }
      ],
      'Multimodal': [
        {
          name: 'llava',
          description: 'Vision and language model',
          size: '7B',
          capabilities: ['text', 'vision', 'multimodal'],
          provider: 'ollama'
        }
      ]
    }

    this._processCategorizedModels(fallbackCategories)
  }

  /**
   * Test connection to Ollama
   * Prompt → Validate → Result pattern
   */
  async testOllamaConnection() {
    try {
      // Prompt: Test if Ollama is accessible
      this.emit('connectionTestStarted', { provider: 'ollama' })

      // Validate: Ping Ollama service
      const response = await apiService.pingOllama()
      
      if (response.success) {
        // Result: Store connection status
        this.state.connectionStatus.set('ollama', {
          status: 'connected',
          lastTest: new Date().toISOString(),
          latency: response.latency || 0,
          version: response.version || 'unknown'
        })
        
        this.emit('connectionTested', { 
          provider: 'ollama', 
          status: 'connected',
          latency: response.latency 
        })
        
        return { success: true, status: 'connected' }
      } else {
        throw new Error(response.error || 'Ollama connection failed')
      }
      
    } catch (error) {
      console.error('Ollama connection test failed:', error)
      
      this.state.connectionStatus.set('ollama', {
        status: 'disconnected',
        lastTest: new Date().toISOString(),
        error: error.message
      })
      
      this.emit('connectionTestFailed', { 
        provider: 'ollama', 
        error: error.message 
      })
      
      return { success: false, error: error.message }
    }
  }

  /**
   * Test connection to any provider
   */
  async testConnection(provider, config = {}) {
    try {
      this.emit('connectionTestStarted', { provider })

      const response = await apiService.testConnection(
        provider,
        config.apiKey,
        config.ollamaUrl,
        config.model
      )
      
      if (response.success) {
        this.state.connectionStatus.set(provider, {
          status: 'connected',
          lastTest: new Date().toISOString(),
          latency: response.latency || 0,
          config
        })
        
        this.emit('connectionTested', { 
          provider, 
          status: 'connected',
          latency: response.latency 
        })
        
        return { success: true, status: 'connected' }
      } else {
        throw new Error(response.error || 'Connection test failed')
      }
      
    } catch (error) {
      console.error(`${provider} connection test failed:`, error)
      
      this.state.connectionStatus.set(provider, {
        status: 'disconnected',
        lastTest: new Date().toISOString(),
        error: error.message
      })
      
      this.emit('connectionTestFailed', { provider, error: error.message })
      return { success: false, error: error.message }
    }
  }

  /**
   * Pull/install a model from Ollama
   * Input → Process → Output pattern with streaming
   */
  async pullModel(modelName) {
    try {
      // Input: Validate model name and permissions
      if (!modelName) {
        throw new Error('Model name is required')
      }
      
      if (!this.config.enableModelPulling) {
        throw new Error('Model pulling is disabled')
      }

      this.emit('modelPullStarted', { modelName })

      // Process: Pull model with streaming progress
      return await this._pullModelWithStreaming(modelName)
      
    } catch (error) {
      console.error('Failed to pull model:', error)
      this.emit('modelPullError', { modelName, error: error.message })
      throw error
    }
  }

  /**
   * Pull model with streaming progress updates
   */
  async _pullModelWithStreaming(modelName) {
    return new Promise((resolve, reject) => {
      try {
        // Create streaming connection for model pulling
        const response = apiService.pullModelStream(modelName)
        
        let pullResult = {
          modelName,
          status: 'pulling',
          progress: 0,
          startTime: new Date().toISOString()
        }

        response.then(streamResponse => {
          if (!streamResponse.ok) {
            throw new Error(`HTTP ${streamResponse.status}: ${streamResponse.statusText}`)
          }

          const reader = streamResponse.body.getReader()
          const decoder = new TextDecoder()

          function read() {
            return reader.read().then(({ done, value }) => {
              if (done) {
                pullResult.status = 'completed'
                pullResult.endTime = new Date().toISOString()
                
                // Add to available models
                this.state.availableModels.set(modelName, {
                  name: modelName,
                  provider: 'ollama',
                  status: 'available',
                  pulledAt: pullResult.endTime
                })
                
                this.emit('modelPullCompleted', { modelName, result: pullResult })
                resolve({ success: true, result: pullResult })
                return
              }

              const chunk = decoder.decode(value)
              const lines = chunk.split('\n')
              
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const data = JSON.parse(line)
                    
                    if (data.status) {
                      pullResult.status = data.status
                    }
                    
                    if (data.completed && data.total) {
                      pullResult.progress = Math.round((data.completed / data.total) * 100)
                    }
                    
                    this.emit('modelPullProgress', { 
                      modelName, 
                      progress: pullResult.progress,
                      status: pullResult.status,
                      data 
                    })
                    
                  } catch (parseError) {
                    console.warn('Failed to parse pull progress:', line)
                  }
                }
              }

              return read()
            })
          }

          return read()
        }).catch(error => {
          pullResult.status = 'failed'
          pullResult.error = error.message
          pullResult.endTime = new Date().toISOString()
          
          this.emit('modelPullError', { modelName, error: error.message })
          reject(error)
        })
        
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return Array.from(this.state.availableModels.values())
  }

  /**
   * Get models by category
   */
  getModelsByCategory(category) {
    return this.state.categorizedModels.get(category) || []
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.state.categorizedModels.keys())
  }

  /**
   * Get categorized models
   */
  getCategorizedModels() {
    const result = {}
    for (const [category, models] of this.state.categorizedModels) {
      result[category] = models
    }
    return result
  }

  /**
   * Get model by name
   */
  getModel(modelName) {
    return this.state.availableModels.get(modelName)
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(capability) {
    return this.getAvailableModels().filter(model => 
      model.capabilities && model.capabilities.includes(capability)
    )
  }

  /**
   * Get connection status for a provider
   */
  getConnectionStatus(provider) {
    return this.state.connectionStatus.get(provider) || {
      status: 'unknown',
      lastTest: null
    }
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses() {
    const result = {}
    for (const [provider, status] of this.state.connectionStatus) {
      result[provider] = status
    }
    return result
  }

  /**
   * Check if a model is available
   */
  isModelAvailable(modelName) {
    const model = this.state.availableModels.get(modelName)
    return model && model.status === 'available'
  }

  /**
   * Get recommended models for a task
   */
  getRecommendedModels(taskType) {
    const recommendations = {
      'code_generation': ['codellama', 'llama2', 'mistral'],
      'text_generation': ['llama2', 'mistral', 'vicuna'],
      'conversation': ['llama2', 'mistral', 'vicuna'],
      'multimodal': ['llava', 'bakllava'],
      'planning': ['llama2', 'mistral', 'codellama'],
      'brainstorming': ['llama2', 'mistral', 'vicuna']
    }
    
    const recommended = recommendations[taskType] || []
    return recommended
      .map(name => this.getModel(name))
      .filter(model => model && this.isModelAvailable(model.name))
  }

  /**
   * Start auto-refresh timer
   */
  _startAutoRefresh() {
    if (this.state.refreshTimer) {
      clearInterval(this.state.refreshTimer)
    }
    
    this.state.refreshTimer = setInterval(() => {
      this.refreshModels().catch(error => {
        console.error('Auto-refresh failed:', error)
      })
    }, this.config.refreshInterval)
  }

  /**
   * Stop auto-refresh timer
   */
  _stopAutoRefresh() {
    if (this.state.refreshTimer) {
      clearInterval(this.state.refreshTimer)
      this.state.refreshTimer = null
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.state.isInitialized,
      availableModelsCount: this.state.availableModels.size,
      categoriesCount: this.state.categorizedModels.size,
      lastRefresh: this.state.lastRefresh,
      connectionStatuses: this.getAllConnectionStatuses(),
      config: this.config
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    
    // Restart auto-refresh if interval changed
    if (newConfig.refreshInterval && this.config.enableAutoRefresh) {
      this._startAutoRefresh()
    }
    
    // Stop auto-refresh if disabled
    if (newConfig.enableAutoRefresh === false) {
      this._stopAutoRefresh()
    }
    
    this.emit('configUpdated', this.config)
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this._stopAutoRefresh()
    this.removeAllListeners()
    this.state.availableModels.clear()
    this.state.categorizedModels.clear()
    this.state.modelStatus.clear()
    this.state.connectionStatus.clear()
    this.state.isInitialized = false
  }
}

export default ModelService
