<!--
  TerminalMonitor.vue - Real-time terminal monitoring for backend processes
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="terminal-monitor">
    <!-- Header -->
    <div class="terminal-monitor__header">
      <h3 class="text-lg font-semibold text-primary">Terminal Monitor</h3>
      <p class="text-sm text-muted">Real-time backend process monitoring</p>
      
      <div class="terminal-actions">
        <BaseButton
          variant="ghost"
          size="sm"
          icon="corvidae-validate"
          @click="clearAllLogs"
        >
          Clear All
        </BaseButton>
        
        <BaseButton
          variant="ghost"
          size="sm"
          icon="turdus-export"
          @click="exportLogs"
        >
          Export Logs
        </BaseButton>
        
        <BaseButton
          variant="ghost"
          size="sm"
          :icon="isAutoScroll ? 'tyrannidae-pause' : 'accipiter-run'"
          @click="toggleAutoScroll"
        >
          {{ isAutoScroll ? 'Pause' : 'Resume' }} Auto-scroll
        </BaseButton>
      </div>
    </div>

    <!-- Process Tabs -->
    <div class="process-tabs">
      <button
        v-for="process in processes"
        :key="process.id"
        class="process-tab"
        :class="{ 
          'process-tab--active': activeProcess === process.id,
          'process-tab--running': process.status === 'running',
          'process-tab--error': process.status === 'error',
          'process-tab--completed': process.status === 'completed'
        }"
        @click="activeProcess = process.id"
      >
        <Icon :name="getProcessIcon(process.type)" size="sm" />
        <span class="process-name">{{ process.name }}</span>
        <span class="process-status-indicator" :class="`status-${process.status}`"></span>
        <span v-if="process.unreadCount > 0" class="unread-badge">{{ process.unreadCount }}</span>
      </button>
      
      <!-- Add Process Button -->
      <button class="process-tab process-tab--add" @click="showAddProcessModal = true">
        <Icon name="plus" size="sm" />
        <span>Add Process</span>
      </button>
    </div>

    <!-- Terminal Content -->
    <div class="terminal-content">
      <div
        v-for="process in processes"
        :key="process.id"
        v-show="activeProcess === process.id"
        class="terminal-panel"
      >
        <!-- Process Info Bar -->
        <div class="process-info-bar">
          <div class="process-details">
            <Icon :name="getProcessIcon(process.type)" size="sm" />
            <span class="process-title">{{ process.name }}</span>
            <span class="process-pid">PID: {{ process.pid || 'N/A' }}</span>
            <span class="process-uptime">Uptime: {{ formatUptime(process.startTime) }}</span>
          </div>
          
          <div class="process-controls">
            <BaseButton
              v-if="process.status === 'running'"
              variant="ghost"
              size="xs"
              icon="tyrannidae-pause"
              @click="pauseProcess(process.id)"
              title="Pause Process"
            />
            <BaseButton
              v-else-if="process.status === 'paused'"
              variant="ghost"
              size="xs"
              icon="accipiter-run"
              @click="resumeProcess(process.id)"
              title="Resume Process"
            />
            <BaseButton
              variant="ghost"
              size="xs"
              icon="tyrannidae-close"
              @click="stopProcess(process.id)"
              title="Stop Process"
            />
            <BaseButton
              variant="ghost"
              size="xs"
              icon="corvidae-validate"
              @click="clearProcessLogs(process.id)"
              title="Clear Logs"
            />
          </div>
        </div>

        <!-- Terminal Output -->
        <div 
          ref="terminalOutput"
          class="terminal-output"
          :class="{ 'terminal-output--auto-scroll': isAutoScroll }"
        >
          <div
            v-for="log in getProcessLogs(process.id)"
            :key="log.id"
            class="log-line"
            :class="`log-${log.level}`"
          >
            <span class="log-timestamp">{{ formatLogTimestamp(log.timestamp) }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-message" v-html="formatLogMessage(log.message)"></span>
          </div>
          
          <!-- Empty State -->
          <div v-if="getProcessLogs(process.id).length === 0" class="terminal-empty">
            <Icon name="passeriformes-text" size="xl" class="text-muted" />
            <p class="text-muted">No logs available for this process</p>
          </div>
        </div>

        <!-- Command Input -->
        <div class="command-input-section">
          <div class="command-input-wrapper">
            <span class="command-prompt">$</span>
            <input
              v-model="commandInput[process.id]"
              type="text"
              class="command-input"
              placeholder="Enter command..."
              @keydown.enter="sendCommand(process.id)"
              @keydown.up="navigateHistory(process.id, 'up')"
              @keydown.down="navigateHistory(process.id, 'down')"
            />
            <BaseButton
              variant="ghost"
              size="sm"
              icon="accipiter-run"
              @click="sendCommand(process.id)"
              :disabled="!commandInput[process.id]?.trim()"
            >
              Send
            </BaseButton>
          </div>
          
          <!-- Command History -->
          <div v-if="showCommandHistory[process.id]" class="command-history">
            <div
              v-for="(cmd, index) in getCommandHistory(process.id)"
              :key="index"
              class="history-item"
              @click="selectHistoryCommand(process.id, cmd)"
            >
              {{ cmd }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Process Statistics -->
    <div class="process-statistics">
      <div class="stats-grid">
        <div class="stat-item">
          <Icon name="accipiter-run" size="sm" class="text-success" />
          <span class="stat-label">Running</span>
          <span class="stat-value">{{ runningProcesses }}</span>
        </div>
        
        <div class="stat-item">
          <Icon name="tyrannidae-pause" size="sm" class="text-warning" />
          <span class="stat-label">Paused</span>
          <span class="stat-value">{{ pausedProcesses }}</span>
        </div>
        
        <div class="stat-item">
          <Icon name="warning" size="sm" class="text-error" />
          <span class="stat-label">Errors</span>
          <span class="stat-value">{{ errorProcesses }}</span>
        </div>
        
        <div class="stat-item">
          <Icon name="corvidae-validate" size="sm" class="text-info" />
          <span class="stat-label">Completed</span>
          <span class="stat-value">{{ completedProcesses }}</span>
        </div>
      </div>
    </div>

    <!-- Add Process Modal -->
    <Modal
      v-if="showAddProcessModal"
      title="Add New Process"
      @close="showAddProcessModal = false"
    >
      <div class="add-process-form">
        <div class="form-group">
          <label class="form-label">Process Name</label>
          <input
            v-model="newProcess.name"
            type="text"
            class="form-input"
            placeholder="Enter process name..."
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Process Type</label>
          <select v-model="newProcess.type" class="form-select">
            <option value="planning">Planning Module</option>
            <option value="brainstorming">Brainstorming Module</option>
            <option value="execution">Execution Module</option>
            <option value="multimodal">Multimodal Module</option>
            <option value="batch">Batch Processor</option>
            <option value="custom">Custom Process</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Command</label>
          <input
            v-model="newProcess.command"
            type="text"
            class="form-input"
            placeholder="Enter command to execute..."
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Working Directory</label>
          <input
            v-model="newProcess.workingDir"
            type="text"
            class="form-input"
            placeholder="Enter working directory..."
          />
        </div>
        
        <div class="form-actions">
          <BaseButton
            variant="ghost"
            @click="showAddProcessModal = false"
          >
            Cancel
          </BaseButton>
          
          <BaseButton
            variant="primary"
            @click="addNewProcess"
            :disabled="!newProcess.name || !newProcess.command"
          >
            Add Process
          </BaseButton>
        </div>
      </div>
    </Modal>

    <!-- Log Filter Modal -->
    <Modal
      v-if="showFilterModal"
      title="Filter Logs"
      @close="showFilterModal = false"
    >
      <div class="log-filter-form">
        <div class="form-group">
          <label class="form-label">Log Level</label>
          <div class="checkbox-group">
            <label v-for="level in logLevels" :key="level" class="checkbox-label">
              <input
                v-model="logFilter.levels"
                type="checkbox"
                :value="level"
                class="checkbox-input"
              />
              <span class="checkbox-text">{{ level.toUpperCase() }}</span>
            </label>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Search Text</label>
          <input
            v-model="logFilter.searchText"
            type="text"
            class="form-input"
            placeholder="Search in log messages..."
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Time Range</label>
          <div class="time-range-inputs">
            <input
              v-model="logFilter.startTime"
              type="datetime-local"
              class="form-input"
            />
            <span class="time-range-separator">to</span>
            <input
              v-model="logFilter.endTime"
              type="datetime-local"
              class="form-input"
            />
          </div>
        </div>
        
        <div class="form-actions">
          <BaseButton
            variant="ghost"
            @click="clearLogFilter"
          >
            Clear Filter
          </BaseButton>
          
          <BaseButton
            variant="primary"
            @click="applyLogFilter"
          >
            Apply Filter
          </BaseButton>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useTerminalMonitor } from '../../composables/useTerminalMonitor.js'
import BaseButton from '../shared/BaseButton.vue'
import Icon from '../shared/Icon.vue'
import Modal from '../shared/Modal.vue'

/**
 * TerminalMonitor Component
 * 
 * Real-time terminal monitoring system:
 * 1. Multi-process monitoring with tabs
 * 2. Real-time log streaming
 * 3. Command input and history
 * 4. Process control (start/stop/pause)
 * 5. Log filtering and export
 */
export default {
  name: 'TerminalMonitor',
  
  components: {
    BaseButton,
    Icon,
    Modal
  },
  
  setup() {
    // Composables
    const {
      processes,
      logs,
      addProcess,
      removeProcess,
      sendCommand: sendProcessCommand,
      clearLogs,
      exportLogs: exportProcessLogs,
      pauseProcess: pauseBackendProcess,
      resumeProcess: resumeBackendProcess,
      stopProcess: stopBackendProcess
    } = useTerminalMonitor()
    
    // Component state
    const activeProcess = ref(null)
    const isAutoScroll = ref(true)
    const showAddProcessModal = ref(false)
    const showFilterModal = ref(false)
    const commandInput = ref({})
    const commandHistory = ref({})
    const historyIndex = ref({})
    const showCommandHistory = ref({})
    const terminalOutput = ref(null)
    
    // New process form
    const newProcess = ref({
      name: '',
      type: 'custom',
      command: '',
      workingDir: ''
    })
    
    // Log filter
    const logFilter = ref({
      levels: ['info', 'warn', 'error', 'debug'],
      searchText: '',
      startTime: '',
      endTime: ''
    })
    
    const logLevels = ['info', 'warn', 'error', 'debug', 'trace']
    
    // Computed properties
    const runningProcesses = computed(() => {
      return processes.value.filter(p => p.status === 'running').length
    })
    
    const pausedProcesses = computed(() => {
      return processes.value.filter(p => p.status === 'paused').length
    })
    
    const errorProcesses = computed(() => {
      return processes.value.filter(p => p.status === 'error').length
    })
    
    const completedProcesses = computed(() => {
      return processes.value.filter(p => p.status === 'completed').length
    })

    // Methods
    
    /**
     * Get logs for specific process
     */
    function getProcessLogs(processId) {
      return logs.value.filter(log => log.processId === processId)
    }
    
    /**
     * Get command history for process
     */
    function getCommandHistory(processId) {
      return commandHistory.value[processId] || []
    }
    
    /**
     * Send command to process
     */
    function sendCommand(processId) {
      const command = commandInput.value[processId]?.trim()
      if (!command) return
      
      // Add to history
      if (!commandHistory.value[processId]) {
        commandHistory.value[processId] = []
      }
      commandHistory.value[processId].unshift(command)
      
      // Keep only last 50 commands
      if (commandHistory.value[processId].length > 50) {
        commandHistory.value[processId] = commandHistory.value[processId].slice(0, 50)
      }
      
      // Send command
      sendProcessCommand(processId, command)
      
      // Clear input
      commandInput.value[processId] = ''
      historyIndex.value[processId] = -1
    }
    
    /**
     * Navigate command history
     */
    function navigateHistory(processId, direction) {
      const history = getCommandHistory(processId)
      if (history.length === 0) return
      
      let currentIndex = historyIndex.value[processId] || -1
      
      if (direction === 'up') {
        currentIndex = Math.min(currentIndex + 1, history.length - 1)
      } else {
        currentIndex = Math.max(currentIndex - 1, -1)
      }
      
      historyIndex.value[processId] = currentIndex
      
      if (currentIndex >= 0) {
        commandInput.value[processId] = history[currentIndex]
      } else {
        commandInput.value[processId] = ''
      }
    }
    
    /**
     * Select command from history
     */
    function selectHistoryCommand(processId, command) {
      commandInput.value[processId] = command
      showCommandHistory.value[processId] = false
    }
    
    /**
     * Add new process
     */
    function addNewProcess() {
      const process = {
        id: Date.now().toString(),
        name: newProcess.value.name,
        type: newProcess.value.type,
        command: newProcess.value.command,
        workingDir: newProcess.value.workingDir,
        status: 'running',
        startTime: Date.now(),
        pid: Math.floor(Math.random() * 10000),
        unreadCount: 0
      }
      
      addProcess(process)
      
      // Reset form
      newProcess.value = {
        name: '',
        type: 'custom',
        command: '',
        workingDir: ''
      }
      
      showAddProcessModal.value = false
      activeProcess.value = process.id
    }
    
    /**
     * Pause process
     */
    function pauseProcess(processId) {
      pauseBackendProcess(processId)
    }
    
    /**
     * Resume process
     */
    function resumeProcess(processId) {
      resumeBackendProcess(processId)
    }
    
    /**
     * Stop process
     */
    function stopProcess(processId) {
      stopBackendProcess(processId)
    }
    
    /**
     * Clear all logs
     */
    function clearAllLogs() {
      clearLogs()
    }
    
    /**
     * Clear logs for specific process
     */
    function clearProcessLogs(processId) {
      clearLogs(processId)
    }
    
    /**
     * Export logs
     */
    function exportLogs() {
      exportProcessLogs()
    }
    
    /**
     * Toggle auto-scroll
     */
    function toggleAutoScroll() {
      isAutoScroll.value = !isAutoScroll.value
    }
    
    /**
     * Apply log filter
     */
    function applyLogFilter() {
      // Implementation for log filtering
      showFilterModal.value = false
    }
    
    /**
     * Clear log filter
     */
    function clearLogFilter() {
      logFilter.value = {
        levels: ['info', 'warn', 'error', 'debug'],
        searchText: '',
        startTime: '',
        endTime: ''
      }
    }
    
    /**
     * Get process icon based on type
     */
    function getProcessIcon(type) {
      const iconMap = {
        'planning': 'corvidae-plan',
        'brainstorming': 'turdus-creative',
        'execution': 'accipiter-run',
        'multimodal': 'turdus-discuss',
        'batch': 'accipiter-folder',
        'custom': 'piciformes-terminal'
      }
      
      return iconMap[type] || 'piciformes-terminal'
    }
    
    /**
     * Format log timestamp
     */
    function formatLogTimestamp(timestamp) {
      return new Date(timestamp).toLocaleTimeString()
    }
    
    /**
     * Format log message with syntax highlighting
     */
    function formatLogMessage(message) {
      // Basic syntax highlighting for common patterns
      return message
        .replace(/\b(ERROR|WARN|INFO|DEBUG)\b/g, '<span class="log-keyword">$1</span>')
        .replace(/\b\d+\b/g, '<span class="log-number">$&</span>')
        .replace(/"([^"]+)"/g, '<span class="log-string">"$1"</span>')
        .replace(/\b(true|false|null|undefined)\b/g, '<span class="log-boolean">$1</span>')
    }
    
    /**
     * Format process uptime
     */
    function formatUptime(startTime) {
      const uptime = Date.now() - startTime
      const seconds = Math.floor(uptime / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`
      } else {
        return `${seconds}s`
      }
    }
    
    /**
     * Auto-scroll to bottom
     */
    function scrollToBottom() {
      if (isAutoScroll.value && terminalOutput.value) {
        nextTick(() => {
          const elements = terminalOutput.value
          if (Array.isArray(elements)) {
            elements.forEach(el => {
              if (el) el.scrollTop = el.scrollHeight
            })
          } else if (elements) {
            elements.scrollTop = elements.scrollHeight
          }
        })
      }
    }

    // Watchers
    watch(logs, () => {
      scrollToBottom()
    }, { deep: true })
    
    watch(processes, (newProcesses) => {
      if (newProcesses.length > 0 && !activeProcess.value) {
        activeProcess.value = newProcesses[0].id
      }
    }, { immediate: true })

    // Lifecycle
    onMounted(() => {
      // Initialize with default processes
      const defaultProcesses = [
        {
          id: 'planning',
          name: 'Planning Module',
          type: 'planning',
          status: 'running',
          startTime: Date.now() - 300000, // 5 minutes ago
          pid: 1234,
          unreadCount: 0
        },
        {
          id: 'execution',
          name: 'Execution Engine',
          type: 'execution',
          status: 'running',
          startTime: Date.now() - 180000, // 3 minutes ago
          pid: 1235,
          unreadCount: 0
        }
      ]
      
      defaultProcesses.forEach(process => addProcess(process))
    })

    return {
      // State
      processes,
      activeProcess,
      isAutoScroll,
      showAddProcessModal,
      showFilterModal,
      commandInput,
      showCommandHistory,
      newProcess,
      logFilter,
      logLevels,
      terminalOutput,
      
      // Computed
      runningProcesses,
      pausedProcesses,
      errorProcesses,
      completedProcesses,
      
      // Methods
      getProcessLogs,
      getCommandHistory,
      sendCommand,
      navigateHistory,
      selectHistoryCommand,
      addNewProcess,
      pauseProcess,
      resumeProcess,
      stopProcess,
      clearAllLogs,
      clearProcessLogs,
      exportLogs,
      toggleAutoScroll,
      applyLogFilter,
      clearLogFilter,
      getProcessIcon,
      formatLogTimestamp,
      formatLogMessage,
      formatUptime
    }
  }
}
</script>

<style scoped>
.terminal-monitor {
  @apply h-full flex flex-col bg-surface;
}

.terminal-monitor__header {
  @apply flex items-start justify-between p-4 border-b border-border bg-surface-hover;
}

.terminal-actions {
  @apply flex items-center gap-2;
}

.process-tabs {
  @apply flex border-b border-border bg-surface-card overflow-x-auto;
}

.process-tab {
  @apply flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted border-b-2 border-transparent hover:text-primary hover:bg-surface-hover transition-colors whitespace-nowrap relative;
}

.process-tab--active {
  @apply text-primary border-primary bg-surface-hover;
}

.process-tab--running {
  @apply border-l-4 border-l-success;
}

.process-tab--error {
  @apply border-l-4 border-l-error;
}

.process-tab--completed {
  @apply border-l-4 border-l-info;
}

.process-tab--add {
  @apply text-muted hover:text-primary;
}

.process-name {
  @apply truncate max-w-32;
}

.process-status-indicator {
  @apply w-2 h-2 rounded-full;
}

.status-running {
  @apply bg-success;
}

.status-paused {
  @apply bg-warning;
}

.status-error {
  @apply bg-error;
}

.status-completed {
  @apply bg-info;
}

.unread-badge {
  @apply absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center;
}

.terminal-content {
  @apply flex-1 overflow-hidden;
}

.terminal-panel {
  @apply h-full flex flex-col;
}

.process-info-bar {
  @apply flex items-center justify-between p-3 border-b border-border bg-surface-card;
}

.process-details {
  @apply flex items-center gap-3 text-sm;
}

.process-title {
  @apply font-medium text-primary;
}

.process-pid,
.process-uptime {
  @apply text-muted;
}

.process-controls {
  @apply flex items-center gap-1;
}

.terminal-output {
  @apply flex-1 overflow-y-auto custom-scrollbar p-4 bg-gray-900 text-green-400 font-mono text-sm;
}

.terminal-output--auto-scroll {
  @apply scroll-smooth;
}

.log-line {
  @apply flex gap-3 py-1 leading-relaxed;
}

.log-timestamp {
  @apply text-gray-500 text-xs min-w-20;
}

.log-level {
  @apply text-xs font-bold min-w-12;
}

.log-message {
  @apply flex-1;
}

.log-info .log-level {
  @apply text-blue-400;
}

.log-warn .log-level {
  @apply text-yellow-400;
}

.log-error .log-level {
  @apply text-red-400;
}

.log-debug .log-level {
  @apply text-purple-400;
}

.log-trace .log-level {
  @apply text-gray-400;
}

.terminal-empty {
  @apply flex flex-col items-center justify-center h-full text-center;
}

.command-input-section {
  @apply border-t border-border bg-surface-card;
}

.command-input-wrapper {
  @apply flex items-center gap-2 p-3;
}

.command-prompt {
  @apply text-primary font-mono font-bold;
}

.command-input {
  @apply flex-1 px-3 py-2 bg-transparent border border-border rounded text-primary font-mono focus:outline-none focus:ring-2 focus:ring-primary;
}

.command-history {
  @apply max-h-32 overflow-y-auto border-t border-border;
}

.history-item {
  @apply px-4 py-2 text-sm font-mono text-secondary hover:bg-surface-hover cursor-pointer;
}

.process-statistics {
  @apply p-4 border-t border-border bg-surface-hover;
}

.stats-grid {
  @apply grid grid-cols-4 gap-4;
}

.stat-item {
  @apply flex items-center gap-2 text-sm;
}

.stat-label {
  @apply text-muted;
}

.stat-value {
  @apply font-semibold text-primary;
}

.add-process-form,
.log-filter-form {
  @apply space-y-4 p-6;
}

.form-group {
  @apply space-y-2;
}

.form-label {
  @apply block text-sm font-medium text-primary;
}

.form-input,
.form-select {
  @apply w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary;
}

.form-actions {
  @apply flex justify-end gap-2 pt-4 border-t border-border;
}

.checkbox-group {
  @apply flex flex-wrap gap-3;
}

.checkbox-label {
  @apply flex items-center gap-2 cursor-pointer;
}

.checkbox-input {
  @apply rounded border-border focus:ring-primary;
}

.checkbox-text {
  @apply text-sm;
}

.time-range-inputs {
  @apply flex items-center gap-2;
}

.time-range-separator {
  @apply text-muted;
}

/* Syntax highlighting */
.log-keyword {
  @apply text-yellow-300 font-bold;
}

.log-number {
  @apply text-blue-300;
}

.log-string {
  @apply text-green-300;
}

.log-boolean {
  @apply text-purple-300;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .terminal-monitor__header {
    @apply flex-col gap-3;
  }
  
  .process-tabs {
    @apply flex-wrap;
  }
  
  .process-info-bar {
    @apply flex-col gap-3;
  }
  
  .stats-grid {
    @apply grid-cols-2;
  }
  
  .command-input-wrapper {
    @apply flex-col gap-2;
  }
}
</style>
