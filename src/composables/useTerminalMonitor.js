/**
 * useTerminalMonitor.js - Terminal monitoring composable
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
 * Terminal monitor composable for process management
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Terminal monitoring interface
 */
export function useTerminalMonitor(options = {}) {
  // State management
  const isConnected = ref(false)
  const activeProcesses = ref([])
  const processHistory = ref([])
  const currentOutput = ref('')
  const maxHistorySize = ref(options.maxHistorySize || 1000)
  
  // Terminal settings
  const settings = reactive({
    fontSize: options.fontSize || 14,
    theme: options.theme || 'dark',
    autoScroll: options.autoScroll !== false,
    showTimestamps: options.showTimestamps !== false,
    bufferSize: options.bufferSize || 10000
  })
  
  // Statistics
  const stats = reactive({
    totalProcesses: 0,
    runningProcesses: 0,
    completedProcesses: 0,
    failedProcesses: 0,
    totalOutputLines: 0
  })
  
  // Computed properties
  const hasActiveProcesses = computed(() => {
    return activeProcesses.value.length > 0
  })
  
  const recentProcesses = computed(() => {
    return processHistory.value
      .slice(-10)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
  })
  
  const outputLines = computed(() => {
    return currentOutput.value.split('\n').filter(line => line.trim())
  })
  
  /**
   * Start a new process
   * Input → Process → Output pattern
   * 
   * @param {Object} processConfig - Process configuration
   */
  const startProcess = async (processConfig) => {
    try {
      // Input: Validate process configuration
      if (!processConfig.command) {
        throw new Error('Process command is required')
      }
      
      // Process: Create process object
      const process = {
        id: generateProcessId(),
        name: processConfig.name || processConfig.command,
        command: processConfig.command,
        args: processConfig.args || [],
        cwd: processConfig.cwd || process.cwd(),
        env: { ...process.env, ...processConfig.env },
        status: 'starting',
        pid: null,
        startTime: new Date().toISOString(),
        endTime: null,
        exitCode: null,
        output: [],
        errors: []
      }
      
      // Add to active processes
      activeProcesses.value.push(process)
      stats.totalProcesses++
      stats.runningProcesses++
      
      // Simulate process execution (replace with actual process spawning)
      await simulateProcess(process)
      
      // Output: Return process reference
      return process
      
    } catch (error) {
      console.error('Failed to start process:', error)
      throw error
    }
  }
  
  /**
   * Stop a running process
   * 
   * @param {string} processId - Process ID to stop
   */
  const stopProcess = async (processId) => {
    try {
      const process = activeProcesses.value.find(p => p.id === processId)
      if (!process) {
        throw new Error(`Process ${processId} not found`)
      }
      
      if (process.status === 'running') {
        process.status = 'stopping'
        
        // Simulate process termination
        setTimeout(() => {
          completeProcess(process, 'SIGTERM', 143)
        }, 1000)
      }
      
    } catch (error) {
      console.error('Failed to stop process:', error)
      throw error
    }
  }
  
  /**
   * Send input to a running process
   * 
   * @param {string} processId - Process ID
   * @param {string} input - Input to send
   */
  const sendInput = async (processId, input) => {
    try {
      const process = activeProcesses.value.find(p => p.id === processId)
      if (!process) {
        throw new Error(`Process ${processId} not found`)
      }
      
      if (process.status !== 'running') {
        throw new Error(`Process ${processId} is not running`)
      }
      
      // Add input to output log
      addOutput(process, `> ${input}`, 'input')
      
      // Simulate command processing
      await processCommand(process, input)
      
    } catch (error) {
      console.error('Failed to send input:', error)
      throw error
    }
  }
  
  /**
   * Clear terminal output
   */
  const clearOutput = () => {
    currentOutput.value = ''
    stats.totalOutputLines = 0
  }
  
  /**
   * Export terminal session
   * 
   * @param {string} format - Export format ('txt', 'json', 'html')
   * @returns {string} Exported data
   */
  const exportSession = (format = 'txt') => {
    const sessionData = {
      timestamp: new Date().toISOString(),
      settings,
      stats,
      activeProcesses: activeProcesses.value,
      processHistory: processHistory.value,
      output: currentOutput.value
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(sessionData, null, 2)
      
      case 'html':
        return exportToHtml(sessionData)
      
      case 'txt':
      default:
        return exportToText(sessionData)
    }
  }
  
  /**
   * Connect to terminal service
   */
  const connect = async () => {
    try {
      isConnected.value = true
      addOutput(null, 'Terminal monitor connected', 'system')
    } catch (error) {
      console.error('Failed to connect:', error)
      throw error
    }
  }
  
  /**
   * Disconnect from terminal service
   */
  const disconnect = async () => {
    try {
      // Stop all active processes
      for (const process of activeProcesses.value) {
        if (process.status === 'running') {
          await stopProcess(process.id)
        }
      }
      
      isConnected.value = false
      addOutput(null, 'Terminal monitor disconnected', 'system')
    } catch (error) {
      console.error('Failed to disconnect:', error)
      throw error
    }
  }
  
  // Internal helper functions
  const generateProcessId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
  
  const simulateProcess = async (process) => {
    // Simulate process startup
    process.status = 'running'
    process.pid = Math.floor(Math.random() * 10000) + 1000
    
    addOutput(process, `Process started: ${process.name} (PID: ${process.pid})`, 'system')
    
    // Simulate some output
    const outputs = [
      'Initializing...',
      'Loading configuration...',
      'Starting services...',
      'Ready to accept commands'
    ]
    
    for (const output of outputs) {
      await new Promise(resolve => setTimeout(resolve, 500))
      addOutput(process, output, 'stdout')
    }
  }
  
  const processCommand = async (process, command) => {
    // Simulate command processing
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Mock responses based on command
    if (command.includes('help')) {
      addOutput(process, 'Available commands: help, status, exit', 'stdout')
    } else if (command.includes('status')) {
      addOutput(process, `Process ${process.name} is running (PID: ${process.pid})`, 'stdout')
    } else if (command.includes('exit')) {
      completeProcess(process, 'exit', 0)
    } else {
      addOutput(process, `Command executed: ${command}`, 'stdout')
    }
  }
  
  const completeProcess = (process, reason, exitCode) => {
    process.status = 'completed'
    process.endTime = new Date().toISOString()
    process.exitCode = exitCode
    
    // Move to history
    processHistory.value.push({ ...process })
    
    // Remove from active processes
    const index = activeProcesses.value.findIndex(p => p.id === process.id)
    if (index !== -1) {
      activeProcesses.value.splice(index, 1)
    }
    
    // Update stats
    stats.runningProcesses--
    if (exitCode === 0) {
      stats.completedProcesses++
    } else {
      stats.failedProcesses++
    }
    
    addOutput(process, `Process completed with exit code ${exitCode}`, 'system')
    
    // Trim history if needed
    if (processHistory.value.length > maxHistorySize.value) {
      processHistory.value = processHistory.value.slice(-maxHistorySize.value)
    }
  }
  
  const addOutput = (process, text, type = 'stdout') => {
    const timestamp = new Date().toISOString()
    const line = settings.showTimestamps 
      ? `[${timestamp.split('T')[1].split('.')[0]}] ${text}`
      : text
    
    // Add to current output
    currentOutput.value += line + '\n'
    stats.totalOutputLines++
    
    // Add to process output if specified
    if (process) {
      process.output.push({
        timestamp,
        text,
        type
      })
    }
    
    // Trim output buffer if needed
    const lines = currentOutput.value.split('\n')
    if (lines.length > settings.bufferSize) {
      currentOutput.value = lines.slice(-settings.bufferSize).join('\n')
    }
  }
  
  const exportToText = (sessionData) => {
    let output = `Terminal Session Export\n`
    output += `=======================\n\n`
    output += `Timestamp: ${sessionData.timestamp}\n`
    output += `Active Processes: ${sessionData.activeProcesses.length}\n`
    output += `Total Processes: ${sessionData.stats.totalProcesses}\n`
    output += `Output Lines: ${sessionData.stats.totalOutputLines}\n\n`
    
    output += `Terminal Output:\n`
    output += `----------------\n`
    output += sessionData.output
    
    return output
  }
  
  const exportToHtml = (sessionData) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Terminal Session - ${sessionData.timestamp}</title>
    <style>
        body { font-family: monospace; background: #000; color: #fff; padding: 20px; }
        .header { border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .output { white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Terminal Session</h1>
        <p>Exported: ${sessionData.timestamp}</p>
        <p>Processes: ${sessionData.stats.totalProcesses} | Lines: ${sessionData.stats.totalOutputLines}</p>
    </div>
    <div class="output">${sessionData.output}</div>
</body>
</html>
    `
  }
  
  return {
    // State
    isConnected,
    activeProcesses,
    processHistory,
    currentOutput,
    settings,
    stats,
    
    // Computed
    hasActiveProcesses,
    recentProcesses,
    outputLines,
    
    // Methods
    startProcess,
    stopProcess,
    sendInput,
    clearOutput,
    exportSession,
    connect,
    disconnect
  }
}

export default useTerminalMonitor
