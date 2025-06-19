/**
 * useFileSystem.js - File system operations composable
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

import { ref, reactive, computed, watch } from 'vue'
import { EventEmitter } from '../utils/EventEmitter.js'

/**
 * File System Composable
 * 
 * Provides reactive file system operations:
 * 1. Real-time file tree management
 * 2. File CRUD operations
 * 3. Git integration
 * 4. File watching and change detection
 * 5. Drag-and-drop file handling
 */
export function useFileSystem(options = {}) {
  // Configuration
  const config = {
    watchFiles: true,
    enableGit: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.js', '.ts', '.vue', '.html', '.css', '.json', '.md', '.py', '.txt'],
    ...options
  }
  
  // Event emitter for file system events
  const emitter = new EventEmitter()
  
  // Reactive state
  const fileTree = ref([])
  const currentDirectory = ref('/')
  const selectedFiles = ref([])
  const recentFiles = ref([])
  const isLoading = ref(false)
  const lastError = ref(null)
  
  // File operations state
  const fileOperations = reactive({
    copying: new Set(),
    moving: new Set(),
    deleting: new Set(),
    creating: new Set()
  })
  
  // Git state
  const gitStatus = reactive({
    isRepository: false,
    branch: '',
    status: [],
    staged: [],
    unstaged: [],
    untracked: []
  })
  
  // Computed properties
  const currentFiles = computed(() => {
    return fileTree.value.filter(file => 
      file.parent === currentDirectory.value
    )
  })
  
  const totalFiles = computed(() => fileTree.value.length)
  
  const totalSize = computed(() => {
    return fileTree.value.reduce((total, file) => total + (file.size || 0), 0)
  })
  
  const hasUnsavedChanges = computed(() => {
    return fileTree.value.some(file => file.modified && !file.saved)
  })

  // File Operations
  
  /**
   * Load file tree from current directory
   * Question → Explore → Apply pattern
   */
  async function loadFileTree(directory = currentDirectory.value) {
    try {
      // Question: Is this a valid directory?
      if (!directory) {
        throw new Error('Directory path is required')
      }
      
      isLoading.value = true
      lastError.value = null
      
      // Explore: Read directory contents
      const files = await readDirectory(directory)
      
      // Apply: Update file tree
      fileTree.value = files.map(file => ({
        ...file,
        id: generateFileId(file.path),
        parent: directory,
        modified: false,
        saved: true
      }))
      
      currentDirectory.value = directory
      
      // Load git status if enabled
      if (config.enableGit) {
        await loadGitStatus()
      }
      
      emitter.emit('fileTreeLoaded', { directory, files: fileTree.value })
      
    } catch (error) {
      lastError.value = error
      console.error('Failed to load file tree:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Read file content
   * Input → Process → Output pattern
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} File content
   */
  async function readFile(filePath) {
    try {
      // Input: Validate file path
      if (!filePath) {
        throw new Error('File path is required')
      }
      
      // Process: Check if file exists in tree
      const file = fileTree.value.find(f => f.path === filePath)
      if (!file) {
        throw new Error('File not found in tree')
      }
      
      // Output: Read file content
      const content = await performFileRead(filePath)
      
      // Update recent files
      addToRecentFiles(file)
      
      emitter.emit('fileRead', { file, content })
      
      return content
      
    } catch (error) {
      lastError.value = error
      console.error('Failed to read file:', error)
      throw error
    }
  }
  
  /**
   * Save file content
   * Prompt → Validate → Result pattern
   * 
   * @param {string} filePath - Path to file
   * @param {string} content - File content
   * @returns {Promise<void>}
   */
  async function saveFile(filePath, content) {
    try {
      // Prompt: Validate inputs
      if (!filePath || content === undefined) {
        throw new Error('File path and content are required')
      }
      
      // Validate: Check file size
      if (content.length > config.maxFileSize) {
        throw new Error('File size exceeds maximum allowed size')
      }
      
      // Result: Save file
      await performFileWrite(filePath, content)
      
      // Update file tree
      const file = fileTree.value.find(f => f.path === filePath)
      if (file) {
        file.modified = false
        file.saved = true
        file.size = content.length
        file.lastModified = new Date()
      }
      
      emitter.emit('fileSaved', { filePath, content, file })
      
    } catch (error) {
      lastError.value = error
      console.error('Failed to save file:', error)
      throw error
    }
  }
  
  /**
   * Create new file
   * 
   * @param {string} filePath - Path for new file
   * @param {string} content - Initial content
   * @returns {Promise<Object>} Created file object
   */
  async function createFile(filePath, content = '') {
    try {
      if (!filePath) {
        throw new Error('File path is required')
      }
      
      // Check if file already exists
      if (fileTree.value.some(f => f.path === filePath)) {
        throw new Error('File already exists')
      }
      
      fileOperations.creating.add(filePath)
      
      // Create file
      await performFileWrite(filePath, content)
      
      // Add to file tree
      const newFile = {
        id: generateFileId(filePath),
        name: getFileName(filePath),
        path: filePath,
        extension: getFileExtension(filePath),
        size: content.length,
        type: 'file',
        parent: getDirectoryPath(filePath),
        created: new Date(),
        lastModified: new Date(),
        modified: false,
        saved: true
      }
      
      fileTree.value.push(newFile)
      
      emitter.emit('fileCreated', { file: newFile })
      
      return newFile
      
    } catch (error) {
      lastError.value = error
      throw error
    } finally {
      fileOperations.creating.delete(filePath)
    }
  }
  
  /**
   * Delete file
   * 
   * @param {string} filePath - Path to file to delete
   * @returns {Promise<void>}
   */
  async function deleteFile(filePath) {
    try {
      if (!filePath) {
        throw new Error('File path is required')
      }
      
      fileOperations.deleting.add(filePath)
      
      // Delete file
      await performFileDelete(filePath)
      
      // Remove from file tree
      const index = fileTree.value.findIndex(f => f.path === filePath)
      if (index !== -1) {
        const deletedFile = fileTree.value.splice(index, 1)[0]
        emitter.emit('fileDeleted', { file: deletedFile })
      }
      
    } catch (error) {
      lastError.value = error
      throw error
    } finally {
      fileOperations.deleting.delete(filePath)
    }
  }
  
  /**
   * Copy file
   * 
   * @param {string} sourcePath - Source file path
   * @param {string} targetPath - Target file path
   * @returns {Promise<Object>} Copied file object
   */
  async function copyFile(sourcePath, targetPath) {
    try {
      if (!sourcePath || !targetPath) {
        throw new Error('Source and target paths are required')
      }
      
      fileOperations.copying.add(sourcePath)
      
      // Read source file
      const content = await readFile(sourcePath)
      
      // Create target file
      const copiedFile = await createFile(targetPath, content)
      
      emitter.emit('fileCopied', { sourcePath, targetPath, file: copiedFile })
      
      return copiedFile
      
    } catch (error) {
      lastError.value = error
      throw error
    } finally {
      fileOperations.copying.delete(sourcePath)
    }
  }
  
  /**
   * Move file
   * 
   * @param {string} sourcePath - Source file path
   * @param {string} targetPath - Target file path
   * @returns {Promise<Object>} Moved file object
   */
  async function moveFile(sourcePath, targetPath) {
    try {
      if (!sourcePath || !targetPath) {
        throw new Error('Source and target paths are required')
      }
      
      fileOperations.moving.add(sourcePath)
      
      // Copy file to new location
      const movedFile = await copyFile(sourcePath, targetPath)
      
      // Delete original file
      await deleteFile(sourcePath)
      
      emitter.emit('fileMoved', { sourcePath, targetPath, file: movedFile })
      
      return movedFile
      
    } catch (error) {
      lastError.value = error
      throw error
    } finally {
      fileOperations.moving.delete(sourcePath)
    }
  }

  // Directory Operations
  
  /**
   * Create directory
   * 
   * @param {string} dirPath - Directory path
   * @returns {Promise<Object>} Created directory object
   */
  async function createDirectory(dirPath) {
    try {
      if (!dirPath) {
        throw new Error('Directory path is required')
      }
      
      await performDirectoryCreate(dirPath)
      
      const newDir = {
        id: generateFileId(dirPath),
        name: getFileName(dirPath),
        path: dirPath,
        type: 'directory',
        parent: getDirectoryPath(dirPath),
        created: new Date(),
        children: []
      }
      
      fileTree.value.push(newDir)
      
      emitter.emit('directoryCreated', { directory: newDir })
      
      return newDir
      
    } catch (error) {
      lastError.value = error
      throw error
    }
  }
  
  /**
   * Navigate to directory
   * 
   * @param {string} dirPath - Directory path
   */
  async function navigateToDirectory(dirPath) {
    try {
      await loadFileTree(dirPath)
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  // Git Operations
  
  /**
   * Load git status
   */
  async function loadGitStatus() {
    try {
      const status = await performGitStatus()
      
      gitStatus.isRepository = status.isRepository
      gitStatus.branch = status.branch
      gitStatus.status = status.files
      gitStatus.staged = status.files.filter(f => f.staged)
      gitStatus.unstaged = status.files.filter(f => f.modified && !f.staged)
      gitStatus.untracked = status.files.filter(f => f.untracked)
      
      emitter.emit('gitStatusLoaded', gitStatus)
      
    } catch (error) {
      console.warn('Git status not available:', error)
    }
  }
  
  /**
   * Stage file for commit
   * 
   * @param {string} filePath - File to stage
   */
  async function stageFile(filePath) {
    try {
      await performGitAdd(filePath)
      await loadGitStatus()
      
      emitter.emit('fileStaged', { filePath })
      
    } catch (error) {
      lastError.value = error
      throw error
    }
  }
  
  /**
   * Unstage file
   * 
   * @param {string} filePath - File to unstage
   */
  async function unstageFile(filePath) {
    try {
      await performGitReset(filePath)
      await loadGitStatus()
      
      emitter.emit('fileUnstaged', { filePath })
      
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  // Drag and Drop Support
  
  /**
   * Handle file drop
   * 
   * @param {DragEvent} event - Drop event
   * @param {string} targetPath - Target directory path
   */
  async function handleFileDrop(event, targetPath = currentDirectory.value) {
    try {
      event.preventDefault()
      
      const files = Array.from(event.dataTransfer.files)
      const uploadedFiles = []
      
      for (const file of files) {
        // Validate file
        if (!isFileAllowed(file)) {
          console.warn(`File ${file.name} is not allowed`)
          continue
        }
        
        // Read file content
        const content = await readFileFromDrop(file)
        
        // Create file in target directory
        const filePath = `${targetPath}/${file.name}`
        const createdFile = await createFile(filePath, content)
        
        uploadedFiles.push(createdFile)
      }
      
      emitter.emit('filesDropped', { files: uploadedFiles, targetPath })
      
      return uploadedFiles
      
    } catch (error) {
      lastError.value = error
      throw error
    }
  }

  // Utility Functions
  
  function generateFileId(path) {
    return btoa(path).replace(/[^a-zA-Z0-9]/g, '')
  }
  
  function getFileName(path) {
    return path.split('/').pop() || path
  }
  
  function getFileExtension(path) {
    const name = getFileName(path)
    const lastDot = name.lastIndexOf('.')
    return lastDot > 0 ? name.substring(lastDot) : ''
  }
  
  function getDirectoryPath(path) {
    const parts = path.split('/')
    parts.pop()
    return parts.join('/') || '/'
  }
  
  function isFileAllowed(file) {
    if (file.size > config.maxFileSize) {
      return false
    }
    
    const extension = getFileExtension(file.name)
    return config.allowedExtensions.includes(extension)
  }
  
  function addToRecentFiles(file) {
    const existing = recentFiles.value.findIndex(f => f.path === file.path)
    if (existing !== -1) {
      recentFiles.value.splice(existing, 1)
    }
    
    recentFiles.value.unshift(file)
    
    // Keep only last 10 files
    if (recentFiles.value.length > 10) {
      recentFiles.value = recentFiles.value.slice(0, 10)
    }
  }
  
  function readFileFromDrop(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  // Mock implementations for file operations
  // In a real implementation, these would interface with the actual file system
  
  async function readDirectory(path) {
    // Mock implementation
    return [
      { name: 'src', path: `${path}/src`, type: 'directory' },
      { name: 'package.json', path: `${path}/package.json`, type: 'file', size: 1024 },
      { name: 'README.md', path: `${path}/README.md`, type: 'file', size: 2048 }
    ]
  }
  
  async function performFileRead(path) {
    // Mock implementation
    return `// Content of ${path}\nconsole.log('Hello World');`
  }
  
  async function performFileWrite(path, content) {
    // Mock implementation
    console.log(`Writing to ${path}:`, content.substring(0, 100))
  }
  
  async function performFileDelete(path) {
    // Mock implementation
    console.log(`Deleting ${path}`)
  }
  
  async function performDirectoryCreate(path) {
    // Mock implementation
    console.log(`Creating directory ${path}`)
  }
  
  async function performGitStatus() {
    // Mock implementation
    return {
      isRepository: true,
      branch: 'main',
      files: [
        { path: 'src/main.js', modified: true, staged: false },
        { path: 'README.md', modified: false, staged: true }
      ]
    }
  }
  
  async function performGitAdd(path) {
    console.log(`Staging ${path}`)
  }
  
  async function performGitReset(path) {
    console.log(`Unstaging ${path}`)
  }

  // Event handling
  function on(event, callback) {
    emitter.on(event, callback)
  }
  
  function off(event, callback) {
    emitter.off(event, callback)
  }
  
  function emit(event, data) {
    emitter.emit(event, data)
  }

  return {
    // State
    fileTree,
    currentDirectory,
    selectedFiles,
    recentFiles,
    isLoading,
    lastError,
    fileOperations,
    gitStatus,
    
    // Computed
    currentFiles,
    totalFiles,
    totalSize,
    hasUnsavedChanges,
    
    // File operations
    loadFileTree,
    readFile,
    saveFile,
    createFile,
    deleteFile,
    copyFile,
    moveFile,
    
    // Directory operations
    createDirectory,
    navigateToDirectory,
    
    // Git operations
    loadGitStatus,
    stageFile,
    unstageFile,
    
    // Drag and drop
    handleFileDrop,
    
    // Event handling
    on,
    off,
    emit
  }
}

export default useFileSystem
