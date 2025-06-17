<!--
  BackendLogViewer.vue - Real-time backend activity monitor
  
  Shows live backend logs and API calls across all screens
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="backend-log-viewer" :class="{ 'minimized': isMinimized }">
    <!-- Header -->
    <div class="log-header" @click="toggleMinimized">
      <div class="log-title">
        <Icon name="accipiter-terminal" size="sm" />
        <span>{{ activeTab === 'backend' ? 'Backend Activity' : 'Ollama Output' }}</span>
        <span class="log-count">({{ activeTab === 'backend' ? logs.length : ollamaLogs.length }})</span>
      </div>
      
      <div class="log-controls">
        <button 
          class="control-btn"
          @click.stop="clearLogs"
          title="Clear logs"
        >
          <Icon name="corvidae-clear" size="xs" />
        </button>
        
        <button 
          class="control-btn"
          @click.stop="toggleAutoScroll"
          :class="{ active: autoScroll }"
          title="Auto-scroll"
        >
          <Icon name="tyrannidae-scroll" size="xs" />
        </button>
        
        <button 
          class="control-btn minimize-btn"
          @click.stop="toggleMinimized"
          :title="isMinimized ? 'Expand' : 'Minimize'"
        >
          <Icon :name="isMinimized ? 'tyrannidae-expand' : 'tyrannidae-collapse'" size="xs" />
        </button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div v-if="!isMinimized" class="log-tabs">
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'backend' }"
        @click="activeTab = 'backend'"
      >
        Backend Activity
      </button>
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'ollama' }"
        @click="activeTab = 'ollama'"
      >
        Ollama Output
      </button>
    </div>

    <!-- Backend Log Content -->
    <div v-if="!isMinimized && activeTab === 'backend'" class="log-content" ref="logContainer">
      <div 
        v-for="log in logs" 
        :key="log.id"
        class="log-entry"
        :class="[`log-${log.level}`, { 'log-error': log.level === 'error' }]"
      >
        <div class="log-timestamp">{{ formatTime(log.timestamp) }}</div>
        <div class="log-level">{{ log.level.toUpperCase() }}</div>
        <div class="log-message">{{ log.message }}</div>
        <div v-if="log.data" class="log-data">
          <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
        </div>
      </div>
      
      <div v-if="logs.length === 0" class="log-empty">
        <Icon name="passeriformes-info" size="lg" />
        <p>No backend activity yet</p>
        <p class="text-muted">Backend logs will appear here in real-time</p>
      </div>
    </div>

    <!-- Ollama Log Content -->
    <div v-if="!isMinimized && activeTab === 'ollama'" class="log-content" ref="ollamaContainer">
      <div 
        v-for="log in ollamaLogs" 
        :key="log.id"
        class="log-entry ollama-entry"
      >
        <div class="log-timestamp">{{ formatTime(log.timestamp) }}</div>
        <div class="log-message ollama-message">{{ log.message }}</div>
        <div v-if="log.thinking" class="ollama-thinking">
          <div class="thinking-indicator">🤔 Thinking...</div>
          <pre>{{ log.thinking }}</pre>
        </div>
      </div>
      
      <div v-if="ollamaLogs.length === 0" class="log-empty">
        <Icon name="passeriformes-info" size="lg" />
        <p>No Ollama output yet</p>
        <p class="text-muted">Ollama thinking process will appear here</p>
      </div>
    </div>

    <!-- Connection Status -->
    <div v-if="!isMinimized" class="connection-status">
      <div class="status-indicator" :class="connectionStatus">
        <div class="status-dot"></div>
        <span>{{ connectionStatusText }}</span>
      </div>
      
      <div class="backend-info">
        <span>Backend: {{ backendUrl }}</span>
        <span v-if="lastActivity">Last: {{ formatTime(lastActivity) }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, nextTick, computed } from 'vue'
import Icon from './Icon.vue'
import { apiService } from '../../services/ApiService.js'

export default {
  name: 'BackendLogViewer',
  
  components: {
    Icon
  },
  
  setup() {
    // State
    const isMinimized = ref(false)
    const autoScroll = ref(true)
    const activeTab = ref('backend')
    const logs = ref([])
    const ollamaLogs = ref([])
    const logContainer = ref(null)
    const ollamaContainer = ref(null)
    const connectionStatus = ref('disconnected')
    const lastActivity = ref(null)
    const backendUrl = ref('http://localhost:3333')
    
    // WebSocket connection for real-time logs
    let ws = null
    let ollamaWs = null
    let reconnectTimer = null
    let heartbeatTimer = null
    
    // Computed
    const connectionStatusText = computed(() => {
      switch (connectionStatus.value) {
        case 'connected': return 'Connected'
        case 'connecting': return 'Connecting...'
        case 'disconnected': return 'Disconnected'
        case 'error': return 'Connection Error'
        default: return 'Unknown'
      }
    })
    
    // Methods
    const addLog = (level, message, data = null) => {
      const log = {
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        level,
        message,
        data
      }
      
      logs.value.push(log)
      lastActivity.value = log.timestamp
      
      // Keep only last 100 logs
      if (logs.value.length > 100) {
        logs.value.shift()
      }
      
      // Auto-scroll to bottom
      if (autoScroll.value) {
        nextTick(() => {
          scrollToBottom()
        })
      }
    }
    
    const clearLogs = () => {
      if (activeTab.value === 'backend') {
        logs.value = []
      } else {
        clearOllamaLogs()
      }
    }
    
    const toggleMinimized = () => {
      isMinimized.value = !isMinimized.value
    }
    
    const toggleAutoScroll = () => {
      autoScroll.value = !autoScroll.value
      if (autoScroll.value) {
        scrollToBottom()
      }
    }
    
    const scrollToBottom = () => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    }
    
    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      })
    }
    
    // Ollama log detection and handling
    const isOllamaLog = (message) => {
      const ollamaKeywords = [
        'LLM Generation',
        'ChatOllama',
        'Ollama',
        'ollama',
        'model:',
        'temperature:',
        'Chunk',
        'Stream',
        'OLLAMA_BASE_URL',
        'generateFromLocal',
        'langchain'
      ]
      return ollamaKeywords.some(keyword => message.includes(keyword))
    }
    
    const addOllamaLog = (message, timestamp) => {
      const log = {
        id: Date.now() + Math.random(),
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        message: message,
        thinking: extractThinkingProcess(message)
      }
      
      ollamaLogs.value.push(log)
      
      // Keep only last 50 Ollama logs
      if (ollamaLogs.value.length > 50) {
        ollamaLogs.value.shift()
      }
      
      // Auto-scroll Ollama container if active
      if (autoScroll.value && activeTab.value === 'ollama') {
        nextTick(() => {
          scrollOllamaToBottom()
        })
      }
    }
    
    const extractThinkingProcess = (message) => {
      // Extract thinking process from LLM generation logs
      if (message.includes('Full prompt:') || message.includes('Final response:')) {
        const lines = message.split('\n')
        const relevantLines = lines.filter(line => 
          line.includes('prompt:') || 
          line.includes('response:') || 
          line.includes('Chunk') ||
          line.includes('temperature:') ||
          line.includes('model:')
        )
        return relevantLines.length > 0 ? relevantLines.join('\n') : null
      }
      return null
    }
    
    const scrollOllamaToBottom = () => {
      if (ollamaContainer.value) {
        ollamaContainer.value.scrollTop = ollamaContainer.value.scrollHeight
      }
    }
    
    const clearOllamaLogs = () => {
      ollamaLogs.value = []
    }
    
    // WebSocket connection management
    const connectWebSocket = () => {
      try {
        connectionStatus.value = 'connecting'
        addLog('info', 'Attempting to connect to backend...')
        
        // Try to connect to backend WebSocket for real-time logs
        ws = new WebSocket('ws://localhost:3333/ws/logs')
        
        ws.onopen = () => {
          connectionStatus.value = 'connected'
          addLog('success', 'Connected to backend log stream')
          startHeartbeat()
        }
        
        ws.onmessage = (event) => {
          try {
            const logData = JSON.parse(event.data)
            const level = (logData.level || 'info').toLowerCase()
            
            // Add to backend logs
            addLog(level, logData.message, logData.data)
            
            // Check if this is Ollama-related output
            if (isOllamaLog(logData.message)) {
              addOllamaLog(logData.message, logData.timestamp)
            }
            
          } catch (error) {
            addLog('debug', event.data)
          }
        }
        
        ws.onclose = () => {
          connectionStatus.value = 'disconnected'
          addLog('warning', 'Disconnected from backend')
          stopHeartbeat()
          scheduleReconnect()
        }
        
        ws.onerror = (error) => {
          connectionStatus.value = 'error'
          addLog('error', 'WebSocket connection error', error)
        }
        
      } catch (error) {
        connectionStatus.value = 'error'
        addLog('error', 'Failed to establish WebSocket connection', error)
        scheduleReconnect()
      }
    }
    
    const disconnectWebSocket = () => {
      if (ws) {
        ws.close()
        ws = null
      }
      stopHeartbeat()
      clearReconnectTimer()
    }
    
    const scheduleReconnect = () => {
      clearReconnectTimer()
      reconnectTimer = setTimeout(() => {
        if (connectionStatus.value !== 'connected') {
          connectWebSocket()
        }
      }, 5000) // Retry every 5 seconds
    }
    
    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }
    
    const startHeartbeat = () => {
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000) // Ping every 30 seconds
    }
    
    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }
    
    // Intercept API calls to log them
    const originalRequest = apiService.request
    apiService.request = async function(endpoint, options = {}) {
      const startTime = Date.now()
      addLog('info', `API Request: ${options.method || 'GET'} ${endpoint}`, {
        endpoint,
        method: options.method || 'GET',
        body: options.body
      })
      
      try {
        const result = await originalRequest.call(this, endpoint, options)
        const duration = Date.now() - startTime
        addLog('success', `API Response: ${endpoint} (${duration}ms)`, {
          endpoint,
          duration,
          status: 'success'
        })
        return result
      } catch (error) {
        const duration = Date.now() - startTime
        addLog('error', `API Error: ${endpoint} (${duration}ms)`, {
          endpoint,
          duration,
          error: error.message
        })
        throw error
      }
    }
    
    // Lifecycle
    onMounted(() => {
      addLog('info', 'Backend log viewer initialized')
      
      // Try to connect to WebSocket
      connectWebSocket()
      
      // Test backend connection
      apiService.getStatus()
        .then(() => {
          addLog('success', 'Backend is responsive')
        })
        .catch((error) => {
          addLog('warning', 'Backend connection test failed', error)
        })
    })
    
    onUnmounted(() => {
      disconnectWebSocket()
    })
    
    return {
      // State
      isMinimized,
      autoScroll,
      activeTab,
      logs,
      ollamaLogs,
      logContainer,
      ollamaContainer,
      connectionStatus,
      lastActivity,
      backendUrl,
      
      // Computed
      connectionStatusText,
      
      // Methods
      addLog,
      clearLogs,
      toggleMinimized,
      toggleAutoScroll,
      formatTime
    }
  }
}
</script>

<style scoped>
.backend-log-viewer {
  position: fixed;
  bottom: 0;
  right: 20px;
  width: 400px;
  max-height: 300px;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 8px 8px 0 0;
  backdrop-filter: blur(10px);
  z-index: 1000;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
}

.backend-log-viewer.minimized {
  max-height: 40px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(233, 69, 96, 0.1);
  border-bottom: 1px solid rgba(233, 69, 96, 0.2);
  cursor: pointer;
  user-select: none;
}

.log-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #e94560;
}

.log-count {
  color: rgba(233, 69, 96, 0.7);
  font-size: 11px;
}

.log-controls {
  display: flex;
  gap: 4px;
}

.control-btn {
  padding: 4px;
  background: transparent;
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 4px;
  color: #e94560;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: rgba(233, 69, 96, 0.1);
  border-color: rgba(233, 69, 96, 0.5);
}

.control-btn.active {
  background: rgba(233, 69, 96, 0.2);
  border-color: #e94560;
}

.log-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(233, 69, 96, 0.2);
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: rgba(233, 69, 96, 0.7);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  background: rgba(233, 69, 96, 0.1);
  color: #e94560;
}

.tab-btn.active {
  background: rgba(233, 69, 96, 0.1);
  color: #e94560;
  border-bottom-color: #e94560;
}

.log-content {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
}

.log-entry {
  display: grid;
  grid-template-columns: 80px 60px 1fr;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(233, 69, 96, 0.1);
  font-size: 11px;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-timestamp {
  color: rgba(233, 69, 96, 0.6);
  font-size: 10px;
}

.log-level {
  font-weight: 600;
  text-transform: uppercase;
}

.log-info .log-level {
  color: #3498db;
}

.log-success .log-level {
  color: #27ae60;
}

.log-warning .log-level {
  color: #f39c12;
}

.log-error .log-level {
  color: #e74c3c;
}

.log-debug .log-level {
  color: #9b59b6;
}

.log-message {
  color: #e94560;
  word-break: break-word;
}

.log-data {
  grid-column: 1 / -1;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  font-size: 10px;
}

.log-data pre {
  margin: 0;
  color: rgba(233, 69, 96, 0.8);
  white-space: pre-wrap;
  word-break: break-word;
}

.log-empty {
  text-align: center;
  padding: 20px;
  color: rgba(233, 69, 96, 0.6);
}

.log-empty p {
  margin: 8px 0;
}

.text-muted {
  color: rgba(233, 69, 96, 0.4);
  font-size: 10px;
}

/* Ollama-specific styles */
.ollama-entry {
  grid-template-columns: 80px 1fr;
}

.ollama-message {
  color: #8b5cf6;
  font-weight: 500;
}

.ollama-thinking {
  grid-column: 1 / -1;
  margin-top: 8px;
  padding: 8px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 4px;
  border-left: 3px solid #8b5cf6;
}

.thinking-indicator {
  color: #8b5cf6;
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 10px;
}

.ollama-thinking pre {
  margin: 0;
  color: rgba(139, 92, 246, 0.8);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 10px;
  line-height: 1.4;
}

.connection-status {
  padding: 8px 12px;
  border-top: 1px solid rgba(233, 69, 96, 0.2);
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6c757d;
}

.status-indicator.connected .status-dot {
  background: #27ae60;
  box-shadow: 0 0 6px rgba(39, 174, 96, 0.5);
}

.status-indicator.connecting .status-dot {
  background: #f39c12;
  animation: pulse 1s infinite;
}

.status-indicator.disconnected .status-dot {
  background: #6c757d;
}

.status-indicator.error .status-dot {
  background: #e74c3c;
}

.backend-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  color: rgba(233, 69, 96, 0.6);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Scrollbar */
.log-content::-webkit-scrollbar {
  width: 6px;
}

.log-content::-webkit-scrollbar-track {
  background: rgba(26, 26, 46, 0.5);
}

.log-content::-webkit-scrollbar-thumb {
  background: rgba(233, 69, 96, 0.3);
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: rgba(233, 69, 96, 0.5);
}

/* Responsive */
@media (max-width: 768px) {
  .backend-log-viewer {
    right: 10px;
    width: calc(100vw - 20px);
    max-width: 350px;
  }
}
</style>
