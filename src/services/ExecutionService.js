/**
 * ExecutionService.js - Real code execution and generation service
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
 * ExecutionService - Real implementation for code generation and execution
 * 
 * Responsibilities:
 * 1. Generate code using AI models via backend API
 * 2. Execute code and monitor processes
 * 3. Handle file operations (read, write, create, delete)
 * 4. Manage batch processing operations
 * 5. Process multimodal inputs (text, images, files)
 */
export class ExecutionService extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      defaultLanguage: 'javascript',
      defaultModel: 'llama2',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedExtensions: ['.js', '.ts', '.vue', '.py', '.html', '.css', '.json', '.md'],
      enableFileOperations: true,
      enableCodeExecution: true,
      ...config
    }
    
    this.state = {
      activeExecutions: new Map(),
      executionHistory: [],
      generatedFiles: new Map(),
      isInitialized: false
    }
  }

  /**
   * Initialize the execution service
   * Input → Process → Output pattern
   */
  async initialize() {
    try {
      // Input: Check if already initialized
      if (this.state.isInitialized) {
        return { success: true, message: 'Already initialized' }
      }

      // Process: Verify backend connection and capabilities
      const statusResponse = await apiService.getStatus()
      
      // Output: Mark as initialized
      this.state.isInitialized = true
      this.emit('initialized', { 
        timestamp: new Date().toISOString(),
        backendStatus: statusResponse 
      })
      
      return { success: true, message: 'Execution service initialized' }
      
    } catch (error) {
      console.error('Failed to initialize execution service:', error)
      this.emit('initializationError', { error: error.message })
      throw error
    }
  }

  /**
   * Generate code using AI models
   * Question → Explore → Apply pattern
   */
  async generateCode(codeRequest) {
    try {
      // Question: What code needs to be generated?
      if (!codeRequest.prompt) {
        throw new Error('Code prompt is required')
      }

      const request = {
        prompt: codeRequest.prompt,
        language: codeRequest.language || this.config.defaultLanguage,
        model: codeRequest.model || this.config.defaultModel,
        framework: codeRequest.framework || '',
        style: codeRequest.style || 'clean',
        includeTests: codeRequest.includeTests || false,
        includeComments: codeRequest.includeComments !== false
      }

      const executionId = this._generateExecutionId()
      
      this.emit('codeGenerationStarted', { executionId, request })

      // Explore: Generate code via backend API
      const response = await apiService.generateCode(
        request.prompt, 
        request.language, 
        request.model
      )
      
      if (response.success) {
        const result = {
          executionId,
          type: 'code_generation',
          request,
          response: response.result,
          timestamp: new Date().toISOString(),
          status: 'completed'
        }
        
        // Apply: Store result and emit events
        this.state.executionHistory.unshift(result)
        this._limitHistory()
        
        this.emit('codeGenerated', { executionId, result })
        this.emit('codeGenerationCompleted', { executionId, result })
        
        return { success: true, result }
      } else {
        throw new Error(response.error || 'Code generation failed')
      }
      
    } catch (error) {
      console.error('Failed to generate code:', error)
      this.emit('codeGenerationError', { error: error.message })
      throw error
    }
  }

  /**
   * Execute code in a safe environment
   * Input → Process → Output pattern
   */
  async executeCode(codeData) {
    try {
      // Input: Validate code and execution parameters
      if (!codeData.code) {
        throw new Error('Code content is required')
      }

      const execution = {
        code: codeData.code,
        language: codeData.language || this.config.defaultLanguage,
        timeout: codeData.timeout || 30000, // 30 seconds
        environment: codeData.environment || 'sandbox'
      }

      const executionId = this._generateExecutionId()
      
      this.emit('codeExecutionStarted', { executionId, execution })

      // Process: Execute code via backend API
      const response = await apiService.runCode(execution.code, execution.language)
      
      if (response.success) {
        const result = {
          executionId,
          type: 'code_execution',
          execution,
          output: response.output,
          exitCode: response.exitCode || 0,
          timestamp: new Date().toISOString(),
          status: 'completed'
        }
        
        // Output: Store result and emit events
        this.state.executionHistory.unshift(result)
        this._limitHistory()
        
        this.emit('codeExecuted', { executionId, result })
        this.emit('codeExecutionCompleted', { executionId, result })
        
        return { success: true, result }
      } else {
        throw new Error(response.error || 'Code execution failed')
      }
      
    } catch (error) {
      console.error('Failed to execute code:', error)
      this.emit('codeExecutionError', { error: error.message })
      throw error
    }
  }

  /**
   * Execute a plan with real-time progress updates
   * Prompt → Validate → Result pattern with streaming
   */
  async executePlan(plan, options = {}) {
    try {
      // Prompt: Check if plan is valid for execution
      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error('Invalid plan for execution')
      }

      const executionOptions = {
        enableFileOperations: options.enableFileOperations !== false,
        enableCodeGeneration: options.enableCodeGeneration !== false,
        timeout: options.timeout || 600000, // 10 minutes
        ...options
      }

      const executionId = this._generateExecutionId()
      
      this.emit('planExecutionStarted', { executionId, plan, options: executionOptions })

      // Validate: Execute plan via backend with streaming
      return await this._executePlanWithStreaming(plan, executionId, executionOptions)
      
    } catch (error) {
      console.error('Failed to execute plan:', error)
      this.emit('planExecutionError', { error: error.message })
      throw error
    }
  }

  /**
   * Execute plan with streaming progress updates
   */
  async _executePlanWithStreaming(plan, executionId, options) {
    return new Promise((resolve, reject) => {
      try {
        // Create streaming connection to backend
        const eventSource = apiService.runPlanStream(plan, options)
        
        let results = {
          executionId,
          planId: plan.id,
          status: 'running',
          steps: [],
          files: [],
          startTime: new Date().toISOString(),
          progress: 0
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            switch (data.type) {
              case 'progress':
                results.progress = data.progress
                this.emit('planExecutionProgress', { 
                  executionId, 
                  progress: data.progress,
                  currentStep: data.currentStep,
                  message: data.message 
                })
                break
                
              case 'step_started':
                this.emit('planStepStarted', { 
                  executionId, 
                  step: data.step 
                })
                break
                
              case 'step_completed':
                results.steps.push(data.step)
                this.emit('planStepCompleted', { 
                  executionId, 
                  step: data.step 
                })
                break
                
              case 'file_created':
                results.files.push(data.file)
                this.state.generatedFiles.set(data.file.path, data.file)
                this.emit('fileCreated', { 
                  executionId, 
                  file: data.file 
                })
                break
                
              case 'code_generated':
                this.emit('codeGenerated', { 
                  executionId, 
                  code: data.code 
                })
                break
                
              case 'error':
                results.status = 'failed'
                results.error = data.error
                results.endTime = new Date().toISOString()
                
                eventSource.close()
                this.emit('planExecutionError', { executionId, error: data.error })
                reject(new Error(data.error))
                break
                
              case 'completed':
                results.status = 'completed'
                results.endTime = new Date().toISOString()
                results.duration = Date.now() - new Date(results.startTime).getTime()
                results.summary = data.summary
                
                eventSource.close()
                
                // Store in history
                this.state.executionHistory.unshift(results)
                this._limitHistory()
                
                this.emit('planExecutionCompleted', { executionId, results })
                resolve({ success: true, results })
                break
            }
          } catch (parseError) {
            console.error('Failed to parse streaming data:', parseError)
          }
        }

        eventSource.onerror = (error) => {
          console.error('EventSource error:', error)
          eventSource.close()
          this.emit('planExecutionError', { executionId, error: 'Streaming connection failed' })
          reject(new Error('Streaming connection failed'))
        }

        // Set timeout
        setTimeout(() => {
          if (results.status === 'running') {
            eventSource.close()
            this.emit('planExecutionTimeout', { executionId })
            reject(new Error('Plan execution timeout'))
          }
        }, options.timeout)
        
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Process batch operations
   * Input → Process → Output pattern with streaming
   */
  async processBatch(batchData) {
    try {
      // Input: Validate batch data
      if (!batchData.tasks || batchData.tasks.length === 0) {
        throw new Error('No tasks provided for batch processing')
      }

      const batchOptions = {
        maxConcurrent: batchData.maxConcurrent || 3,
        timeout: batchData.timeout || 300000, // 5 minutes
        continueOnError: batchData.continueOnError !== false,
        ...batchData.options
      }

      const executionId = this._generateExecutionId()
      
      this.emit('batchProcessingStarted', { executionId, batchData, options: batchOptions })

      // Process: Execute batch via backend with streaming
      return await this._processBatchWithStreaming(batchData, executionId, batchOptions)
      
    } catch (error) {
      console.error('Failed to process batch:', error)
      this.emit('batchProcessingError', { error: error.message })
      throw error
    }
  }

  /**
   * Process batch with streaming updates
   */
  async _processBatchWithStreaming(batchData, executionId, options) {
    return new Promise((resolve, reject) => {
      try {
        // Create streaming connection for batch processing
        const eventSource = apiService.batchProcessStream(batchData.tasks, options)
        
        let results = {
          executionId,
          status: 'running',
          totalTasks: batchData.tasks.length,
          completedTasks: 0,
          failedTasks: 0,
          results: [],
          startTime: new Date().toISOString(),
          progress: 0
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            switch (data.type) {
              case 'progress':
                results.progress = data.progress
                results.completedTasks = data.completed
                results.failedTasks = data.failed
                
                this.emit('batchProgress', { 
                  executionId, 
                  progress: data.progress,
                  completed: data.completed,
                  failed: data.failed,
                  current: data.current
                })
                break
                
              case 'task_completed':
                results.results.push(data.result)
                this.emit('batchTaskCompleted', { 
                  executionId, 
                  task: data.task,
                  result: data.result 
                })
                break
                
              case 'task_failed':
                results.results.push(data.result)
                this.emit('batchTaskFailed', { 
                  executionId, 
                  task: data.task,
                  error: data.error 
                })
                break
                
              case 'completed':
                results.status = 'completed'
                results.endTime = new Date().toISOString()
                results.duration = Date.now() - new Date(results.startTime).getTime()
                results.summary = data.summary
                
                eventSource.close()
                
                // Store in history
                this.state.executionHistory.unshift(results)
                this._limitHistory()
                
                this.emit('batchProcessingCompleted', { executionId, results })
                resolve({ success: true, results })
                break
                
              case 'error':
                results.status = 'failed'
                results.error = data.error
                results.endTime = new Date().toISOString()
                
                eventSource.close()
                this.emit('batchProcessingError', { executionId, error: data.error })
                reject(new Error(data.error))
                break
            }
          } catch (parseError) {
            console.error('Failed to parse batch streaming data:', parseError)
          }
        }

        eventSource.onerror = (error) => {
          console.error('Batch EventSource error:', error)
          eventSource.close()
          this.emit('batchProcessingError', { executionId, error: 'Streaming connection failed' })
          reject(new Error('Streaming connection failed'))
        }
        
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Process multimodal input (text + images + files)
   * Question → Explore → Apply pattern
   */
  async processMultimodal(inputData) {
    try {
      // Question: What multimodal input needs processing?
      if (!inputData.text && !inputData.images && !inputData.files) {
        throw new Error('At least one input type (text, images, files) is required')
      }

      const request = {
        text: inputData.text || '',
        images: inputData.images || [],
        model: inputData.model || this.config.defaultModel,
        options: inputData.options || {}
      }

      const executionId = this._generateExecutionId()
      
      this.emit('multimodalProcessingStarted', { executionId, request })

      // Explore: Process via backend API
      const response = await apiService.processMultimodal(
        request.text,
        request.images,
        request.model
      )
      
      if (response.success) {
        const result = {
          executionId,
          type: 'multimodal_processing',
          request,
          response: response.result,
          timestamp: new Date().toISOString(),
          status: 'completed'
        }
        
        // Apply: Store result and emit events
        this.state.executionHistory.unshift(result)
        this._limitHistory()
        
        this.emit('multimodalProcessed', { executionId, result })
        this.emit('multimodalProcessingCompleted', { executionId, result })
        
        return { success: true, result }
      } else {
        throw new Error(response.error || 'Multimodal processing failed')
      }
      
    } catch (error) {
      console.error('Failed to process multimodal input:', error)
      this.emit('multimodalProcessingError', { error: error.message })
      throw error
    }
  }

  /**
   * File Operations
   */

  /**
   * Write file to filesystem
   */
  async writeFile(filePath, content, options = {}) {
    try {
      if (!this.config.enableFileOperations) {
        throw new Error('File operations are disabled')
      }

      // Validate file extension
      const ext = filePath.substring(filePath.lastIndexOf('.'))
      if (!this.config.allowedExtensions.includes(ext)) {
        throw new Error(`File extension ${ext} is not allowed`)
      }

      // Validate file size
      if (content.length > this.config.maxFileSize) {
        throw new Error('File size exceeds maximum allowed size')
      }

      const encoding = options.encoding || 'utf-8'
      
      this.emit('fileWriteStarted', { filePath, size: content.length })

      const response = await apiService.writeFile(filePath, content, encoding)
      
      if (response.success) {
        const fileInfo = {
          path: filePath,
          size: content.length,
          encoding,
          timestamp: new Date().toISOString()
        }
        
        this.state.generatedFiles.set(filePath, fileInfo)
        this.emit('fileWritten', { file: fileInfo })
        
        return { success: true, file: fileInfo }
      } else {
        throw new Error(response.error || 'Failed to write file')
      }
      
    } catch (error) {
      console.error('Failed to write file:', error)
      this.emit('fileWriteError', { filePath, error: error.message })
      throw error
    }
  }

  /**
   * Read file from filesystem
   */
  async readFile(filePath, options = {}) {
    try {
      if (!this.config.enableFileOperations) {
        throw new Error('File operations are disabled')
      }

      const encoding = options.encoding || 'utf-8'
      
      this.emit('fileReadStarted', { filePath })

      const response = await apiService.readFile(filePath, encoding)
      
      if (response.success) {
        this.emit('fileRead', { filePath, size: response.content.length })
        return { success: true, content: response.content }
      } else {
        throw new Error(response.error || 'Failed to read file')
      }
      
    } catch (error) {
      console.error('Failed to read file:', error)
      this.emit('fileReadError', { filePath, error: error.message })
      throw error
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus() {
    try {
      const response = await apiService.getExecutionStatus()
      return response
    } catch (error) {
      console.error('Failed to get execution status:', error)
      throw error
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory() {
    return [...this.state.executionHistory]
  }

  /**
   * Get active executions
   */
  getActiveExecutions() {
    return Array.from(this.state.activeExecutions.values())
  }

  /**
   * Get generated files
   */
  getGeneratedFiles() {
    return Array.from(this.state.generatedFiles.values())
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId) {
    try {
      const execution = this.state.activeExecutions.get(executionId)
      if (execution) {
        execution.status = 'cancelled'
        this.state.activeExecutions.delete(executionId)
        this.emit('executionCancelled', { executionId })
        return { success: true }
      } else {
        throw new Error('Execution not found')
      }
    } catch (error) {
      console.error('Failed to cancel execution:', error)
      throw error
    }
  }

  /**
   * Utility: Generate execution ID
   */
  _generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Utility: Limit history size
   */
  _limitHistory() {
    if (this.state.executionHistory.length > 100) {
      this.state.executionHistory = this.state.executionHistory.slice(0, 100)
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.state.isInitialized,
      activeExecutionsCount: this.state.activeExecutions.size,
      executionHistoryCount: this.state.executionHistory.length,
      generatedFilesCount: this.state.generatedFiles.size,
      config: this.config
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this.removeAllListeners()
    this.state.activeExecutions.clear()
    this.state.executionHistory.length = 0
    this.state.generatedFiles.clear()
    this.state.isInitialized = false
  }
}

export default ExecutionService
