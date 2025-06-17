/**
 * planningStore.js - Pinia store for planning state management
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'

/**
 * Planning Store - Manages planning state and operations
 * 
 * Responsibilities:
 * 1. Store current plan and plan history
 * 2. Manage selected models for planning
 * 3. Handle plan validation states
 * 4. Track plan execution progress
 */
export const usePlanningStore = defineStore('planning', () => {
  // State - Reactive references
  const currentPlan = ref(null)
  const planHistory = ref([])
  const selectedModels = ref([])
  const validationResults = ref(null)
  const isCreatingPlan = ref(false)
  const isValidatingPlan = ref(false)
  const isExecutingPlan = ref(false)
  const executionProgress = ref(0)
  const lastError = ref(null)
  
  // Plan templates and step library
  const planTemplates = ref(new Map())
  const stepTemplates = ref(new Map())
  
  // Plan builder state
  const planBuilder = reactive({
    steps: [],
    connections: [],
    selectedStep: null,
    draggedStep: null,
    canvasZoom: 1,
    canvasOffset: { x: 0, y: 0 }
  })

  // Computed properties
  const hasCurrentPlan = computed(() => currentPlan.value !== null)
  const canExecutePlan = computed(() => {
    return hasCurrentPlan.value && 
           validationResults.value?.isValid && 
           !isExecutingPlan.value
  })
  const planCount = computed(() => planHistory.value.length)
  const recentPlans = computed(() => 
    planHistory.value
      .slice(-10)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  )

  // Actions - Plan Management
  
  /**
   * Set the current plan
   * Input → Process → Output pattern
   * 
   * @param {Object} plan - Plan object to set as current
   */
  function setCurrentPlan(plan) {
    try {
      // Input validation
      if (!plan || typeof plan !== 'object') {
        throw new Error('Invalid plan object')
      }
      
      // Process: Set plan and add to history if new
      currentPlan.value = plan
      
      if (!planHistory.value.find(p => p.id === plan.id)) {
        planHistory.value.push({
          ...plan,
          createdAt: plan.createdAt || new Date().toISOString()
        })
      }
      
      // Output: Clear previous validation and errors
      validationResults.value = null
      lastError.value = null
      
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  /**
   * Create a new plan using backend API
   * Question → Explore → Apply pattern
   * 
   * @param {Object} planRequest - Plan creation request
   * @returns {Promise<Object>} Created plan
   */
  async function createPlan(planRequest) {
    try {
      // Question: What plan needs to be created?
      if (!planRequest.description) {
        throw new Error('Plan description is required')
      }
      
      isCreatingPlan.value = true
      lastError.value = null
      
      // Explore: Use backend API to create plan
      const apiService = await import('../services/ApiService.js')
      
      const response = await apiService.default.createPlan({
        name: planRequest.name || extractPlanName(planRequest.description),
        description: planRequest.description,
        goal: planRequest.description,
        language: planRequest.language || 'javascript',
        framework: planRequest.framework,
        complexity: planRequest.complexity || 'medium',
        steps: planRequest.steps || []
      })
      
      if (response.success) {
        // Apply: Set as current plan
        setCurrentPlan(response.plan)
        return response.plan
      } else {
        throw new Error(response.error || 'Failed to create plan')
      }
      
    } catch (error) {
      console.error('Failed to create plan via backend, using fallback:', error)
      
      // Fallback to local plan creation
      const plan = {
        id: generatePlanId(),
        name: planRequest.name || extractPlanName(planRequest.description),
        description: planRequest.description,
        steps: planRequest.steps || [],
        modelId: planRequest.modelId,
        constraints: planRequest.constraints || {},
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          estimatedDuration: 0,
          complexity: 'medium'
        },
        status: 'draft'
      }
      
      setCurrentPlan(plan)
      return plan
      
    } finally {
      isCreatingPlan.value = false
    }
  }

  /**
   * Validate the current plan
   * Prompt → Validate → Result pattern
   * 
   * @returns {Promise<Object>} Validation results
   */
  async function validateCurrentPlan() {
    try {
      // Prompt: Check if there's a plan to validate
      if (!currentPlan.value) {
        throw new Error('No current plan to validate')
      }
      
      isValidatingPlan.value = true
      lastError.value = null
      
      // Validate: Run validation checks
      const validation = await runPlanValidation(currentPlan.value)
      
      // Result: Store validation results
      validationResults.value = validation
      
      return validation
      
    } catch (error) {
      lastError.value = error
      validationResults.value = { isValid: false, errors: [error.message] }
      throw error
    } finally {
      isValidatingPlan.value = false
    }
  }

  /**
   * Update plan execution progress
   * 
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} status - Current status
   */
  function updateExecutionProgress(progress, status = '') {
    executionProgress.value = Math.max(0, Math.min(100, progress))
    
    if (currentPlan.value) {
      currentPlan.value.executionStatus = status
      currentPlan.value.executionProgress = progress
    }
  }

  /**
   * Add a step to the plan builder
   * 
   * @param {Object} step - Step to add
   * @param {Object} position - Position on canvas
   */
  function addStepToBuilder(step, position = { x: 0, y: 0 }) {
    const newStep = {
      id: generateStepId(),
      ...step,
      position,
      connections: {
        inputs: [],
        outputs: []
      }
    }
    
    planBuilder.steps.push(newStep)
    planBuilder.selectedStep = newStep.id
  }

  /**
   * Remove a step from the plan builder
   * 
   * @param {string} stepId - ID of step to remove
   */
  function removeStepFromBuilder(stepId) {
    const stepIndex = planBuilder.steps.findIndex(s => s.id === stepId)
    if (stepIndex !== -1) {
      planBuilder.steps.splice(stepIndex, 1)
      
      // Remove connections involving this step
      planBuilder.connections = planBuilder.connections.filter(
        conn => conn.from !== stepId && conn.to !== stepId
      )
      
      // Clear selection if this step was selected
      if (planBuilder.selectedStep === stepId) {
        planBuilder.selectedStep = null
      }
    }
  }

  /**
   * Connect two steps in the plan builder
   * 
   * @param {string} fromStepId - Source step ID
   * @param {string} toStepId - Target step ID
   * @param {string} outputKey - Output key from source
   * @param {string} inputKey - Input key to target
   */
  function connectSteps(fromStepId, toStepId, outputKey = 'output', inputKey = 'input') {
    const connection = {
      id: generateConnectionId(),
      from: fromStepId,
      to: toStepId,
      outputKey,
      inputKey
    }
    
    planBuilder.connections.push(connection)
  }

  /**
   * Generate plan from builder state
   * 
   * @returns {Object} Generated plan
   */
  function generatePlanFromBuilder() {
    const plan = {
      id: generatePlanId(),
      name: 'Visual Plan',
      description: 'Plan created using visual builder',
      steps: planBuilder.steps.map(step => ({
        id: step.id,
        type: step.type,
        name: step.name,
        parameters: step.parameters || {},
        dependencies: planBuilder.connections
          .filter(conn => conn.to === step.id)
          .map(conn => conn.from)
      })),
      metadata: {
        createdAt: new Date().toISOString(),
        createdWith: 'visual-builder',
        stepCount: planBuilder.steps.length,
        connectionCount: planBuilder.connections.length
      },
      status: 'draft'
    }
    
    return plan
  }

  // Actions - Template Management
  
  /**
   * Load plan templates
   */
  function loadPlanTemplates() {
    // Default templates
    const defaultTemplates = [
      {
        id: 'web-app',
        name: 'Web Application',
        description: 'Create a complete web application',
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
        steps: [
          { type: 'setup_server', name: 'Setup Server' },
          { type: 'create_routes', name: 'Create Routes' },
          { type: 'add_middleware', name: 'Add Middleware' },
          { type: 'setup_database', name: 'Setup Database' },
          { type: 'add_tests', name: 'Add Tests' }
        ]
      }
    ]
    
    defaultTemplates.forEach(template => {
      planTemplates.value.set(template.id, template)
    })
  }

  /**
   * Load step templates from data file
   */
  function loadStepTemplates() {
    // Import step templates from data file
    import('../data/stepTemplates.js').then(module => {
      const templates = module.STEP_TEMPLATES
      
      // Convert templates to the format expected by the store
      Object.entries(templates).forEach(([key, template]) => {
        const stepTemplate = {
          id: key.toLowerCase(),
          key: key,
          name: template.name,
          icon: template.icon,
          category: template.category,
          inputs: template.inputs,
          outputs: template.outputs,
          description: template.description,
          estimatedDuration: template.estimatedDuration,
          parameters: template.parameters
        }
        
        stepTemplates.value.set(stepTemplate.id, stepTemplate)
      })
      
      console.log(`Loaded ${stepTemplates.value.size} step templates`)
    }).catch(error => {
      console.error('Failed to load step templates:', error)
      
      // Fallback to basic templates
      const fallbackTemplates = [
        {
          id: 'generate_code',
          name: 'Generate Code',
          icon: 'corvidae-code',
          category: 'generation',
          description: 'Generate code based on description',
          parameters: {
            prompt: { type: 'textarea', label: 'Description', required: true },
            language: { type: 'select', label: 'Language', options: ['javascript', 'python', 'vue'], required: true }
          }
        },
        {
          id: 'file_operation',
          name: 'File Operation',
          icon: 'accipiter-file',
          category: 'filesystem',
          description: 'Perform file operations',
          parameters: {
            operation: { type: 'select', label: 'Operation', options: ['create', 'read', 'update', 'delete'], required: true },
            path: { type: 'text', label: 'File Path', required: true }
          }
        }
      ]
      
      fallbackTemplates.forEach(template => {
        stepTemplates.value.set(template.id, template)
      })
    })
  }

  // Utility functions
  
  function generatePlanId() {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  function generateStepId() {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  function generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  function extractPlanName(description) {
    // Extract a reasonable name from description
    const words = description.split(' ').slice(0, 4)
    return words.join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim()
  }
  
  async function runPlanValidation(plan) {
    // Mock validation - in real implementation would use validation service
    const issues = []
    
    if (!plan.steps || plan.steps.length === 0) {
      issues.push('Plan must have at least one step')
    }
    
    if (plan.steps && plan.steps.length > 50) {
      issues.push('Plan has too many steps (maximum 50)')
    }
    
    // Check for circular dependencies
    const stepIds = plan.steps.map(s => s.id)
    for (const step of plan.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.includes(dep)) {
            issues.push(`Step ${step.name} depends on non-existent step ${dep}`)
          }
        }
      }
    }
    
    return {
      isValid: issues.length === 0,
      errors: issues,
      warnings: [],
      suggestions: issues.length === 0 ? ['Plan looks good!'] : [],
      estimatedDuration: plan.steps ? plan.steps.length * 30000 : 0 // 30s per step
    }
  }

  // Initialize templates
  loadPlanTemplates()
  loadStepTemplates()

  // Return store interface
  return {
    // State
    currentPlan,
    planHistory,
    selectedModels,
    validationResults,
    isCreatingPlan,
    isValidatingPlan,
    isExecutingPlan,
    executionProgress,
    lastError,
    planTemplates,
    stepTemplates,
    planBuilder,
    
    // Computed
    hasCurrentPlan,
    canExecutePlan,
    planCount,
    recentPlans,
    
    // Actions
    setCurrentPlan,
    createPlan,
    validateCurrentPlan,
    updateExecutionProgress,
    addStepToBuilder,
    removeStepFromBuilder,
    connectSteps,
    generatePlanFromBuilder,
    loadPlanTemplates,
    loadStepTemplates
  }
})

export default usePlanningStore
