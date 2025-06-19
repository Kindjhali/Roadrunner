<!--
  IdeaNode.vue - Individual idea node for the mind mapping canvas
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div
    class="idea-node"
    :class="nodeClasses"
    :style="nodeStyle"
    @mousedown="handleMouseDown"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <!-- Node Header -->
    <div class="node-header">
      <div class="node-type-indicator" :style="{ backgroundColor: node.color }"></div>
      <div class="node-title" :contenteditable="isEditing" @blur="handleTitleBlur">
        {{ node.title }}
      </div>
      <div class="node-actions">
        <button
          class="node-action-btn"
          @click.stop="$emit('connect', node.id)"
          :class="{ 'connecting': connecting }"
          title="Connect to other nodes"
        >
          <Icon name="turdus-connect" size="xs" />
        </button>
        <button
          class="node-action-btn"
          @click.stop="$emit('delete', node.id)"
          title="Delete node"
        >
          <Icon name="turdus-delete" size="xs" />
        </button>
      </div>
    </div>

    <!-- Node Content -->
    <div class="node-content">
      <div 
        class="node-text"
        :contenteditable="isEditing"
        @blur="handleContentBlur"
      >
        {{ node.content }}
      </div>
    </div>

    <!-- Node Footer -->
    <div class="node-footer">
      <span class="node-category">{{ node.category }}</span>
      <span class="node-priority" :class="`priority-${node.priority}`">
        {{ node.priority }}
      </span>
    </div>

    <!-- Connection Points -->
    <div class="connection-points">
      <div class="connection-point connection-point--top" data-direction="top"></div>
      <div class="connection-point connection-point--right" data-direction="right"></div>
      <div class="connection-point connection-point--bottom" data-direction="bottom"></div>
      <div class="connection-point connection-point--left" data-direction="left"></div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from '../shared/Icon.vue'

/**
 * IdeaNode Component
 * 
 * Represents a single idea node in the mind mapping canvas:
 * 1. Draggable and resizable
 * 2. Editable content
 * 3. Connection points for linking
 * 4. Visual categorization and prioritization
 */
export default {
  name: 'IdeaNode',
  
  components: {
    Icon
  },
  
  props: {
    node: {
      type: Object,
      required: true
    },
    selected: {
      type: Boolean,
      default: false
    },
    connecting: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['select', 'move', 'edit', 'delete', 'connect', 'update'],
  
  setup(props, { emit }) {
    // State
    const isEditing = ref(false)
    const isDragging = ref(false)
    const dragStart = ref({ x: 0, y: 0 })
    const nodeStart = ref({ x: 0, y: 0 })
    
    // Computed properties
    const nodeClasses = computed(() => ({
      'idea-node--selected': props.selected,
      'idea-node--connecting': props.connecting,
      'idea-node--editing': isEditing.value,
      'idea-node--dragging': isDragging.value,
      [`idea-node--${props.node.category}`]: true,
      [`idea-node--${props.node.priority}`]: true
    }))
    
    const nodeStyle = computed(() => ({
      left: `${props.node.position.x}px`,
      top: `${props.node.position.y}px`,
      width: `${props.node.size.width}px`,
      height: `${props.node.size.height}px`,
      borderColor: props.node.color,
      zIndex: props.selected ? 1000 : 1
    }))

    // Event handlers
    
    /**
     * Handle mouse down for dragging
     * Input → Process → Output pattern
     */
    function handleMouseDown(event) {
      if (event.target.contentEditable === 'true') return
      
      // Input: Capture initial positions
      isDragging.value = true
      dragStart.value = { x: event.clientX, y: event.clientY }
      nodeStart.value = { ...props.node.position }
      
      // Process: Add global event listeners
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      // Output: Prevent default behavior
      event.preventDefault()
    }
    
    function handleMouseMove(event) {
      if (!isDragging.value) return
      
      const deltaX = event.clientX - dragStart.value.x
      const deltaY = event.clientY - dragStart.value.y
      
      const newPosition = {
        x: nodeStart.value.x + deltaX,
        y: nodeStart.value.y + deltaY
      }
      
      emit('move', props.node.id, newPosition)
    }
    
    function handleMouseUp() {
      isDragging.value = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    function handleClick(event) {
      if (!isEditing.value) {
        emit('select', props.node.id, event.ctrlKey || event.metaKey)
      }
    }
    
    function handleDoubleClick() {
      isEditing.value = true
      emit('edit', props.node.id)
    }
    
    function handleTitleBlur(event) {
      const newTitle = event.target.textContent.trim()
      if (newTitle !== props.node.title) {
        emit('update', props.node.id, { title: newTitle })
      }
      isEditing.value = false
    }
    
    function handleContentBlur(event) {
      const newContent = event.target.textContent.trim()
      if (newContent !== props.node.content) {
        emit('update', props.node.id, { content: newContent })
      }
      isEditing.value = false
    }

    // Keyboard shortcuts
    function handleKeydown(event) {
      if (props.selected && !isEditing.value) {
        if (event.key === 'Delete') {
          emit('delete', props.node.id)
        }
        
        if (event.key === 'Enter') {
          isEditing.value = true
          emit('edit', props.node.id)
        }
        
        if (event.key === 'Escape') {
          isEditing.value = false
        }
      }
    }

    // Lifecycle
    onMounted(() => {
      document.addEventListener('keydown', handleKeydown)
    })
    
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    })

    return {
      isEditing,
      isDragging,
      nodeClasses,
      nodeStyle,
      handleMouseDown,
      handleClick,
      handleDoubleClick,
      handleTitleBlur,
      handleContentBlur
    }
  }
}
</script>

<style scoped>
.idea-node {
  @apply absolute bg-surface border-2 rounded-lg shadow-md cursor-move select-none transition-all;
  min-width: 150px;
  min-height: 80px;
}

.idea-node:hover {
  @apply shadow-lg;
}

.idea-node--selected {
  @apply ring-2 ring-primary ring-opacity-50;
}

.idea-node--connecting {
  @apply ring-2 ring-blue-500 ring-opacity-75;
}

.idea-node--editing {
  @apply cursor-text;
}

.idea-node--dragging {
  @apply shadow-xl opacity-80;
}

/* Category-based styling */
.idea-node--idea {
  @apply border-blue-400;
}

.idea-node--problem {
  @apply border-red-400;
}

.idea-node--solution {
  @apply border-green-400;
}

.idea-node--feature {
  @apply border-purple-400;
}

.idea-node--question {
  @apply border-yellow-400;
}

.idea-node--category {
  @apply border-gray-400;
}

/* Priority-based styling */
.idea-node--critical {
  @apply border-4;
}

.idea-node--high {
  @apply border-4;
}

.node-header {
  @apply flex items-center justify-between p-2 border-b border-border;
}

.node-type-indicator {
  @apply w-3 h-3 rounded-full mr-2;
}

.node-title {
  @apply flex-1 font-medium text-primary text-sm;
  outline: none;
}

.node-title[contenteditable="true"] {
  @apply bg-surface-hover rounded px-1;
}

.node-actions {
  @apply flex gap-1;
}

.node-action-btn {
  @apply w-6 h-6 flex items-center justify-center text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors;
}

.node-action-btn.connecting {
  @apply text-blue-500 bg-blue-100;
}

.node-content {
  @apply flex-1 p-2;
}

.node-text {
  @apply text-sm text-secondary leading-relaxed;
  outline: none;
  word-wrap: break-word;
}

.node-text[contenteditable="true"] {
  @apply bg-surface-hover rounded px-1;
}

.node-footer {
  @apply flex items-center justify-between p-2 border-t border-border text-xs;
}

.node-category {
  @apply text-muted capitalize;
}

.node-priority {
  @apply px-2 py-1 rounded text-xs font-medium;
}

.priority-low {
  @apply bg-gray-100 text-gray-600;
}

.priority-medium {
  @apply bg-blue-100 text-blue-600;
}

.priority-high {
  @apply bg-orange-100 text-orange-600;
}

.priority-critical {
  @apply bg-red-100 text-red-600;
}

.connection-points {
  @apply absolute inset-0 pointer-events-none;
}

.connection-point {
  @apply absolute w-3 h-3 bg-primary rounded-full opacity-0 transition-opacity pointer-events-auto;
  transform: translate(-50%, -50%);
}

.idea-node:hover .connection-point,
.idea-node--connecting .connection-point {
  @apply opacity-100;
}

.connection-point--top {
  @apply top-0 left-1/2;
}

.connection-point--right {
  @apply top-1/2 right-0;
}

.connection-point--bottom {
  @apply bottom-0 left-1/2;
}

.connection-point--left {
  @apply top-1/2 left-0;
}

.connection-point:hover {
  @apply bg-blue-500 scale-125;
}
</style>
