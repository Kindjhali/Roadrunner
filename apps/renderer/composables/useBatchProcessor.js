/**
 * useBatchProcessor.js - Batch processing composable
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { ref, reactive, computed } from 'vue'

/**
 * Batch processor composable for handling multiple files/tasks
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Batch processing interface
 */
export function useBatchProcessor(options = {}) {
  // State management
  const isProcessing = ref(false)
  const currentFile = ref(null)
  const processedFiles = ref([])
  const failedFiles = ref([])
  const totalFiles = ref(0)
  const preInstructions = ref(options.defaultInstructions || '')
  
  // Processing statistics
  const stats = reactive({
    totalProcessed: 0,
    totalFailed: 0,
    totalWords: 0,
    totalTokens: 0,
    startTime: null,
    endTime: null
  })
  
  // Computed properties
  const progress = computed(() => {
    if (totalFiles.value === 0) return 0
    return Math.round(((processedFiles.value.length + failedFiles.value.length) / totalFiles.value) * 100)
  })
  
  const isComplete = computed(() => {
    return totalFiles.value > 0 && (processedFiles.value.length + failedFiles.value.length) === totalFiles.value
  })
  
  const successRate = computed(() => {
    const total = processedFiles.value.length + failedFiles.value.length
    if (total === 0) return 0
    return Math.round((processedFiles.value.length / total) * 100)
  })
  
  const estimatedTimeRemaining = computed(() => {
    if (!stats.startTime || totalFiles.value === 0) return null
    
    const elapsed = Date.now() - stats.startTime
    const processed = processedFiles.value.length + failedFiles.value.length
    const remaining = totalFiles.value - processed
    
    if (processed === 0) return null
    
    const avgTimePerFile = elapsed / processed
    return Math.round((avgTimePerFile * remaining) / 1000) // seconds
  })
  
  /**
   * Add files to the processing queue
   * Input → Process → Output pattern
   * 
   * @param {Array} files - Array of File objects
   */
  const addFiles = async (files) => {
    try {
      // Input: Validate files
      if (!Array.isArray(files)) {
        throw new Error('Files must be an array')
      }
      
      // Process: Add files to queue
      const validFiles = []
      for (const file of files) {
        if (file instanceof File) {
          const fileData = {
            id: generateFileId(),
            name: file.name,
            size: file.size,
            type: file.type,
            content: await readFileContent(file),
            status: 'pending',
            addedAt: new Date().toISOString()
          }
          
          // Calculate word and token counts
          fileData.wordCount = countWords(fileData.content)
          fileData.tokenCount = estimateTokens(fileData.content)
          
          validFiles.push(fileData)
        }
      }
      
      // Output: Update state
      totalFiles.value = validFiles.length
      stats.totalWords = validFiles.reduce((sum, file) => sum + file.wordCount, 0)
      stats.totalTokens = validFiles.reduce((sum, file) => sum + file.tokenCount, 0)
      
      return validFiles
      
    } catch (error) {
      console.error('Failed to add files:', error)
      throw error
    }
  }
  
  /**
   * Process all files in the queue
   * 
   * @param {Array} files - Files to process
   * @param {Function} processor - Processing function
   */
  const processFiles = async (files, processor) => {
    try {
      isProcessing.value = true
      stats.startTime = Date.now()
      stats.totalProcessed = 0
      stats.totalFailed = 0
      processedFiles.value = []
      failedFiles.value = []
      
      for (const file of files) {
        currentFile.value = file
        
        try {
          // Apply pre-instructions if provided
          let content = file.content
          if (preInstructions.value.trim()) {
            content = `${preInstructions.value}\n\n${content}`
          }
          
          // Process the file
          const result = await processor({
            ...file,
            content,
            preInstructions: preInstructions.value
          })
          
          // Mark as processed
          const processedFile = {
            ...file,
            status: 'completed',
            result,
            processedAt: new Date().toISOString()
          }
          
          processedFiles.value.push(processedFile)
          stats.totalProcessed++
          
        } catch (error) {
          // Mark as failed
          const failedFile = {
            ...file,
            status: 'failed',
            error: error.message,
            failedAt: new Date().toISOString()
          }
          
          failedFiles.value.push(failedFile)
          stats.totalFailed++
        }
      }
      
      stats.endTime = Date.now()
      currentFile.value = null
      
    } catch (error) {
      console.error('Batch processing failed:', error)
      throw error
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * Retry failed files
   * 
   * @param {Function} processor - Processing function
   */
  const retryFailed = async (processor) => {
    const filesToRetry = [...failedFiles.value]
    failedFiles.value = []
    
    await processFiles(filesToRetry, processor)
  }
  
  /**
   * Export results in various formats
   * 
   * @param {string} format - Export format ('json', 'csv', 'txt')
   * @returns {string} Exported data
   */
  const exportResults = (format = 'json') => {
    const results = {
      summary: {
        totalFiles: totalFiles.value,
        processed: processedFiles.value.length,
        failed: failedFiles.value.length,
        successRate: successRate.value,
        totalWords: stats.totalWords,
        totalTokens: stats.totalTokens,
        processingTime: stats.endTime ? stats.endTime - stats.startTime : null
      },
      processedFiles: processedFiles.value,
      failedFiles: failedFiles.value
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(results, null, 2)
      
      case 'csv':
        return exportToCsv(results)
      
      case 'txt':
        return exportToText(results)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
  
  /**
   * Clear all data and reset state
   */
  const reset = () => {
    isProcessing.value = false
    currentFile.value = null
    processedFiles.value = []
    failedFiles.value = []
    totalFiles.value = 0
    preInstructions.value = ''
    
    Object.assign(stats, {
      totalProcessed: 0,
      totalFailed: 0,
      totalWords: 0,
      totalTokens: 0,
      startTime: null,
      endTime: null
    })
  }
  
  // Utility functions
  const generateFileId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
  
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }
  
  const countWords = (text) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }
  
  const estimateTokens = (text) => {
    // Rough estimation: 1 token ≈ 0.75 words
    return Math.ceil(countWords(text) / 0.75)
  }
  
  const exportToCsv = (results) => {
    const headers = ['Name', 'Status', 'Words', 'Tokens', 'Processed At', 'Error']
    const rows = [
      ...results.processedFiles.map(file => [
        file.name,
        file.status,
        file.wordCount,
        file.tokenCount,
        file.processedAt || '',
        ''
      ]),
      ...results.failedFiles.map(file => [
        file.name,
        file.status,
        file.wordCount,
        file.tokenCount,
        file.failedAt || '',
        file.error || ''
      ])
    ]
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  const exportToText = (results) => {
    let output = `Batch Processing Results\n`
    output += `========================\n\n`
    output += `Summary:\n`
    output += `- Total Files: ${results.summary.totalFiles}\n`
    output += `- Processed: ${results.summary.processed}\n`
    output += `- Failed: ${results.summary.failed}\n`
    output += `- Success Rate: ${results.summary.successRate}%\n`
    output += `- Total Words: ${results.summary.totalWords}\n`
    output += `- Total Tokens: ${results.summary.totalTokens}\n\n`
    
    if (results.processedFiles.length > 0) {
      output += `Processed Files:\n`
      results.processedFiles.forEach(file => {
        output += `- ${file.name} (${file.wordCount} words, ${file.tokenCount} tokens)\n`
      })
      output += '\n'
    }
    
    if (results.failedFiles.length > 0) {
      output += `Failed Files:\n`
      results.failedFiles.forEach(file => {
        output += `- ${file.name}: ${file.error}\n`
      })
    }
    
    return output
  }
  
  return {
    // State
    isProcessing,
    currentFile,
    processedFiles,
    failedFiles,
    totalFiles,
    preInstructions,
    stats,
    
    // Computed
    progress,
    isComplete,
    successRate,
    estimatedTimeRemaining,
    
    // Methods
    addFiles,
    processFiles,
    retryFailed,
    exportResults,
    reset
  }
}

export default useBatchProcessor
