/**
 * ConferenceService.js - Real multi-agent conference service
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
 * ConferenceService - Real implementation for multi-agent conferences
 * 
 * Responsibilities:
 * 1. Create and manage multi-agent conference sessions
 * 2. Facilitate agent-to-agent communication
 * 3. Coordinate discussion rounds and topics
 * 4. Export conference transcripts and results
 * 5. Manage agent roles and permissions
 */
export class ConferenceService extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      defaultModel: 'llama2',
      maxAgents: 10,
      maxRounds: 20,
      roundTimeout: 120000, // 2 minutes per round
      enableTranscripts: true,
      enableModeration: true,
      ...config
    }
    
    this.state = {
      activeSessions: new Map(),
      sessionHistory: [],
      agentProfiles: new Map(),
      isInitialized: false
    }
  }

  /**
   * Initialize the conference service
   * Input → Process → Output pattern
   */
  async initialize() {
    try {
      // Input: Check if already initialized
      if (this.state.isInitialized) {
        return { success: true, message: 'Already initialized' }
      }

      // Process: Load agent profiles and verify backend
      await this._loadAgentProfiles()
      
      // Output: Mark as initialized
      this.state.isInitialized = true
      this.emit('initialized', { timestamp: new Date().toISOString() })
      
      return { success: true, message: 'Conference service initialized' }
      
    } catch (error) {
      console.error('Failed to initialize conference service:', error)
      this.emit('initializationError', { error: error.message })
      throw error
    }
  }

  /**
   * Start a new conference session
   * Question → Explore → Apply pattern
   */
  async startConference(topic, agentIds = [], config = {}) {
    try {
      // Question: What kind of conference is needed?
      if (!topic) {
        throw new Error('Conference topic is required')
      }

      const sessionConfig = {
        topic,
        description: config.description || '',
        maxRounds: config.maxRounds || this.config.maxRounds,
        roundTimeout: config.roundTimeout || this.config.roundTimeout,
        model: config.model || this.config.defaultModel,
        agents: agentIds.length > 0 ? agentIds : ['architect', 'developer', 'reviewer'],
        moderator: config.moderator || 'moderator',
        enableTranscripts: config.enableTranscripts !== false
      }

      const sessionId = this._generateSessionId()
      
      this.emit('conferenceStarted', { sessionId, config: sessionConfig })

      // Explore: Start session via backend API
      const response = await apiService.startConferenceSession(
        sessionConfig.topic,
        sessionConfig.agents,
        sessionConfig.model
      )
      
      if (response.success) {
        const session = {
          id: sessionId,
          ...sessionConfig,
          backendSessionId: response.sessionId,
          status: 'active',
          currentRound: 0,
          messages: [],
          participants: response.participants || [],
          startTime: new Date().toISOString(),
          transcript: []
        }
        
        // Apply: Store session and start first round
        this.state.activeSessions.set(sessionId, session)
        
        // Start first discussion round
        await this._startDiscussionRound(session)
        
        this.emit('sessionCreated', { session })
        return { success: true, session }
      } else {
        throw new Error(response.error || 'Failed to start conference session')
      }
      
    } catch (error) {
      console.error('Failed to start conference:', error)
      this.emit('conferenceError', { error: error.message })
      throw error
    }
  }

  /**
   * Start a discussion round
   * Input → Process → Output pattern
   */
  async _startDiscussionRound(session) {
    try {
      // Input: Validate session and round parameters
      if (!session || session.status !== 'active') {
        return
      }

      session.currentRound++
      
      if (session.currentRound > session.maxRounds) {
        await this.completeSession(session.id)
        return
      }

      this.emit('roundStarted', { 
        sessionId: session.id, 
        round: session.currentRound 
      })

      // Process: Get responses from each agent
      for (const agentId of session.agents) {
        try {
          const response = await this._getAgentResponse(session, agentId)
          if (response) {
            session.messages.push(response)
            session.transcript.push({
              round: session.currentRound,
              agent: agentId,
              message: response.content,
              timestamp: new Date().toISOString()
            })
            
            this.emit('agentResponse', { 
              sessionId: session.id, 
              agent: agentId,
              response 
            })
          }
        } catch (agentError) {
          console.warn(`Failed to get response from agent ${agentId}:`, agentError)
        }
      }

      // Output: Complete round and start next
      this.emit('roundCompleted', { 
        sessionId: session.id, 
        round: session.currentRound,
        messageCount: session.messages.length 
      })

      // Schedule next round
      setTimeout(() => {
        this._startDiscussionRound(session)
      }, 2000) // 2 second delay between rounds
      
    } catch (error) {
      console.error('Failed to start discussion round:', error)
      this.emit('roundError', { sessionId: session.id, error: error.message })
    }
  }

  /**
   * Get response from a specific agent
   * Prompt → Validate → Result pattern
   */
  async _getAgentResponse(session, agentId) {
    try {
      // Prompt: Create context for agent response
      const context = this._buildAgentContext(session, agentId)
      const prompt = this._generateAgentPrompt(session, agentId, context)

      // Validate: Get response via backend
      const response = await apiService.sendConferenceMessage(
        session.backendSessionId,
        agentId,
        prompt,
        true // generateResponse
      )
      
      if (response.success && response.message) {
        // Result: Process and structure the response
        return {
          id: this._generateMessageId(),
          agentId,
          content: response.message.content || response.message,
          round: session.currentRound,
          timestamp: new Date().toISOString(),
          metadata: {
            model: session.model,
            confidence: response.message.confidence || 0.8
          }
        }
      } else {
        throw new Error(response.error || 'Failed to get agent response')
      }
      
    } catch (error) {
      console.error(`Failed to get response from agent ${agentId}:`, error)
      return null
    }
  }

  /**
   * Build context for agent response
   */
  _buildAgentContext(session, agentId) {
    const recentMessages = session.messages.slice(-5) // Last 5 messages
    const agentProfile = this.state.agentProfiles.get(agentId) || { role: agentId }
    
    return {
      topic: session.topic,
      description: session.description,
      round: session.currentRound,
      totalRounds: session.maxRounds,
      agentRole: agentProfile.role,
      agentPersonality: agentProfile.personality || 'professional',
      recentMessages,
      participants: session.agents
    }
  }

  /**
   * Generate prompt for agent
   */
  _generateAgentPrompt(session, agentId, context) {
    const agentProfile = this.state.agentProfiles.get(agentId) || { role: agentId }
    
    let prompt = `You are ${agentProfile.name || agentId}, a ${agentProfile.role || 'participant'} in a conference discussion.

Topic: ${context.topic}
${context.description ? `Description: ${context.description}` : ''}

Round ${context.round} of ${context.totalRounds}

Your role: ${agentProfile.role}
Your perspective: ${agentProfile.perspective || 'Provide thoughtful analysis'}

`

    if (context.recentMessages.length > 0) {
      prompt += `Recent discussion:\n`
      context.recentMessages.forEach(msg => {
        prompt += `${msg.agentId}: ${msg.content}\n`
      })
      prompt += '\n'
    }

    prompt += `Please provide your ${agentProfile.role} perspective on this topic. Be concise but insightful.`

    return prompt
  }

  /**
   * Complete a conference session
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
      if (this.state.sessionHistory.length > 50) {
        this.state.sessionHistory = this.state.sessionHistory.slice(0, 50)
      }

      // Output: Emit completion event
      this.emit('conferenceCompleted', { session })
      
      return { success: true, session }
      
    } catch (error) {
      console.error('Failed to complete session:', error)
      this.emit('sessionCompletionError', { sessionId, error: error.message })
      throw error
    }
  }

  /**
   * Export session transcript
   * Question → Explore → Apply pattern
   */
  async exportTranscript(sessionId, format = 'markdown') {
    try {
      // Question: What session needs to be exported?
      const session = this.getSession(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      // Explore: Generate export data based on format
      let exportData
      
      switch (format.toLowerCase()) {
        case 'markdown':
          exportData = this._exportAsMarkdown(session)
          break
        case 'json':
          exportData = this._exportAsJSON(session)
          break
        case 'txt':
          exportData = this._exportAsText(session)
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

      // Apply: Return export result
      this.emit('transcriptExported', { sessionId, format, size: exportData.length })
      
      return {
        success: true,
        data: exportData,
        filename: `conference_${session.topic.replace(/\s+/g, '_')}_${sessionId}.${format}`,
        format
      }
      
    } catch (error) {
      console.error('Failed to export transcript:', error)
      this.emit('transcriptExportError', { sessionId, format, error: error.message })
      throw error
    }
  }

  /**
   * Export transcript as Markdown
   */
  _exportAsMarkdown(session) {
    let markdown = `# Conference: ${session.topic}\n\n`
    
    if (session.description) {
      markdown += `**Description:** ${session.description}\n\n`
    }
    
    markdown += `**Duration:** ${Math.round(session.duration / 1000 / 60)} minutes\n`
    markdown += `**Rounds:** ${session.currentRound}\n`
    markdown += `**Participants:** ${session.agents.join(', ')}\n\n`
    
    if (session.summary) {
      markdown += `## Summary\n\n${session.summary}\n\n`
    }
    
    markdown += `## Transcript\n\n`
    
    let currentRound = 0
    session.transcript.forEach(entry => {
      if (entry.round !== currentRound) {
        currentRound = entry.round
        markdown += `### Round ${currentRound}\n\n`
      }
      
      markdown += `**${entry.agent}:** ${entry.message}\n\n`
    })
    
    return markdown
  }

  /**
   * Export transcript as JSON
   */
  _exportAsJSON(session) {
    return JSON.stringify(session, null, 2)
  }

  /**
   * Export transcript as plain text
   */
  _exportAsText(session) {
    let text = `Conference: ${session.topic}\n`
    text += `Duration: ${Math.round(session.duration / 1000 / 60)} minutes\n`
    text += `Participants: ${session.agents.join(', ')}\n\n`
    
    let currentRound = 0
    session.transcript.forEach(entry => {
      if (entry.round !== currentRound) {
        currentRound = entry.round
        text += `\n--- Round ${currentRound} ---\n\n`
      }
      
      text += `${entry.agent}: ${entry.message}\n\n`
    })
    
    return text
  }

  /**
   * Load agent profiles
   */
  async _loadAgentProfiles() {
    const profiles = [
      {
        id: 'architect',
        name: 'System Architect',
        role: 'architect',
        perspective: 'Focus on system design, scalability, and technical architecture',
        personality: 'analytical and strategic'
      },
      {
        id: 'developer',
        name: 'Senior Developer',
        role: 'developer',
        perspective: 'Focus on implementation details, code quality, and best practices',
        personality: 'practical and detail-oriented'
      },
      {
        id: 'reviewer',
        name: 'Code Reviewer',
        role: 'reviewer',
        perspective: 'Focus on code quality, security, and maintainability',
        personality: 'critical and thorough'
      },
      {
        id: 'product',
        name: 'Product Manager',
        role: 'product',
        perspective: 'Focus on user needs, business value, and requirements',
        personality: 'user-focused and strategic'
      },
      {
        id: 'qa',
        name: 'QA Engineer',
        role: 'qa',
        perspective: 'Focus on testing, quality assurance, and edge cases',
        personality: 'methodical and thorough'
      }
    ]

    profiles.forEach(profile => {
      this.state.agentProfiles.set(profile.id, profile)
    })
  }

  /**
   * Generate session summary
   */
  _generateSessionSummary(session) {
    const totalMessages = session.messages.length
    const roundsCompleted = session.currentRound
    const avgMessagesPerRound = totalMessages / roundsCompleted
    
    let summary = `Conference completed with ${roundsCompleted} rounds and ${totalMessages} total messages. `
    summary += `Average ${avgMessagesPerRound.toFixed(1)} messages per round. `
    
    const participantCounts = {}
    session.transcript.forEach(entry => {
      participantCounts[entry.agent] = (participantCounts[entry.agent] || 0) + 1
    })
    
    const mostActive = Object.entries(participantCounts)
      .sort(([,a], [,b]) => b - a)[0]
    
    if (mostActive) {
      summary += `Most active participant: ${mostActive[0]} (${mostActive[1]} messages).`
    }
    
    return summary
  }

  /**
   * Utility functions
   */
  
  _generateSessionId() {
    return `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  _generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
  
  getAgentProfiles() {
    return Array.from(this.state.agentProfiles.values())
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.state.isInitialized,
      activeSessionsCount: this.state.activeSessions.size,
      sessionHistoryCount: this.state.sessionHistory.length,
      agentProfilesCount: this.state.agentProfiles.size,
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
    this.state.agentProfiles.clear()
    this.state.isInitialized = false
  }
}

export default ConferenceService
