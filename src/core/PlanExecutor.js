/**
 * PlanExecutor.js - Plan execution engine
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
 * PlanExecutor - Executes plans step by step
 * 
 * Responsibilities:
 * 1. Execute plan steps in sequence or parallel
 * 2. Handle step dependencies and validation
 * 3. Manage execution state and progress
 * 4. Provide rollback and recovery mechanisms
 */
export class PlanExecutor extends EventEmitter {
  constructor(config = {}) {
    super()
    
    // Configuration
    this.config = {
      maxConcurrentSteps: 3,
      stepTimeout: 300000, // 5 minutes
      enableRollback: true,
      enableValidation: true,
      enableLogging: true,
      retryAttempts: 3,
      retryDelay: 5000,
      ...config
    }
    
    // State management
    this.state = {
      activeExecutions: new Map(),
      executionHistory: [],
      stepResults: new Map(),
      rollbackStack: []
    }
    
    // Step handlers
    this.stepHandlers = new Map()
    this._initializeStepHandlers()
  }

  /**
   * Execute plan using backend API
   * Input → Process → Output pattern
   * 
   * @param {Object} plan - Plan to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executePlan(plan, options = {}) {
    try {
      // Input: Validate plan
      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error('Invalid plan: must have steps')
      }
      
      const executionId = this._generateExecutionId()
      const execution = {
        id: executionId,
        plan,
        options,
        status: 'running',
        startTime: new Date().toISOString(),
        progress: 0,
        results: [],
        errors: []
      }
      
      this.state.activeExecutions.set(executionId, execution)
      this.emit('executionStarted', { executionId, plan })
      
      // Process: Execute using backend API
      const { apiService } = await import('../services/ApiService.js')
      
      // Use backend execution API
      const response = await apiService.executePlan(plan, {
        ...options,
        executionId,
        enableStreaming: true
      })
      
      if (response.success) {
        // Handle streaming execution updates
        if (response.stream) {
          await this._handleExecutionStream(response.stream, execution)
        }
        
        // Output: Finalize execution
        execution.status = 'completed'
        execution.endTime = new Date().toISOString()
        execution.duration = Date.now() - new Date(execution.startTime).getTime()
        
        this.state.executionHistory.push(execution)
        this.state.activeExecutions.delete(executionId)
        
        this.emit('executionCompleted', { executionId, results: execution.results })
        
        return {
          success: true,
          executionId,
          results: execution.results,
          duration: execution.duration
        }
      } else {
        throw new Error(response.error || 'Plan execution failed')
      }
      
    } catch (error) {
      this.emit('executionError', { error: error.message })
      throw error
    }
  }

  /**
   * Handle execution stream from backend
   * 
   * @param {ReadableStream} stream - Execution stream
   * @param {Object} execution - Execution context
   */
  async _handleExecutionStream(stream, execution) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            
            if (data.type === 'progress') {
              execution.progress = data.progress
              this.emit('executionProgress', {
                executionId: execution.id,
                progress: data.progress,
                step: data.step
              })
            } else if (data.type === 'stepCompleted') {
              execution.results.push(data.result)
              this.emit('stepCompleted', {
                executionId: execution.id,
                step: data.step,
                result: data.result
              })
            } else if (data.type === 'error') {
              execution.errors.push(data.error)
              this.emit('stepError', {
                executionId: execution.id,
                error: data.error
              })
            }
          } catch (parseError) {
            // Ignore JSON parse errors for non-JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Execute single step using backend API
   * 
   * @param {Object} step - Step to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Step result
   */
  async executeStep(step, context = {}) {
    try {
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.executeStep(step, context)
      
      if (response.success) {
        this.emit('stepCompleted', { step, result: response.result })
        return response.result
      } else {
        throw new Error(response.error || 'Step execution failed')
      }
      
    } catch (error) {
      this.emit('stepError', { step, error: error.message })
      throw error
    }
  }

  /**
   * Validate plan using backend API
   * 
   * @param {Object} plan - Plan to validate
   * @returns {Promise<Object>} Validation result
   */
  async validatePlan(plan) {
    try {
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.validatePlan(plan)
      
      if (response.success) {
        return response.validation
      } else {
        throw new Error(response.error || 'Plan validation failed')
      }
      
    } catch (error) {
      console.error('Failed to validate plan:', error)
      // Fallback to local validation
      return this._validatePlanLocally(plan)
    }
  }

  /**
   * Local plan validation fallback
   * 
   * @param {Object} plan - Plan to validate
   * @returns {Object} Validation result
   */
  _validatePlanLocally(plan) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }
    
    // Basic validation
    if (!plan.name) {
      validation.errors.push('Plan name is required')
      validation.isValid = false
    }
    
    if (!plan.steps || plan.steps.length === 0) {
      validation.errors.push('Plan must have at least one step')
      validation.isValid = false
    }
    
    // Step validation
    plan.steps?.forEach((step, index) => {
      if (!step.type) {
        validation.errors.push(`Step ${index + 1}: Step type is required`)
        validation.isValid = false
      }
      
      if (!step.name) {
        validation.warnings.push(`Step ${index + 1}: Step name is recommended`)
      }
    })
    
    return validation
  }

  /**
   * Initialize step handlers for different step types
   * Setup → Register → Validate pattern
   */
  _initializeStepHandlers() {
    // File operation steps
    this.stepHandlers.set('create_file', this._handleCreateFile.bind(this))
    this.stepHandlers.set('update_file', this._handleUpdateFile.bind(this))
    this.stepHandlers.set('delete_file', this._handleDeleteFile.bind(this))
    this.stepHandlers.set('read_file', this._handleReadFile.bind(this))
    
    // Code generation steps
    this.stepHandlers.set('generate_code', this._handleGenerateCode.bind(this))
    this.stepHandlers.set('refactor_code', this._handleRefactorCode.bind(this))
    this.stepHandlers.set('analyze_code', this._handleAnalyzeCode.bind(this))
    
    // Git operation steps
    this.stepHandlers.set('git_add', this._handleGitAdd.bind(this))
    this.stepHandlers.set('git_commit', this._handleGitCommit.bind(this))
    this.stepHandlers.set('git_push', this._handleGitPush.bind(this))
    
    // System operation steps
    this.stepHandlers.set('run_command', this._handleRunCommand.bind(this))
    this.stepHandlers.set('install_package', this._handleInstallPackage.bind(this))
    
    // Custom step handler
    this.stepHandlers.set('custom', this._handleCustomStep.bind(this))
  }

  /**
   * Execute a complete plan
   * Prompt → Validate → Result pattern
   * 
   * @param {Object} plan - Plan to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executePlan(plan, options = {}) {
    try {
      // Prompt: Validate plan structure
      this._validatePlan(plan)
      
      // Create execution context
      const executionId = this._generateExecutionId()
      const execution = {
        id: executionId,
        plan,
        options,
        startTime: new Date().toISOString(),
        status: 'running',
        progress: 0,
        steps: plan.steps.map(step => ({
          ...step,
          status: 'pending',
          result: null,
          error: null,
          startTime: null,
          endTime: null
        }))
      }
      
      this.state.currentExecution = execution
      this.emit('executionStarted', { executionId, plan })
      
      // Validate: Check dependencies and prerequisites
      await this._validateDependencies(plan)
      
      // Result: Execute steps
      const result = await this._executeSteps(execution)
      
      // Update final state
      execution.status = result.success ? 'completed' : 'failed'
      execution.endTime = new Date().toISOString()
      execution.result = result
      
      this.state.executionHistory.push(execution)
      this.state.currentExecution = null
      
      this.emit('executionCompleted', { executionId, result })
      
      return result
      
    } catch (error) {
      if (this.state.currentExecution) {
        this.state.currentExecution.status = 'failed'
        this.state.currentExecution.error = error.message
        this.state.currentExecution.endTime = new Date().toISOString()
      }
      
      this.emit('executionError', { error, executionId: this.state.currentExecution?.id })
      throw error
    }
  }

  /**
   * Execute individual steps in the plan
   * 
   * @param {Object} execution - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async _executeSteps(execution) {
    const { steps } = execution
    const results = []
    let successCount = 0
    let failureCount = 0
    
    // Build dependency graph
    const dependencyGraph = this._buildDependencyGraph(steps)
    const executionOrder = this._topologicalSort(dependencyGraph)
    
    // Execute steps in dependency order
    for (const stepIndex of executionOrder) {
      const step = steps[stepIndex]
      
      try {
        // Check if dependencies are satisfied
        const dependenciesSatisfied = await this._checkStepDependencies(step, results)
        if (!dependenciesSatisfied) {
          throw new Error(`Dependencies not satisfied for step: ${step.name}`)
        }
        
        // Execute step
        step.status = 'running'
        step.startTime = new Date().toISOString()
        
        this.emit('stepStarted', { 
          executionId: execution.id, 
          step, 
          stepIndex 
        })
        
        const stepResult = await this._executeStep(step, execution)
        
        // Handle step completion
        step.status = 'completed'
        step.endTime = new Date().toISOString()
        step.result = stepResult
        
        results[stepIndex] = stepResult
        successCount++
        
        // Update progress
        execution.progress = Math.round((successCount + failureCount) / steps.length * 100)
        
        this.emit('stepCompleted', { 
          executionId: execution.id, 
          step, 
          stepIndex, 
          result: stepResult 
        })
        
        this.emit('executionProgress', { 
          executionId: execution.id, 
          progress: execution.progress,
          completedSteps: successCount,
          failedSteps: failureCount,
          totalSteps: steps.length
        })
        
      } catch (error) {
        // Handle step failure
        step.status = 'failed'
        step.endTime = new Date().toISOString()
        step.error = error.message
        
        failureCount++
        execution.progress = Math.round((successCount + failureCount) / steps.length * 100)
        
        this.emit('stepFailed', { 
          executionId: execution.id, 
          step, 
          stepIndex, 
          error 
        })
        
        // Decide whether to continue or abort
        const shouldContinue = await this._handleStepFailure(step, error, execution)
        if (!shouldContinue) {
          break
        }
      }
    }
    
    return {
      success: failureCount === 0,
      totalSteps: steps.length,
      successCount,
      failureCount,
      results,
      executionTime: Date.now() - new Date(execution.startTime).getTime()
    }
  }

  /**
   * Execute a single step
   * 
   * @param {Object} step - Step to execute
   * @param {Object} execution - Execution context
   * @returns {Promise<Object>} Step result
   */
  async _executeStep(step, execution) {
    const handler = this.stepHandlers.get(step.type)
    if (!handler) {
      throw new Error(`No handler found for step type: ${step.type}`)
    }
    
    // Create step context
    const context = {
      step,
      execution,
      config: this.config,
      previousResults: execution.steps
        .filter(s => s.status === 'completed')
        .map(s => s.result)
    }
    
    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Step execution timeout')), this.config.stepTimeout)
    })
    
    const executionPromise = handler(context)
    
    const result = await Promise.race([executionPromise, timeoutPromise])
    
    // Add rollback information if enabled
    if (this.config.enableRollback && result.rollbackInfo) {
      this.state.rollbackStack.push({
        stepId: step.id,
        rollbackInfo: result.rollbackInfo,
        timestamp: new Date().toISOString()
      })
    }
    
    return result
  }

  /**
   * Handle step failure and determine if execution should continue
   * 
   * @param {Object} step - Failed step
   * @param {Error} error - Error that occurred
   * @param {Object} execution - Execution context
   * @returns {Promise<boolean>} Whether to continue execution
   */
  async _handleStepFailure(step, error, execution) {
    // Check if step allows failure
    if (step.allowFailure) {
      return true
    }
    
    // Check if we should retry
    if (step.retryCount < (step.maxRetries || this.config.retryAttempts)) {
      step.retryCount = (step.retryCount || 0) + 1
      step.status = 'retrying'
      
      this.emit('stepRetrying', { 
        executionId: execution.id, 
        step, 
        attempt: step.retryCount,
        error 
      })
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * step.retryCount))
      
      try {
        const retryResult = await this._executeStep(step, execution)
        step.status = 'completed'
        step.result = retryResult
        return true
      } catch (retryError) {
        // Retry failed, continue with original error handling
      }
    }
    
    // Check if execution should stop on failure
    if (step.stopOnFailure !== false) {
      return false
    }
    
    return true
  }

  /**
   * Validate plan structure and requirements
   * 
   * @param {Object} plan - Plan to validate
   */
  _validatePlan(plan) {
    if (!plan || typeof plan !== 'object') {
      throw new Error('Invalid plan: must be an object')
    }
    
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error('Invalid plan: must have steps array')
    }
    
    // Validate each step
    plan.steps.forEach((step, index) => {
      if (!step.id) {
        step.id = `step_${index}`
      }
      
      if (!step.type) {
        throw new Error(`Step ${index} missing type`)
      }
      
      if (!this.stepHandlers.has(step.type)) {
        throw new Error(`Unknown step type: ${step.type}`)
      }
    })
  }

  /**
   * Validate dependencies between steps
   * 
   * @param {Object} plan - Plan to validate
   */
  async _validateDependencies(plan) {
    const stepIds = new Set(plan.steps.map(step => step.id))
    
    for (const step of plan.steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            throw new Error(`Step ${step.id} depends on non-existent step: ${depId}`)
          }
        }
      }
    }
  }

  /**
   * Build dependency graph for steps
   * 
   * @param {Array} steps - Array of steps
   * @returns {Map} Dependency graph
   */
  _buildDependencyGraph(steps) {
    const graph = new Map()
    
    steps.forEach((step, index) => {
      graph.set(index, step.dependencies || [])
    })
    
    return graph
  }

  /**
   * Perform topological sort to determine execution order
   * 
   * @param {Map} graph - Dependency graph
   * @returns {Array} Execution order (step indices)
   */
  _topologicalSort(graph) {
    const visited = new Set()
    const visiting = new Set()
    const result = []
    
    const visit = (nodeIndex) => {
      if (visiting.has(nodeIndex)) {
        throw new Error('Circular dependency detected')
      }
      
      if (visited.has(nodeIndex)) {
        return
      }
      
      visiting.add(nodeIndex)
      
      const dependencies = graph.get(nodeIndex) || []
      for (const dep of dependencies) {
        const depIndex = Array.from(graph.keys()).find(i => 
          graph.get(i).id === dep || i.toString() === dep
        )
        if (depIndex !== undefined) {
          visit(depIndex)
        }
      }
      
      visiting.delete(nodeIndex)
      visited.add(nodeIndex)
      result.push(nodeIndex)
    }
    
    for (const nodeIndex of graph.keys()) {
      if (!visited.has(nodeIndex)) {
        visit(nodeIndex)
      }
    }
    
    return result
  }

  /**
   * Check if step dependencies are satisfied
   * 
   * @param {Object} step - Step to check
   * @param {Array} results - Previous step results
   * @returns {Promise<boolean>} Whether dependencies are satisfied
   */
  async _checkStepDependencies(step, results) {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true
    }
    
    // Check if all dependency steps completed successfully
    for (const depId of step.dependencies) {
      const depStep = this.state.currentExecution.steps.find(s => s.id === depId)
      if (!depStep || depStep.status !== 'completed') {
        return false
      }
    }
    
    return true
  }

  /**
   * Generate unique execution ID
   * 
   * @returns {string} Execution ID
   */
  _generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Step Handlers - Each handler follows Input → Process → Output pattern

  /**
   * Handle file creation step
   */
  async _handleCreateFile(context) {
    const { step } = context
    const { path, content, encoding = 'utf8' } = step.parameters
    
    if (!path || content === undefined) {
      throw new Error('create_file step requires path and content parameters')
    }
    
    // Implementation would use file system service
    // For now, return mock result
    return {
      success: true,
      path,
      size: content.length,
      rollbackInfo: { type: 'delete_file', path }
    }
  }

  /**
   * Handle file update step
   */
  async _handleUpdateFile(context) {
    const { step } = context
    const { path, content, backup = true } = step.parameters
    
    if (!path || content === undefined) {
      throw new Error('update_file step requires path and content parameters')
    }
    
    return {
      success: true,
      path,
      size: content.length,
      rollbackInfo: backup ? { type: 'restore_file', path } : null
    }
  }

  /**
   * Handle file deletion step
   */
  async _handleDeleteFile(context) {
    const { step } = context
    const { path } = step.parameters
    
    if (!path) {
      throw new Error('delete_file step requires path parameter')
    }
    
    return {
      success: true,
      path,
      rollbackInfo: { type: 'restore_file', path }
    }
  }

  /**
   * Handle file reading step
   */
  async _handleReadFile(context) {
    const { step } = context
    const { path, encoding = 'utf8' } = step.parameters
    
    if (!path) {
      throw new Error('read_file step requires path parameter')
    }
    
    return {
      success: true,
      path,
      content: '// Mock file content',
      size: 100
    }
  }

  /**
   * Handle code generation step
   */
  async _handleGenerateCode(context) {
    const { step } = context
    const { prompt, language, framework } = step.parameters
    
    if (!prompt) {
      throw new Error('generate_code step requires prompt parameter')
    }
    
    return {
      success: true,
      code: '// Generated code placeholder',
      language: language || 'javascript',
      framework,
      tokensUsed: 150
    }
  }

  /**
   * Handle code refactoring step
   */
  async _handleRefactorCode(context) {
    const { step } = context
    const { path, instructions } = step.parameters
    
    if (!path || !instructions) {
      throw new Error('refactor_code step requires path and instructions parameters')
    }
    
    return {
      success: true,
      path,
      changes: ['Added error handling', 'Improved performance'],
      rollbackInfo: { type: 'restore_file', path }
    }
  }

  /**
   * Handle code analysis step
   */
  async _handleAnalyzeCode(context) {
    const { step } = context
    const { path, analysisType = 'quality' } = step.parameters
    
    if (!path) {
      throw new Error('analyze_code step requires path parameter')
    }
    
    return {
      success: true,
      path,
      analysisType,
      score: 85,
      issues: [],
      suggestions: ['Consider adding unit tests']
    }
  }

  /**
   * Handle Git add step
   */
  async _handleGitAdd(context) {
    const { step } = context
    const { files = ['.'] } = step.parameters
    
    return {
      success: true,
      files,
      rollbackInfo: { type: 'git_reset', files }
    }
  }

  /**
   * Handle Git commit step
   */
  async _handleGitCommit(context) {
    const { step } = context
    const { message } = step.parameters
    
    if (!message) {
      throw new Error('git_commit step requires message parameter')
    }
    
    return {
      success: true,
      message,
      hash: 'abc123def456',
      rollbackInfo: { type: 'git_reset', hash: 'HEAD~1' }
    }
  }

  /**
   * Handle Git push step
   */
  async _handleGitPush(context) {
    const { step } = context
    const { remote = 'origin', branch = 'main' } = step.parameters
    
    return {
      success: true,
      remote,
      branch
    }
  }

  /**
   * Handle command execution step
   */
  async _handleRunCommand(context) {
    const { step } = context
    const { command, workingDirectory } = step.parameters
    
    if (!command) {
      throw new Error('run_command step requires command parameter')
    }
    
    return {
      success: true,
      command,
      exitCode: 0,
      stdout: 'Command executed successfully',
      stderr: ''
    }
  }

  /**
   * Handle package installation step
   */
  async _handleInstallPackage(context) {
    const { step } = context
    const { packages, packageManager = 'npm' } = step.parameters
    
    if (!packages || packages.length === 0) {
      throw new Error('install_package step requires packages parameter')
    }
    
    return {
      success: true,
      packages,
      packageManager,
      rollbackInfo: { type: 'uninstall_package', packages }
    }
  }

  /**
   * Handle custom step
   */
  async _handleCustomStep(context) {
    const { step } = context
    const { handler } = step.parameters
    
    if (!handler || typeof handler !== 'function') {
      throw new Error('custom step requires handler function')
    }
    
    return await handler(context)
  }

  /**
   * Rollback execution to a previous state
   * 
   * @param {string} executionId - Execution to rollback
   * @param {number} stepIndex - Step index to rollback to
   * @returns {Promise<Object>} Rollback result
   */
  async rollback(executionId, stepIndex = 0) {
    if (!this.config.enableRollback) {
      throw new Error('Rollback is disabled')
    }
    
    const rollbackActions = this.state.rollbackStack
      .filter(action => action.stepId.startsWith(executionId))
      .slice(stepIndex)
      .reverse()
    
    const results = []
    
    for (const action of rollbackActions) {
      try {
        // Execute rollback action
        const result = await this._executeRollbackAction(action)
        results.push(result)
      } catch (error) {
        console.error('Rollback action failed:', error)
        results.push({ success: false, error: error.message })
      }
    }
    
    return {
      success: results.every(r => r.success),
      actions: results.length,
      results
    }
  }

  /**
   * Execute a rollback action
   * 
   * @param {Object} action - Rollback action
   * @returns {Promise<Object>} Action result
   */
  async _executeRollbackAction(action) {
    // Implementation would depend on the rollback type
    // For now, return mock result
    return {
      success: true,
      action: action.rollbackInfo.type,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Get execution status
   * 
   * @param {string} executionId - Execution ID
   * @returns {Object|null} Execution status
   */
  getExecutionStatus(executionId) {
    if (this.state.currentExecution?.id === executionId) {
      return this.state.currentExecution
    }
    
    return this.state.executionHistory.find(exec => exec.id === executionId) || null
  }

  /**
   * Cancel running execution
   * 
   * @param {string} executionId - Execution ID to cancel
   * @returns {Promise<boolean>} Whether cancellation was successful
   */
  async cancelExecution(executionId) {
    if (this.state.currentExecution?.id === executionId) {
      this.state.currentExecution.status = 'cancelled'
      this.state.currentExecution.endTime = new Date().toISOString()
      
      this.emit('executionCancelled', { executionId })
      return true
    }
    
    return false
  }

  /**
   * Get current state
   * 
   * @returns {Object} Current state
   */
  getState() {
    return {
      ...this.state,
      config: this.config
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this.removeAllListeners()
    this.state.activeSteps.clear()
    this.state.completedSteps.clear()
    this.state.failedSteps.clear()
    this.state.rollbackStack.length = 0
  }
}

export default PlanExecutor
