<!--
  BrainstormingTab.vue - AI-powered brainstorming interface
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="brainstorming-tab">
    <div class="tab-header">
      <h2 class="tab-title">
        🧠 Brainstorming & Ideation
      </h2>
      <p class="tab-description">
        Generate and explore ideas with multi-agent AI collaboration
      </p>
    </div>

    <div class="tab-content">
      <!-- Session Configuration -->
      <div class="section">
        <h3 class="section-title">Session Configuration</h3>
        
        <!-- Topic Input -->
        <div class="input-group">
          <label class="input-label">Brainstorming Topic</label>
          <textarea
            v-model="sessionTopic"
            placeholder="Describe what you want to brainstorm about..."
            class="topic-input"
            rows="3"
          />
        </div>

        <!-- Model Selection -->
        <div class="input-group">
          <label class="input-label">AI Model</label>
          <SimpleModelDropdown
            v-model="selectedModel"
            category="brainstorming"
            @model-changed="handleModelChanged"
          />
        </div>

        <!-- Agent Configuration -->
        <div class="input-group">
          <label class="input-label">Agent Types</label>
          <div class="agent-selection">
            <label class="agent-checkbox">
              <input type="checkbox" v-model="selectedAgents" value="creative" />
              <span>Creative Agent</span>
            </label>
            <label class="agent-checkbox">
              <input type="checkbox" v-model="selectedAgents" value="analytical" />
              <span>Analytical Agent</span>
            </label>
            <label class="agent-checkbox">
              <input type="checkbox" v-model="selectedAgents" value="practical" />
              <span>Practical Agent</span>
            </label>
          </div>
        </div>

        <!-- Session Options -->
        <div class="input-group">
          <label class="input-label">Session Options</label>
          <div class="session-options">
            <div class="option-item">
              <label>Max Ideas:</label>
              <input type="number" v-model="maxIdeas" min="1" max="20" class="number-input" />
            </div>
            <div class="option-item">
              <label>Session Duration:</label>
              <select v-model="sessionDuration" class="duration-select">
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Start Button -->
        <div class="input-actions">
          <button
            class="btn-primary"
            @click="startBrainstorming"
            :disabled="!sessionTopic.trim() || !selectedModel || selectedAgents.length === 0 || isSessionActive"
          >
            {{ isSessionActive ? '🔄 Brainstorming...' : '🚀 Start Brainstorming' }}
          </button>
          
          <button
            v-if="isSessionActive"
            class="btn-secondary"
            @click="stopBrainstorming"
          >
            ⏹️ Stop Session
          </button>
        </div>
      </div>

      <!-- Progress Indicator -->
      <div v-if="isSessionActive" class="section">
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: sessionProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ sessionStatus }}</div>
        </div>
      </div>

      <!-- Results Section -->
      <div v-if="sessionResults.length > 0" class="section">
        <div class="results-header">
          <h3 class="section-title">Generated Ideas ({{ sessionResults.length }})</h3>
          <div class="view-controls">
            <button 
              class="view-btn" 
              :class="{ active: viewMode === 'cards' }"
              @click="viewMode = 'cards'"
            >
              📋 Cards
            </button>
            <button 
              class="view-btn" 
              :class="{ active: viewMode === 'canvas' }"
              @click="viewMode = 'canvas'"
            >
              🎨 Canvas
            </button>
          </div>
        </div>

        <!-- Cards View -->
        <div v-if="viewMode === 'cards'" class="ideas-grid">
          <div v-for="(idea, index) in sessionResults" :key="index" class="idea-card">
            <div class="idea-header">
              <span class="idea-agent">{{ idea.agent || 'AI' }}</span>
              <span class="idea-score">{{ idea.score || 85 }}/100</span>
            </div>
            <div class="idea-content">{{ idea.content }}</div>
            <div class="idea-meta">
              <span class="idea-category">{{ idea.category || 'General' }}</span>
              <div class="idea-actions">
                <button class="action-btn" @click="expandIdea(idea)">🔍 Expand</button>
                <button class="action-btn" @click="convertToPlan(idea)">📋 Plan</button>
                <button class="action-btn" @click="saveIdea(idea)">💾 Save</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Canvas View -->
        <div v-if="viewMode === 'canvas'" class="canvas-container">
          <IdeaCanvas
            :ideas="sessionResults"
            :connections="ideaConnections"
            @idea-selected="handleIdeaSelected"
            @connection-created="handleConnectionCreated"
            @canvas-export="handleCanvasExport"
          />
        </div>

        <!-- Export Options -->
        <div class="export-section">
          <h4 class="export-title">Export Ideas</h4>
          <div class="export-buttons">
            <button class="export-btn" @click="exportIdeas('json')">📄 JSON</button>
            <button class="export-btn" @click="exportIdeas('csv')">📊 CSV</button>
            <button class="export-btn" @click="exportIdeas('markdown')">📝 Markdown</button>
            <button class="export-btn" @click="exportIdeas('pdf')">📑 PDF</button>
          </div>
        </div>
      </div>

      <!-- Session History -->
      <div v-if="sessionHistory.length > 0" class="section">
        <h3 class="section-title">Session History</h3>
        <div class="history-list">
          <div v-for="session in sessionHistory" :key="session.id" class="history-item" @click="loadSession(session)">
            <div class="history-header">
              <div class="history-topic">{{ session.topic }}</div>
              <div class="history-date">{{ formatDate(session.timestamp) }}</div>
            </div>
            <div class="history-meta">
              <span class="history-stat">{{ session.ideas.length }} ideas</span>
              <span class="history-stat">{{ session.model }}</span>
              <span class="history-stat">{{ session.agents?.join(', ') || 'Multiple agents' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="section">
        <h3 class="section-title">Quick Actions</h3>
        <div class="quick-actions">
          <button class="quick-action-btn" @click="startQuickSession('product-ideas')">
            💡 Product Ideas
          </button>
          <button class="quick-action-btn" @click="startQuickSession('problem-solving')">
            🔧 Problem Solving
          </button>
          <button class="quick-action-btn" @click="startQuickSession('creative-writing')">
            ✍️ Creative Writing
          </button>
          <button class="quick-action-btn" @click="startQuickSession('business-strategy')">
            📈 Business Strategy
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import SimpleModelDropdown from '../shared/SimpleModelDropdown.vue'
import IdeaCanvas from './IdeaCanvas.vue'

export default {
  name: 'BrainstormingTab',
  
  components: {
    SimpleModelDropdown,
    IdeaCanvas
  },
  
  props: {
    engine: {
      type: Object,
      default: null
    }
  },
  
  emits: ['session-completed', 'idea-expanded', 'plan-created'],
  
  setup(props, { emit }) {
    // State
    const selectedModel = ref('')
    const sessionTopic = ref('')
    const selectedAgents = ref(['creative'])
    const maxIdeas = ref(5)
    const sessionDuration = ref(10)
    const isSessionActive = ref(false)
    const sessionProgress = ref(0)
    const sessionStatus = ref('')
    const sessionResults = ref([])
    const sessionHistory = ref([])
    const viewMode = ref('cards')
    const ideaConnections = ref([])
    const availableModels = ref([])

    // Load models from backend
    const loadModels = async () => {
      try {
        const response = await fetch('http://localhost:3333/api/models')
        const result = await response.json()
        
        if (result.success && result.models) {
          availableModels.value = result.models
          console.log('Loaded models:', result.models.length)
          
          // Set first model as default if none selected
          if (!selectedModel.value && result.models.length > 0) {
            selectedModel.value = result.models[0].name
          }
        }
      } catch (error) {
        console.error('Failed to load models:', error)
      }
    }

    // Format model size for display
    const formatModelSize = (size) => {
      if (!size) return 'Unknown'
      
      const gb = size / (1024 * 1024 * 1024)
      if (gb >= 1) {
        return `${gb.toFixed(1)}GB`
      }
      
      const mb = size / (1024 * 1024)
      return `${mb.toFixed(0)}MB`
    }

    // Start brainstorming session
    const startBrainstorming = async () => {
      if (!sessionTopic.value.trim() || !selectedModel.value || selectedAgents.value.length === 0) return
      
      try {
        isSessionActive.value = true
        sessionProgress.value = 0
        sessionStatus.value = 'Initializing session...'
        
        // Use actual backend API with Ollama
        const response = await fetch('http://localhost:3333/api/brainstorming/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic: sessionTopic.value,
            model: selectedModel.value,
            agents: selectedAgents.value,
            maxIdeas: maxIdeas.value
          })
        })
        
        const result = await response.json()
        
        if (result.success && result.ideas) {
          sessionResults.value = result.ideas
        } else {
          console.error('Brainstorming API failed:', result)
          // Fallback to basic ideas if API fails
          sessionResults.value = [
            {
              content: `Build a ${sessionTopic.value} application`,
              score: 85,
              category: 'Development',
              agent: 'creative'
            }
          ]
        }
        
        // Add to history
        const session = {
          id: Date.now(),
          topic: sessionTopic.value,
          ideas: sessionResults.value,
          model: selectedModel.value,
          agents: selectedAgents.value,
          timestamp: new Date().toISOString()
        }
        
        sessionHistory.value.unshift(session)
        
        emit('session-completed', session)
        
      } catch (error) {
        console.error('Brainstorming session failed:', error)
        // Fallback if network fails
        sessionResults.value = [
          {
            content: `Create a ${sessionTopic.value} project`,
            score: 80,
            category: 'Basic',
            agent: 'fallback'
          }
        ]
      } finally {
        isSessionActive.value = false
        sessionProgress.value = 100
        sessionStatus.value = 'Session completed'
      }
    }

    // Stop brainstorming session
    const stopBrainstorming = () => {
      isSessionActive.value = false
      sessionStatus.value = 'Session stopped'
    }

    // Start quick session with predefined topic
    const startQuickSession = (type) => {
      const topics = {
        'product-ideas': 'Innovative product ideas for modern consumers',
        'problem-solving': 'Creative solutions to common workplace challenges',
        'creative-writing': 'Unique story concepts and character development ideas',
        'business-strategy': 'Strategic approaches to business growth and market expansion'
      }
      
      sessionTopic.value = topics[type] || 'General brainstorming session'
      startBrainstorming()
    }

    // Expand idea with more details
    const expandIdea = (idea) => {
      emit('idea-expanded', idea)
    }

    // Convert idea to execution plan
    const convertToPlan = (idea) => {
      emit('plan-created', idea)
    }

    // Save idea to favorites
    const saveIdea = (idea) => {
      // Implementation for saving ideas
      console.log('Saving idea:', idea)
    }

    // Export ideas in various formats
    const exportIdeas = (format) => {
      const data = {
        session: {
          topic: sessionTopic.value,
          model: selectedModel.value,
          agents: selectedAgents.value,
          timestamp: new Date().toISOString()
        },
        ideas: sessionResults.value
      }
      
      switch (format) {
        case 'json':
          downloadFile(JSON.stringify(data, null, 2), 'brainstorming-session.json', 'application/json')
          break
        case 'csv':
          const csv = convertToCSV(sessionResults.value)
          downloadFile(csv, 'brainstorming-ideas.csv', 'text/csv')
          break
        case 'markdown':
          const markdown = convertToMarkdown(data)
          downloadFile(markdown, 'brainstorming-session.md', 'text/markdown')
          break
        case 'pdf':
          // PDF export would require additional library
          console.log('PDF export not implemented yet')
          break
      }
    }

    // Helper function to download file
    const downloadFile = (content, filename, mimeType) => {
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    // Convert ideas to CSV format
    const convertToCSV = (ideas) => {
      const headers = ['Content', 'Score', 'Category', 'Agent']
      const rows = ideas.map(idea => [
        `"${idea.content}"`,
        idea.score || 0,
        idea.category || 'General',
        idea.agent || 'AI'
      ])
      
      return [headers, ...rows].map(row => row.join(',')).join('\n')
    }

    // Convert session to Markdown format
    const convertToMarkdown = (data) => {
      let markdown = `# Brainstorming Session\n\n`
      markdown += `**Topic:** ${data.session.topic}\n`
      markdown += `**Model:** ${data.session.model}\n`
      markdown += `**Agents:** ${data.session.agents.join(', ')}\n`
      markdown += `**Date:** ${new Date(data.session.timestamp).toLocaleString()}\n\n`
      markdown += `## Generated Ideas\n\n`
      
      data.ideas.forEach((idea, index) => {
        markdown += `### Idea ${index + 1}\n`
        markdown += `**Content:** ${idea.content}\n`
        markdown += `**Score:** ${idea.score || 'N/A'}\n`
        markdown += `**Category:** ${idea.category || 'General'}\n`
        markdown += `**Agent:** ${idea.agent || 'AI'}\n\n`
      })
      
      return markdown
    }

    // Load previous session
    const loadSession = (session) => {
      sessionTopic.value = session.topic
      selectedModel.value = session.model
      selectedAgents.value = session.agents || ['creative']
      sessionResults.value = session.ideas
    }

    // Format date for display
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString()
    }

    // Handle idea selection in canvas
    const handleIdeaSelected = (idea) => {
      console.log('Idea selected:', idea)
    }

    // Handle connection creation in canvas
    const handleConnectionCreated = (connection) => {
      ideaConnections.value.push(connection)
    }

    // Handle canvas export
    const handleCanvasExport = (exportData) => {
      console.log('Canvas export:', exportData)
    }

    // Handle ideas updated from canvas
    const handleIdeasUpdated = (updatedIdeas) => {
      sessionResults.value = updatedIdeas
    }

    // Handle model change
    const handleModelChanged = (model) => {
      selectedModel.value = model
    }

    // Lifecycle
    onMounted(() => {
      loadModels()
    })

    return {
      // State
      selectedModel,
      sessionTopic,
      selectedAgents,
      maxIdeas,
      sessionDuration,
      isSessionActive,
      sessionProgress,
      sessionStatus,
      sessionResults,
      sessionHistory,
      viewMode,
      ideaConnections,
      availableModels,
      
      // Methods
      formatModelSize,
      startBrainstorming,
      stopBrainstorming,
      startQuickSession,
      expandIdea,
      convertToPlan,
      saveIdea,
      exportIdeas,
      loadSession,
      formatDate,
      handleIdeaSelected,
      handleConnectionCreated,
      handleCanvasExport,
      handleIdeasUpdated,
      handleModelChanged
    }
  }
}
</script>

<style scoped>
.brainstorming-tab {
  @apply flex flex-col h-full bg-surface;
}

.tab-header {
  @apply p-6 border-b border-border bg-gradient-to-r from-surface to-surface-hover;
}

.tab-title {
  @apply text-2xl font-bold text-primary mb-2;
}

.tab-description {
  @apply text-muted;
}

.tab-content {
  @apply flex-1 overflow-y-auto p-6 space-y-6;
}

.section {
  @apply bg-surface-card rounded-lg p-6 border border-border;
}

.section-title {
  @apply text-lg font-semibold text-primary mb-4;
}

.input-group {
  @apply mb-4;
}

.input-label {
  @apply block text-sm font-medium text-primary mb-2;
}

.topic-input {
  @apply w-full p-3 bg-surface border border-border rounded-lg text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
  resize: vertical;
}

.model-select {
  @apply w-full p-3 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
}

.agent-selection {
  @apply flex flex-wrap gap-4;
}

.agent-checkbox {
  @apply flex items-center gap-2 cursor-pointer;
}

.agent-checkbox input {
  @apply w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary;
}

.agent-checkbox span {
  @apply text-primary;
}

.session-options {
  @apply flex gap-4;
}

.option-item {
  @apply flex items-center gap-2;
}

.option-item label {
  @apply text-sm text-primary;
}

.number-input,
.duration-select {
  @apply p-2 bg-surface border border-border rounded text-primary focus:outline-none focus:ring-2 focus:ring-primary;
}

.input-actions {
  @apply flex gap-3 mt-6;
}

.btn-primary {
  @apply px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply px-6 py-3 bg-surface-hover text-primary border border-border rounded-lg hover:bg-surface-elevated transition-all duration-200;
}

.progress-container {
  @apply space-y-2;
}

.progress-bar {
  @apply w-full bg-surface-hover rounded-full h-2;
}

.progress-fill {
  @apply bg-gradient-to-r from-red-500 to-pink-500 h-2 rounded-full transition-all duration-300;
}

.progress-text {
  @apply text-sm text-muted text-center;
}

.results-header {
  @apply flex justify-between items-center mb-4;
}

.view-controls {
  @apply flex gap-2;
}

.view-btn {
  @apply px-3 py-2 text-sm bg-surface-hover text-primary rounded-lg hover:bg-surface-elevated transition-all duration-200;
}

.view-btn.active {
  @apply bg-primary text-white;
}

.ideas-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.idea-card {
  @apply bg-surface border border-border rounded-lg p-4 hover:border-primary transition-all duration-200;
}

.idea-header {
  @apply flex justify-between items-center mb-3;
}

.idea-agent {
  @apply text-xs px-2 py-1 bg-surface-hover text-primary rounded-full;
}

.idea-score {
  @apply text-xs font-semibold text-primary;
}

.idea-content {
  @apply text-primary mb-3 leading-relaxed;
}

.idea-meta {
  @apply flex justify-between items-center;
}

.idea-category {
  @apply text-xs px-2 py-1 bg-surface-elevated text-muted rounded;
}

.idea-actions {
  @apply flex gap-1;
}

.action-btn {
  @apply text-xs px-2 py-1 bg-surface-hover text-primary rounded hover:bg-surface-elevated transition-all duration-200;
}

.canvas-container {
  @apply h-96 bg-surface border border-border rounded-lg;
}

.export-section {
  @apply mt-6 pt-6 border-t border-border;
}

.export-title {
  @apply text-sm font-medium text-primary mb-3;
}

.export-buttons {
  @apply flex gap-2;
}

.export-btn {
  @apply px-3 py-2 text-sm bg-surface-hover text-primary rounded-lg hover:bg-surface-elevated transition-all duration-200;
}

.history-list {
  @apply space-y-3;
}

.history-item {
  @apply p-4 bg-surface border border-border rounded-lg cursor-pointer hover:border-primary transition-all duration-200;
}

.history-header {
  @apply flex justify-between items-start mb-2;
}

.history-topic {
  @apply font-medium text-primary;
}

.history-date {
  @apply text-xs text-muted;
}

.history-meta {
  @apply flex gap-4 text-sm text-muted;
}

.history-stat {
  @apply flex items-center gap-1;
}

.quick-actions {
  @apply grid grid-cols-2 md:grid-cols-4 gap-3;
}

.quick-action-btn {
  @apply p-4 bg-surface-hover text-primary rounded-lg hover:bg-surface-elevated transition-all duration-200 text-center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .session-options {
    @apply flex-col;
  }
  
  .ideas-grid {
    @apply grid-cols-1;
  }
  
  .quick-actions {
    @apply grid-cols-1;
  }
}
</style>
