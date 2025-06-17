/**
 * PlanValidator.js - Intelligent plan validation engine
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { STEP_TEMPLATES } from '../data/stepTemplates.js'

/**
 * Plan Validator Engine
 * 
 * Comprehensive plan validation with:
 * 1. Circular dependency detection
 * 2. Input/output validation
 * 3. Resource availability checks
 * 4. Execution time estimation
 * 5. Risk assessment
 */
export class PlanValidator {
  constructor(options = {}) {
    this.options = {
      maxExecutionTime: 3600, // 1 hour default
      maxSteps: 50,
      enableResourceChecks: true,
      enableTimeEstimation: true,
      ...options
    }
    
    this.validationRules = new Map()
    this.resourceProviders = new Map()
    
    this.initializeDefaultRules()
  }

  /**
   * Validate a complete plan
   * Question → Explore → Apply pattern
   * 
   * @param {Object} plan - Plan to validate
   * @returns {Promise<Object>} Validation result
   */
  async validatePlan(plan) {
    try {
      // Question: Is the plan structure valid?
      const structureValidation = this.validatePlanStructure(plan)
      if (!structureValidation.isValid) {
        return structureValidation
      }
      
      // Explore: Run comprehensive validation checks
      const issues = []
      const warnings = []
      const suggestions = []
      
      // Check for circular dependencies
      const circularDeps = this.detectCircularDependencies(plan)
      if (circularDeps.length > 0) {
        issues.push(...circularDeps.map(cycle => ({
          type: 'error',
          category: 'dependencies',
          message: `Circular dependency detected: ${cycle.join(' → ')}`,
          steps: cycle,
          severity: 'high'
        })))
      }
      
      // Validate step inputs and outputs
      const ioValidation = await this.validateInputsOutputs(plan)
      issues.push(...ioValidation.issues)
      warnings.push(...ioValidation.warnings)
      
      // Check resource availability
      if (this.options.enableResourceChecks) {
        const resourceValidation = await this.validateResourceAvailability(plan)
        issues.push(...resourceValidation.issues)
        warnings.push(...resourceValidation.warnings)
      }
      
      // Estimate execution time
      let estimatedTime = 0
      if (this.options.enableTimeEstimation) {
        estimatedTime = this.estimateExecutionTime(plan)
        
        if (estimatedTime > this.options.maxExecutionTime) {
          warnings.push({
            type: 'warning',
            category: 'performance',
            message: `Plan execution time (${Math.round(estimatedTime / 60)}min) exceeds recommended maximum`,
            estimatedTime,
            maxTime: this.options.maxExecutionTime,
            severity: 'medium'
          })
        }
      }
      
      // Validate step count
      if (plan.steps.length > this.options.maxSteps) {
        warnings.push({
          type: 'warning',
          category: 'complexity',
          message: `Plan has ${plan.steps.length} steps, consider breaking into smaller plans`,
          stepCount: plan.steps.length,
          maxSteps: this.options.maxSteps,
          severity: 'low'
        })
      }
      
      // Generate optimization suggestions
      const optimizations = this.generateOptimizationSuggestions(plan)
      suggestions.push(...optimizations)
      
      // Apply: Return comprehensive validation result
      return {
        isValid: issues.length === 0,
        issues,
        warnings,
        suggestions,
        estimatedTime,
        riskLevel: this.calculateRiskLevel(issues, warnings),
        metrics: {
          stepCount: plan.steps.length,
          dependencyCount: this.countDependencies(plan),
          complexityScore: this.calculateComplexityScore(plan)
        }
      }
      
    } catch (error) {
      return {
        isValid: false,
        issues: [{
          type: 'error',
          category: 'validation',
          message: `Validation failed: ${error.message}`,
          severity: 'high'
        }],
        warnings: [],
        suggestions: [],
        estimatedTime: 0,
        riskLevel: 'high'
      }
    }
  }

  /**
   * Validate basic plan structure
   * Input → Process → Output pattern
   * 
   * @param {Object} plan - Plan to validate
   * @returns {Object} Structure validation result
   */
  validatePlanStructure(plan) {
    // Input: Check basic structure
    if (!plan) {
      return {
        isValid: false,
        issues: [{
          type: 'error',
          category: 'structure',
          message: 'Plan is null or undefined',
          severity: 'high'
        }]
      }
    }
    
    if (!plan.steps || !Array.isArray(plan.steps)) {
      return {
        isValid: false,
        issues: [{
          type: 'error',
          category: 'structure',
          message: 'Plan must have a steps array',
          severity: 'high'
        }]
      }
    }
    
    if (plan.steps.length === 0) {
      return {
        isValid: false,
        issues: [{
          type: 'error',
          category: 'structure',
          message: 'Plan must have at least one step',
          severity: 'high'
        }]
      }
    }
    
    // Process: Validate each step structure
    const issues = []
    
    plan.steps.forEach((step, index) => {
      if (!step.id) {
        issues.push({
          type: 'error',
          category: 'structure',
          message: `Step ${index + 1} is missing required 'id' field`,
          stepIndex: index,
          severity: 'high'
        })
      }
      
      if (!step.name && !step.title) {
        issues.push({
          type: 'error',
          category: 'structure',
          message: `Step ${index + 1} is missing required 'name' or 'title' field`,
          stepIndex: index,
          stepId: step.id,
          severity: 'medium'
        })
      }
      
      if (!step.type && !step.category) {
        issues.push({
          type: 'warning',
          category: 'structure',
          message: `Step ${index + 1} is missing 'type' or 'category' field`,
          stepIndex: index,
          stepId: step.id,
          severity: 'low'
        })
      }
    })
    
    // Output: Return validation result
    return {
      isValid: issues.filter(issue => issue.type === 'error').length === 0,
      issues
    }
  }

  /**
   * Detect circular dependencies in plan
   * Prompt → Validate → Result pattern
   * 
   * @param {Object} plan - Plan to check
   * @returns {Array} Array of circular dependency cycles
   */
  detectCircularDependencies(plan) {
    // Prompt: Build dependency graph
    const graph = new Map()
    const stepIds = new Set()
    
    plan.steps.forEach(step => {
      stepIds.add(step.id)
      graph.set(step.id, step.dependencies || [])
    })
    
    // Validate: Use DFS to detect cycles
    const visited = new Set()
    const recursionStack = new Set()
    const cycles = []
    
    function dfs(nodeId, path = []) {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), nodeId])
        }
        return
      }
      
      if (visited.has(nodeId)) {
        return
      }
      
      visited.add(nodeId)
      recursionStack.add(nodeId)
      path.push(nodeId)
      
      const dependencies = graph.get(nodeId) || []
      dependencies.forEach(depId => {
        if (stepIds.has(depId)) {
          dfs(depId, [...path])
        }
      })
      
      recursionStack.delete(nodeId)
    }
    
    // Result: Check all nodes
    stepIds.forEach(stepId => {
      if (!visited.has(stepId)) {
        dfs(stepId)
      }
    })
    
    return cycles
  }

  /**
   * Validate step inputs and outputs
   * 
   * @param {Object} plan - Plan to validate
   * @returns {Promise<Object>} Input/output validation result
   */
  async validateInputsOutputs(plan) {
    const issues = []
    const warnings = []
    
    // Build available outputs map
    const availableOutputs = new Map()
    
    plan.steps.forEach(step => {
      const template = STEP_TEMPLATES[step.type] || STEP_TEMPLATES[step.templateKey]
      if (template && template.outputs) {
        template.outputs.forEach(output => {
          if (!availableOutputs.has(output)) {
            availableOutputs.set(output, [])
          }
          availableOutputs.get(output).push(step.id)
        })
      }
    })
    
    // Validate each step's inputs
    plan.steps.forEach((step, index) => {
      const template = STEP_TEMPLATES[step.type] || STEP_TEMPLATES[step.templateKey]
      
      if (!template) {
        warnings.push({
          type: 'warning',
          category: 'template',
          message: `Unknown step template: ${step.type || step.templateKey}`,
          stepIndex: index,
          stepId: step.id,
          severity: 'medium'
        })
        return
      }
      
      // Check required inputs
      if (template.inputs) {
        template.inputs.forEach(input => {
          const hasInput = step.parameters && step.parameters[input]
          const hasConnection = step.connections && 
            step.connections.some(conn => conn.input === input)
          
          if (!hasInput && !hasConnection) {
            issues.push({
              type: 'error',
              category: 'inputs',
              message: `Step '${step.name}' is missing required input: ${input}`,
              stepIndex: index,
              stepId: step.id,
              missingInput: input,
              severity: 'high'
            })
          }
        })
      }
      
      // Validate parameter types
      if (template.parameters && step.parameters) {
        Object.entries(template.parameters).forEach(([paramName, paramDef]) => {
          const value = step.parameters[paramName]
          
          if (paramDef.required && (!value || value === '')) {
            issues.push({
              type: 'error',
              category: 'parameters',
              message: `Step '${step.name}' missing required parameter: ${paramName}`,
              stepIndex: index,
              stepId: step.id,
              missingParameter: paramName,
              severity: 'high'
            })
          }
          
          if (value && paramDef.type === 'select' && paramDef.options) {
            if (!paramDef.options.includes(value)) {
              issues.push({
                type: 'error',
                category: 'parameters',
                message: `Invalid value '${value}' for parameter '${paramName}' in step '${step.name}'`,
                stepIndex: index,
                stepId: step.id,
                invalidParameter: paramName,
                invalidValue: value,
                validOptions: paramDef.options,
                severity: 'medium'
              })
            }
          }
        })
      }
    })
    
    return { issues, warnings }
  }

  /**
   * Validate resource availability
   * 
   * @param {Object} plan - Plan to validate
   * @returns {Promise<Object>} Resource validation result
   */
  async validateResourceAvailability(plan) {
    const issues = []
    const warnings = []
    
    // Check file system resources
    const fileOperations = plan.steps.filter(step => 
      step.type === 'FILE_OPERATION' || step.category === 'filesystem'
    )
    
    fileOperations.forEach((step, index) => {
      if (step.parameters && step.parameters.path) {
        const path = step.parameters.path
        
        // Basic path validation
        if (path.includes('..')) {
          issues.push({
            type: 'error',
            category: 'security',
            message: `Potentially unsafe file path in step '${step.name}': ${path}`,
            stepIndex: index,
            stepId: step.id,
            unsafePath: path,
            severity: 'high'
          })
        }
        
        // Check for path conflicts
        const conflictingSteps = fileOperations.filter(otherStep => 
          otherStep.id !== step.id && 
          otherStep.parameters && 
          otherStep.parameters.path === path
        )
        
        if (conflictingSteps.length > 0) {
          warnings.push({
            type: 'warning',
            category: 'conflicts',
            message: `Multiple steps operate on the same file: ${path}`,
            stepId: step.id,
            conflictingSteps: conflictingSteps.map(s => s.id),
            filePath: path,
            severity: 'medium'
          })
        }
      }
    })
    
    return { issues, warnings }
  }

  /**
   * Estimate total execution time
   * 
   * @param {Object} plan - Plan to estimate
   * @returns {number} Estimated time in seconds
   */
  estimateExecutionTime(plan) {
    let totalTime = 0
    
    plan.steps.forEach(step => {
      const template = STEP_TEMPLATES[step.type] || STEP_TEMPLATES[step.templateKey]
      const baseTime = template ? template.estimatedDuration : 60
      
      // Apply complexity multipliers
      let multiplier = 1
      
      if (step.parameters) {
        // Larger inputs take more time
        Object.values(step.parameters).forEach(value => {
          if (typeof value === 'string' && value.length > 1000) {
            multiplier *= 1.5
          }
        })
      }
      
      totalTime += baseTime * multiplier
    })
    
    return totalTime
  }

  /**
   * Calculate risk level based on issues and warnings
   * 
   * @param {Array} issues - Validation issues
   * @param {Array} warnings - Validation warnings
   * @returns {string} Risk level (low, medium, high)
   */
  calculateRiskLevel(issues, warnings) {
    const highSeverityIssues = issues.filter(issue => issue.severity === 'high').length
    const mediumSeverityIssues = issues.filter(issue => issue.severity === 'medium').length
    const totalWarnings = warnings.length
    
    if (highSeverityIssues > 0) {
      return 'high'
    }
    
    if (mediumSeverityIssues > 2 || totalWarnings > 5) {
      return 'medium'
    }
    
    return 'low'
  }

  /**
   * Generate optimization suggestions
   * 
   * @param {Object} plan - Plan to optimize
   * @returns {Array} Optimization suggestions
   */
  generateOptimizationSuggestions(plan) {
    const suggestions = []
    
    // Suggest parallelization opportunities
    const parallelizableSteps = this.findParallelizableSteps(plan)
    if (parallelizableSteps.length > 0) {
      suggestions.push({
        type: 'optimization',
        category: 'performance',
        message: 'Some steps can be executed in parallel to reduce total time',
        parallelizableSteps,
        potentialTimeSaving: '20-40%',
        severity: 'low'
      })
    }
    
    // Suggest step consolidation
    const consolidationOpportunities = this.findConsolidationOpportunities(plan)
    if (consolidationOpportunities.length > 0) {
      suggestions.push({
        type: 'optimization',
        category: 'simplification',
        message: 'Consider consolidating similar steps to reduce complexity',
        consolidationOpportunities,
        severity: 'low'
      })
    }
    
    return suggestions
  }

  /**
   * Find steps that can be executed in parallel
   * 
   * @param {Object} plan - Plan to analyze
   * @returns {Array} Groups of parallelizable steps
   */
  findParallelizableSteps(plan) {
    const parallelGroups = []
    const dependencyMap = new Map()
    
    // Build dependency map
    plan.steps.forEach(step => {
      dependencyMap.set(step.id, step.dependencies || [])
    })
    
    // Find independent steps
    const independentSteps = plan.steps.filter(step => {
      const deps = dependencyMap.get(step.id)
      return !deps || deps.length === 0
    })
    
    if (independentSteps.length > 1) {
      parallelGroups.push(independentSteps.map(step => step.id))
    }
    
    return parallelGroups
  }

  /**
   * Find opportunities to consolidate similar steps
   * 
   * @param {Object} plan - Plan to analyze
   * @returns {Array} Consolidation opportunities
   */
  findConsolidationOpportunities(plan) {
    const opportunities = []
    const stepsByType = new Map()
    
    // Group steps by type
    plan.steps.forEach(step => {
      const type = step.type || step.category
      if (!stepsByType.has(type)) {
        stepsByType.set(type, [])
      }
      stepsByType.get(type).push(step)
    })
    
    // Find types with multiple steps
    stepsByType.forEach((steps, type) => {
      if (steps.length > 2) {
        opportunities.push({
          type,
          steps: steps.map(step => step.id),
          count: steps.length
        })
      }
    })
    
    return opportunities
  }

  /**
   * Count total dependencies in plan
   * 
   * @param {Object} plan - Plan to analyze
   * @returns {number} Total dependency count
   */
  countDependencies(plan) {
    return plan.steps.reduce((count, step) => {
      return count + (step.dependencies ? step.dependencies.length : 0)
    }, 0)
  }

  /**
   * Calculate complexity score
   * 
   * @param {Object} plan - Plan to analyze
   * @returns {number} Complexity score (0-100)
   */
  calculateComplexityScore(plan) {
    const stepCount = plan.steps.length
    const dependencyCount = this.countDependencies(plan)
    const uniqueTypes = new Set(plan.steps.map(step => step.type || step.category)).size
    
    // Weighted complexity calculation
    const stepWeight = stepCount * 2
    const dependencyWeight = dependencyCount * 3
    const typeWeight = uniqueTypes * 1
    
    const rawScore = stepWeight + dependencyWeight + typeWeight
    
    // Normalize to 0-100 scale
    return Math.min(100, Math.round(rawScore / 2))
  }

  /**
   * Initialize default validation rules
   */
  initializeDefaultRules() {
    // Add default validation rules here
    this.validationRules.set('no-empty-steps', {
      validate: (step) => step.name && step.name.trim().length > 0,
      message: 'Step name cannot be empty'
    })
    
    this.validationRules.set('valid-file-paths', {
      validate: (step) => {
        if (step.parameters && step.parameters.path) {
          return !step.parameters.path.includes('..')
        }
        return true
      },
      message: 'File paths cannot contain ".." for security reasons'
    })
  }

  /**
   * Add custom validation rule
   * 
   * @param {string} name - Rule name
   * @param {Object} rule - Rule definition
   */
  addValidationRule(name, rule) {
    this.validationRules.set(name, rule)
  }

  /**
   * Remove validation rule
   * 
   * @param {string} name - Rule name
   */
  removeValidationRule(name) {
    this.validationRules.delete(name)
  }
}

export default PlanValidator
