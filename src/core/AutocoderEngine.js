/**
 * AutocoderEngine.js - Core autocoding engine
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { EventEmitter } from '../utils/EventEmitter.js'

/**
 * AutocoderEngine - Central orchestrator for autocoding operations
 * 
 * Responsibilities:
 * 1. Coordinate between planning, execution, and brainstorming services
 * 2. Manage autocoding workflows and pipelines
 * 3. Handle complex multi-step operations
 * 4. Provide unified interface for autocoding tasks
 */
export class AutocoderEngine extends EventEmitter {
  constructor(config = {}) {
    super()
    
    // Configuration
    this.config = {
      enablePipelines: true,
      enableWorkflows: true,
      maxConcurrentOperations: 3,
      operationTimeout: 600000, // 10 minutes
      enableLogging: true,
      enableMetrics: true,
      ...config
    }
    
    // State management
    this.state = {
      activeOperations: new Map(),
      operationHistory: [],
      pipelines: new Map(),
      workflows: new Map(),
      metrics: new Map()
    }
    
    // Service references (will be injected)
    this.services = {
      planning: null,
      execution: null,
      brainstorming: null,
      conference: null,
      model: null
    }
    
    this._initializeEngine()
  }

  /**
   * Initialize the engine
   */
  _initializeEngine() {
    // Set up default workflows
    this._setupDefaultWorkflows()
    
    // Initialize metrics
    this._initializeMetrics()
  }

  /**
   * Set up default workflows
   */
  _setupDefaultWorkflows() {
    this.state.workflows.set('simple_autocoding', {
      name: 'Simple Autocoding',
      steps: ['planning', 'execution'],
      description: 'Basic plan and execute workflow'
    })
    
    this.state.workflows.set('full_autocoding', {
      name: 'Full Autocoding',
      steps: ['brainstorming', 'planning', 'execution'],
      description: 'Complete workflow with brainstorming'
    })
    
    this.state.workflows.set('conference_autocoding', {
      name: 'Conference Autocoding',
      steps: ['conference', 'planning', 'execution'],
      description: 'Multi-agent conference followed by execution'
    })
  }

  /**
   * Initialize metrics tracking
   */
  _initializeMetrics() {
    this.state.metrics.set('operations_completed', 0)
    this.state.metrics.set('operations_failed', 0)
    this.state.metrics.set('total_execution_time', 0)
    this.state.metrics.set('average_execution_time', 0)
  }

  /**
   * Initialize services with backend connections
   */
  async initializeServices() {
    try {
      // Import services dynamically with default imports
      const PlanningServiceModule = await import('../services/PlanningService.js')
      const ExecutionServiceModule = await import('../services/ExecutionService.js')
      const BrainstormingServiceModule = await import('../services/BrainstormingService.js')
      const ConferenceServiceModule = await import('../services/ConferenceService.js')
      const ModelServiceModule = await import('../services/ModelService.js')
      
      const PlanningService = PlanningServiceModule.default || PlanningServiceModule.PlanningService
      const ExecutionService = ExecutionServiceModule.default || ExecutionServiceModule.ExecutionService
      const BrainstormingService = BrainstormingServiceModule.default || BrainstormingServiceModule.BrainstormingService
      const ConferenceService = ConferenceServiceModule.default || ConferenceServiceModule.ConferenceService
      const ModelService = ModelServiceModule.default || ModelServiceModule.ModelService
      
      // Initialize services with error handling
      const serviceInitPromises = [
        this._initializeService('planning', () => new PlanningService(this.config)),
        this._initializeService('execution', () => new ExecutionService(this.config)),
        this._initializeService('brainstorming', () => new BrainstormingService(this.config)),
        this._initializeService('conference', () => new ConferenceService(this.config)),
        this._initializeService('model', () => new ModelService(this.config))
      ]
      
      // Wait for all services to initialize (or fail gracefully)
      await Promise.allSettled(serviceInitPromises)
      
      // Set up service event forwarding
      this._setupServiceEventForwarding()
      
      const initializedServices = Object.entries(this.services)
        .filter(([_, service]) => service !== null)
        .map(([name, _]) => name)
      
      this.emit('servicesInitialized', { services: initializedServices })
      
    } catch (error) {
      console.error('Failed to initialize services:', error)
      this.emit('serviceInitializationError', { error: error.message })
      // Don't throw - allow partial initialization
    }
  }

  /**
   * Initialize a single service with error handling
   */
  async _initializeService(serviceName, serviceFactory) {
    try {
      const service = serviceFactory()
      if (service && typeof service.initialize === 'function') {
        await service.initialize()
      }
      this.services[serviceName] = service
      console.log(`Service ${serviceName} initialized successfully`)
    } catch (error) {
      console.error(`Failed to initialize ${serviceName} service:`, error)
      this.services[serviceName] = null
    }
  }

  /**
   * Set up event forwarding from services
   */
  _setupServiceEventForwarding() {
    // Forward planning events
    if (this.services.planning) {
      this.services.planning.on('planCreated', (data) => this.emit('planCreated', data))
      this.services.planning.on('planValidated', (data) => this.emit('planValidated', data))
      this.services.planning.on('planSaved', (data) => this.emit('planSaved', data))
    }
    
    // Forward execution events
    if (this.services.execution) {
      this.services.execution.on('executionStarted', (data) => this.emit('executionStarted', data))
      this.services.execution.on('executionProgress', (data) => this.emit('executionProgress', data))
      this.services.execution.on('executionCompleted', (data) => this.emit('executionCompleted', data))
      this.services.execution.on('codeGenerationCompleted', (data) => this.emit('codeGenerated', data))
    }
    
    // Forward brainstorming events
    if (this.services.brainstorming) {
      this.services.brainstorming.on('sessionStarted', (data) => this.emit('brainstormingStarted', data))
      this.services.brainstorming.on('ideaGenerated', (data) => this.emit('ideaGenerated', data))
      this.services.brainstorming.on('sessionCompleted', (data) => this.emit('brainstormingCompleted', data))
    }
    
    // Forward conference events
    if (this.services.conference) {
      this.services.conference.on('conferenceStarted', (data) => this.emit('conferenceStarted', data))
      this.services.conference.on('roundCompleted', (data) => this.emit('conferenceRoundCompleted', data))
      this.services.conference.on('conferenceCompleted', (data) => this.emit('conferenceCompleted', data))
    }
    
    // Forward model events
    if (this.services.model) {
      this.services.model.on('modelsUpdated', (data) => this.emit('modelsUpdated', data))
      this.services.model.on('modelPullProgress', (data) => this.emit('modelPullProgress', data))
      this.services.model.on('connectionTested', (data) => this.emit('connectionTested', data))
    }
  }

  /**
   * Execute complete autocoding workflow
   * Input → Process → Output pattern
   * 
   * @param {Object} request - Autocoding request
   * @returns {Promise<Object>} Workflow result
   */
  async executeAutocodingWorkflow(request) {
    try {
      // Input: Validate request
      if (!request.goal) {
        throw new Error('Autocoding goal is required')
      }
      
      const operationId = this._generateOperationId()
      const operation = {
        id: operationId,
        type: 'autocoding_workflow',
        request,
        status: 'running',
        startTime: new Date().toISOString(),
        steps: [],
        results: {}
      }
      
      this.state.activeOperations.set(operationId, operation)
      this.emit('workflowStarted', { operationId, request })
      
      // Process: Execute workflow steps
      
      // Step 1: Brainstorm if requested
      if (request.enableBrainstorming) {
        const brainstormResult = await this._executeBrainstormingStep(request, operation)
        operation.results.brainstorming = brainstormResult
      }
      
      // Step 2: Create plan
      const planResult = await this._executePlanningStep(request, operation)
      operation.results.planning = planResult
      
      // Step 3: Execute plan
      const executionResult = await this._executeExecutionStep(planResult.plan, operation)
      operation.results.execution = executionResult
      
      // Output: Finalize operation
      operation.status = 'completed'
      operation.endTime = new Date().toISOString()
      operation.duration = Date.now() - new Date(operation.startTime).getTime()
      
      this.state.operationHistory.push(operation)
      this.state.activeOperations.delete(operationId)
      
      // Update metrics
      this._updateMetrics(operation)
      
      this.emit('workflowCompleted', { operationId, results: operation.results })
      
      return {
        success: true,
        operationId,
        results: operation.results,
        duration: operation.duration
      }
      
    } catch (error) {
      this.emit('workflowError', { error: error.message })
      this._updateMetrics(null, error)
      throw error
    }
  }

  /**
   * Execute brainstorming step
   * 
   * @param {Object} request - Original request
   * @param {Object} operation - Operation context
   * @returns {Promise<Object>} Brainstorming result
   */
  async _executeBrainstormingStep(request, operation) {
    if (!this.services.brainstorming) {
      throw new Error('Brainstorming service not initialized')
    }
    
    const sessionConfig = {
      topic: request.goal,
      duration: request.brainstormingDuration || 300000, // 5 minutes
      maxIdeas: request.maxIdeas || 20
    }
    
    const result = await this.services.brainstorming.startSession(sessionConfig)
    
    operation.steps.push({
      name: 'brainstorming',
      status: 'completed',
      result: result.sessionId
    })
    
    return result
  }

  /**
   * Execute planning step
   * 
   * @param {Object} request - Original request
   * @param {Object} operation - Operation context
   * @returns {Promise<Object>} Planning result
   */
  async _executePlanningStep(request, operation) {
    if (!this.services.planning) {
      throw new Error('Planning service not initialized')
    }
    
    const planData = {
      name: request.planName || `Autocode: ${request.goal}`,
      description: request.goal,
      goal: request.goal,
      language: request.language || 'javascript',
      framework: request.framework,
      complexity: request.complexity || 'medium',
      context: {
        brainstormingResults: operation.results.brainstorming
      }
    }
    
    const result = await this.services.planning.createPlan(planData)
    
    operation.steps.push({
      name: 'planning',
      status: 'completed',
      result: result.id
    })
    
    return result
  }

  /**
   * Execute execution step
   * 
   * @param {Object} plan - Plan to execute
   * @param {Object} operation - Operation context
   * @returns {Promise<Object>} Execution result
   */
  async _executeExecutionStep(plan, operation) {
    if (!this.services.execution) {
      throw new Error('Execution service not initialized')
    }
    
    const result = await this.services.execution.executePlan(plan, {
      operationId: operation.id,
      enableFileOperations: true,
      enableCodeGeneration: true
    })
    
    operation.steps.push({
      name: 'execution',
      status: 'completed',
      result: result.executionId
    })
    
    return result
  }

  /**
   * Generate code directly without a formal plan
   * 
   * @param {Object} codeRequest - Code generation request
   * @returns {Promise<Object>} Generated code result
   */
  async generateCode(codeRequest) {
    try {
      if (!this.services.execution) {
        throw new Error('Execution service not initialized')
      }
      
      const result = await this.services.execution.generateCode(codeRequest)
      
      this.emit('codeGenerated', { result })
      
      return result
      
    } catch (error) {
      this.emit('codeGenerationError', { error: error.message })
      throw error
    }
  }

  /**
   * Start a brainstorming session
   * 
   * @param {Object} sessionRequest - Brainstorming session request
   * @returns {Promise<Object>} Session result
   */
  async startBrainstormingSession(sessionRequest) {
    try {
      if (!this.services.brainstorming) {
        throw new Error('Brainstorming service not initialized')
      }
      
      const result = await this.services.brainstorming.startSession(sessionRequest)
      
      this.emit('brainstormingSessionStarted', { result })
      
      return result
      
    } catch (error) {
      this.emit('brainstormingError', { error: error.message })
      throw error
    }
  }

  /**
   * Start a conference session
   * 
   * @param {Object} conferenceRequest - Conference request
   * @returns {Promise<Object>} Conference result
   */
  async startConferenceSession(conferenceRequest) {
    try {
      if (!this.services.conference) {
        throw new Error('Conference service not initialized')
      }
      
      const result = await this.services.conference.startConference(
        conferenceRequest.topic,
        conferenceRequest.agentIds,
        conferenceRequest.config
      )
      
      this.emit('conferenceSessionStarted', { result })
      
      return result
      
    } catch (error) {
      this.emit('conferenceError', { error: error.message })
      throw error
    }
  }

  /**
   * Get available models
   * 
   * @returns {Promise<Array>} Available models
   */
  async getAvailableModels() {
    try {
      if (!this.services.model) {
        throw new Error('Model service not initialized')
      }
      
      return await this.services.model.getAvailableModels()
      
    } catch (error) {
      console.error('Failed to get available models:', error)
      return []
    }
  }

  /**
   * Test model connection
   * 
   * @param {string} provider - Provider name
   * @param {Object} config - Provider configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(provider, config) {
    try {
      if (!this.services.model) {
        throw new Error('Model service not initialized')
      }
      
      return await this.services.model.testConnection(provider, config)
      
    } catch (error) {
      console.error('Failed to test connection:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update metrics
   * 
   * @param {Object} operation - Completed operation
   * @param {Error} error - Error if operation failed
   */
  _updateMetrics(operation, error = null) {
    if (error) {
      const failed = this.state.metrics.get('operations_failed') || 0
      this.state.metrics.set('operations_failed', failed + 1)
    } else if (operation) {
      const completed = this.state.metrics.get('operations_completed') || 0
      this.state.metrics.set('operations_completed', completed + 1)
      
      const totalTime = this.state.metrics.get('total_execution_time') || 0
      const newTotalTime = totalTime + operation.duration
      this.state.metrics.set('total_execution_time', newTotalTime)
      
      const averageTime = newTotalTime / (completed + 1)
      this.state.metrics.set('average_execution_time', averageTime)
    }
  }

  /**
   * Generate unique operation ID
   * 
   * @returns {string} Operation ID
   */
  _generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current engine state
   * 
   * @returns {Object} Current state
   */
  getState() {
    return {
      activeOperationsCount: this.state.activeOperations.size,
      operationHistoryCount: this.state.operationHistory.length,
      servicesInitialized: Object.values(this.services).every(service => service !== null),
      metrics: Object.fromEntries(this.state.metrics),
      config: this.config
    }
  }

  /**
   * Get operation by ID
   * 
   * @param {string} operationId - Operation identifier
   * @returns {Object|null} Operation object or null if not found
   */
  getOperation(operationId) {
    return this.state.activeOperations.get(operationId) || 
           this.state.operationHistory.find(op => op.id === operationId) || 
           null
  }

  /**
   * Get all active operations
   * 
   * @returns {Array} Array of active operations
   */
  getActiveOperations() {
    return Array.from(this.state.activeOperations.values())
  }

  /**
   * Cancel an active operation
   * 
   * @param {string} operationId - Operation identifier
   * @returns {boolean} Whether cancellation was successful
   */
  cancelOperation(operationId) {
    const operation = this.state.activeOperations.get(operationId)
    if (operation && operation.status === 'running') {
      operation.status = 'cancelled'
      operation.endTime = new Date().toISOString()
      
      // Move to history
      this.state.operationHistory.push(operation)
      this.state.activeOperations.delete(operationId)
      
      this.emit('operationCancelled', { operationId })
      return true
    }
    
    return false
  }

  /**
   * Update configuration
   * 
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', this.config)
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this.removeAllListeners()
    
    // Destroy services
    for (const service of Object.values(this.services)) {
      if (service && typeof service.destroy === 'function') {
        await service.destroy()
      }
    }
    
    // Clear state
    this.state.activeOperations.clear()
    this.state.operationHistory.length = 0
    this.state.pipelines.clear()
    this.state.workflows.clear()
    this.state.metrics.clear()
  }
}

export default AutocoderEngine
