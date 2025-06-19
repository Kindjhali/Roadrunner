/**
 * ApiService.js - Complete Backend API connection service
 * 
 * Connects frontend to the actual backend server running on port 3333
 * Implements ALL backend APIs from fucking_plan.md
 * 
 * @version 2.0.0
 * @author Roadrunner Autocoder System
 */

class ApiService {
  constructor() {
    this.baseUrl = 'http://localhost:3333'
    this.timeout = 30000 // 30 seconds
  }

  /**
   * Make HTTP request to backend
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: this.timeout,
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      }
      
      return await response.text()
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error)
      throw error
    }
  }

  /**
   * Create EventSource for streaming responses
   */
  createEventSource(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    return new EventSource(url)
  }

  // ===== BASIC STATUS APIs =====
  
  /**
   * Get backend status
   */
  async getStatus() {
    return this.request('/api/status')
  }

  /**
   * Health check
   */
  async getHealth() {
    return this.request('/health')
  }

  // ===== BRAINSTORMING APIs =====
  
  /**
   * Start brainstorming session
   */
  async startBrainstorming(sessionData) {
    return this.request('/api/brainstorming/start', {
      method: 'POST',
      body: sessionData
    })
  }

  /**
   * Get agent response for brainstorming
   */
  async getBrainstormingAgentResponse(prompt, modelId) {
    return this.request('/api/brainstorming/agent-response', {
      method: 'POST',
      body: { prompt, modelId }
    })
  }

  // ===== PLANNING APIs =====
  
  /**
   * Create a plan
   */
  async createPlan(planData) {
    return this.request('/api/planning/create', {
      method: 'POST',
      body: planData
    })
  }

  /**
   * Execute a plan (streaming)
   */
  executePlanStream(planId, plan) {
    return this.createEventSource('/api/planning/execute', {
      method: 'POST',
      body: { planId, plan }
    })
  }

  /**
   * Get step templates
   */
  async getStepTemplates() {
    return this.request('/api/planning/templates')
  }

  /**
   * Validate a plan
   */
  async validatePlan(plan) {
    return this.request('/api/planning/validate', {
      method: 'POST',
      body: { plan }
    })
  }

  /**
   * Save a plan
   */
  async savePlan(plan) {
    return this.request('/api/planning/save', {
      method: 'POST',
      body: { plan }
    })
  }

  /**
   * Get all saved plans
   */
  async getPlans() {
    return this.request('/api/planning/plans')
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId) {
    return this.request(`/api/planning/plan/${planId}`, {
      method: 'DELETE'
    })
  }

  /**
   * Export a plan
   */
  async exportPlan(planId, format) {
    return this.request('/api/planning/export', {
      method: 'POST',
      body: { planId, format }
    })
  }

  // ===== EXECUTION APIs =====
  
  /**
   * Generate code
   */
  async generateCode(prompt, language, model) {
    return this.request('/api/execution/generate-code', {
      method: 'POST',
      body: { prompt, language, model }
    })
  }

  /**
   * Run code
   */
  async runCode(code, language) {
    return this.request('/api/execution/run-code', {
      method: 'POST',
      body: { code, language }
    })
  }

  /**
   * Write file
   */
  async writeFile(filePath, content, encoding = 'utf-8') {
    return this.request('/api/execution/write-file', {
      method: 'POST',
      body: { path: filePath, content, encoding }
    })
  }

  /**
   * Read file
   */
  async readFile(filePath, encoding = 'utf-8') {
    return this.request('/api/execution/read-file', {
      method: 'POST',
      body: { path: filePath, encoding }
    })
  }

  /**
   * Run plan (streaming)
   */
  runPlanStream(plan, options = {}) {
    return this.createEventSource('/api/execution/run-plan', {
      method: 'POST',
      body: { plan, options }
    })
  }

  /**
   * Get execution status
   */
  async getExecutionStatus() {
    return this.request('/api/execution/status')
  }

  /**
   * Batch process tasks (streaming)
   */
  batchProcessStream(tasks, options = {}) {
    return this.createEventSource('/api/execution/batch-process', {
      method: 'POST',
      body: { tasks, options }
    })
  }

  // ===== CONFERENCE APIs =====
  
  /**
   * Start conference session
   */
  async startConferenceSession(topic, agents, model) {
    return this.request('/api/conference/start-session', {
      method: 'POST',
      body: { topic, agents, model }
    })
  }

  /**
   * Add agent to conference
   */
  async addConferenceAgent(sessionId, agentType, agentName) {
    return this.request('/api/conference/add-agent', {
      method: 'POST',
      body: { sessionId, agentType, agentName }
    })
  }

  /**
   * Send message in conference
   */
  async sendConferenceMessage(sessionId, agentId, message, generateResponse = false) {
    return this.request('/api/conference/send-message', {
      method: 'POST',
      body: { sessionId, agentId, message, generateResponse }
    })
  }

  /**
   * Get conference session
   */
  async getConferenceSession(sessionId) {
    return this.request(`/api/conference/session/${sessionId}`)
  }

  /**
   * Delete conference session
   */
  async deleteConferenceSession(sessionId) {
    return this.request(`/api/conference/session/${sessionId}`, {
      method: 'DELETE'
    })
  }

  // ===== FILE SYSTEM APIs =====
  
  /**
   * Create file
   */
  async createFile(filePath, content, type) {
    return this.request('/api/files/create', {
      method: 'POST',
      body: { path: filePath, content, type }
    })
  }

  /**
   * List files
   */
  async listFiles(directory = '') {
    const query = directory ? `?directory=${encodeURIComponent(directory)}` : ''
    return this.request(`/api/files/list${query}`)
  }

  /**
   * Update file
   */
  async updateFile(filePath, content) {
    return this.request('/api/files/update', {
      method: 'PUT',
      body: { path: filePath, content }
    })
  }

  /**
   * Delete file
   */
  async deleteFile(filePath) {
    return this.request('/api/files/delete', {
      method: 'DELETE',
      body: { path: filePath }
    })
  }

  /**
   * Export files
   */
  async exportFiles(files, format, destination) {
    return this.request('/api/files/export', {
      method: 'POST',
      body: { files, format, destination }
    })
  }

  // ===== CONFIGURATION APIs =====
  
  /**
   * Get configuration settings
   */
  async getConfigSettings() {
    return this.request('/api/config/settings')
  }

  /**
   * Update configuration settings
   */
  async updateConfigSettings(settings) {
    return this.request('/api/config/settings', {
      method: 'POST',
      body: settings
    })
  }

  /**
   * Get available models
   */
  async getConfigModels() {
    return this.request('/api/config/models')
  }

  /**
   * Test connection
   */
  async testConnection(provider, apiKey, ollamaUrl, model) {
    return this.request('/api/config/test-connection', {
      method: 'POST',
      body: { provider, apiKey, ollamaUrl, model }
    })
  }

  // ===== MODEL MANAGEMENT APIs =====
  
  /**
   * Get available models
   */
  async getModels() {
    return this.request('/api/models')
  }

  /**
   * Get categorized Ollama models
   */
  async getCategorizedModels() {
    return this.request('/api/ollama-models/categorized')
  }

  /**
   * Pull Ollama model (streaming)
   */
  pullModelStream(modelName) {
    return fetch(`${this.baseUrl}/api/ollama/pull-model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ modelName })
    })
  }

  /**
   * Ping Ollama
   */
  async pingOllama() {
    return this.request('/api/ollama/ping')
  }

  // ===== MULTIMODAL APIs =====
  
  /**
   * Process multimodal input
   */
  async processMultimodal(text, images, model) {
    return this.request('/api/multimodal/process', {
      method: 'POST',
      body: { text, images, model }
    })
  }

  // ===== LEGACY SETTINGS APIs (for backward compatibility) =====
  
  /**
   * Get settings (legacy)
   */
  async getSettings() {
    return this.request('/api/settings')
  }

  /**
   * Update settings (legacy)
   */
  async updateSettings(settings) {
    return this.request('/api/settings', {
      method: 'POST',
      body: settings
    })
  }

  // ===== UTILITY METHODS =====
  
  /**
   * Handle streaming response
   */
  handleStreamingResponse(response, onData, onError, onComplete) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    function read() {
      return reader.read().then(({ done, value }) => {
        if (done) {
          onComplete && onComplete()
          return
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              onData && onData(data)
            } catch (error) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }

        return read()
      }).catch(error => {
        onError && onError(error)
      })
    }

    return read()
  }

  /**
   * Create streaming request
   */
  async createStreamingRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    
    const config = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    return fetch(url, config)
  }
}

export const apiService = new ApiService()
export default apiService
