<!--
  PlanBuilder.vue - Visual drag-and-drop plan creation interface
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="plan-builder">
    <!-- Header with controls -->
    <div class="plan-builder__header">
      <div class="plan-builder__title">
        <h2 class="text-xl font-semibold text-primary">Visual Plan Builder</h2>
        <p class="text-sm text-muted">Drag and drop steps to create your plan</p>
      </div>
      
      <div class="plan-builder__controls">
        <button 
          class="btn btn--secondary"
          @click="clearCanvas"
          :disabled="planBuilder.steps.length === 0"
        >
          Clear Canvas
        </button>
        
        <button 
          class="btn btn--primary"
          @click="generatePlan"
        >
          Generate Plan
        </button>
      </div>
    </div>

    <!-- Main builder interface -->
    <div class="plan-builder__workspace">
      <!-- Step Templates Sidebar -->
      <div class="plan-builder__sidebar">
        <div class="step-templates">
          <h3 class="step-templates__title">Step Templates</h3>
          
          <div class="step-templates__categories">
            <div 
              v-for="category in stepCategories" 
              :key="category.id"
              class="step-category"
            >
              <h4 class="step-category__title">{{ category.name }}</h4>
              
              <div class="step-category__items">
                <div
                  v-for="template in category.templates"
                  :key="template.id"
                  class="step-template"
                  :class="{ 'step-template--dragging': draggedTemplate?.id === template.id }"
                  draggable="true"
                  @dragstart="handleTemplateDragStart(template, $event)"
                  @dragend="handleTemplateDragEnd"
                >
                  <div class="step-template__icon">
                    <Icon :name="template.icon" />
                  </div>
                  
                  <div class="step-template__content">
                    <div class="step-template__name">{{ template.name }}</div>
                    <div class="step-template__description">{{ template.description }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Canvas Area -->
      <div class="plan-builder__canvas-container">
        <div 
          ref="canvasRef"
          class="plan-builder__canvas"
          :style="canvasStyle"
          @drop="handleCanvasDrop"
          @dragover="handleCanvasDragOver"
          @click="handleCanvasClick"
        >
          <!-- Grid background -->
          <div class="canvas-grid"></div>
          
          <!-- Plan Steps -->
          <PlanStep
            v-for="step in planBuilder.steps"
            :key="step.id"
            :step="step"
            :selected="planBuilder.selectedStep === step.id"
            :connections="getStepConnections(step.id)"
            @update="updateStep"
            @delete="removeStep"
            @select="selectStep"
            @connect="startConnection"
            @move="moveStep"
          />
          
          <!-- Connection Lines -->
          <svg class="connection-overlay" :viewBox="svgViewBox">
            <ConnectionLine
              v-for="connection in planBuilder.connections"
              :key="connection.id"
              :connection="connection"
              :steps="planBuilder.steps"
              @delete="removeConnection"
            />
            
            <!-- Temporary connection line while dragging -->
            <ConnectionLine
              v-if="tempConnection"
              :connection="tempConnection"
              :steps="planBuilder.steps"
              :temporary="true"
            />
          </svg>
        </div>
        
        <!-- Canvas Controls -->
        <div class="canvas-controls">
          <button 
            class="canvas-control"
            @click="zoomIn"
            title="Zoom In"
          >
            <Icon name="plus" />
          </button>
          
          <button 
            class="canvas-control"
            @click="zoomOut"
            title="Zoom Out"
          >
            <Icon name="minus" />
          </button>
          
          <button 
            class="canvas-control"
            @click="resetZoom"
            title="Reset Zoom"
          >
            <Icon name="refresh" />
          </button>
          
          <div class="zoom-indicator">
            {{ Math.round(planBuilder.canvasZoom * 100) }}%
          </div>
        </div>
      </div>

      <!-- Properties Panel -->
      <div class="plan-builder__properties">
        <div class="properties-panel">
          <h3 class="properties-panel__title">Properties</h3>
          
          <div v-if="selectedStep" class="step-properties">
            <StepProperties
              :step="selectedStep"
              :template="getStepTemplate(selectedStep.type)"
              @update="updateStepProperties"
            />
          </div>
          
          <div v-else class="no-selection">
            <p class="text-muted">Select a step to edit its properties</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Plan Preview Modal -->
    <Modal 
      v-if="showPlanPreview"
      title="Generated Plan Preview"
      @close="showPlanPreview = false"
    >
      <PlanPreview 
        :plan="generatedPlan"
        @save="savePlan"
        @edit="editPlan"
      />
    </Modal>
  </div>
</template>

<script>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { usePlanningStore } from '../../stores/planningStore.js'
import { useModelManager } from '../../composables/useModelManager.js'
import PlanStep from './PlanStep.vue'
import ConnectionLine from './ConnectionLine.vue'
import StepProperties from './StepProperties.vue'
import PlanPreview from './PlanPreview.vue'
import Icon from '../shared/Icon.vue'
import Modal from '../shared/Modal.vue'

/**
 * PlanBuilder Component
 * 
 * Provides visual drag-and-drop plan creation:
 * 1. Step template library with categories
 * 2. Canvas for arranging steps
 * 3. Connection system for step dependencies
 * 4. Properties panel for step configuration
 */
export default {
  name: 'PlanBuilder',
  
  components: {
    PlanStep,
    ConnectionLine,
    StepProperties,
    PlanPreview,
    Icon,
    Modal
  },
  
  props: {
    engine: {
      type: Object,
      required: false,
      default: null
    },
    selectedModel: {
      type: Object,
      required: false,
      default: null
    }
  },
  
  emits: ['plan-created', 'plan-validated', 'generate-plan'],
  
  setup(props, { emit }) {
    // Stores and composables
    const planningStore = usePlanningStore()
    const modelManager = useModelManager()
    
    // Template refs
    const canvasRef = ref(null)
    
    // Component state
    const draggedTemplate = ref(null)
    const tempConnection = ref(null)
    const showPlanPreview = ref(false)
    const generatedPlan = ref(null)
    
    // Canvas interaction state
    const canvasInteraction = reactive({
      isDragging: false,
      dragStart: { x: 0, y: 0 },
      lastMousePos: { x: 0, y: 0 }
    })
    
    // Computed properties
    const planBuilder = computed(() => planningStore.planBuilder)
    
    const selectedStep = computed(() => {
      if (!planBuilder.value.selectedStep) return null
      return planBuilder.value.steps.find(s => s.id === planBuilder.value.selectedStep)
    })
    
    const stepCategories = computed(() => {
      const categories = new Map()
      
      // Group step templates by category
      for (const [id, template] of planningStore.stepTemplates) {
        const category = template.category || 'general'
        
        if (!categories.has(category)) {
          categories.set(category, {
            id: category,
            name: category.charAt(0).toUpperCase() + category.slice(1),
            templates: []
          })
        }
        
        categories.get(category).templates.push(template)
      }
      
      return Array.from(categories.values())
    })
    
    const canvasStyle = computed(() => ({
      transform: `scale(${planBuilder.value.canvasZoom}) translate(${planBuilder.value.canvasOffset.x}px, ${planBuilder.value.canvasOffset.y}px)`
    }))
    
    const svgViewBox = computed(() => {
      const zoom = planBuilder.value.canvasZoom
      const offset = planBuilder.value.canvasOffset
      const width = 2000 / zoom
      const height = 1500 / zoom
      return `${-offset.x / zoom} ${-offset.y / zoom} ${width} ${height}`
    })

    // Actions - Template Handling
    
    /**
     * Handle template drag start
     * Input → Process → Output pattern
     */
    function handleTemplateDragStart(template, event) {
      // Input: Store dragged template
      draggedTemplate.value = template
      
      // Process: Set drag data
      event.dataTransfer.setData('application/json', JSON.stringify(template))
      event.dataTransfer.effectAllowed = 'copy'
      
      // Output: Visual feedback
      event.target.style.opacity = '0.5'
    }
    
    function handleTemplateDragEnd(event) {
      draggedTemplate.value = null
      event.target.style.opacity = '1'
    }

    // Actions - Canvas Handling
    
    function handleCanvasDragOver(event) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
    
    /**
     * Handle drop on canvas
     * Question → Explore → Apply pattern
     */
    function handleCanvasDrop(event) {
      event.preventDefault()
      
      try {
        // Question: What was dropped?
        const templateData = event.dataTransfer.getData('application/json')
        if (!templateData) return
        
        const template = JSON.parse(templateData)
        
        // Explore: Calculate drop position
        const rect = canvasRef.value.getBoundingClientRect()
        const zoom = planBuilder.value.canvasZoom
        const offset = planBuilder.value.canvasOffset
        
        const position = {
          x: (event.clientX - rect.left) / zoom - offset.x,
          y: (event.clientY - rect.top) / zoom - offset.y
        }
        
        // Apply: Add step to canvas
        planningStore.addStepToBuilder(template, position)
        
      } catch (error) {
        console.error('Failed to handle canvas drop:', error)
      }
    }
    
    function handleCanvasClick(event) {
      // Deselect step if clicking on empty canvas
      if (event.target === canvasRef.value) {
        planBuilder.value.selectedStep = null
      }
    }

    // Actions - Step Management
    
    function updateStep(stepId, updates) {
      const step = planBuilder.value.steps.find(s => s.id === stepId)
      if (step) {
        Object.assign(step, updates)
      }
    }
    
    function removeStep(stepId) {
      planningStore.removeStepFromBuilder(stepId)
    }
    
    function selectStep(stepId) {
      planBuilder.value.selectedStep = stepId
    }
    
    function moveStep(stepId, position) {
      updateStep(stepId, { position })
    }
    
    function updateStepProperties(properties) {
      if (selectedStep.value) {
        updateStep(selectedStep.value.id, { parameters: properties })
      }
    }

    // Actions - Connection Management
    
    function startConnection(fromStepId, outputKey) {
      // Implementation for starting connection creation
      console.log('Starting connection from', fromStepId, outputKey)
    }
    
    function removeConnection(connectionId) {
      const index = planBuilder.value.connections.findIndex(c => c.id === connectionId)
      if (index !== -1) {
        planBuilder.value.connections.splice(index, 1)
      }
    }
    
    function getStepConnections(stepId) {
      return planBuilder.value.connections.filter(
        conn => conn.from === stepId || conn.to === stepId
      )
    }

    // Actions - Canvas Controls
    
    function zoomIn() {
      planBuilder.value.canvasZoom = Math.min(2, planBuilder.value.canvasZoom * 1.2)
    }
    
    function zoomOut() {
      planBuilder.value.canvasZoom = Math.max(0.2, planBuilder.value.canvasZoom / 1.2)
    }
    
    function resetZoom() {
      planBuilder.value.canvasZoom = 1
      planBuilder.value.canvasOffset = { x: 0, y: 0 }
    }
    
    function clearCanvas() {
      planBuilder.value.steps = []
      planBuilder.value.connections = []
      planBuilder.value.selectedStep = null
    }

    // Actions - Plan Generation
    
    /**
     * Generate plan from builder state
     * Prompt → Validate → Result pattern
     */
    async function generatePlan() {
      try {
        // Prompt: Check if there are steps to generate from
        if (planBuilder.value.steps.length === 0) {
          // If no steps in builder, create a plan from scratch using AI
          const planDescription = prompt('Enter a description for your plan:')
          if (!planDescription) return
          
          // Emit to parent component to handle with terminal feedback
          emit('generate-plan', {
            type: 'text',
            description: planDescription,
            model: props.selectedModel?.name || 'mistral-nemo:latest'
          })
        } else {
          // Validate: Generate plan structure from builder
          const builderData = {
            steps: planBuilder.value.steps,
            connections: planBuilder.value.connections,
            metadata: {
              canvasZoom: planBuilder.value.canvasZoom,
              canvasOffset: planBuilder.value.canvasOffset
            }
          }
          
          // Emit to parent component to handle with terminal feedback
          emit('generate-plan', {
            type: 'visual',
            builderData: builderData,
            model: props.selectedModel?.name || 'mistral-nemo:latest'
          })
        }
        
      } catch (error) {
        console.error('Failed to generate plan:', error)
        alert('Failed to generate plan: ' + error.message)
      }
    }
    
    async function savePlan(plan) {
      try {
        // Save to backend API
        const response = await fetch('http://localhost:3333/api/planning/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            plan: plan
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          planningStore.setCurrentPlan(result.plan)
          showPlanPreview.value = false
          console.log('Plan saved successfully:', result.plan)
          alert('Plan saved successfully!')
        } else {
          throw new Error(result.error || 'Failed to save plan')
        }
        
      } catch (error) {
        console.error('Failed to save plan:', error)
        alert('Failed to save plan: ' + error.message)
      }
    }
    
    function editPlan() {
      showPlanPreview.value = false
      // Keep current builder state for editing
    }

    // Utility functions
    
    function getStepTemplate(templateId) {
      return planningStore.stepTemplates.get(templateId)
    }

    // Keyboard shortcuts
    function handleKeydown(event) {
      if (event.key === 'Delete' && selectedStep.value) {
        removeStep(selectedStep.value.id)
      }
      
      if (event.key === 'Escape') {
        planBuilder.value.selectedStep = null
      }
    }

    // Lifecycle
    onMounted(() => {
      document.addEventListener('keydown', handleKeydown)
    })
    
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown)
    })

    return {
      // Template refs
      canvasRef,
      
      // State
      draggedTemplate,
      tempConnection,
      showPlanPreview,
      generatedPlan,
      
      // Computed
      planBuilder,
      selectedStep,
      stepCategories,
      canvasStyle,
      svgViewBox,
      
      // Actions
      handleTemplateDragStart,
      handleTemplateDragEnd,
      handleCanvasDragOver,
      handleCanvasDrop,
      handleCanvasClick,
      updateStep,
      removeStep,
      selectStep,
      moveStep,
      updateStepProperties,
      startConnection,
      removeConnection,
      getStepConnections,
      zoomIn,
      zoomOut,
      resetZoom,
      clearCanvas,
      generatePlan,
      savePlan,
      editPlan,
      getStepTemplate
    }
  }
}
</script>

<style scoped>
.plan-builder {
  @apply h-full flex flex-col bg-surface;
}

.plan-builder__header {
  @apply flex items-center justify-between p-4 border-b border-border;
}

.plan-builder__title h2 {
  @apply text-xl font-semibold text-primary mb-1;
}

.plan-builder__title p {
  @apply text-sm text-muted;
}

.plan-builder__controls {
  @apply flex gap-2;
}

.plan-builder__workspace {
  @apply flex-1 flex overflow-hidden;
}

.plan-builder__sidebar {
  @apply w-80 bg-surface-hover border-r border-border overflow-y-auto;
}

.step-templates {
  @apply p-4;
}

.step-templates__title {
  @apply text-lg font-medium text-primary mb-4;
}

.step-category {
  @apply mb-6;
}

.step-category__title {
  @apply text-sm font-medium text-secondary mb-2 uppercase tracking-wide;
}

.step-template {
  @apply flex items-center p-3 mb-2 bg-surface rounded-lg border border-border cursor-grab transition-all;
}

.step-template:hover {
  @apply bg-surface-hover border-primary shadow-sm;
}

.step-template--dragging {
  @apply opacity-50;
}

.step-template__icon {
  @apply w-8 h-8 flex items-center justify-center bg-primary text-white rounded mr-3;
}

.step-template__content {
  @apply flex-1;
}

.step-template__name {
  @apply font-medium text-primary text-sm;
}

.step-template__description {
  @apply text-xs text-muted mt-1;
}

.plan-builder__canvas-container {
  @apply flex-1 relative overflow-hidden bg-surface;
}

.plan-builder__canvas {
  @apply w-full h-full relative;
  transform-origin: top left;
}

.canvas-grid {
  @apply absolute inset-0 opacity-20;
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

.canvas-controls {
  @apply absolute bottom-4 right-4 flex flex-col gap-2;
}

.canvas-control {
  @apply w-10 h-10 bg-surface border border-border rounded-lg flex items-center justify-center text-primary hover:bg-surface-hover transition-colors;
}

.zoom-indicator {
  @apply text-xs text-center text-muted bg-surface border border-border rounded px-2 py-1;
}

.plan-builder__properties {
  @apply w-80 bg-surface-hover border-l border-border overflow-y-auto;
}

.properties-panel {
  @apply p-4;
}

.properties-panel__title {
  @apply text-lg font-medium text-primary mb-4;
}

.no-selection {
  @apply text-center py-8;
}

/* Button styles */
.btn {
  @apply px-4 py-2 rounded-lg font-medium transition-all;
}

.btn--primary {
  @apply bg-primary text-white hover:bg-orange-dark;
}

.btn--secondary {
  @apply bg-surface border border-border text-primary hover:bg-surface-hover;
}

.btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
