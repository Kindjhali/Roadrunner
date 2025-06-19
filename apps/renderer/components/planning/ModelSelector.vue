<!--
  ModelSelector.vue - Visual model selection interface with grid layout
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="model-selector">
    <!-- Header with search and filters -->
    <div class="model-selector__header">
      <div class="model-selector__title">
        <h3 class="text-lg font-semibold text-primary">Select AI Model</h3>
        <p class="text-sm text-muted">Choose the best model for your task</p>
      </div>
      
      <div class="model-selector__controls">
        <!-- Search -->
        <div class="search-input">
          <Icon name="passeriformes-search" size="sm" class="search-input__icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search models..."
            class="search-input__field"
          />
        </div>
        
        <!-- Category filter -->
        <select v-model="selectedCategory" class="category-filter">
          <option value="">All Categories</option>
          <option value="coding">Code Generation</option>
          <option value="reasoning">Logical Reasoning</option>
          <option value="creative">Creative Writing</option>
          <option value="general">General Purpose</option>
          <option value="multimodal">Multimodal</option>
        </select>
        
        <!-- Provider filter -->
        <select v-model="selectedProvider" class="provider-filter">
          <option value="">All Providers</option>
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="cohere">Cohere</option>
        </select>
      </div>
    </div>

    <!-- Model Grid -->
    <div class="tyrannidae-model-grid" :class="{ 'is-loading': isLoading }">
      <!-- Loading state -->
      <div v-if="isLoading" class="model-grid__loading">
        <div class="loading-spinner">
          <Icon name="loading" size="xl" animation="spin" />
        </div>
        <p class="text-muted">Loading models...</p>
      </div>
      
      <!-- Error state -->
      <div v-else-if="lastError" class="model-grid__error">
        <Icon name="error" size="xl" class="text-error" />
        <p class="text-error">Failed to load models</p>
        <BaseButton 
          variant="outline" 
          size="sm" 
          @click="refreshModels"
          icon="refresh"
        >
          Retry
        </BaseButton>
      </div>
      
      <!-- Empty state -->
      <div v-else-if="filteredModels.length === 0" class="model-grid__empty">
        <Icon name="passeriformes-search" size="xl" class="text-muted" />
        <p class="text-muted">No models found</p>
        <p class="text-sm text-muted">Try adjusting your search or filters</p>
      </div>
      
      <!-- Model Cards -->
      <ModelCard
        v-for="model in filteredModels"
        :key="model.id"
        :model="model"
        :selected="selectedModel?.id === model.id"
        :benchmark-results="getBenchmarkResults(model.id)"
        @select="selectModel"
        @benchmark="benchmarkModel"
        @compare="addToComparison"
        @details="showModelDetails"
      />
    </div>

    <!-- Selected Model Summary -->
    <div v-if="selectedModel" class="model-selector__summary">
      <div class="selected-model-summary">
        <div class="selected-model-summary__info">
          <div class="selected-model-summary__header">
            <h4 class="font-medium text-primary">{{ selectedModel.name }}</h4>
            <span class="model-badge" :class="`model-badge--${selectedModel.provider}`">
              {{ selectedModel.provider }}
            </span>
          </div>
          
          <div class="selected-model-summary__details">
            <span class="detail-item">
              <Icon name="furnariidae-component" size="xs" />
              {{ selectedModel.family || 'Unknown' }}
            </span>
            
            <span v-if="selectedModel.size" class="detail-item">
              <Icon name="piciformes-database" size="xs" />
              {{ formatModelSize(selectedModel.size) }}
            </span>
            
            <span class="detail-item">
              <Icon name="corvidae-analyze" size="xs" />
              {{ getModelCategory(selectedModel) }}
            </span>
          </div>
        </div>
        
        <div class="selected-model-summary__actions">
          <BaseButton
            variant="ghost"
            size="sm"
            icon="corvidae-analyze"
            @click="benchmarkModel(selectedModel.id)"
            :loading="isBenchmarking"
          >
            Benchmark
          </BaseButton>
          
          <BaseButton
            variant="ghost"
            size="sm"
            icon="info"
            @click="showModelDetails(selectedModel)"
          >
            Details
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Model Comparison Panel -->
    <div v-if="comparisonModels.length > 0" class="model-selector__comparison">
      <div class="comparison-panel">
        <div class="comparison-panel__header">
          <h4 class="font-medium text-primary">Model Comparison</h4>
          <BaseButton
            variant="ghost"
            size="sm"
            icon="tyrannidae-close"
            @click="clearComparison"
          >
            Clear
          </BaseButton>
        </div>
        
        <div class="comparison-models">
          <div
            v-for="model in comparisonModels"
            :key="model.id"
            class="comparison-model"
          >
            <span class="comparison-model__name">{{ model.name }}</span>
            <BaseButton
              variant="ghost"
              size="xs"
              icon="tyrannidae-close"
              @click="removeFromComparison(model.id)"
            />
          </div>
        </div>
        
        <BaseButton
          v-if="canCompareModels"
          variant="primary"
          size="sm"
          icon="corvidae-analyze"
          @click="compareModels"
          :loading="isComparing"
          block
        >
          Compare Models
        </BaseButton>
      </div>
    </div>

    <!-- Model Details Modal -->
    <Modal
      v-if="showDetailsModal"
      :title="`${detailsModel?.name} Details`"
      @close="showDetailsModal = false"
    >
      <ModelDetails
        :model="detailsModel"
        :capabilities="modelCapabilities"
        :benchmark-results="getBenchmarkResults(detailsModel?.id)"
        @benchmark="benchmarkModel"
        @select="selectModel"
      />
    </Modal>

    <!-- Comparison Results Modal -->
    <Modal
      v-if="showComparisonModal"
      title="Model Comparison Results"
      size="large"
      @close="showComparisonModal = false"
    >
      <ModelComparison
        :comparison-results="comparisonResults"
        @select="selectModel"
        @close="showComparisonModal = false"
      />
    </Modal>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useModelManager } from '../../composables/useModelManager.js'
import ModelCard from './ModelCard.vue'
import ModelDetails from './ModelDetails.vue'
import ModelComparison from './ModelComparison.vue'
import Icon from '../shared/Icon.vue'
import BaseButton from '../shared/BaseButton.vue'
import Modal from '../shared/Modal.vue'

/**
 * ModelSelector Component
 * 
 * Visual model selection interface with:
 * 1. Grid-based model display with cards
 * 2. Search and filtering capabilities
 * 3. Model comparison functionality
 * 4. Benchmarking and performance metrics
 * 5. Detailed model information
 */
export default {
  name: 'ModelSelector',
  
  components: {
    ModelCard,
    ModelDetails,
    ModelComparison,
    Icon,
    BaseButton,
    Modal
  },
  
  props: {
    /**
     * Use case for model selection (affects recommendations)
     */
    useCase: {
      type: String,
      default: 'general',
      validator: (value) => {
        const useCases = ['planning', 'execution', 'brainstorming', 'coding', 'general']
        return useCases.includes(value)
      }
    },
    
    /**
     * Whether to show comparison features
     */
    enableComparison: {
      type: Boolean,
      default: true
    },
    
    /**
     * Whether to show benchmarking features
     */
    enableBenchmarking: {
      type: Boolean,
      default: true
    },
    
    /**
     * Maximum number of models to show
     */
    maxModels: {
      type: Number,
      default: null
    }
  },
  
  emits: ['model-selected', 'models-compared', 'model-benchmarked'],
  
  setup(props, { emit }) {
    // Composables
    const {
      categorizedModels,
      selectedModel,
      comparisonModels,
      benchmarkResults,
      isLoading,
      lastError,
      canCompareModels,
      loadModels,
      refreshModels,
      setSelectedModel,
      addToComparison,
      removeFromComparison,
      clearComparison,
      compareModels: performComparison,
      benchmarkModel: performBenchmark,
      getBenchmarkResults,
      getModelCapabilities,
      filterModels
    } = useModelManager()
    
    // Component state
    const searchQuery = ref('')
    const selectedCategory = ref('')
    const selectedProvider = ref('')
    const showDetailsModal = ref(false)
    const showComparisonModal = ref(false)
    const detailsModel = ref(null)
    const modelCapabilities = ref(null)
    const comparisonResults = ref(null)
    const isBenchmarking = ref(false)
    const isComparing = ref(false)
    
    // Computed properties
    const allModels = computed(() => {
      const models = []
      Object.values(categorizedModels.value).forEach(category => {
        models.push(...category)
      })
      return models
    })
    
    const filteredModels = computed(() => {
      let models = filterModels({
        category: selectedCategory.value,
        provider: selectedProvider.value,
        search: searchQuery.value
      })
      
      // Apply max models limit
      if (props.maxModels && models.length > props.maxModels) {
        models = models.slice(0, props.maxModels)
      }
      
      // Sort by relevance for use case
      if (props.useCase !== 'general') {
        models = sortByRelevance(models, props.useCase)
      }
      
      return models
    })
    
    const recommendedModels = computed(() => {
      return getRecommendedModels(props.useCase).slice(0, 3)
    })

    // Methods
    
    /**
     * Select a model
     * Input → Process → Output pattern
     */
    function selectModel(model) {
      // Input: Validate model
      if (!model || !model.id) {
        console.error('Invalid model for selection')
        return
      }
      
      // Process: Set selected model
      setSelectedModel(model)
      
      // Output: Emit selection event
      emit('model-selected', model)
    }
    
    /**
     * Benchmark a model
     * Question → Explore → Apply pattern
     */
    async function benchmarkModel(modelId) {
      try {
        // Question: Should we benchmark this model?
        if (!props.enableBenchmarking) {
          console.warn('Benchmarking is disabled')
          return
        }
        
        isBenchmarking.value = true
        
        // Explore: Run benchmark
        const results = await performBenchmark(modelId)
        
        // Apply: Emit results
        emit('model-benchmarked', { modelId, results })
        
      } catch (error) {
        console.error('Benchmarking failed:', error)
      } finally {
        isBenchmarking.value = false
      }
    }
    
    /**
     * Compare selected models
     * Prompt → Validate → Result pattern
     */
    async function compareModels() {
      try {
        // Prompt: Check if comparison is possible
        if (!props.enableComparison || !canCompareModels.value) {
          console.warn('Model comparison not available')
          return
        }
        
        isComparing.value = true
        
        // Validate: Perform comparison
        const results = await performComparison()
        
        // Result: Show comparison results
        comparisonResults.value = results
        showComparisonModal.value = true
        
        emit('models-compared', results)
        
      } catch (error) {
        console.error('Model comparison failed:', error)
      } finally {
        isComparing.value = false
      }
    }
    
    /**
     * Show model details
     */
    async function showModelDetails(model) {
      try {
        detailsModel.value = model
        
        // Load model capabilities
        modelCapabilities.value = await getModelCapabilities(model.id)
        
        showDetailsModal.value = true
        
      } catch (error) {
        console.error('Failed to load model details:', error)
        // Show modal anyway with basic info
        showDetailsModal.value = true
      }
    }
    
    /**
     * Sort models by relevance to use case
     */
    function sortByRelevance(models, useCase) {
      const relevanceScores = {
        'planning': { reasoning: 3, general: 2, coding: 1 },
        'execution': { coding: 3, general: 2, reasoning: 1 },
        'brainstorming': { creative: 3, general: 2, reasoning: 1 },
        'coding': { coding: 3, reasoning: 2, general: 1 }
      }
      
      const scores = relevanceScores[useCase] || {}
      
      return models.sort((a, b) => {
        const scoreA = scores[getModelCategory(a)] || 0
        const scoreB = scores[getModelCategory(b)] || 0
        return scoreB - scoreA
      })
    }
    
    /**
     * Get model category
     */
    function getModelCategory(model) {
      // Find which category this model belongs to
      for (const [category, models] of Object.entries(categorizedModels.value)) {
        if (models.some(m => m.id === model.id)) {
          return category
        }
      }
      return 'general'
    }
    
    /**
     * Format model size for display
     */
    function formatModelSize(size) {
      if (!size) return 'Unknown'
      
      const gb = size / (1024 * 1024 * 1024)
      if (gb >= 1) {
        return `${gb.toFixed(1)}GB`
      }
      
      const mb = size / (1024 * 1024)
      return `${mb.toFixed(0)}MB`
    }

    // Watchers
    watch(selectedModel, (model) => {
      if (model) {
        emit('model-selected', model)
      }
    })

    // Lifecycle
    onMounted(async () => {
      if (allModels.value.length === 0) {
        await loadModels()
      }
    })

    return {
      // State
      searchQuery,
      selectedCategory,
      selectedProvider,
      showDetailsModal,
      showComparisonModal,
      detailsModel,
      modelCapabilities,
      comparisonResults,
      isBenchmarking,
      isComparing,
      
      // Computed
      filteredModels,
      recommendedModels,
      
      // From composable
      selectedModel,
      comparisonModels,
      isLoading,
      lastError,
      canCompareModels,
      
      // Methods
      selectModel,
      benchmarkModel,
      compareModels,
      showModelDetails,
      refreshModels,
      addToComparison,
      removeFromComparison,
      clearComparison,
      getBenchmarkResults,
      getModelCategory,
      formatModelSize
    }
  }
}
</script>

<style scoped>
.model-selector {
  @apply flex flex-col h-full bg-surface;
}

.model-selector__header {
  @apply flex items-start justify-between p-4 border-b border-border;
}

.model-selector__title h3 {
  @apply text-lg font-semibold text-primary mb-1;
}

.model-selector__title p {
  @apply text-sm text-muted;
}

.model-selector__controls {
  @apply flex items-center gap-3;
}

.search-input {
  @apply relative;
}

.search-input__icon {
  @apply absolute left-3 top-1/2 transform -translate-y-1/2 text-muted;
}

.search-input__field {
  @apply pl-10 pr-4 py-2 bg-surface-card border border-border rounded-lg text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
  min-width: 200px;
}

.category-filter,
.provider-filter {
  @apply px-3 py-2 bg-surface-card border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
}

.tyrannidae-model-grid {
  @apply flex-1 p-4 overflow-y-auto custom-scrollbar;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  align-content: start;
}

.tyrannidae-model-grid.is-loading {
  @apply flex items-center justify-center;
}

.model-grid__loading,
.model-grid__error,
.model-grid__empty {
  @apply flex flex-col items-center justify-center text-center py-12;
  grid-column: 1 / -1;
}

.model-grid__loading .loading-spinner {
  @apply mb-4;
}

.model-grid__error {
  @apply gap-4;
}

.model-grid__empty {
  @apply gap-2;
}

.model-selector__summary {
  @apply border-t border-border bg-surface-hover;
}

.selected-model-summary {
  @apply flex items-center justify-between p-4;
}

.selected-model-summary__header {
  @apply flex items-center gap-2 mb-2;
}

.selected-model-summary__header h4 {
  @apply font-medium text-primary;
}

.model-badge {
  @apply px-2 py-1 text-xs font-medium rounded-full;
}

.model-badge--ollama {
  @apply bg-blue-100 text-blue-800;
}

.model-badge--openai {
  @apply bg-green-100 text-green-800;
}

.model-badge--anthropic {
  @apply bg-purple-100 text-purple-800;
}

.model-badge--cohere {
  @apply bg-orange-100 text-orange-800;
}

.selected-model-summary__details {
  @apply flex items-center gap-4 text-sm text-muted;
}

.detail-item {
  @apply flex items-center gap-1;
}

.selected-model-summary__actions {
  @apply flex items-center gap-2;
}

.model-selector__comparison {
  @apply border-t border-border bg-surface-card;
}

.comparison-panel {
  @apply p-4;
}

.comparison-panel__header {
  @apply flex items-center justify-between mb-3;
}

.comparison-panel__header h4 {
  @apply font-medium text-primary;
}

.comparison-models {
  @apply flex flex-wrap gap-2 mb-4;
}

.comparison-model {
  @apply flex items-center gap-2 px-3 py-1 bg-surface-hover rounded-lg text-sm;
}

.comparison-model__name {
  @apply text-primary;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .model-selector__header {
    @apply flex-col gap-4;
  }
  
  .model-selector__controls {
    @apply flex-col w-full;
  }
  
  .search-input__field {
    min-width: auto;
    @apply w-full;
  }
  
  .tyrannidae-model-grid {
    grid-template-columns: 1fr;
  }
  
  .selected-model-summary {
    @apply flex-col gap-4;
  }
  
  .selected-model-summary__details {
    @apply flex-wrap;
  }
}

/* Dark theme adjustments */
[data-theme="dark"] .search-input__field,
[data-theme="dark"] .category-filter,
[data-theme="dark"] .provider-filter {
  @apply bg-surface-elevated border-surface-border;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .model-badge {
    @apply border border-current;
  }
}
</style>
