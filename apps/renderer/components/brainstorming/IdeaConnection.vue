<!--
  IdeaConnection.vue - Visual connection lines between idea nodes
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <g class="idea-connection" :class="connectionClasses">
    <!-- Connection Path -->
    <path
      :d="pathData"
      :stroke="connectionColor"
      :stroke-width="strokeWidth"
      :stroke-dasharray="strokeDashArray"
      fill="none"
      class="connection-path"
      @click="handleClick"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    />
    
    <!-- Connection Arrow -->
    <polygon
      :points="arrowPoints"
      :fill="connectionColor"
      class="connection-arrow"
      @click="handleClick"
    />
    
    <!-- Connection Label -->
    <text
      v-if="connection.label"
      :x="labelPosition.x"
      :y="labelPosition.y"
      :fill="connectionColor"
      class="connection-label"
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {{ connection.label }}
    </text>
    
    <!-- Delete Button (on hover) -->
    <circle
      v-if="isHovered"
      :cx="deleteButtonPosition.x"
      :cy="deleteButtonPosition.y"
      r="8"
      fill="var(--color-red-500)"
      class="delete-button"
      @click="handleDelete"
    />
    
    <text
      v-if="isHovered"
      :x="deleteButtonPosition.x"
      :y="deleteButtonPosition.y"
      fill="white"
      text-anchor="middle"
      dominant-baseline="middle"
      class="delete-icon"
      @click="handleDelete"
    >
      ×
    </text>
  </g>
</template>

<script>
import { ref, computed } from 'vue'

/**
 * IdeaConnection Component
 * 
 * Renders visual connections between idea nodes:
 * 1. Curved connection paths
 * 2. Directional arrows
 * 3. Connection labels
 * 4. Interactive deletion
 */
export default {
  name: 'IdeaConnection',
  
  props: {
    connection: {
      type: Object,
      required: true
    },
    nodes: {
      type: Array,
      required: true
    },
    temporary: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['delete', 'select'],
  
  setup(props, { emit }) {
    // State
    const isHovered = ref(false)
    
    // Computed properties
    const fromNode = computed(() => 
      props.nodes.find(node => node.id === props.connection.from)
    )
    
    const toNode = computed(() => 
      props.nodes.find(node => node.id === props.connection.to)
    )
    
    const connectionClasses = computed(() => ({
      'idea-connection--temporary': props.temporary,
      'idea-connection--hovered': isHovered.value,
      [`idea-connection--${props.connection.type}`]: props.connection.type
    }))
    
    const connectionColor = computed(() => {
      if (props.temporary) return 'var(--color-primary)'
      
      const colors = {
        relates: 'var(--color-blue-500)',
        depends: 'var(--color-orange-500)',
        conflicts: 'var(--color-red-500)',
        supports: 'var(--color-green-500)',
        similar: 'var(--color-purple-500)'
      }
      
      return colors[props.connection.type] || colors.relates
    })
    
    const strokeWidth = computed(() => {
      if (props.temporary) return 2
      return isHovered.value ? 3 : 2
    })
    
    const strokeDashArray = computed(() => {
      if (props.temporary) return '5,5'
      return props.connection.type === 'conflicts' ? '8,4' : 'none'
    })
    
    /**
     * Calculate connection path coordinates
     * Question → Explore → Apply pattern
     */
    const pathCoordinates = computed(() => {
      // Question: Do we have valid nodes?
      if (!fromNode.value || !toNode.value) {
        return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
      }
      
      // Explore: Calculate node center points
      const fromCenter = {
        x: fromNode.value.position.x + fromNode.value.size.width / 2,
        y: fromNode.value.position.y + fromNode.value.size.height / 2
      }
      
      const toCenter = {
        x: toNode.value.position.x + toNode.value.size.width / 2,
        y: toNode.value.position.y + toNode.value.size.height / 2
      }
      
      // Apply: Calculate connection points on node edges
      const start = calculateConnectionPoint(fromNode.value, toCenter)
      const end = calculateConnectionPoint(toNode.value, fromCenter)
      
      return { start, end }
    })
    
    const pathData = computed(() => {
      const { start, end } = pathCoordinates.value
      
      // Calculate control points for curved path
      const dx = end.x - start.x
      const dy = end.y - start.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      // Curve intensity based on distance
      const curveIntensity = Math.min(distance * 0.3, 100)
      
      const controlPoint1 = {
        x: start.x + dx * 0.3,
        y: start.y - curveIntensity
      }
      
      const controlPoint2 = {
        x: end.x - dx * 0.3,
        y: end.y - curveIntensity
      }
      
      return `M ${start.x} ${start.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${end.x} ${end.y}`
    })
    
    const arrowPoints = computed(() => {
      const { end } = pathCoordinates.value
      const { start } = pathCoordinates.value
      
      // Calculate arrow direction
      const dx = end.x - start.x
      const dy = end.y - start.y
      const angle = Math.atan2(dy, dx)
      
      // Arrow size
      const arrowSize = 8
      
      // Calculate arrow points
      const x1 = end.x - arrowSize * Math.cos(angle - Math.PI / 6)
      const y1 = end.y - arrowSize * Math.sin(angle - Math.PI / 6)
      const x2 = end.x - arrowSize * Math.cos(angle + Math.PI / 6)
      const y2 = end.y - arrowSize * Math.sin(angle + Math.PI / 6)
      
      return `${end.x},${end.y} ${x1},${y1} ${x2},${y2}`
    })
    
    const labelPosition = computed(() => {
      const { start, end } = pathCoordinates.value
      return {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2 - 20
      }
    })
    
    const deleteButtonPosition = computed(() => {
      const { start, end } = pathCoordinates.value
      return {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      }
    })

    // Utility functions
    
    /**
     * Calculate connection point on node edge
     * 
     * @param {Object} node - Node object
     * @param {Object} targetPoint - Target point to connect to
     * @returns {Object} Connection point coordinates
     */
    function calculateConnectionPoint(node, targetPoint) {
      const nodeCenter = {
        x: node.position.x + node.size.width / 2,
        y: node.position.y + node.size.height / 2
      }
      
      const dx = targetPoint.x - nodeCenter.x
      const dy = targetPoint.y - nodeCenter.y
      
      // Calculate intersection with node rectangle
      const halfWidth = node.size.width / 2
      const halfHeight = node.size.height / 2
      
      let connectionX, connectionY
      
      if (Math.abs(dx) / halfWidth > Math.abs(dy) / halfHeight) {
        // Connection on left or right edge
        connectionX = nodeCenter.x + (dx > 0 ? halfWidth : -halfWidth)
        connectionY = nodeCenter.y + (dy * halfWidth) / Math.abs(dx)
      } else {
        // Connection on top or bottom edge
        connectionX = nodeCenter.x + (dx * halfHeight) / Math.abs(dy)
        connectionY = nodeCenter.y + (dy > 0 ? halfHeight : -halfHeight)
      }
      
      return { x: connectionX, y: connectionY }
    }

    // Event handlers
    
    function handleClick(event) {
      event.stopPropagation()
      emit('select', props.connection.id)
    }
    
    function handleMouseEnter() {
      isHovered.value = true
    }
    
    function handleMouseLeave() {
      isHovered.value = false
    }
    
    function handleDelete(event) {
      event.stopPropagation()
      emit('delete', props.connection.id)
    }

    return {
      isHovered,
      connectionClasses,
      connectionColor,
      strokeWidth,
      strokeDashArray,
      pathData,
      arrowPoints,
      labelPosition,
      deleteButtonPosition,
      handleClick,
      handleMouseEnter,
      handleMouseLeave,
      handleDelete
    }
  }
}
</script>

<style scoped>
.idea-connection {
  @apply cursor-pointer;
}

.connection-path {
  @apply transition-all;
}

.connection-path:hover {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.idea-connection--temporary .connection-path {
  @apply opacity-70;
}

.connection-arrow {
  @apply transition-all;
}

.connection-label {
  @apply text-xs font-medium;
  filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.8));
}

.delete-button {
  @apply cursor-pointer transition-all;
}

.delete-button:hover {
  @apply scale-110;
}

.delete-icon {
  @apply text-xs font-bold cursor-pointer select-none;
}

/* Connection type specific styles */
.idea-connection--depends .connection-path {
  stroke-linecap: round;
}

.idea-connection--conflicts .connection-path {
  stroke-linecap: round;
}

.idea-connection--supports .connection-path {
  stroke-linecap: round;
}

.idea-connection--similar .connection-path {
  stroke-linecap: round;
}
</style>
