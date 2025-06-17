/**
 * PlanningService.js - Real planning operations service
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
 * PlanningService - Real implementation for plan creation, validation, and execution
 * 
 * Responsibilities:
 * 1. Create and manage execution plans using backend API
 * 2. Validate plans with real validation logic
 * 3. Execute plans with streaming progress updates
 * 4. Manage plan templates and step libraries
 */
export class PlanningService extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      maxPlanSteps: 50,
      defaultTimeout: 300000, // 5 minutes
      enableStreaming: true,
      ...config
    }
    
    this.state = {
      activePlans: new Map(),
      planHistory: [],
      templates: new Map(),
      isInitialized: false
    }
  }

  /**
   * Initialize the planning service
   * Input → Process → Output pattern
   */
  async initialize() {
    try {
      // Input: Check if already initialized
      if (this.state.isInitialized) {
        return { success: true, message: 'Already initialized' }
      }

      // Process: Load templates and verify backend connection
      await this.loadPlanTemplates()
      await this.loadStepTemplates()
      
      // Output: Mark as initialized
      this.state.isInitialized = true
      this.emit('initialized', { timestamp: new Date().toISOString() })
      
      return { success: true, message: 'Planning service initialized' }
      
    } catch (error) {
      console.error('Failed to initialize planning service:', error)
      this.emit('initializationError', { error: error.message })
      throw error
    }
  }

  /**
   * Create a new plan using backend API
   * Question → Explore → Apply pattern
   */
  async createPlan(planData) {
    try {
      // Question: What plan needs to be created?
      if (!planData.description && !planData.goal) {
        throw new Error('Plan description or goal is required')
      }

      // Explore: Prepare plan data for backend
      const planRequest = {
        name: planData.name || this._extractPlanName(planData.description || planData.goal),
        description: planData.description || planData.goal,
        goal: planData.goal || planData.description,
        language: planData.language || 'javascript',
        framework: planData.framework || '',
        complexity: planData.complexity || 'medium',
        steps: planData.steps || [],
        constraints: planData.constraints || {},
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: 'user',
          version: '1.0.0'
        }
      }

      this.emit('planCreationStarted', { planRequest })

      // Apply: Create plan via backend API
      const response = await apiService.createPlan(planRequest)
      
      if (response.success) {
        const plan = response.plan
        
        // Store in active plans
        this.state.activePlans.set(plan.id, plan)
        this.state.planHistory.unshift(plan)
        
        // Keep history manageable
        if (this.state.planHistory.length > 100) {
          this.state.planHistory = this.state.planHistory.slice(0, 100)
        }
        
        this.emit('planCreated', { plan })
        return { success: true, plan }
      } else {
        throw new Error(response.error || 'Failed to create plan')
      }
      
    } catch (error) {
      console.error('Failed to create plan:', error)
      this.emit('planCreationError', { error: error.message })
      throw error
    }
  }

  /**
   * Validate a plan using backend validation
   * Prompt → Validate → Result pattern
   */
  async validatePlan(plan) {
    try {
      // Prompt: Check if plan exists
      if (!plan || !plan.steps) {
        throw new Error('Invalid plan structure')
      }

      this.emit('planValidationStarted', { planId: plan.id })

      // Validate: Use backend validation API
      const response = await apiService.validatePlan(plan)
      
      if (response.success) {
        const validation = response.validation
        
        this.emit('planValidated', { plan, validation })
        return { success: true, validation }
      } else {
        throw new Error(response.error || 'Plan validation failed')
      }
      
    } catch (error) {
      console.error('Failed to validate plan:', error)
      this.emit('planValidationError', { error: error.message })
      throw error
    }
  }

  /**
   * Execute a plan with streaming progress updates
   * Input → Process → Output pattern with streaming
   */
  async executePlan(plan, options = {}) {
    try {
      // Input: Validate plan and options
      if (!plan || !plan.id) {
        throw new Error('Invalid plan for execution')
      }

      const executionOptions = {
        enableStreaming: this.config.enableStreaming,
        timeout: options.timeout || this.config.defaultTimeout,
        enableFileOperations: options.enableFileOperations !== false,
        enableCodeGeneration: options.enableCodeGeneration !== false,
        ...options
      }

      const executionId = this._generateExecutionId()
      
      this.emit('executionStarted', { 
        executionId, 
        plan, 
        options: executionOptions 
      })

      // Process: Execute via backend with streaming
      if (executionOptions.enableStreaming) {
        return await this._executeWithStreaming(plan, executionId, executionOptions)
      } else {
        return await this._executeWithoutStreaming(plan, executionId, executionOptions)
      }
      
    } catch (error) {
      console.error('Failed to execute plan:', error)
      this.emit('executionError', { error: error.message })
      throw error
    }
  }

  /**
   * Execute plan with streaming updates
   */
  async _executeWithStreaming(plan, executionId, options) {
    return new Promise((resolve, reject) => {
      try {
        // Create EventSource for streaming
        const eventSource = apiService.executePlanStream(plan.id, plan)
        
        let results = {
          executionId,
          planId: plan.id,
          status: 'running',
          steps: [],
          startTime: new Date().toISOString(),
          progress: 0
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            switch (data.type) {
              case 'progress':
                results.progress = data.progress
                this.emit('executionProgress', { 
                  executionId, 
                  progress: data.progress,
                  currentStep: data.currentStep 
                })
                break
                
              case 'step_completed':
                results.steps.push(data.step)
                this.emit('stepCompleted', { 
                  executionId, 
                  step: data.step 
                })
                break
                
              case 'step_error':
                this.emit('stepError', { 
                  executionId, 
                  step: data.step, 
                  error: data.error 
                })
                break
                
              case 'completed':
                results.status = 'completed'
                results.endTime = new Date().toISOString()
                results.duration = Date.now() - new Date(results.startTime).getTime()
                results.output = data.output
                
                eventSource.close()
                this.emit('executionCompleted', { executionId, results })
                resolve({ success: true, results })
                break
                
              case 'error':
                results.status = 'failed'
                results.error = data.error
                results.endTime = new Date().toISOString()
                
                eventSource.close()
                this.emit('executionError', { executionId, error: data.error })
                reject(new Error(data.error))
                break
            }
          } catch (parseError) {
            console.error('Failed to parse streaming data:', parseError)
          }
        }

        eventSource.onerror = (error) => {
          console.error('EventSource error:', error)
          eventSource.close()
          this.emit('executionError', { executionId, error: 'Streaming connection failed' })
          reject(new Error('Streaming connection failed'))
        }

        // Set timeout
        setTimeout(() => {
          if (results.status === 'running') {
            eventSource.close()
            this.emit('executionTimeout', { executionId })
            reject(new Error('Execution timeout'))
          }
        }, options.timeout)
        
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Execute plan without streaming (fallback)
   */
  async _executeWithoutStreaming(plan, executionId, options) {
    // Implementation for non-streaming execution
    // This would be a simple API call without real-time updates
    throw new Error('Non-streaming execution not yet implemented')
  }

  /**
   * Save a plan to backend storage
   */
  async savePlan(plan) {
    try {
      const response = await apiService.savePlan(plan)
      
      if (response.success) {
        this.emit('planSaved', { plan: response.plan })
        return { success: true, plan: response.plan }
      } else {
        throw new Error(response.error || 'Failed to save plan')
      }
      
    } catch (error) {
      console.error('Failed to save plan:', error)
      this.emit('planSaveError', { error: error.message })
      throw error
    }
  }

  /**
   * Load all saved plans
   */
  async loadPlans() {
    try {
      const response = await apiService.getPlans()
      
      if (response.success) {
        const plans = response.plans || []
        
        // Update local state
        this.state.planHistory = plans
        
        this.emit('plansLoaded', { plans })
        return { success: true, plans }
      } else {
        throw new Error(response.error || 'Failed to load plans')
      }
      
    } catch (error) {
      console.error('Failed to load plans:', error)
      this.emit('plansLoadError', { error: error.message })
      throw error
    }
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId) {
    try {
      const response = await apiService.deletePlan(planId)
      
      if (response.success) {
        // Remove from local state
        this.state.activePlans.delete(planId)
        this.state.planHistory = this.state.planHistory.filter(p => p.id !== planId)
        
        this.emit('planDeleted', { planId })
        return { success: true }
      } else {
        throw new Error(response.error || 'Failed to delete plan')
      }
      
    } catch (error) {
      console.error('Failed to delete plan:', error)
      this.emit('planDeleteError', { error: error.message })
      throw error
    }
  }

  /**
   * Export a plan in various formats
   */
  async exportPlan(planId, format = 'json') {
    try {
      const response = await apiService.exportPlan(planId, format)
      
      if (response.success) {
        this.emit('planExported', { planId, format, data: response.data })
        return { success: true, data: response.data }
      } else {
        throw new Error(response.error || 'Failed to export plan')
      }
      
    } catch (error) {
      console.error('Failed to export plan:', error)
      this.emit('planExportError', { error: error.message })
      throw error
    }
  }

  /**
   * Load plan templates from backend
   */
  async loadPlanTemplates() {
    try {
      const response = await apiService.getStepTemplates()
      
      if (response.success) {
        const templates = response.templates || []
        
        // Store templates
        this.state.templates.clear()
        templates.forEach(template => {
          this.state.templates.set(template.id, template)
        })
        
        this.emit('templatesLoaded', { templates })
        return { success: true, templates }
      } else {
        // Use fallback templates if backend fails
        this._loadFallbackTemplates()
        return { success: true, templates: Array.from(this.state.templates.values()) }
      }
      
    } catch (error) {
      console.warn('Failed to load templates from backend, using fallback:', error)
      this._loadFallbackTemplates()
      return { success: true, templates: Array.from(this.state.templates.values()) }
    }
  }

  /**
   * Load step templates (alias for plan templates)
   */
  async loadStepTemplates() {
    return this.loadPlanTemplates()
  }

  /**
   * Load fallback templates when backend is unavailable
   */
  _loadFallbackTemplates() {
    const fallbackTemplates = [
      {
        id: 'web-app',
        name: 'Web Application',
        description: 'Create a complete web application',
        category: 'web',
        steps: [
          { type: 'setup_project', name: 'Setup Project Structure' },
          { type: 'create_components', name: 'Create Components' },
          { type: 'setup_routing', name: 'Setup Routing' },
          { type: 'add_styling', name: 'Add Styling' },
          { type: 'add_tests', name: 'Add Tests' }
        ]
      },
      {
        id: 'api-service',
        name: 'API Service',
        description: 'Create a REST API service',
        category: 'backend',
        steps: [
          { type: 'setup_server', name: 'Setup Server' },
          { type: 'create_routes', name: 'Create Routes' },
          { type: 'add_middleware', name: 'Add Middleware' },
          { type: 'setup_database', name: 'Setup Database' },
          { type: 'add_tests', name: 'Add Tests' }
        ]
      },
      {
        id: 'generate_code',
        name: 'Generate Code',
        description: 'Generate code using AI',
        category: 'generation',
        icon: 'corvidae-code',
        inputs: ['prompt', 'language', 'framework'],
        outputs: ['code', 'tests', 'documentation'],
        parameters: {
          prompt: { type: 'text', required: true },
          language: { type: 'select', options: ['javascript', 'python', 'vue', 'react'] },
          framework: { type: 'text', required: false }
        }
      },
      {
        id: 'file_operation',
        name: 'File Operation',
        description: 'Perform file system operations',
        category: 'filesystem',
        icon: 'accipiter-file',
        inputs: ['operation', 'path', 'content'],
        outputs: ['result', 'status'],
        parameters: {
          operation: { type: 'select', options: ['create', 'read', 'update', 'delete'] },
          path: { type: 'text', required: true },
          content: { type: 'textarea', required: false }
        }
      }
    ]

    fallbackTemplates.forEach(template => {
      this.state.templates.set(template.id, template)
    })
  }

  /**
   * Get plan by ID
   */
  getPlan(planId) {
    return this.state.activePlans.get(planId) || 
           this.state.planHistory.find(p => p.id === planId)
  }

  /**
   * Get all active plans
   */
  getActivePlans() {
    return Array.from(this.state.activePlans.values())
  }

  /**
   * Get plan history
   */
  getPlanHistory() {
    return [...this.state.planHistory]
  }

  /**
   * Get available templates
   */
  getTemplates() {
    return Array.from(this.state.templates.values())
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId) {
    return this.state.templates.get(templateId)
  }

  /**
   * Utility: Extract plan name from description
   */
  _extractPlanName(description) {
    const words = description.split(' ').slice(0, 4)
    return words.join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Untitled Plan'
  }

  /**
   * Utility: Generate execution ID
   */
  _generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.state.isInitialized,
      activePlansCount: this.state.activePlans.size,
      planHistoryCount: this.state.planHistory.length,
      templatesCount: this.state.templates.size,
      config: this.config
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this.removeAllListeners()
    this.state.activePlans.clear()
    this.state.planHistory.length = 0
    this.state.templates.clear()
    this.state.isInitialized = false
  }
}

export default PlanningService
