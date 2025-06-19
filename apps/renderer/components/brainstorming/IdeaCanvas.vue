<!--
  IdeaCanvas.vue - Visual idea organization and mind mapping interface
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="idea-canvas">
    <!-- Canvas Header -->
    <div class="canvas-header">
      <div class="canvas-title">
        <h3 class="text-lg font-semibold text-primary">Idea Canvas</h3>
        <p class="text-sm text-muted">Organize and connect your ideas visually</p>
      </div>
      
      <div class="canvas-controls">
        <button 
          class="canvas-btn"
          @click="addIdeaNode"
          title="Add Idea"
        >
          <Icon name="turdus-idea" />
        </button>
        
        <button 
          class="canvas-btn"
          @click="addCategoryNode"
          title="Add Category"
        >
          <Icon name="turdus-category" />
        </button>
        
        <button 
          class="canvas-btn"
          @click="autoLayout"
          title="Auto Layout"
        >
          <Icon name="turdus-layout" />
        </button>
        
        <button 
          class="canvas-btn"
          @click="clearCanvas"
          title="Clear Canvas"
        >
          <Icon name="turdus-clear" />
        </button>
        
        <div class="zoom-controls">
          <button class="zoom-btn" @click="zoomIn">+</button>
          <span class="zoom-level">{{ Math.round(canvasZoom * 100) }}%</span>
          <button class="zoom-btn" @click="zoomOut">-</button>
        </div>
      </div>
    </div>

    <!-- Canvas Area -->
    <div class="canvas-container">
      <div 
        ref="canvasRef"
        class="canvas-workspace"
        :style="canvasStyle"
        @mousedown="handleCanvasMouseDown"
        @mousemove="handleCanvasMouseMove"
        @mouseup="handleCanvasMouseUp"
        @wheel="handleCanvasWheel"
        @drop="handleCanvasDrop"
        @dragover="handleCanvasDragOver"
      >
        <!-- Grid Background -->
        <div class="canvas-grid"></div>
        
        <!-- Idea Nodes -->
        <IdeaNode
          v-for="node in ideaNodes"
          :key="node.id"
          :node="node"
          :selected="selectedNodes.includes(node.id)"
          :connecting="connectingFrom === node.id"
          @select="selectNode"
          @move="moveNode"
          @edit="editNode"
          @delete="deleteNode"
          @connect="startConnection"
        />
        
        <!-- Connection Lines -->
        <svg class="connection-overlay" :viewBox="svgViewBox">
          <IdeaConnection
            v-for="connection in connections"
            :key="connection.id"
            :connection="connection"
            :nodes="ideaNodes"
            @delete="deleteConnection"
          />
          
          <!-- Temporary connection line -->
          <line
            v-if="tempConnection"
            :x1="tempConnection.x1"
            :y1="tempConnection.y1"
            :x2="tempConnection.x2"
            :y2="tempConnection.y2"
            stroke="var(--color-primary)"
            stroke-width="2"
            stroke-dasharray="5,5"
          />
        </svg>
      </div>
    </div>

    <!-- Properties Panel -->
    <div class="properties-panel">
      <div v-if="selectedNode" class="node-properties">
        <h4 class="properties-title">Node Properties</h4>
        
        <div class="property-group">
          <label class="property-label">Title</label>
          <input
            v-model="selectedNode.title"
            class="property-input"
            @input="updateNode"
          />
        </div>
        
        <div class="property-group">
          <label class="property-label">Content</label>
          <textarea
            v-model="selectedNode.content"
            class="property-textarea"
            rows="3"
            @input="updateNode"
          ></textarea>
        </div>
        
        <div class="property-group">
          <label class="property-label">Category</label>
          <select
            v-model="selectedNode.category"
            class="property-select"
            @change="updateNode"
          >
            <option value="idea">Idea</option>
            <option value="problem">Problem</option>
            <option value="solution">Solution</option>
            <option value="feature">Feature</option>
            <option value="question">Question</option>
          </select>
        </div>
        
        <div class="property-group">
          <label class="property-label">Priority</label>
          <select
            v-model="selectedNode.priority"
            class="property-select"
            @change="updateNode"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        
        <div class="property-actions">
          <button 
            class="property-btn property-btn--danger"
            @click="deleteNode(selectedNode.id)"
          >
            Delete Node
          </button>
        </div>
      </div>
      
      <div v-else class="no-selection">
        <Icon name="turdus-select" size="lg" class="text-muted" />
        <p class="text-muted">Select a node to edit its properties</p>
      </div>
    </div>

    <!-- Export Modal -->
    <Modal 
      v-if="showExportModal"
      title="Export Ideas"
      @close="showExportModal = false"
    >
      <div class="export-options">
        <div class="export-format">
          <h4 class="mb-3">Export Format</h4>
          <div class="format-options">
            <label class="format-option">
              <input type="radio" v-model="exportFormat" value="json" />
              <span>JSON</span>
            </label>
            <label class="format-option">
              <input type="radio" v-model="exportFormat" value="markdown" />
              <span>Markdown</span>
            </label>
            <label class="format-option">
              <input type="radio" v-model="exportFormat" value="plan" />
              <span>Execution Plan</span>
            </label>
          </div>
        </div>
        
        <div class="export-actions">
          <button class="btn btn--secondary" @click="showExportModal = false">
            Cancel
          </button>
          <button class="btn btn--primary" @click="exportIdeas">
            Export
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import Icon from '../shared/Icon.vue'
import Modal from '../shared/Modal.vue'
import IdeaNode from './IdeaNode.vue'
import IdeaConnection from './IdeaConnection.vue'

/**
 * IdeaCanvas Component
 * 
 * Provides visual idea organization and mind mapping:
 * 1. Drag-and-drop idea nodes
 * 2. Visual connections between ideas
 * 3. Categorization and prioritization
 * 4. Export to various formats
 */
export default {
  name: 'IdeaCanvas',
  
  components: {
    Icon,
    Modal,
    IdeaNode,
    IdeaConnection
  },
  
  props: {
    initialIdeas: {
      type: Array,
      default: () => []
    }
  },
  
  emits: ['export-ideas', 'ideas-updated'],
  
  setup(props, { emit }) {
    // Template refs
    const canvasRef = ref(null)
    
    // Canvas state
    const canvasZoom = ref(1)
    const canvasOffset = reactive({ x: 0, y: 0 })
    const isDragging = ref(false)
    const dragStart = reactive({ x: 0, y: 0 })
    
    // Node management
    const ideaNodes = ref([])
    const selectedNodes = ref([])
    const connectingFrom = ref(null)
    const tempConnection = ref(null)
    const connections = ref([])
    
    // UI state
    const showExportModal = ref(false)
    const exportFormat = ref('json')
    
    // Computed properties
    const selectedNode = computed(() => {
      if (selectedNodes.value.length === 1) {
        return ideaNodes.value.find(node => node.id === selectedNodes.value[0])
      }
      return null
    })
    
    const canvasStyle = computed(() => ({
      transform: `scale(${canvasZoom.value}) translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
      transformOrigin: 'top left'
    }))
    
    const svgViewBox = computed(() => {
      const zoom = canvasZoom.value
      const width = 2000 / zoom
      const height = 1500 / zoom
      return `${-canvasOffset.x / zoom} ${-canvasOffset.y / zoom} ${width} ${height}`
    })

    // Actions - Node Management
    
    /**
     * Add new idea node to canvas
     * Input → Process → Output pattern
     */
    function addIdeaNode() {
      // Input: Generate new node data
      const newNode = {
        id: generateNodeId(),
        type: 'idea',
        title: 'New Idea',
        content: 'Enter your idea here...',
        category: 'idea',
        priority: 'medium',
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100
        },
        size: { width: 200, height: 120 },
        color: getNodeColor('idea')
      }
      
      // Process: Add to canvas
      ideaNodes.value.push(newNode)
      
      // Output: Select new node
      selectedNodes.value = [newNode.id]
      
      emitIdeasUpdated()
    }
    
    function addCategoryNode() {
      const newNode = {
        id: generateNodeId(),
        type: 'category',
        title: 'Category',
        content: 'Group related ideas',
        category: 'category',
        priority: 'medium',
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100
        },
        size: { width: 180, height: 100 },
        color: getNodeColor('category')
      }
      
      ideaNodes.value.push(newNode)
      selectedNodes.value = [newNode.id]
      
      emitIdeasUpdated()
    }
    
    function selectNode(nodeId, multiSelect = false) {
      if (multiSelect) {
        if (selectedNodes.value.includes(nodeId)) {
          selectedNodes.value = selectedNodes.value.filter(id => id !== nodeId)
        } else {
          selectedNodes.value.push(nodeId)
        }
      } else {
        selectedNodes.value = [nodeId]
      }
    }
    
    function moveNode(nodeId, position) {
      const node = ideaNodes.value.find(n => n.id === nodeId)
      if (node) {
        node.position = position
        emitIdeasUpdated()
      }
    }
    
    function editNode(nodeId) {
      selectNode(nodeId)
    }
    
    function deleteNode(nodeId) {
      // Remove node
      const nodeIndex = ideaNodes.value.findIndex(n => n.id === nodeId)
      if (nodeIndex !== -1) {
        ideaNodes.value.splice(nodeIndex, 1)
      }
      
      // Remove connections involving this node
      connections.value = connections.value.filter(
        conn => conn.from !== nodeId && conn.to !== nodeId
      )
      
      // Clear selection if this node was selected
      selectedNodes.value = selectedNodes.value.filter(id => id !== nodeId)
      
      emitIdeasUpdated()
    }
    
    function updateNode() {
      emitIdeasUpdated()
    }

    // Actions - Connection Management
    
    function startConnection(nodeId) {
      if (connectingFrom.value === nodeId) {
        // Cancel connection
        connectingFrom.value = null
        tempConnection.value = null
      } else if (connectingFrom.value) {
        // Complete connection
        createConnection(connectingFrom.value, nodeId)
        connectingFrom.value = null
        tempConnection.value = null
      } else {
        // Start connection
        connectingFrom.value = nodeId
      }
    }
    
    function createConnection(fromId, toId) {
      if (fromId === toId) return
      
      // Check if connection already exists
      const exists = connections.value.some(
        conn => (conn.from === fromId && conn.to === toId) ||
                (conn.from === toId && conn.to === fromId)
      )
      
      if (!exists) {
        connections.value.push({
          id: generateConnectionId(),
          from: fromId,
          to: toId,
          type: 'relates'
        })
        
        emitIdeasUpdated()
      }
    }
    
    function deleteConnection(connectionId) {
      const index = connections.value.findIndex(c => c.id === connectionId)
      if (index !== -1) {
        connections.value.splice(index, 1)
        emitIdeasUpdated()
      }
    }

    // Actions - Canvas Controls
    
    function zoomIn() {
      canvasZoom.value = Math.min(2, canvasZoom.value * 1.2)
    }
    
    function zoomOut() {
      canvasZoom.value = Math.max(0.2, canvasZoom.value / 1.2)
    }
    
    function autoLayout() {
      // Simple force-directed layout
      const nodes = ideaNodes.value
      const centerX = 400
      const centerY = 300
      const radius = 200
      
      nodes.forEach((node, index) => {
        const angle = (index / nodes.length) * 2 * Math.PI
        node.position = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        }
      })
      
      emitIdeasUpdated()
    }
    
    function clearCanvas() {
      ideaNodes.value = []
      connections.value = []
      selectedNodes.value = []
      connectingFrom.value = null
      tempConnection.value = null
      
      emitIdeasUpdated()
    }

    // Actions - Canvas Interaction
    
    function handleCanvasMouseDown(event) {
      if (event.target === canvasRef.value) {
        isDragging.value = true
        dragStart.x = event.clientX
        dragStart.y = event.clientY
        
        // Clear selection if clicking on empty canvas
        selectedNodes.value = []
      }
    }
    
    function handleCanvasMouseMove(event) {
      if (isDragging.value) {
        const deltaX = event.clientX - dragStart.x
        const deltaY = event.clientY - dragStart.y
        
        canvasOffset.x += deltaX / canvasZoom.value
        canvasOffset.y += deltaY / canvasZoom.value
        
        dragStart.x = event.clientX
        dragStart.y = event.clientY
      }
      
      // Update temp connection line
      if (connectingFrom.value && tempConnection.value) {
        const rect = canvasRef.value.getBoundingClientRect()
        tempConnection.value.x2 = (event.clientX - rect.left) / canvasZoom.value - canvasOffset.x
        tempConnection.value.y2 = (event.clientY - rect.top) / canvasZoom.value - canvasOffset.y
      }
    }
    
    function handleCanvasMouseUp() {
      isDragging.value = false
    }
    
    function handleCanvasWheel(event) {
      event.preventDefault()
      
      const delta = event.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.2, Math.min(2, canvasZoom.value * delta))
      
      canvasZoom.value = newZoom
    }
    
    function handleCanvasDrop(event) {
      event.preventDefault()
      // Handle dropping external content
    }
    
    function handleCanvasDragOver(event) {
      event.preventDefault()
    }

    // Actions - Export
    
    function exportIdeas() {
      const exportData = {
        nodes: ideaNodes.value,
        connections: connections.value,
        format: exportFormat.value,
        timestamp: new Date().toISOString()
      }
      
      emit('export-ideas', exportData)
      showExportModal.value = false
    }

    // Utility functions
    
    function generateNodeId() {
      return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
    function generateConnectionId() {
      return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
    function getNodeColor(category) {
      const colors = {
        idea: '#3B82F6',
        problem: '#EF4444',
        solution: '#10B981',
        feature: '#8B5CF6',
        question: '#F59E0B',
        category: '#6B7280'
      }
      return colors[category] || colors.idea
    }
    
    function emitIdeasUpdated() {
      emit('ideas-updated', {
        nodes: ideaNodes.value,
        connections: connections.value
      })
    }
    
    function loadInitialIdeas() {
      if (props.initialIdeas.length > 0) {
        props.initialIdeas.forEach((idea, index) => {
          const node = {
            id: generateNodeId(),
            type: 'idea',
            title: idea.title || `Idea ${index + 1}`,
            content: idea.content || idea.description || '',
            category: idea.category || 'idea',
            priority: idea.priority || 'medium',
            position: {
              x: 100 + (index % 3) * 220,
              y: 100 + Math.floor(index / 3) * 140
            },
            size: { width: 200, height: 120 },
            color: getNodeColor(idea.category || 'idea')
          }
          
          ideaNodes.value.push(node)
        })
        
        emitIdeasUpdated()
      }
    }

    // Keyboard shortcuts
    function handleKeydown(event) {
      if (event.key === 'Delete' && selectedNodes.value.length > 0) {
        selectedNodes.value.forEach(nodeId => deleteNode(nodeId))
      }
      
      if (event.key === 'Escape') {
        selectedNodes.value = []
        connectingFrom.value = null
        tempConnection.value = null
      }
      
      if (event.key === 'a' && event.ctrlKey) {
        event.preventDefault()
        selectedNodes.value = ideaNodes.value.map(n => n.id)
      }
    }

    // Lifecycle
    onMounted(() => {
      document.addEventListener('keydown', handleKeydown)
      loadInitialIdeas()
    })
    
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown)
    })

    return {
      // Template refs
      canvasRef,
      
      // State
      canvasZoom,
      canvasOffset,
      ideaNodes,
      selectedNodes,
      connectingFrom,
      tempConnection,
      connections,
      showExportModal,
      exportFormat,
      
      // Computed
      selectedNode,
      canvasStyle,
      svgViewBox,
      
      // Actions
      addIdeaNode,
      addCategoryNode,
      selectNode,
      moveNode,
      editNode,
      deleteNode,
      updateNode,
      startConnection,
      deleteConnection,
      zoomIn,
      zoomOut,
      autoLayout,
      clearCanvas,
      handleCanvasMouseDown,
      handleCanvasMouseMove,
      handleCanvasMouseUp,
      handleCanvasWheel,
      handleCanvasDrop,
      handleCanvasDragOver,
      exportIdeas
    }
  }
}
</script>

<style scoped>
.idea-canvas {
  @apply h-full flex flex-col bg-surface;
}

.canvas-header {
  @apply flex items-center justify-between p-4 border-b border-border;
}

.canvas-title h3 {
  @apply text-lg font-semibold text-primary mb-1;
}

.canvas-controls {
  @apply flex items-center gap-2;
}

.canvas-btn {
  @apply w-8 h-8 flex items-center justify-center bg-surface-hover border border-border rounded hover:bg-surface-card transition-colors;
}

.zoom-controls {
  @apply flex items-center gap-1 ml-2;
}

.zoom-btn {
  @apply w-6 h-6 flex items-center justify-center bg-surface-hover border border-border rounded text-xs font-bold hover:bg-surface-card;
}

.zoom-level {
  @apply text-xs text-muted px-2;
}

.canvas-container {
  @apply flex-1 flex overflow-hidden;
}

.canvas-workspace {
  @apply flex-1 relative overflow-hidden bg-surface cursor-grab;
  transform-origin: top left;
}

.canvas-workspace:active {
  @apply cursor-grabbing;
}

.canvas-grid {
  @apply absolute inset-0 opacity-10;
  background-image: 
    linear-gradient(var(--color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
  background-size: 20px 20px;
}

.connection-overlay {
  @apply absolute inset-0 pointer-events-none;
  width: 100%;
  height: 100%;
}

.properties-panel {
  @apply w-80 bg-surface-hover border-l border-border p-4 overflow-y-auto;
}

.properties-title {
  @apply text-lg font-medium text-primary mb-4;
}

.property-group {
  @apply mb-4;
}

.property-label {
  @apply block text-sm font-medium text-secondary mb-1;
}

.property-input,
.property-textarea,
.property-select {
  @apply w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary;
}

.property-textarea {
  @apply resize-none;
}

.property-actions {
  @apply mt-6;
}

.property-btn {
  @apply px-4 py-2 rounded font-medium transition-colors;
}

.property-btn--danger {
  @apply bg-red-500 text-white hover:bg-red-600;
}

.no-selection {
  @apply text-center py-8 space-y-3;
}

.export-options {
  @apply space-y-6;
}

.format-options {
  @apply space-y-2;
}

.format-option {
  @apply flex items-center gap-2 cursor-pointer;
}

.export-actions {
  @apply flex gap-3 justify-end;
}

.btn {
  @apply px-4 py-2 rounded font-medium transition-colors;
}

.btn--primary {
  @apply bg-primary text-white hover:bg-orange-dark;
}

.btn--secondary {
  @apply bg-surface border border-border text-primary hover:bg-surface-hover;
}
</style>
