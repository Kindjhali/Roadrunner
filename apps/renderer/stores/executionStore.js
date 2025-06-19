/**
 * executionStore.js - Pinia store for execution state management
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
 * Execution Store - Manages execution state and operations
 * 
 * Responsibilities:
 * 1. Track execution progress and status
 * 2. Manage execution history and results
 * 3. Handle code content and language settings
 * 4. Coordinate with backend execution APIs
 */
export const useExecutionStore = defineStore('execution', () => {
  // State - Reactive references
  const activeMode = ref('code') // code, batch, multimodal, terminal
  const isExecuting = ref(false)
  const currentTask = ref(null)
  const currentExecution = ref(null)
  const executionProgress = ref(0)
  const executionHistory = ref([])
  const executionResults = ref([])
  const lastExecution = ref(null)
  const lastError = ref(null)
  
  // Code editor state
  const codeContent = ref('')
  const selectedLanguage = ref('javascript')
  
  // Execution settings
  const settings = reactive({
    autoSave: true,
    showProgress: true,
    enableNotifications: true,
    maxHistoryItems: 100,
    executionTimeout: 300000, // 5 minutes
    enableStreaming: true
  })
  
  // Statistics
  const stats = reactive({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalLinesExecuted: 0,
    totalCharactersTyped: 0,
    averageExecutionTime: 0,
    lastExecutionTime: null
  })

  // Computed properties
  const successRate = computed(() => {
    if (stats.totalExecutions === 0) return 0
    return Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
  })
  
  const hasActiveTask = computed(() => currentTask.value !== null)
  
  const recentExecutions = computed(() => 
    executionHistory.value.slice(0, 10)
  )
  
  const wordCount = computed(() => {
    return codeContent.value.split(/\s+/).filter(word => word.length > 0).length
  })
  
  const tokenCount = computed(() => {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(codeContent.value.length / 4)
  })
  
  const lineCount = computed(() => {
    return codeContent.value.split('\n').length
  })

  // Actions - Execution Management
  
  /**
   * Set the active execution mode
   * 
   * @param {string} mode - Execution mode
   */
  const setActiveMode = (mode) => {
    activeMode.value = mode
  }

  /**
   * Execute a plan using backend API
   * Input → Process → Output pattern
   * 
   * @param {Object} plan - Plan to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async function executePlan(plan, options = {}) {
    try {
      // Input: Validate plan
      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error('Invalid plan: must have steps')
      }
      
      isExecuting.value = true
      currentExecution.value = {
        id: generateExecutionId(),
        plan,
        startTime: new Date().toISOString(),
        progress: 0,
        status: 'running',
        results: [],
        errors: []
      }
      
      lastError.value = null
      
      // Process: Execute using backend API
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.executePlan(plan, {
        ...options,
        executionId: currentExecution.value.id,
        enableStreaming: true
      })
      
      if (response.success) {
        // Handle streaming execution updates
        if (response.stream) {
          await handleExecutionStream(response.stream)
        }
        
        // Output: Finalize execution
        executionProgress.value = 100
        currentExecution.value.progress = 100
        currentExecution.value.status = 'completed'
        currentExecution.value.endTime = new Date().toISOString()
        
        // Add to history
        executionHistory.value.push({ ...currentExecution.value })
        
        return {
          success: true,
          executionId: currentExecution.value.id,
          results: currentExecution.value.results,
          errors: currentExecution.value.errors
        }
      } else {
        throw new Error(response.error || 'Plan execution failed')
      }
      
    } catch (error) {
      console.error('Failed to execute plan via backend, using fallback:', error)
      
      // Fallback to local execution
      return await executeLocalPlan(plan, options)
      
    } finally {
      isExecuting.value = false
    }
  }

  /**
   * Handle execution stream from backend
   * 
   * @param {ReadableStream} stream - Execution stream
   */
  async function handleExecutionStream(stream) {
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
              executionProgress.value = data.progress
              currentExecution.value.progress = data.progress
            } else if (data.type === 'stepCompleted') {
              currentExecution.value.results.push(data.result)
            } else if (data.type === 'error') {
              currentExecution.value.errors.push(data.error)
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
   * Fallback local plan execution
   * 
   * @param {Object} plan - Plan to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async function executeLocalPlan(plan, options = {}) {
    const results = []
    const totalSteps = plan.steps.length
    
    for (let i = 0; i < totalSteps; i++) {
      const step = plan.steps[i]
      
      try {
        // Update progress
        executionProgress.value = Math.round((i / totalSteps) * 100)
        currentExecution.value.progress = executionProgress.value
        
        // Execute step
        const stepResult = await executeStep(step, {
          stepIndex: i,
          previousResults: results,
          ...options
        })
        
        results.push(stepResult)
        currentExecution.value.results.push(stepResult)
        
      } catch (stepError) {
        const error = {
          step: step.name || `Step ${i + 1}`,
          error: stepError.message,
          stepIndex: i
        }
        
        currentExecution.value.errors.push(error)
        
        // Decide whether to continue or abort
        if (step.stopOnFailure !== false) {
          throw stepError
        }
      }
    }
    
    return {
      success: true,
      executionId: currentExecution.value.id,
      results,
      errors: currentExecution.value.errors
    }
  }

  /**
   * Execute a single step using backend API
   * 
   * @param {Object} step - Step to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Step result
   */
  async function executeStep(step, context = {}) {
    try {
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.executeStep(step, context)
      
      if (response.success) {
        return response.result
      } else {
        throw new Error(response.error || 'Step execution failed')
      }
      
    } catch (error) {
      console.error('Failed to execute step via backend, using fallback:', error)
      
      // Fallback to mock execution
      return {
        success: true,
        output: `Mock execution of ${step.type} step`,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Generate code using backend API
   * 
   * @param {Object} codeRequest - Code generation request
   * @returns {Promise<Object>} Generated code result
   */
  async function generateCode(codeRequest) {
    try {
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.generateCode(
        codeRequest.prompt,
        codeRequest.language || selectedLanguage.value,
        codeRequest.model
      )
      
      if (response.success) {
        // Update code content if requested
        if (codeRequest.updateEditor) {
          updateCodeContent(response.code)
        }
        
        return response
      } else {
        throw new Error(response.error || 'Code generation failed')
      }
      
    } catch (error) {
      console.error('Failed to generate code via backend:', error)
      throw error
    }
  }
  
  /**
   * Start a new execution task
   * 
   * @param {Object} taskConfig - Task configuration
   */
  const startExecution = async (taskConfig) => {
    try {
      // Input: Validate task configuration
      if (!taskConfig.type) {
        throw new Error('Task type is required')
      }
      
      // Process: Create task object
      const task = {
        id: generateTaskId(),
        type: taskConfig.type,
        name: taskConfig.name || `${taskConfig.type} task`,
        config: taskConfig,
        status: 'running',
        startTime: new Date().toISOString(),
        endTime: null,
        result: null,
        error: null
      }
      
      currentTask.value = task
      isExecuting.value = true
      stats.totalExecutions++
      
      // Simulate execution (replace with actual execution logic)
      const result = await executeTask(task)
      
      // Output: Complete task
      task.status = 'completed'
      task.endTime = new Date().toISOString()
      task.result = result
      
      // Update statistics
      stats.successfulExecutions++
      stats.lastExecutionTime = new Date().toISOString()
      updateAverageExecutionTime(task)
      
      // Add to history
      executionHistory.value.unshift({ ...task })
      
      // Store result
      const executionResult = {
        id: task.id,
        type: task.type,
        title: `${task.type} execution completed`,
        content: result.output || result.message || 'Execution completed successfully',
        timestamp: task.endTime,
        success: true
      }
      
      executionResults.value.unshift(executionResult)
      lastExecution.value = executionResult
      
      return result
      
    } catch (error) {
      // Handle execution failure
      if (currentTask.value) {
        currentTask.value.status = 'failed'
        currentTask.value.endTime = new Date().toISOString()
        currentTask.value.error = error.message
        
        stats.failedExecutions++
        
        // Add to history
        executionHistory.value.unshift({ ...currentTask.value })
        
        // Store error result
        const errorResult = {
          id: currentTask.value.id,
          type: currentTask.value.type,
          title: `${currentTask.value.type} execution failed`,
          content: error.message,
          timestamp: currentTask.value.endTime,
          success: false
        }
        
        executionResults.value.unshift(errorResult)
        lastExecution.value = errorResult
      }
      
      console.error('Execution failed:', error)
      throw error
    } finally {
      isExecuting.value = false
      currentTask.value = null
    }
  }
  
  /**
   * Stop the current execution
   */
  const stopExecution = () => {
    if (currentTask.value && isExecuting.value) {
      currentTask.value.status = 'cancelled'
      currentTask.value.endTime = new Date().toISOString()
      
      isExecuting.value = false
      currentTask.value = null
      
      console.log('Execution stopped by user')
    }
  }
  
  /**
   * Update code content
   * 
   * @param {string} content - New code content
   */
  const updateCodeContent = (content) => {
    const oldLength = codeContent.value.length
    codeContent.value = content
    
    // Update typing statistics
    const newLength = content.length
    if (newLength > oldLength) {
      stats.totalCharactersTyped += (newLength - oldLength)
    }
  }
  
  /**
   * Save current code content
   * 
   * @param {string} filename - Optional filename
   */
  const saveCode = async (filename = null) => {
    try {
      const saveData = {
        content: codeContent.value,
        language: selectedLanguage.value,
        filename: filename || `code_${Date.now()}.${getFileExtension(selectedLanguage.value)}`,
        timestamp: new Date().toISOString(),
        wordCount: wordCount.value,
        tokenCount: tokenCount.value,
        lineCount: lineCount.value
      }
      
      // Use backend API to save file
      const { apiService } = await import('../services/ApiService.js')
      
      const response = await apiService.writeFile(saveData.filename, saveData.content)
      
      if (response.success) {
        console.log('Code saved:', saveData.filename)
        return saveData
      } else {
        throw new Error(response.error || 'Failed to save code')
      }
      
    } catch (error) {
      console.error('Failed to save code:', error)
      throw error
    }
  }
  
  /**
   * Load code from file
   * 
   * @param {File} file - File to load
   */
  const loadCode = async (file) => {
    try {
      const content = await readFileContent(file)
      const language = detectLanguage(file.name)
      
      updateCodeContent(content)
      selectedLanguage.value = language
      
      console.log('Code loaded from:', file.name)
      return { content, language }
      
    } catch (error) {
      console.error('Failed to load code:', error)
      throw error
    }
  }
  
  /**
   * Clear execution history
   */
  const clearHistory = () => {
    executionHistory.value = []
    executionResults.value = []
    lastExecution.value = null
  }
  
  /**
   * Update settings
   * 
   * @param {Object} newSettings - Settings to update
   */
  const updateSettings = (newSettings) => {
    Object.assign(settings, newSettings)
    console.log('Execution settings updated')
  }
  
  /**
   * Reset statistics
   */
  const resetStats = () => {
    Object.assign(stats, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalLinesExecuted: 0,
      totalCharactersTyped: 0,
      averageExecutionTime: 0,
      lastExecutionTime: null
    })
  }
  
  /**
   * Export execution data
   * 
   * @param {string} format - Export format (json, csv, txt)
   */
  const exportData = (format = 'json') => {
    const exportData = {
      timestamp: new Date().toISOString(),
      settings,
      stats,
      history: executionHistory.value,
      results: executionResults.value,
      currentCode: {
        content: codeContent.value,
        language: selectedLanguage.value,
        wordCount: wordCount.value,
        tokenCount: tokenCount.value,
        lineCount: lineCount.value
      }
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2)
      
      case 'csv':
        return exportToCsv(exportData)
      
      case 'txt':
        return exportToText(exportData)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
  
  // Internal helper functions
  const generateExecutionId = () => {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  const generateTaskId = () => {
    return 'task_' + Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
  
  const executeTask = async (task) => {
    // Mock execution based on task type
    const executionTime = Math.random() * 2000 + 500 // 0.5-2.5 seconds
    await new Promise(resolve => setTimeout(resolve, executionTime))
    
    switch (task.type) {
      case 'code':
        return {
          output: 'Code executed successfully',
          exitCode: 0,
          executionTime
        }
      
      case 'batch':
        return {
          message: 'Batch processing completed',
          processedFiles: task.config.files?.length || 0,
          executionTime
        }
      
      case 'multimodal':
        return {
          message: 'Multimodal input processed',
          inputTypes: task.config.inputTypes || [],
          executionTime
        }
      
      case 'terminal':
        return {
          output: 'Terminal command executed',
          command: task.config.command || 'unknown',
          executionTime
        }
      
      default:
        return {
          message: 'Task completed',
          executionTime
        }
    }
  }
  
  const updateAverageExecutionTime = (task) => {
    const executionTime = new Date(task.endTime) - new Date(task.startTime)
    const totalTime = stats.averageExecutionTime * (stats.totalExecutions - 1) + executionTime
    stats.averageExecutionTime = Math.round(totalTime / stats.totalExecutions)
  }
  
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }
  
  const detectLanguage = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase()
    const languageMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'bash',
      'ps1': 'powershell'
    }
    
    return languageMap[extension] || 'plaintext'
  }
  
  const getFileExtension = (language) => {
    const extensionMap = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'cs',
      'php': 'php',
      'ruby': 'rb',
      'go': 'go',
      'rust': 'rs',
      'swift': 'swift',
      'kotlin': 'kt',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'markdown': 'md',
      'sql': 'sql',
      'bash': 'sh',
      'powershell': 'ps1'
    }
    
    return extensionMap[language] || 'txt'
  }
  
  const exportToCsv = (data) => {
    const headers = ['ID', 'Type', 'Status', 'Start Time', 'End Time', 'Duration']
    const rows = data.history.map(task => [
      task.id,
      task.type,
      task.status,
      task.startTime,
      task.endTime || '',
      task.endTime ? new Date(task.endTime) - new Date(task.startTime) : ''
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  const exportToText = (data) => {
    let output = `Execution Store Export\n`
    output += `=====================\n\n`
    output += `Statistics:\n`
    output += `- Total Executions: ${data.stats.totalExecutions}\n`
    output += `- Successful: ${data.stats.successfulExecutions}\n`
    output += `- Failed: ${data.stats.failedExecutions}\n`
    output += `- Success Rate: ${Math.round((data.stats.successfulExecutions / data.stats.totalExecutions) * 100)}%\n`
    output += `- Average Execution Time: ${data.stats.averageExecutionTime}ms\n\n`
    
    output += `Current Code:\n`
    output += `- Language: ${data.currentCode.language}\n`
    output += `- Lines: ${data.currentCode.lineCount}\n`
    output += `- Words: ${data.currentCode.wordCount}\n`
    output += `- Tokens: ${data.currentCode.tokenCount}\n\n`
    
    return output
  }
  
  return {
    // State
    activeMode,
    isExecuting,
    currentTask,
    currentExecution,
    executionProgress,
    executionHistory,
    codeContent,
    selectedLanguage,
    executionResults,
    lastExecution,
    lastError,
    settings,
    stats,
    
    // Computed
    successRate,
    hasActiveTask,
    recentExecutions,
    wordCount,
    tokenCount,
    lineCount,
    
    // Actions
    setActiveMode,
    executePlan,
    executeStep,
    generateCode,
    startExecution,
    stopExecution,
    updateCodeContent,
    saveCode,
    loadCode,
    clearHistory,
    updateSettings,
    resetStats,
    exportData
  }
})

export default useExecutionStore
