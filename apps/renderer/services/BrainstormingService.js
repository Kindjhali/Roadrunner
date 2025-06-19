/**
 * BrainstormingService.js - Real brainstorming and idea generation service
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
 * BrainstormingService - Real implementation for AI-powered brainstorming
 * 
 * Responsibilities:
 * 1. Create and manage brainstorming sessions
 * 2. Generate ideas using AI models
 * 3. Facilitate multi-agent brainstorming
 * 4. Export and save brainstorming results
 * 5. Analyze and categorize generated ideas
 */
export class BrainstormingService extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      defaultModel: 'llama2',
      maxIdeasPerSession: 50,
      sessionTimeout: 1800000, // 30 minutes
      enableMultiAgent: true,
      enableIdeaAnalysis: true,
      ...config
    }
    
    this.state = {
      activeSessions: new Map(),
      sessionHistory: [],
      ideaTemplates: new Map(),
      isInitialized: false
    }
  }

  /**
   * Initialize the brainstorming service
   * Input → Process → Output pattern
   */
  async initialize() {
    try {
      // Input: Check if already initialized
      if (this.state.isInitialized) {
        return { success: true, message: 'Already initialized' }
      }

      // Process: Load idea templates and verify backend
      await this._loadIdeaTemplates()
      
      // Output: Mark as initialized
      this.state.isInitialized = true
      this.emit('initialized', { timestamp: new Date().toISOString() })
      
      return { success: true, message: 'Brainstorming service initialized' }
      
    } catch (error) {
      console.error('Failed to initialize brainstorming service:', error)
      this.emit('initializationError', { error: error.message })
      throw error
    }
  }

  /**
   * Start a new brainstorming session
   * Question → Explore → Apply pattern
   */
  async startSession(sessionData) {
    try {
      // Question: What kind of brainstorming session is needed?
      if (!sessionData.topic) {
        throw new Error('Session topic is required')
      }

      const sessionConfig = {
        topic: sessionData.topic,
        description: sessionData.description || '',
        duration: sessionData.duration || 300000, // 5 minutes
        maxIdeas: sessionData.maxIdeas || this.config.maxIdeasPerSession,
        model: sessionData.model || this.config.defaultModel,
        agents: sessionData.agents || ['creative', 'analytical', 'practical'],
        constraints: sessionData.constraints || {},
        enableMultiAgent: sessionData.enableMultiAgent !== false
      }

      const sessionId = this._generateSessionId()
      
      this.emit('sessionStarted', { sessionId, config: sessionConfig })

      // Explore: Start session via backend API
      const response = await apiService.startBrainstorming(sessionConfig)
      
      if (response.success) {
        const session = {
          id: sessionId,
          ...sessionConfig,
          backendSessionId: response.sessionId,
          status: 'active',
          ideas: [],
          startTime: new Date().toISOString(),
          participants: response.participants || []
        }
        
        // Apply: Store session and start idea generation
        this.state.activeSessions.set(sessionId, session)
        
        // Start generating ideas
        this._startIdeaGeneration(session)
        
        this.emit('sessionCreated', { session })
        return { success: true, session }
      } else {
        throw new Error(response.error || 'Failed to start brainstorming session')
      }
      
    } catch (error) {
      console.error('Failed to start brainstorming session:', error)
      this.emit('sessionError', { error: error.message })
      throw error
    }
  }

  /**
   * Generate ideas for a session
   * Input → Process → Output pattern
   */
  async _startIdeaGeneration(session) {
    try {
      // Input: Validate session and parameters
      if (!session || session.status !== 'active') {
        return
      }

      const ideaPrompts = this._generateIdeaPrompts(session)
      
      // Process: Generate ideas using different approaches
      for (const prompt of ideaPrompts) {
        if (session.ideas.length >= session.maxIdeas) {
          break
        }
        
        try {
          const idea = await this._generateSingleIdea(session, prompt)
          if (idea) {
            session.ideas.push(idea)
            this.emit('ideaGenerated', { sessionId: session.id, idea })
          }
        } catch (ideaError) {
          console.warn('Failed to generate idea:', ideaError)
        }
        
        // Small delay between ideas
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // Output: Complete session if max ideas reached or timeout
      if (session.ideas.length >= session.maxIdeas) {
        await this.completeSession(session.id)
      }
      
    } catch (error) {
      console.error('Failed to generate ideas:', error)
      this.emit('ideaGenerationError', { sessionId: session.id, error: error.message })
    }
  }

  /**
   * Generate a single idea using AI
   * Prompt → Validate → Result pattern
   */
  async _generateSingleIdea(session, prompt) {
    try {
      // Prompt: Create idea generation request
      const ideaRequest = {
        prompt: prompt.text,
        context: {
          topic: session.topic,
          description: session.description,
          constraints: session.constraints,
          existingIdeas: session.ideas.map(idea => idea.title)
        },
        agent: prompt.agent || 'creative',
        model: session.model
      }

      // Validate: Generate idea via backend
      const response = await apiService.getBrainstormingAgentResponse(
        ideaRequest.prompt,
        session.model
      )
      
      if (response.success && response.idea) {
        // Result: Process and structure the idea
        const idea = {
          id: this._generateIdeaId(),
          title: response.idea.title || this._extractTitle(response.idea.content),
          content: response.idea.content || response.idea,
          category: response.idea.category || prompt.category,
          agent: prompt.agent,
          confidence: response.idea.confidence || 0.8,
          tags: response.idea.tags || this._extractTags(response.idea.content),
          timestamp: new Date().toISOString(),
          prompt: prompt.text
        }
        
        // Analyze idea if enabled
        if (this.config.enableIdeaAnalysis) {
          idea.analysis = await this._analyzeIdea(idea, session)
        }
        
        return idea
      } else {
        throw new Error(response.error || 'Failed to generate idea')
      }
      
    } catch (error) {
      console.error('Failed to generate single idea:', error)
      return null
    }
  }

  /**
   * Generate idea prompts for different perspectives
   */
  _generateIdeaPrompts(session) {
    const basePrompts = [
      {
        text: `Generate a creative and innovative idea for: ${session.topic}. Focus on originality and thinking outside the box.`,
        agent: 'creative',
        category: 'creative'
      },
      {
        text: `Analyze the problem "${session.topic}" and suggest a practical, implementable solution.`,
        agent: 'analytical',
        category: 'practical'
      },
      {
        text: `What are some unconventional approaches to "${session.topic}" that others might not consider?`,
        agent: 'creative',
        category: 'unconventional'
      },
      {
        text: `How could technology be used to solve or improve "${session.topic}"?`,
        agent: 'technical',
        category: 'technology'
      },
      {
        text: `What are the potential risks and benefits of different approaches to "${session.topic}"?`,
        agent: 'analytical',
        category: 'analysis'
      }
    ]

    // Add session-specific prompts based on description
    if (session.description) {
      basePrompts.push({
        text: `Given the context "${session.description}", what specific ideas would work best for "${session.topic}"?`,
        agent: 'contextual',
        category: 'contextual'
      })
    }

    // Add constraint-based prompts
    if (session.constraints && Object.keys(session.constraints).length > 0) {
      const constraintText = Object.entries(session.constraints)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      
      basePrompts.push({
        text: `Considering these constraints (${constraintText}), what ideas would work for "${session.topic}"?`,
        agent: 'constrained',
        category: 'constrained'
      })
    }

    return basePrompts
  }

  /**
   * Analyze an idea for quality and relevance
   */
  async _analyzeIdea(idea, session) {
    try {
      const analysisPrompt = `Analyze this idea for the topic "${session.topic}":
      
      Title: ${idea.title}
      Content: ${idea.content}
      
      Rate the idea on:
      1. Relevance (1-10)
      2. Feasibility (1-10)
      3. Innovation (1-10)
      4. Impact (1-10)
      
      Provide a brief analysis and overall score.`

      const response = await apiService.getBrainstormingAgentResponse(
        analysisPrompt,
        session.model
      )
      
      if (response.success) {
        return {
          relevance: this._extractScore(response.result, 'relevance') || 7,
          feasibility: this._extractScore(response.result, 'feasibility') || 7,
          innovation: this._extractScore(response.result, 'innovation') || 7,
          impact: this._extractScore(response.result, 'impact') || 7,
          summary: response.result,
          timestamp: new Date().toISOString()
        }
      }
      
      return null
      
    } catch (error) {
      console.warn('Failed to analyze idea:', error)
      return null
    }
  }

  /**
   * Complete a brainstorming session
   * Input → Process → Output pattern
   */
  async completeSession(sessionId) {
    try {
      // Input: Get session and validate
      const session = this.state.activeSessions.get(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      // Process: Finalize session data
      session.status = 'completed'
      session.endTime = new Date().toISOString()
      session.duration = Date.now() - new Date(session.startTime).getTime()
      session.summary = this._generateSessionSummary(session)

      // Move to history
      this.state.sessionHistory.unshift(session)
      this.state.activeSessions.delete(sessionId)
      
      // Limit history size
      if (this.state.sessionHistory.length > 100) {
        this.state.sessionHistory = this.state.sessionHistory.slice(0, 100)
      }

      // Output: Emit completion event
      this.emit('sessionCompleted', { session })
      
      return { success: true, session }
      
    } catch (error) {
      console.error('Failed to complete session:', error)
      this.emit('sessionCompletionError', { sessionId, error: error.message })
      throw error
    }
  }

  /**
   * Export session results in various formats
   * Question → Explore → Apply pattern
   */
  async exportSession(sessionId, format = 'json') {
    try {
      // Question: What session needs to be exported?
      const session = this.getSession(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      // Explore: Generate export data based on format
      let exportData
      
      switch (format.toLowerCase()) {
        case 'json':
          exportData = this._exportAsJSON(session)
          break
        case 'markdown':
          exportData = this._exportAsMarkdown(session)
          break
        case 'csv':
          exportData = this._exportAsCSV(session)
          break
        case 'pdf':
          exportData = await this._exportAsPDF(session)
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

      // Apply: Return export result
      this.emit('sessionExported', { sessionId, format, size: exportData.length })
      
      return {
        success: true,
        data: exportData,
        filename: `brainstorming_${session.topic.replace(/\s+/g, '_')}_${sessionId}.${format}`,
        format
      }
      
    } catch (error) {
      console.error('Failed to export session:', error)
      this.emit('sessionExportError', { sessionId, format, error: error.message })
      throw error
    }
  }

  /**
   * Export session as JSON
   */
  _exportAsJSON(session) {
    return JSON.stringify(session, null, 2)
  }

  /**
   * Export session as Markdown
   */
  _exportAsMarkdown(session) {
    let markdown = `# Brainstorming Session: ${session.topic}\n\n`
    
    if (session.description) {
      markdown += `**Description:** ${session.description}\n\n`
    }
    
    markdown += `**Duration:** ${Math.round(session.duration / 1000 / 60)} minutes\n`
    markdown += `**Ideas Generated:** ${session.ideas.length}\n\n`
    
    if (session.summary) {
      markdown += `## Summary\n\n${session.summary}\n\n`
    }
    
    markdown += `## Ideas\n\n`
    
    session.ideas.forEach((idea, index) => {
      markdown += `### ${index + 1}. ${idea.title}\n\n`
      markdown += `${idea.content}\n\n`
      
      if (idea.tags && idea.tags.length > 0) {
        markdown += `**Tags:** ${idea.tags.join(', ')}\n\n`
      }
      
      if (idea.analysis) {
        markdown += `**Analysis:**\n`
        markdown += `- Relevance: ${idea.analysis.relevance}/10\n`
        markdown += `- Feasibility: ${idea.analysis.feasibility}/10\n`
        markdown += `- Innovation: ${idea.analysis.innovation}/10\n`
        markdown += `- Impact: ${idea.analysis.impact}/10\n\n`
      }
      
      markdown += `---\n\n`
    })
    
    return markdown
  }

  /**
   * Export session as CSV
   */
  _exportAsCSV(session) {
    const headers = ['ID', 'Title', 'Content', 'Category', 'Agent', 'Tags', 'Timestamp']
    
    if (session.ideas.length > 0 && session.ideas[0].analysis) {
      headers.push('Relevance', 'Feasibility', 'Innovation', 'Impact')
    }
    
    let csv = headers.join(',') + '\n'
    
    session.ideas.forEach(idea => {
      const row = [
        idea.id,
        `"${idea.title.replace(/"/g, '""')}"`,
        `"${idea.content.replace(/"/g, '""')}"`,
        idea.category || '',
        idea.agent || '',
        `"${(idea.tags || []).join('; ')}"`,
        idea.timestamp
      ]
      
      if (idea.analysis) {
        row.push(
          idea.analysis.relevance,
          idea.analysis.feasibility,
          idea.analysis.innovation,
          idea.analysis.impact
        )
      }
      
      csv += row.join(',') + '\n'
    })
    
    return csv
  }

  /**
   * Export session as PDF (placeholder - would need PDF library)
   */
  async _exportAsPDF(session) {
    // For now, return markdown that could be converted to PDF
    return this._exportAsMarkdown(session)
  }

  /**
   * Load idea templates
   */
  async _loadIdeaTemplates() {
    const templates = [
      {
        id: 'problem_solving',
        name: 'Problem Solving',
        prompts: [
          'What is the root cause of this problem?',
          'How might we approach this differently?',
          'What would happen if we did the opposite?'
        ]
      },
      {
        id: 'product_development',
        name: 'Product Development',
        prompts: [
          'What features would users love?',
          'How can we make this simpler?',
          'What would make this 10x better?'
        ]
      },
      {
        id: 'business_strategy',
        name: 'Business Strategy',
        prompts: [
          'What opportunities are we missing?',
          'How can we differentiate ourselves?',
          'What would our competitors not expect?'
        ]
      }
    ]

    templates.forEach(template => {
      this.state.ideaTemplates.set(template.id, template)
    })
  }

  /**
   * Generate session summary
   */
  _generateSessionSummary(session) {
    const totalIdeas = session.ideas.length
    const categories = [...new Set(session.ideas.map(idea => idea.category))].filter(Boolean)
    const avgConfidence = session.ideas.reduce((sum, idea) => sum + (idea.confidence || 0), 0) / totalIdeas
    
    let summary = `Generated ${totalIdeas} ideas in ${Math.round(session.duration / 1000 / 60)} minutes. `
    
    if (categories.length > 0) {
      summary += `Ideas span ${categories.length} categories: ${categories.join(', ')}. `
    }
    
    summary += `Average confidence: ${(avgConfidence * 100).toFixed(1)}%.`
    
    return summary
  }

  /**
   * Utility functions
   */
  
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  _generateIdeaId() {
    return `idea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  _extractTitle(content) {
    const lines = content.split('\n').filter(line => line.trim())
    return lines[0]?.substring(0, 100) || 'Untitled Idea'
  }
  
  _extractTags(content) {
    const words = content.toLowerCase().split(/\W+/)
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    return words
      .filter(word => word.length > 3 && !commonWords.includes(word))
      .slice(0, 5)
  }
  
  _extractScore(text, metric) {
    const regex = new RegExp(`${metric}[:\\s]*(\\d+)`, 'i')
    const match = text.match(regex)
    return match ? parseInt(match[1]) : null
  }

  /**
   * Public API methods
   */
  
  getSession(sessionId) {
    return this.state.activeSessions.get(sessionId) || 
           this.state.sessionHistory.find(s => s.id === sessionId)
  }
  
  getActiveSessions() {
    return Array.from(this.state.activeSessions.values())
  }
  
  getSessionHistory() {
    return [...this.state.sessionHistory]
  }
  
  getIdeaTemplates() {
    return Array.from(this.state.ideaTemplates.values())
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.state.isInitialized,
      activeSessionsCount: this.state.activeSessions.size,
      sessionHistoryCount: this.state.sessionHistory.length,
      ideaTemplatesCount: this.state.ideaTemplates.size,
      config: this.config
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this.removeAllListeners()
    this.state.activeSessions.clear()
    this.state.sessionHistory.length = 0
    this.state.ideaTemplates.clear()
    this.state.isInitialized = false
  }
}

export default BrainstormingService
