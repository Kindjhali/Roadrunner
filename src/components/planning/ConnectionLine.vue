<template>
  <svg 
    class="connection-line"
    :style="svgStyle"
    :viewBox="`0 0 ${width} ${height}`"
  >
    <!-- Connection Path -->
    <path
      :d="pathData"
      :class="[
        'connection-path',
        {
          'path-active': isActive,
          'path-selected': isSelected,
          'path-error': hasError
        }
      ]"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      fill="none"
      :marker-end="showArrow ? 'url(#arrowhead)' : ''"
    />
    
    <!-- Connection Label -->
    <text
      v-if="label"
      :x="labelPosition.x"
      :y="labelPosition.y"
      class="connection-label"
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {{ label }}
    </text>
    
    <!-- Arrow Marker Definition -->
    <defs v-if="showArrow">
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon
          points="0 0, 10 3.5, 0 7"
          :fill="strokeColor"
        />
      </marker>
    </defs>
    
    <!-- Connection Points -->
    <circle
      v-if="showPoints"
      :cx="startPoint.x"
      :cy="startPoint.y"
      r="4"
      class="connection-point start-point"
      :fill="strokeColor"
    />
    
    <circle
      v-if="showPoints"
      :cx="endPoint.x"
      :cy="endPoint.y"
      r="4"
      class="connection-point end-point"
      :fill="strokeColor"
    />
  </svg>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'ConnectionLine',
  
  props: {
    startPoint: {
      type: Object,
      required: true,
      validator: (point) => point && typeof point.x === 'number' && typeof point.y === 'number'
    },
    endPoint: {
      type: Object,
      required: true,
      validator: (point) => point && typeof point.x === 'number' && typeof point.y === 'number'
    },
    type: {
      type: String,
      default: 'straight',
      validator: (value) => ['straight', 'curved', 'stepped', 'bezier'].includes(value)
    },
    label: {
      type: String,
      default: ''
    },
    color: {
      type: String,
      default: '#6b7280'
    },
    width: {
      type: Number,
      default: 2
    },
    isActive: {
      type: Boolean,
      default: false
    },
    isSelected: {
      type: Boolean,
      default: false
    },
    hasError: {
      type: Boolean,
      default: false
    },
    showArrow: {
      type: Boolean,
      default: true
    },
    showPoints: {
      type: Boolean,
      default: false
    },
    animated: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['click', 'hover'],
  
  setup(props, { emit }) {
    // Calculate SVG dimensions and position
    const svgStyle = computed(() => {
      const minX = Math.min(props.startPoint.x, props.endPoint.x) - 20
      const minY = Math.min(props.startPoint.y, props.endPoint.y) - 20
      const maxX = Math.max(props.startPoint.x, props.endPoint.x) + 20
      const maxY = Math.max(props.startPoint.y, props.endPoint.y) + 20
      
      return {
        position: 'absolute',
        left: `${minX}px`,
        top: `${minY}px`,
        width: `${maxX - minX}px`,
        height: `${maxY - minY}px`,
        pointerEvents: 'none',
        zIndex: 1
      }
    })
    
    const width = computed(() => {
      return Math.abs(props.endPoint.x - props.startPoint.x) + 40
    })
    
    const height = computed(() => {
      return Math.abs(props.endPoint.y - props.startPoint.y) + 40
    })
    
    // Calculate path data based on connection type
    const pathData = computed(() => {
      const start = {
        x: props.startPoint.x - Math.min(props.startPoint.x, props.endPoint.x) + 20,
        y: props.startPoint.y - Math.min(props.startPoint.y, props.endPoint.y) + 20
      }
      
      const end = {
        x: props.endPoint.x - Math.min(props.startPoint.x, props.endPoint.x) + 20,
        y: props.endPoint.y - Math.min(props.startPoint.y, props.endPoint.y) + 20
      }
      
      switch (props.type) {
        case 'straight':
          return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
          
        case 'curved':
          const midX = (start.x + end.x) / 2
          const midY = (start.y + end.y) / 2
          const controlOffset = 50
          return `M ${start.x} ${start.y} Q ${midX} ${midY - controlOffset} ${end.x} ${end.y}`
          
        case 'stepped':
          const stepX = start.x + (end.x - start.x) * 0.7
          return `M ${start.x} ${start.y} L ${stepX} ${start.y} L ${stepX} ${end.y} L ${end.x} ${end.y}`
          
        case 'bezier':
          const cp1x = start.x + (end.x - start.x) * 0.5
          const cp1y = start.y
          const cp2x = start.x + (end.x - start.x) * 0.5
          const cp2y = end.y
          return `M ${start.x} ${start.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${end.x} ${end.y}`
          
        default:
          return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
      }
    })
    
    // Calculate label position
    const labelPosition = computed(() => {
      const start = {
        x: props.startPoint.x - Math.min(props.startPoint.x, props.endPoint.x) + 20,
        y: props.startPoint.y - Math.min(props.startPoint.y, props.endPoint.y) + 20
      }
      
      const end = {
        x: props.endPoint.x - Math.min(props.startPoint.x, props.endPoint.x) + 20,
        y: props.endPoint.y - Math.min(props.startPoint.y, props.endPoint.y) + 20
      }
      
      return {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      }
    })
    
    // Dynamic stroke color based on state
    const strokeColor = computed(() => {
      if (props.hasError) return '#ef4444'
      if (props.isSelected) return '#3b82f6'
      if (props.isActive) return '#10b981'
      return props.color
    })
    
    const strokeWidth = computed(() => {
      if (props.isSelected || props.isActive) return props.width + 1
      return props.width
    })
    
    return {
      svgStyle,
      width,
      height,
      pathData,
      labelPosition,
      strokeColor,
      strokeWidth
    }
  }
}
</script>

<style scoped>
.connection-line {
  overflow: visible;
}

.connection-path {
  @apply transition-all duration-200;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.connection-path.path-active {
  filter: drop-shadow(0 0 4px currentColor);
}

.connection-path.path-selected {
  stroke-dasharray: 5, 5;
  animation: dash 1s linear infinite;
}

.connection-path.path-error {
  stroke-dasharray: 3, 3;
  animation: error-pulse 1s ease-in-out infinite alternate;
}

.connection-label {
  @apply text-xs font-medium fill-current;
  @apply text-gray-600 dark:text-gray-400;
  pointer-events: auto;
  cursor: pointer;
}

.connection-point {
  @apply transition-all duration-200;
  cursor: pointer;
  pointer-events: auto;
}

.connection-point:hover {
  r: 6;
  filter: drop-shadow(0 0 4px currentColor);
}

.start-point {
  @apply fill-green-500;
}

.end-point {
  @apply fill-red-500;
}

/* Animations */
@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}

@keyframes error-pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.5;
  }
}

/* Connection types */
.connection-path[data-type="curved"] {
  stroke-linecap: round;
}

.connection-path[data-type="stepped"] {
  stroke-linejoin: miter;
}

.connection-path[data-type="bezier"] {
  stroke-linecap: round;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .connection-label {
    @apply text-xs;
  }
  
  .connection-point {
    r: 3;
  }
  
  .connection-point:hover {
    r: 5;
  }
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .connection-path {
    filter: brightness(1.2);
  }
  
  .connection-label {
    @apply text-gray-300;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .connection-path {
    stroke-width: 3;
  }
  
  .connection-label {
    @apply font-bold;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .connection-path,
  .connection-point {
    transition: none;
  }
  
  .connection-path.path-selected,
  .connection-path.path-error {
    animation: none;
  }
}
</style>
