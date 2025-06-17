/**
 * ModelManager.js - Centralized model management for Roadrunner Autocoder
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - All logic commented and attributed
 * - Rule of 3: Input → Process → Output
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { EventEmitter } from '../utils/EventEmitter.js'

/**
 * ModelManager - Handles AI model selection, configuration, and performance tracking
 * 
 * Responsibilities:
 * 1. Manage available models from multiple providers (Ollama, OpenAI, etc.)
 * 2. Track model performance and capabilities
 * 3. Provide intelligent model recommendations
 * 4. Handle model switching and fallbacks
 */
export class ModelManager extends EventEmitter {
  constructor(config = {}) {
    super()
    
    // Configuration
    this.config = {
      providers: ['ollama', 'openai'],
      defaultProvider: 'ollama',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiApiKey: null,
      cacheTTL: 300000, // 5 minutes
      performanceTracking: true,
      ...config
    }
    
    // State management
    this.state = {
      availableModels: new Map(),
      modelCapabilities: new Map(),
      performanceMetrics: new Map(),
      defaultModels: new Map(),
      lastUpdate: null,
      isLoading: false
    }
    
    // Model categories following existing system
    this.categories = {
      coding: ['code', 'programming', 'development'],
      planning: ['reasoning', 'analysis', 'planning'],
      brainstorming: ['creative', 'ideation', 'discussion'],
      general: ['chat', 'assistant', 'general']
    }
    
    // Default model assignments
    this.state.defaultModels.set('coding', 'codellama:latest')
    this.state.defaultModels.set('planning', 'llama3:latest')
    this.state.defaultModels.set('brainstorming', 'codellama:latest')
    this.state.defaultModels.set('execution', 'codellama:latest')
    
    this._initializeProviders()
  }

  /**
   * Initialize model providers
   * Setup → Connect → Validate pattern
   */
  async _initializeProviders() {
    try {
      // Setup: Configure providers
      this.providers = new Map()
      
      if (this.config.providers.includes('ollama')) {
        this.providers.set('ollama', {
          name: 'Ollama',
          baseUrl: this.config.ollamaBaseUrl,
          type: 'local',
          isAvailable: false
        })
      }
      
      if (this.config.providers.includes('openai') && this.config.openaiApiKey) {
        this.providers.set('openai', {
          name: 'OpenAI',
          apiKey: this.config.openaiApiKey,
          type: 'remote',
          isAvailable: false
        })
      }
      
      // Connect: Test provider connections
      await this._testProviderConnections()
      
      // Validate: Load available models
      await this.refreshModels()
      
    } catch (error) {
      console.error('Failed to initialize providers:', error)
      this.emit('error', error)
    }
  }

  /**
   * Test connections to all configured providers
   * 
   * @returns {Promise<Object>} Connection status for each provider
   */
  async _testProviderConnections() {
    const connectionStatus = {}
    
    for (const [providerId, provider] of this.providers) {
      try {
        let isConnected = false
        
        if (providerId === 'ollama') {
          // Test Ollama connection
          const response = await fetch(`${provider.baseUrl}/api/tags`, {
            method: 'GET',
            timeout: 5000
          })
          isConnected = response.ok
        } else if (providerId === 'openai') {
          // Test OpenAI connection (simple models list)
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          })
          isConnected = response.ok
        }
        
        provider.isAvailable = isConnected
        connectionStatus[providerId] = isConnected
        
        this.emit('providerStatusChanged', { providerId, isAvailable: isConnected })
        
      } catch (error) {
        provider.isAvailable = false
        connectionStatus[providerId] = false
        console.warn(`Provider ${providerId} connection failed:`, error.message)
      }
    }
    
    return connectionStatus
  }

  /**
   * Refresh available models from all providers
   * Input → Process → Output pattern
   * 
   * @returns {Promise<Map>} Updated models map
   */
  async refreshModels() {
    try {
      // Input: Check if refresh is needed
      if (this.state.isLoading) {
        return this.state.availableModels
      }
      
      this.state.isLoading = true
      this.emit('modelsRefreshStarted')
      
      // Process: Fetch models from each provider
      const allModels = new Map()
      
      for (const [providerId, provider] of this.providers) {
        if (!provider.isAvailable) continue
        
        try {
          const models = await this._fetchModelsFromProvider(providerId, provider)
          
          // Categorize and store models
          for (const model of models) {
            const modelId = `${providerId}:${model.name}`
            const categorizedModel = {
              ...model,
              id: modelId,
              provider: providerId,
              category: this._categorizeModel(model),
              capabilities: this._analyzeModelCapabilities(model),
              lastUsed: null,
              performanceScore: 0
            }
            
            allModels.set(modelId, categorizedModel)
          }
          
        } catch (error) {
          console.error(`Failed to fetch models from ${providerId}:`, error)
        }
      }
      
      // Output: Update state and emit events
      this.state.availableModels = allModels
      this.state.lastUpdate = new Date().toISOString()
      this.state.isLoading = false
      
      this.emit('modelsRefreshed', {
        count: allModels.size,
        providers: Array.from(this.providers.keys()).filter(p => this.providers.get(p).isAvailable)
      })
      
      return allModels
      
    } catch (error) {
      this.state.isLoading = false
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Fetch models from a specific provider
   * 
   * @param {string} providerId - Provider identifier
   * @param {Object} provider - Provider configuration
   * @returns {Promise<Array>} Array of model objects
   */
  async _fetchModelsFromProvider(providerId, provider) {
    if (providerId === 'ollama') {
      const response = await fetch(`${provider.baseUrl}/api/tags`)
      const data = await response.json()
      return data.models || []
    } else if (providerId === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      return data.data || []
    }
    
    return []
  }

  /**
   * Categorize a model based on its name and metadata
   * 
   * @param {Object} model - Model object
   * @returns {string} Category name
   */
  _categorizeModel(model) {
    const modelName = model.name.toLowerCase()
    
    // Check each category for keyword matches
    for (const [category, keywords] of Object.entries(this.categories)) {
      if (keywords.some(keyword => modelName.includes(keyword))) {
        return category
      }
    }
    
    return 'general'
  }

  /**
   * Analyze model capabilities based on metadata
   * 
   * @param {Object} model - Model object
   * @returns {Object} Capabilities object
   */
  _analyzeModelCapabilities(model) {
    const capabilities = {
      coding: false,
      reasoning: false,
      creative: false,
      multimodal: false,
      streaming: true, // Assume all models support streaming
      contextLength: 4096 // Default context length
    }
    
    const modelName = model.name.toLowerCase()
    
    // Analyze based on model name patterns
    if (modelName.includes('code') || modelName.includes('programming')) {
      capabilities.coding = true
      capabilities.contextLength = 8192
    }
    
    if (modelName.includes('reasoning') || modelName.includes('analysis')) {
      capabilities.reasoning = true
    }
    
    if (modelName.includes('creative') || modelName.includes('chat')) {
      capabilities.creative = true
    }
    
    if (modelName.includes('vision') || modelName.includes('multimodal')) {
      capabilities.multimodal = true
    }
    
    // Set context length based on model size hints
    if (modelName.includes('32k') || modelName.includes('32000')) {
      capabilities.contextLength = 32768
    } else if (modelName.includes('16k') || modelName.includes('16000')) {
      capabilities.contextLength = 16384
    } else if (modelName.includes('8k') || modelName.includes('8000')) {
      capabilities.contextLength = 8192
    }
    
    return capabilities
  }

  /**
   * Get available models, optionally filtered by category
   * 
   * @param {string} category - Optional category filter
   * @returns {Array} Array of model objects
   */
  getAvailableModels(category = null) {
    const models = Array.from(this.state.availableModels.values())
    
    if (category) {
      return models.filter(model => model.category === category)
    }
    
    return models
  }

  /**
   * Get categorized models (for UI display)
   * 
   * @returns {Object} Models grouped by category
   */
  getCategorizedModels() {
    const categorized = {}
    
    for (const category of Object.keys(this.categories)) {
      categorized[category] = this.getAvailableModels(category)
    }
    
    return categorized
  }

  /**
   * Get default model for a specific use case
   * 
   * @param {string} useCase - Use case identifier
   * @returns {string} Model ID
   */
  getDefaultModel(useCase) {
    return this.state.defaultModels.get(useCase) || this.state.defaultModels.get('general')
  }

  /**
   * Set default model for a use case
   * 
   * @param {string} useCase - Use case identifier
   * @param {string} modelId - Model ID to set as default
   */
  setDefaultModel(useCase, modelId) {
    if (this.state.availableModels.has(modelId)) {
      this.state.defaultModels.set(useCase, modelId)
      this.emit('defaultModelChanged', { useCase, modelId })
    } else {
      throw new Error(`Model ${modelId} is not available`)
    }
  }

  /**
   * Get model by ID
   * 
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Model object or null if not found
   */
  getModel(modelId) {
    return this.state.availableModels.get(modelId) || null
  }

  /**
   * Record model performance metrics
   * 
   * @param {string} modelId - Model identifier
   * @param {Object} metrics - Performance metrics
   */
  recordPerformance(modelId, metrics) {
    if (!this.config.performanceTracking) return
    
    const existing = this.state.performanceMetrics.get(modelId) || {
      totalRequests: 0,
      totalTokens: 0,
      averageResponseTime: 0,
      successRate: 0,
      lastUsed: null
    }
    
    // Update metrics
    existing.totalRequests += 1
    existing.totalTokens += metrics.tokensUsed || 0
    existing.averageResponseTime = (existing.averageResponseTime + (metrics.responseTime || 0)) / 2
    existing.successRate = (existing.successRate + (metrics.success ? 1 : 0)) / 2
    existing.lastUsed = new Date().toISOString()
    
    this.state.performanceMetrics.set(modelId, existing)
    
    // Update model's performance score
    const model = this.state.availableModels.get(modelId)
    if (model) {
      model.performanceScore = this._calculatePerformanceScore(existing)
      model.lastUsed = existing.lastUsed
    }
    
    this.emit('performanceRecorded', { modelId, metrics: existing })
  }

  /**
   * Calculate performance score for a model
   * 
   * @param {Object} metrics - Performance metrics
   * @returns {number} Performance score (0-100)
   */
  _calculatePerformanceScore(metrics) {
    // Simple scoring algorithm - can be enhanced
    const responseTimeScore = Math.max(0, 100 - (metrics.averageResponseTime / 1000) * 10)
    const successRateScore = metrics.successRate * 100
    const usageScore = Math.min(100, metrics.totalRequests * 2)
    
    return (responseTimeScore + successRateScore + usageScore) / 3
  }

  /**
   * Get recommended model for a specific task
   * 
   * @param {string} taskType - Type of task
   * @param {Object} requirements - Task requirements
   * @returns {string|null} Recommended model ID
   */
  getRecommendedModel(taskType, requirements = {}) {
    const candidates = this.getAvailableModels(taskType)
    
    if (candidates.length === 0) {
      return this.getDefaultModel(taskType)
    }
    
    // Score candidates based on requirements and performance
    const scoredCandidates = candidates.map(model => {
      let score = model.performanceScore || 0
      
      // Bonus for matching capabilities
      if (requirements.coding && model.capabilities.coding) score += 20
      if (requirements.reasoning && model.capabilities.reasoning) score += 20
      if (requirements.creative && model.capabilities.creative) score += 20
      if (requirements.multimodal && model.capabilities.multimodal) score += 30
      
      // Bonus for sufficient context length
      if (requirements.contextLength && model.capabilities.contextLength >= requirements.contextLength) {
        score += 15
      }
      
      // Bonus for recent usage
      if (model.lastUsed) {
        const daysSinceUsed = (Date.now() - new Date(model.lastUsed).getTime()) / (1000 * 60 * 60 * 24)
        score += Math.max(0, 10 - daysSinceUsed)
      }
      
      return { model, score }
    })
    
    // Return highest scoring model
    scoredCandidates.sort((a, b) => b.score - a.score)
    return scoredCandidates[0]?.model.id || this.getDefaultModel(taskType)
  }

  /**
   * Update configuration
   * 
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', this.config)
    
    // Reinitialize if providers changed
    if (newConfig.providers || newConfig.ollamaBaseUrl || newConfig.openaiApiKey) {
      this._initializeProviders()
    }
  }

  /**
   * Get current state
   * 
   * @returns {Object} Current state
   */
  getState() {
    return {
      ...this.state,
      providers: Object.fromEntries(this.providers),
      config: this.config
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this.removeAllListeners()
    this.state.availableModels.clear()
    this.state.performanceMetrics.clear()
    this.providers.clear()
  }
}

export default ModelManager
