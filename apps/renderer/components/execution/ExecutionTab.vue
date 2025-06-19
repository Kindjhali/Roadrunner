<template>
  <div class="execution-tab">
    <!-- Header -->
    <div class="header">
      <h2>🚀 Roadrunner Autocoder</h2>
      <p>Describe what you want to build and the AI will automatically generate code, write files, and execute tasks</p>
    </div>

    <!-- Mode Selection -->
    <div class="mode-tabs">
      <button 
        :class="{ active: mode === 'single' }" 
        @click="mode = 'single'"
      >
        Single Task
      </button>
      <button 
        :class="{ active: mode === 'batch' }" 
        @click="mode = 'batch'"
      >
        Batch Folder
      </button>
    </div>

    <!-- Single Task Mode -->
    <div v-if="mode === 'single'" class="single-mode">
      <div class="model-selection">
        <h3>Model Selection</h3>
        <SimpleModelDropdown
          v-model="selectedModel"
          placeholder="Select AI model for execution"
        />
      </div>
      
      <h3>Task Description</h3>
      <textarea
        v-model="taskDescription"
        placeholder="Describe what you want to build. Examples:

• Create a simple calculator web app with HTML, CSS, and JavaScript
• Build a REST API for a todo list with Node.js and Express  
• Generate a Python script that processes CSV files
• Create a Vue.js component for user authentication
• Build a React dashboard with charts and data visualization"
        rows="8"
        :disabled="isExecuting"
      ></textarea>
      
      <div class="controls">
        <label>
          <input v-model="safetyMode" type="checkbox" />
          Safety Mode (requires confirmation for file operations)
        </label>
        
        <button 
          :disabled="!taskDescription.trim() || isExecuting"
          @click="executeTask"
          class="execute-btn"
        >
          {{ isExecuting ? 'Executing...' : 'Start Autocoder' }}
        </button>
      </div>
    </div>

    <!-- Batch Folder Mode -->
    <div v-if="mode === 'batch'" class="batch-mode">
      <div class="model-selection">
        <h3>Model Selection</h3>
        <SimpleModelDropdown
          v-model="selectedModel"
          placeholder="Select AI model for batch processing"
        />
      </div>
      
      <h3>Batch Folder Processing</h3>
      
      <div class="folder-selector">
        <input
          ref="folderInput"
          type="file"
          webkitdirectory
          multiple
          style="display: none"
          @change="handleFolderSelect"
        />
        
        <div v-if="!selectedFolder" class="folder-placeholder">
          <p>Select a folder containing instruction files (.txt, .md)</p>
          <button @click="$refs.folderInput.click()">Select Folder</button>
        </div>
        
        <div v-else class="folder-selected">
          <h4>{{ selectedFolder.name }}</h4>
          <p>{{ instructionFiles.length }} instruction files found</p>
          <button @click="clearFolder">Clear</button>
        </div>
      </div>
      
      <div v-if="instructionFiles.length > 0" class="files-list">
        <h4>Files to Process:</h4>
        <div v-for="file in instructionFiles" :key="file.name" class="file-item">
          📄 {{ file.name }} ({{ formatFileSize(file.size) }})
        </div>
        
        <div class="batch-controls">
          <label>
            <input v-model="safetyMode" type="checkbox" />
            Safety Mode
          </label>
          
          <button 
            :disabled="isExecuting"
            @click="executeBatch"
            class="execute-btn"
          >
            {{ isExecuting ? 'Processing...' : 'Process All Files' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Execution Progress -->
    <div v-if="isExecuting || logs.length > 0" class="progress">
      <h3>
        Execution Progress
        <span v-if="isExecuting" class="status">⚡ Running</span>
        <span v-else class="status">✅ Completed</span>
      </h3>
      
      <div v-if="mode === 'batch' && batchProgress.total > 0" class="batch-progress">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }"
          ></div>
        </div>
        <p>{{ batchProgress.completed }} / {{ batchProgress.total }} files processed</p>
      </div>
      
      <div class="logs">
        <div v-for="(log, index) in logs" :key="index" class="log-entry">
          <span class="timestamp">{{ formatTime(log.timestamp) }}</span>
          <span class="message">{{ log.message }}</span>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="pendingConfirmation" class="modal-overlay">
      <div class="modal">
        <h4>Confirmation Required</h4>
        <p>{{ pendingConfirmation.message }}</p>
        <p><strong>Tool:</strong> {{ pendingConfirmation.toolName }}</p>
        <div class="modal-buttons">
          <button @click="confirmAction(true)" class="confirm-btn">Approve</button>
          <button @click="confirmAction(false)" class="cancel-btn">Deny</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import SimpleModelDropdown from '../shared/SimpleModelDropdown.vue'

export default {
  name: 'ExecutionTab',
  components: {
    SimpleModelDropdown
  },
  setup() {
    // State
    const mode = ref('single')
    const selectedModel = ref('')
    const taskDescription = ref('')
    const safetyMode = ref(true)
    const isExecuting = ref(false)
    const logs = ref([])
    const selectedFolder = ref(null)
    const instructionFiles = ref([])
    const batchProgress = ref({ completed: 0, total: 0 })
    const pendingConfirmation = ref(null)
    const eventSource = ref(null)

    // Computed
    const wordCount = computed(() => {
      return taskDescription.value.split(/\s+/).filter(word => word.length > 0).length
    })

    // Methods
    const addLog = (message, type = 'info') => {
      logs.value.push({
        timestamp: Date.now(),
        message,
        type
      })
    }

    const executeTask = async () => {
      if (!taskDescription.value.trim()) return
      
      isExecuting.value = true
      logs.value = []
      addLog('Starting autocoder execution...')
      
      try {
        // Use the backend's autonomous task execution endpoint
        const url = new URL('http://localhost:3333/execute-autonomous-task')
        url.searchParams.append('task_description', taskDescription.value)
        url.searchParams.append('safetyMode', safetyMode.value.toString())
        
        eventSource.value = new EventSource(url)
        
        eventSource.value.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            handleSSEMessage(data)
          } catch (error) {
            console.error('Error parsing SSE message:', error)
          }
        }
        
        eventSource.value.onerror = (error) => {
          console.error('SSE Error:', error)
          addLog('Connection error occurred', 'error')
          isExecuting.value = false
          eventSource.value?.close()
        }
        
      } catch (error) {
        console.error('Failed to start execution:', error)
        addLog(`Error: ${error.message}`, 'error')
        isExecuting.value = false
      }
    }

    const executeBatch = async () => {
      if (instructionFiles.value.length === 0) return
      
      isExecuting.value = true
      logs.value = []
      batchProgress.value = { completed: 0, total: instructionFiles.value.length }
      
      addLog(`Starting batch processing of ${instructionFiles.value.length} files...`)
      
      try {
        for (let i = 0; i < instructionFiles.value.length; i++) {
          const file = instructionFiles.value[i]
          addLog(`Processing file ${i + 1}/${instructionFiles.value.length}: ${file.name}`)
          
          // Read file content
          const content = await readFileContent(file)
          
          // Execute each file as a separate task
          await executeFileTask(content, file.name)
          
          batchProgress.value.completed++
        }
        
        addLog('Batch processing completed!', 'success')
        
      } catch (error) {
        console.error('Batch processing failed:', error)
        addLog(`Batch processing error: ${error.message}`, 'error')
      } finally {
        isExecuting.value = false
      }
    }

    const executeFileTask = (content, filename) => {
      return new Promise((resolve, reject) => {
        try {
          const url = new URL('http://localhost:3333/execute-autonomous-task')
          url.searchParams.append('task_description', content)
          url.searchParams.append('safetyMode', safetyMode.value.toString())
          
          const fileEventSource = new EventSource(url)
          
          fileEventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              
              if (data.type === 'execution_complete') {
                addLog(`✅ Completed: ${filename}`, 'success')
                fileEventSource.close()
                resolve()
              } else if (data.type === 'error') {
                addLog(`❌ Error in ${filename}: ${data.content}`, 'error')
                fileEventSource.close()
                reject(new Error(data.content))
              } else if (data.type === 'log_entry') {
                addLog(`[${filename}] ${data.message}`)
              }
            } catch (error) {
              console.error('Error parsing file SSE message:', error)
            }
          }
          
          fileEventSource.onerror = (error) => {
            console.error('File SSE Error:', error)
            addLog(`❌ Connection error for ${filename}`, 'error')
            fileEventSource.close()
            reject(error)
          }
          
        } catch (error) {
          reject(error)
        }
      })
    }

    const handleSSEMessage = (data) => {
      switch (data.type) {
        case 'log_entry':
          addLog(data.message)
          break
        case 'confirmation_required':
          pendingConfirmation.value = {
            confirmationId: data.confirmationId,
            toolName: data.toolName,
            toolInput: data.toolInput,
            message: data.message
          }
          break
        case 'execution_complete':
          addLog('✅ Task completed successfully!', 'success')
          isExecuting.value = false
          eventSource.value?.close()
          break
        case 'error':
          addLog(`❌ Error: ${data.content}`, 'error')
          isExecuting.value = false
          eventSource.value?.close()
          break
        default:
          if (data.message) {
            addLog(data.message)
          }
      }
    }

    const confirmAction = async (approved) => {
      if (!pendingConfirmation.value) return
      
      try {
        const response = await fetch(`http://localhost:3333/api/confirm-action/${pendingConfirmation.value.confirmationId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ confirmed: approved })
        })
        
        if (response.ok) {
          addLog(approved ? '✅ Action approved' : '❌ Action denied')
        } else {
          addLog('❌ Failed to send confirmation', 'error')
        }
        
      } catch (error) {
        console.error('Failed to confirm action:', error)
        addLog('❌ Failed to send confirmation', 'error')
      }
      
      pendingConfirmation.value = null
    }

    const handleFolderSelect = (event) => {
      const files = Array.from(event.target.files)
      
      // Filter for instruction files (text files)
      const textFiles = files.filter(file => {
        const ext = file.name.toLowerCase().split('.').pop()
        return ['txt', 'md', 'markdown'].includes(ext)
      })
      
      if (textFiles.length > 0) {
        selectedFolder.value = {
          name: files[0].webkitRelativePath.split('/')[0]
        }
        instructionFiles.value = textFiles
        addLog(`Found ${textFiles.length} instruction files in folder`)
      } else {
        alert('No instruction files (.txt, .md) found in the selected folder')
      }
    }

    const clearFolder = () => {
      selectedFolder.value = null
      instructionFiles.value = []
      batchProgress.value = { completed: 0, total: 0 }
    }

    const readFileContent = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.onerror = (e) => reject(new Error('Failed to read file'))
        reader.readAsText(file)
      })
    }

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString()
    }

    return {
      mode,
      selectedModel,
      taskDescription,
      safetyMode,
      isExecuting,
      logs,
      selectedFolder,
      instructionFiles,
      batchProgress,
      pendingConfirmation,
      wordCount,
      executeTask,
      executeBatch,
      confirmAction,
      handleFolderSelect,
      clearFolder,
      formatFileSize,
      formatTime
    }
  }
}
</script>

<style scoped>
.execution-tab {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  background-color: var(--color-background);
  color: var(--color-text-primary);
  min-height: 100vh;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h2 {
  font-size: 2rem;
  margin-bottom: 10px;
  color: var(--color-text-primary);
}

.header p {
  color: var(--color-text-secondary);
  font-size: 1.1rem;
}

.mode-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  justify-content: center;
}

.mode-tabs button {
  padding: 12px 24px;
  border: 2px solid var(--color-secondary);
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-md);
}

.mode-tabs button:hover {
  background: var(--color-surface-hover);
  box-shadow: var(--shadow-lg);
}

.mode-tabs button.active {
  background: var(--color-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-secondary);
  box-shadow: var(--shadow-glow);
}

.single-mode, .batch-mode {
  background: var(--color-surface-card);
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
}

.single-mode h3, .batch-mode h3 {
  margin-bottom: 15px;
  color: var(--color-text-primary);
  font-weight: 600;
}

.model-selection {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
}

textarea {
  width: 100%;
  padding: 15px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 15px;
  background: #8b5cf6;
  color: #ff6a00;
  transition: all var(--transition-fast);
}

textarea:focus {
  outline: none;
  border-color: var(--color-secondary);
  box-shadow: var(--shadow-md);
}

textarea::placeholder {
  color: rgba(255, 106, 0, 0.7);
}

.controls, .batch-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.controls label, .batch-controls label {
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.execute-btn {
  background: var(--color-secondary);
  color: var(--color-text-primary);
  border: 2px solid var(--color-secondary);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-size: 16px;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-md);
}

.execute-btn:hover:not(:disabled) {
  background: var(--color-secondary-light);
  border-color: var(--color-secondary-light);
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.execute-btn:disabled {
  background: var(--color-border);
  border-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.folder-selector {
  margin-bottom: 20px;
}

.folder-placeholder {
  text-align: center;
  padding: 40px;
  border: 2px dashed var(--surface-border);
  border-radius: 8px;
  background: var(--surface-elevated);
  color: var(--text-secondary);
}

.folder-placeholder button {
  background: var(--primary-orange);
  color: var(--text-inverse);
  border: 2px solid var(--primary-orange);
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 10px;
  font-weight: 600;
  transition: all var(--transition-fast);
  box-shadow: var(--glow-subtle);
}

.folder-placeholder button:hover {
  background: var(--orange-light);
  border-color: var(--orange-light);
  box-shadow: var(--glow-secondary);
  transform: translateY(-1px);
}

.folder-selected {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: var(--surface-elevated);
  border-radius: 8px;
  border: 2px solid var(--color-success);
  color: var(--text-primary);
}

.folder-selected button {
  background: var(--color-error);
  color: var(--text-inverse);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.folder-selected button:hover {
  background: var(--color-error-dark);
  transform: translateY(-1px);
}

.files-list {
  background: var(--surface-elevated);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
  color: var(--text-primary);
}

.files-list h4 {
  color: var(--text-primary);
  margin-bottom: 10px;
}

.file-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--surface-border);
  color: var(--text-secondary);
}

.file-item:last-child {
  border-bottom: none;
}

.progress {
  background: var(--surface-card);
  padding: 20px;
  border-radius: 10px;
  margin-top: 20px;
  border: 1px solid var(--surface-border);
}

.progress h3 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  color: var(--text-primary);
}

.status {
  font-size: 14px;
  font-weight: normal;
  color: var(--text-secondary);
}

.batch-progress {
  margin-bottom: 20px;
}

.batch-progress p {
  color: var(--text-secondary);
  margin-top: 8px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: var(--surface-elevated);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
  border: 1px solid var(--surface-border);
}

.progress-fill {
  height: 100%;
  background: var(--color-success);
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

.logs {
  max-height: 400px;
  overflow-y: auto;
  background: var(--surface-elevated);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 15px;
}

.log-entry {
  padding: 5px 0;
  border-bottom: 1px solid var(--surface-border);
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--text-secondary);
}

.log-entry:last-child {
  border-bottom: none;
}

.timestamp {
  color: var(--text-muted);
  margin-right: 10px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--surface-card);
  padding: 30px;
  border-radius: 10px;
  max-width: 500px;
  width: 90%;
  border: 1px solid var(--surface-border);
  box-shadow: var(--shadow-xl);
  color: var(--text-primary);
}

.modal h4 {
  margin-bottom: 15px;
  color: var(--text-primary);
  font-weight: 600;
}

.modal p {
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.modal-buttons {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.confirm-btn {
  background: var(--color-success);
  color: var(--text-inverse);
  border: 2px solid var(--color-success);
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.confirm-btn:hover {
  background: var(--color-success-dark);
  border-color: var(--color-success-dark);
  transform: translateY(-1px);
}

.cancel-btn {
  background: var(--color-error);
  color: var(--text-inverse);
  border: 2px solid var(--color-error);
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.cancel-btn:hover {
  background: var(--color-error-dark);
  border-color: var(--color-error-dark);
  transform: translateY(-1px);
}
</style>
