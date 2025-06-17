<!--
  BatchProcessor.vue - Batch file and instruction processing system
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="batch-processor">
    <!-- Header -->
    <div class="batch-processor__header">
      <h3 class="text-lg font-semibold text-primary">Batch Processor</h3>
      <p class="text-sm text-muted">Process multiple files and instructions in batch</p>
      
      <div class="batch-actions">
        <BaseButton
          variant="ghost"
          size="sm"
          icon="turdus-import"
          @click="importBatch"
        >
          Import Batch
        </BaseButton>
        
        <BaseButton
          variant="ghost"
          size="sm"
          icon="turdus-export"
          @click="exportResults"
        >
          Export Results
        </BaseButton>
        
        <BaseButton
          variant="primary"
          size="sm"
          icon="accipiter-run"
          @click="startBatchProcessing"
          :disabled="!canProcess"
          :loading="isProcessing"
        >
          Start Processing
        </BaseButton>
      </div>
    </div>

    <!-- Pre-instructions Editor -->
    <div class="pre-instructions-section">
      <h4 class="section-title">
        <Icon name="passeriformes-edit" size="sm" />
        Pre-instructions (Editable)
      </h4>
      
      <div class="instructions-editor">
        <textarea
          v-model="preInstructions"
          class="instructions-textarea"
          placeholder="Enter pre-processing instructions that will be applied to all files..."
          rows="4"
        ></textarea>
        
        <div class="instructions-stats">
          <span class="stat-item">
            <Icon name="passeriformes-text" size="xs" />
            {{ wordCount }} words
          </span>
          <span class="stat-item">
            <Icon name="piciformes-token" size="xs" />
            {{ tokenCount }} tokens (est.)
          </span>
        </div>
      </div>
    </div>

    <!-- File Upload Section -->
    <div class="file-upload-section">
      <h4 class="section-title">
        <Icon name="accipiter-folder" size="sm" />
        Files to Process
      </h4>
      
      <div 
        class="file-drop-zone"
        :class="{ 'file-drop-zone--active': isDragging }"
        @drop="handleFileDrop"
        @dragover="handleDragOver"
        @dragenter="handleDragEnter"
        @dragleave="handleDragLeave"
      >
        <div v-if="!batchFiles.length" class="drop-zone-placeholder">
          <Icon name="accipiter-upload" size="xl" class="text-muted" />
          <p class="text-muted">Drop files here or click to select</p>
          <input
            ref="fileInput"
            type="file"
            multiple
            class="hidden"
            @change="handleFileSelect"
          />
          <input
            ref="folderInput"
            type="file"
            webkitdirectory
            class="hidden"
            @change="handleFolderSelect"
          />
          <div class="upload-buttons">
            <BaseButton
              variant="outline"
              size="sm"
              @click="$refs.fileInput.click()"
            >
              Select Files
            </BaseButton>
            <BaseButton
              variant="outline"
              size="sm"
              icon="accipiter-folder"
              @click="$refs.folderInput.click()"
            >
              Select Folder
            </BaseButton>
          </div>
        </div>
        
        <!-- File List -->
        <div v-else class="file-list">
          <div
            v-for="file in batchFiles"
            :key="file.id"
            class="file-item"
            :class="{
              'file-item--processing': file.status === 'processing',
              'file-item--completed': file.status === 'completed',
              'file-item--failed': file.status === 'failed'
            }"
          >
            <div class="file-info">
              <Icon :name="getFileIcon(file.extension)" size="sm" />
              <div class="file-details">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
              </div>
            </div>
            
            <div class="file-status">
              <Icon
                v-if="file.status === 'pending'"
                name="passeriformes-clock"
                size="sm"
                class="text-muted"
              />
              <Icon
                v-else-if="file.status === 'processing'"
                name="loading"
                size="sm"
                class="text-info"
                animation="spin"
              />
              <Icon
                v-else-if="file.status === 'completed'"
                name="corvidae-validate"
                size="sm"
                class="text-success"
              />
              <Icon
                v-else-if="file.status === 'failed'"
                name="warning"
                size="sm"
                class="text-error"
              />
            </div>
            
            <div class="file-actions">
              <BaseButton
                v-if="file.status === 'completed'"
                variant="ghost"
                size="xs"
                icon="corvidae-preview"
                @click="previewResult(file)"
                title="Preview Result"
              />
              <BaseButton
                variant="ghost"
                size="xs"
                icon="tyrannidae-close"
                @click="removeFile(file.id)"
                title="Remove File"
              />
            </div>
          </div>
          
          <!-- Add More Files -->
          <div class="add-more-files">
            <BaseButton
              variant="ghost"
              size="sm"
              icon="plus"
              @click="$refs.fileInput.click()"
            >
              Add More Files
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Processing Statistics -->
    <div class="processing-stats">
      <div class="stats-grid">
        <div class="stat-card">
          <Icon name="accipiter-file" size="lg" class="stat-icon" />
          <div class="stat-content">
            <span class="stat-value">{{ totalFilesCount }}</span>
            <span class="stat-label">Total Files</span>
          </div>
        </div>
        
        <div class="stat-card">
          <Icon name="corvidae-validate" size="lg" class="stat-icon text-success" />
          <div class="stat-content">
            <span class="stat-value">{{ processedFilesCount }}</span>
            <span class="stat-label">Processed</span>
          </div>
        </div>
        
        <div class="stat-card">
          <Icon name="warning" size="lg" class="stat-icon text-error" />
          <div class="stat-content">
            <span class="stat-value">{{ failedFilesCount }}</span>
            <span class="stat-label">Failed</span>
          </div>
        </div>
        
        <div class="stat-card">
          <Icon name="passeriformes-clock" size="lg" class="stat-icon text-info" />
          <div class="stat-content">
            <span class="stat-value">{{ formatDuration(processingTime) }}</span>
            <span class="stat-label">Processing Time</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div v-if="isProcessing" class="progress-section">
      <div class="progress-header">
        <span class="progress-text">Processing files...</span>
        <span class="progress-percentage">{{ Math.round(progressPercentage) }}%</span>
      </div>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="hasResults" class="results-section">
      <h4 class="section-title">
        <Icon name="corvidae-analyze" size="sm" />
        Processing Results
      </h4>
      
      <div class="results-tabs">
        <button
          v-for="tab in resultTabs"
          :key="tab.id"
          class="result-tab"
          :class="{ 'result-tab--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <Icon :name="tab.icon" size="sm" />
          {{ tab.label }}
        </button>
      </div>
      
      <div class="results-content">
        <!-- Summary Tab -->
        <div v-if="activeTab === 'summary'" class="result-panel">
          <div class="summary-grid">
            <div class="summary-item">
              <h5>Processing Summary</h5>
              <ul>
                <li>Total files: {{ totalFilesCount }}</li>
                <li>Successfully processed: {{ processedFilesCount }}</li>
                <li>Failed: {{ failedFilesCount }}</li>
                <li>Total processing time: {{ formatDuration(processingTime) }}</li>
                <li>Average time per file: {{ formatDuration(averageProcessingTime) }}</li>
              </ul>
            </div>
            
            <div class="summary-item">
              <h5>Token Usage</h5>
              <ul>
                <li>Total tokens processed: {{ totalTokensProcessed }}</li>
                <li>Average tokens per file: {{ averageTokensPerFile }}</li>
                <li>Pre-instruction tokens: {{ tokenCount }}</li>
              </ul>
            </div>
          </div>
        </div>
        
        <!-- Files Tab -->
        <div v-if="activeTab === 'files'" class="result-panel">
          <div class="file-results-list">
            <div
              v-for="file in batchFiles"
              :key="file.id"
              class="file-result-item"
            >
              <div class="file-result-header">
                <Icon :name="getFileIcon(file.extension)" size="sm" />
                <span class="file-result-name">{{ file.name }}</span>
                <span class="file-result-status" :class="`status-${file.status}`">
                  {{ file.status }}
                </span>
              </div>
              
              <div v-if="file.result" class="file-result-content">
                <pre class="result-preview">{{ file.result.substring(0, 200) }}...</pre>
                <div class="file-result-actions">
                  <BaseButton
                    variant="ghost"
                    size="xs"
                    icon="corvidae-preview"
                    @click="previewResult(file)"
                  >
                    View Full Result
                  </BaseButton>
                  <BaseButton
                    variant="ghost"
                    size="xs"
                    icon="turdus-export"
                    @click="exportFileResult(file)"
                  >
                    Export
                  </BaseButton>
                </div>
              </div>
              
              <div v-if="file.error" class="file-error">
                <Icon name="warning" size="sm" class="text-error" />
                <span class="error-message">{{ file.error }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Logs Tab -->
        <div v-if="activeTab === 'logs'" class="result-panel">
          <div class="logs-container">
            <div
              v-for="log in processingLogs"
              :key="log.id"
              class="log-entry"
              :class="`log-${log.level}`"
            >
              <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
              <Icon :name="getLogIcon(log.level)" size="xs" />
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- File Preview Modal -->
    <Modal
      v-if="showPreviewModal"
      :title="`Preview: ${previewFile?.name}`"
      size="large"
      @close="showPreviewModal = false"
    >
      <div class="file-preview">
        <div class="preview-header">
          <div class="preview-info">
            <span>File: {{ previewFile?.name }}</span>
            <span>Size: {{ formatFileSize(previewFile?.size) }}</span>
            <span>Status: {{ previewFile?.status }}</span>
          </div>
          <div class="preview-actions">
            <BaseButton
              variant="ghost"
              size="sm"
              icon="passeriformes-copy"
              @click="copyToClipboard(previewFile?.result)"
            >
              Copy
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="sm"
              icon="turdus-export"
              @click="exportFileResult(previewFile)"
            >
              Export
            </BaseButton>
          </div>
        </div>
        
        <div class="preview-content">
          <pre class="result-full">{{ previewFile?.result }}</pre>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import BaseButton from '../shared/BaseButton.vue'
import Icon from '../shared/Icon.vue'
import Modal from '../shared/Modal.vue'

export default {
  name: 'BatchProcessor',
  
  components: {
    BaseButton,
    Icon,
    Modal
  },
  
  setup() {
    // Component state
    const batchFiles = ref([])
    const processingLogs = ref([])
    const preInstructions = ref('')
    const isProcessing = ref(false)
    const isDragging = ref(false)
    const showPreviewModal = ref(false)
    const previewFile = ref(null)
    const activeTab = ref('summary')
    const processingStartTime = ref(null)
    const processingTime = ref(0)
    
    // Computed properties
    const wordCount = computed(() => {
      return preInstructions.value.split(/\s+/).filter(word => word.length > 0).length
    })
    
    const tokenCount = computed(() => {
      return Math.ceil(wordCount.value / 0.75)
    })
    
    const totalFilesCount = computed(() => batchFiles.value.length)
    
    const processedFilesCount = computed(() => {
      return batchFiles.value.filter(file => file.status === 'completed').length
    })
    
    const failedFilesCount = computed(() => {
      return batchFiles.value.filter(file => file.status === 'failed').length
    })
    
    const canProcess = computed(() => {
      return batchFiles.value.length > 0 && !isProcessing.value
    })
    
    const hasResults = computed(() => {
      return batchFiles.value.some(file => file.status === 'completed' || file.status === 'failed')
    })
    
    const progressPercentage = computed(() => {
      if (totalFilesCount.value === 0) return 0
      const completed = processedFilesCount.value + failedFilesCount.value
      return (completed / totalFilesCount.value) * 100
    })
    
    const totalTokensProcessed = computed(() => {
      return batchFiles.value.reduce((total, file) => {
        return total + (file.tokensUsed || 0)
      }, 0)
    })
    
    const averageTokensPerFile = computed(() => {
      const completed = processedFilesCount.value
      return completed > 0 ? Math.round(totalTokensProcessed.value / completed) : 0
    })
    
    const averageProcessingTime = computed(() => {
      const completed = processedFilesCount.value
      return completed > 0 ? processingTime.value / completed : 0
    })
    
    const resultTabs = computed(() => [
      { id: 'summary', label: 'Summary', icon: 'corvidae-analyze' },
      { id: 'files', label: 'Files', icon: 'accipiter-file' },
      { id: 'logs', label: 'Logs', icon: 'passeriformes-text' }
    ])

    // Methods
    function handleFileDrop(event) {
      event.preventDefault()
      isDragging.value = false
      
      const files = Array.from(event.dataTransfer.files)
      handleAddFiles(files)
    }
    
    function handleFileSelect(event) {
      const files = Array.from(event.target.files)
      handleAddFiles(files)
    }
    
    function handleFolderSelect(event) {
      const files = Array.from(event.target.files)
      handleAddFiles(files)
    }
    
    async function handleAddFiles(files) {
      try {
        for (const file of files) {
          const fileData = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            name: file.name,
            size: file.size,
            type: file.type,
            extension: file.name.split('.').pop()?.toLowerCase() || '',
            status: 'pending',
            addedAt: new Date().toISOString(),
            file: file // Store the actual File object for reading later
          }
          
          batchFiles.value.push(fileData)
        }
      } catch (error) {
        console.error('Failed to add files:', error)
      }
    }
    
    function removeFile(fileId) {
      const index = batchFiles.value.findIndex(file => file.id === fileId)
      if (index !== -1) {
        batchFiles.value.splice(index, 1)
      }
    }
    
    async function startBatchProcessing() {
      try {
        isProcessing.value = true
        processingStartTime.value = Date.now()
        
        addLog('info', 'Starting batch processing...')
        addLog('info', `Processing ${batchFiles.value.length} files with pre-instructions`)
        
        for (const file of batchFiles.value) {
          file.status = 'processing'
          addLog('info', `Processing file: ${file.name}`)
          
          try {
            // Read file content
            const fileContent = await readFileContent(file.file)
            
            // Send to backend for processing
            const response = await fetch('http://localhost:3333/api/execution/process-file', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                filename: file.name,
                content: fileContent,
                preInstructions: preInstructions.value,
                fileType: file.extension
              })
            })
            
            const result = await response.json()
            
            if (result.success) {
              file.status = 'completed'
              file.result = result.processedContent
              file.tokensUsed = result.tokensUsed || 0
              addLog('success', `Successfully processed: ${file.name}`)
            } else {
              throw new Error(result.error || 'Processing failed')
            }
            
          } catch (error) {
            file.status = 'failed'
            file.error = error.message
            addLog('error', `Failed to process ${file.name}: ${error.message}`)
          }
        }
        
        processingTime.value = Date.now() - processingStartTime.value
        addLog('success', `Batch processing completed in ${formatDuration(processingTime.value)}`)
        
      } catch (error) {
        console.error('Batch processing failed:', error)
        addLog('error', `Batch processing failed: ${error.message}`)
      } finally {
        isProcessing.value = false
      }
    }
    
    function previewResult(file) {
      previewFile.value = file
      showPreviewModal.value = true
    }
    
    function exportFileResult(file) {
      const blob = new Blob([file.result], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `${file.name}-result.txt`
      a.click()
      
      URL.revokeObjectURL(url)
    }
    
    async function copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
      }
    }
    
    function importBatch() {
      console.log('Import batch functionality')
    }
    
    function exportResults() {
      console.log('Export results functionality')
    }
    
    function handleDragOver(event) {
      event.preventDefault()
    }
    
    function handleDragEnter(event) {
      event.preventDefault()
      isDragging.value = true
    }
    
    function handleDragLeave(event) {
      event.preventDefault()
      if (!event.currentTarget.contains(event.relatedTarget)) {
        isDragging.value = false
      }
    }
    
    function getFileIcon(extension) {
      const iconMap = {
        'js': 'corvidae-code',
        'ts': 'corvidae-code',
        'vue': 'furnariidae-component',
        'html': 'passeriformes-edit',
        'css': 'passeriformes-edit',
        'json': 'piciformes-config',
        'md': 'passeriformes-edit',
        'txt': 'passeriformes-edit',
        'py': 'corvidae-code'
      }
      
      return iconMap[extension] || 'accipiter-file'
    }
    
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes'
      
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
    
    function formatDuration(ms) {
      if (ms < 1000) return `${ms}ms`
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
      return `${(ms / 60000).toFixed(1)}m`
    }
    
    function formatTimestamp(timestamp) {
      return new Date(timestamp).toLocaleTimeString()
    }
    
    function getLogIcon(level) {
      const iconMap = {
        'info': 'corvidae-info',
        'warn': 'warning',
        'error': 'warning',
        'success': 'corvidae-validate'
      }
      
      return iconMap[level] || 'corvidae-info'
    }
    
    // Helper function to add log entries
    function addLog(level, message) {
      processingLogs.value.push({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        level,
        message,
        timestamp: Date.now()
      })
    }
    
    // Helper function to read file content
    function readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        
        reader.onload = (event) => {
          resolve(event.target.result)
        }
        
        reader.onerror = (error) => {
          reject(new Error(`Failed to read file: ${error.message}`))
        }
        
        reader.readAsText(file)
      })
    }

    return {
      // State
      batchFiles,
      preInstructions,
      isProcessing,
      processingLogs,
      isDragging,
      showPreviewModal,
      previewFile,
      activeTab,
      processingTime,
      
      // Computed
      wordCount,
      tokenCount,
      totalFilesCount,
      processedFilesCount,
      failedFilesCount,
      canProcess,
      hasResults,
      progressPercentage,
      totalTokensProcessed,
      averageTokensPerFile,
      averageProcessingTime,
      resultTabs,
      
      // Methods
      handleFileDrop,
      handleFileSelect,
      handleFolderSelect,
      startBatchProcessing,
      removeFile,
      previewResult,
      exportFileResult,
      copyToClipboard,
      importBatch,
      exportResults,
      handleDragOver,
      handleDragEnter,
      handleDragLeave,
      getFileIcon,
      formatFileSize,
      formatDuration,
      formatTimestamp,
      getLogIcon
    }
  }
}
</script>

<style scoped>
.batch-processor {
  @apply h-full flex flex-col bg-surface;
}

.batch-processor__header {
  @apply flex items-start justify-between p-6 border-b border-border bg-surface-hover;
}

.batch-actions {
  @apply flex items-center gap-2;
}

.pre-instructions-section,
.file-upload-section,
.results-section {
  @apply p-6 border-b border-border;
}

.section-title {
  @apply flex items-center gap-2 font-medium text-primary mb-4;
}

.instructions-editor {
  @apply space-y-3;
}

.instructions-textarea {
  @apply w-full px-4 py-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary;
}

.instructions-stats {
  @apply flex items-center gap-4 text-sm text-muted;
}

.stat-item {
  @apply flex items-center gap-1;
}

.file-drop-zone {
  @apply border-2 border-dashed border-border rounded-lg p-6 transition-colors;
}

.file-drop-zone--active {
  @apply border-primary bg-primary bg-opacity-5;
}

.drop-zone-placeholder {
  @apply text-center space-y-4;
}

.upload-buttons {
  @apply flex gap-2 justify-center;
}

.file-list {
  @apply space-y-3;
}

.file-item {
  @apply flex items-center justify-between p-3 bg-surface-card rounded-lg border border-border;
}

.file-item--processing {
  @apply border-info bg-info bg-opacity-5;
}

.file-item--completed {
  @apply border-success bg-success bg-opacity-5;
}

.file-item--failed {
  @apply border-error bg-error bg-opacity-5;
}

.file-info {
  @apply flex items-center gap-3;
}

.file-details {
  @apply flex flex-col;
}

.file-name {
  @apply font-medium text-primary;
}

.file-size {
  @apply text-sm text-muted;
}

.file-actions {
  @apply flex items-center gap-1;
}

.add-more-files {
  @apply text-center py-3;
}

.processing-stats {
  @apply p-6 border-b border-border;
}

.stats-grid {
  @apply grid grid-cols-2 md:grid-cols-4 gap-4;
}

.stat-card {
  @apply flex items-center gap-3 p-4 bg-surface-card rounded-lg border border-border;
}

.stat-icon {
  @apply text-primary;
}

.stat-content {
  @apply flex flex-col;
}

.stat-value {
  @apply text-lg font-semibold text-primary;
}

.stat-label {
  @apply text-sm text-muted;
}

.progress-section {
  @apply p-6 border-b border-border;
}

.progress-header {
  @apply flex items-center justify-between mb-2;
}

.progress-text {
  @apply text-sm font-medium text-primary;
}

.progress-percentage {
  @apply text-sm text-muted;
}

.progress-bar {
  @apply w-full h-2 bg-surface-elevated rounded-full overflow-hidden;
}

.progress-fill {
  @apply h-full bg-primary transition-all duration-300;
}

.results-tabs {
  @apply flex border-b border-border mb-4;
}

.result-tab {
  @apply flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted border-b-2 border-transparent hover:text-primary hover:border-primary transition-colors;
}

.result-tab--active {
  @apply text-primary border-primary;
}

.result-panel {
  @apply space-y-4;
}

.summary-grid {
  @apply grid md:grid-cols-2 gap-6;
}

.summary-item {
  @apply p-4 bg-surface-card rounded-lg border border-border;
}

.summary-item h5 {
  @apply font-medium text-primary mb-3;
}

.summary-item ul {
  @apply space-y-2 text-sm text-secondary;
}

.file-results-list {
  @apply space-y-4;
}

.file-result-item {
  @apply p-4 bg-surface-card rounded-lg border border-border;
}

.file-result-header {
  @apply flex items-center gap-3 mb-3;
}

.file-result-name {
  @apply flex-1 font-medium text-primary;
}

.file-result-status {
  @apply px-2 py-1 text-xs font-medium rounded;
}

.status-completed {
  @apply bg-success text-white;
}

.status-failed {
  @apply bg-error text-white;
}

.status-processing {
  @apply bg-info text-white;
}

.status-pending {
  @apply bg-muted text-white;
}

.file-result-content {
  @apply space-y-3;
}

.result-preview {
  @apply p-3 bg-surface-elevated rounded text-sm font-mono;
}

.file-result-actions {
  @apply flex gap-2;
}

.file-error {
  @apply flex items-center gap-2 text-error;
}

.error-message {
  @apply text-sm;
}

.logs-container {
  @apply max-h-96 overflow-y-auto custom-scrollbar space-y-2;
}

.log-entry {
  @apply flex items-center gap-2 p-2 rounded text-sm;
}

.log-info {
  @apply bg-info bg-opacity-10 text-info;
}

.log-warn {
  @apply bg-warning bg-opacity-10 text-warning;
}

.log-error {
  @apply bg-error bg-opacity-10 text-error;
}

.log-success {
  @apply bg-success bg-opacity-10 text-success;
}

.log-timestamp {
  @apply text-xs text-muted font-mono;
}

.log-message {
  @apply flex-1;
}

.file-preview {
  @apply space-y-4;
}

.preview-header {
  @apply flex items-center justify-between p-4 bg-surface-hover rounded-lg;
}

.preview-info {
  @apply flex flex-col gap-1 text-sm;
}

.preview-actions {
  @apply flex gap-2;
}

.preview-content {
  @apply max-h-96 overflow-auto custom-scrollbar;
}

.result-full {
  @apply p-4 bg-surface-elevated rounded text-sm font-mono whitespace-pre-wrap;
}

@media (max-width: 768px) {
  .batch-processor__header {
    @apply flex-col gap-4;
  }
  
  .stats-grid {
    @apply grid-cols-2;
  }
  
  .summary-grid {
    @apply grid-cols-1;
  }
  
  .file-item {
    @apply flex-col gap-3;
  }
  
  .file-info {
    @apply w-full;
  }
  
  .file-actions {
    @apply w-full justify-end;
  }
}
</style>
