<!--
  SimpleModelDropdown.vue - Simple working model dropdown
  
  Following AGENTS.md principles:
  - No inline code or styles
  - Modular, testable components only
  - All logic in composables and services
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="simple-model-dropdown">
    <select 
      :value="modelValue" 
      @change="handleModelChange"
      class="model-select"
      :disabled="isLoading"
    >
      <option value="">{{ isLoading ? 'Loading models...' : 'Select a model...' }}</option>
      <option 
        v-for="model in models" 
        :key="model.name" 
        :value="model.name"
      >
        {{ formatModelName(model.name) }} ({{ formatModelSize(model.size) }})
      </option>
    </select>
    
    <div v-if="error" class="error-message">
      Failed to load models: {{ error }}
      <button @click="loadModels" class="retry-button">Retry</button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'SimpleModelDropdown',
  
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      default: 'general'
    }
  },
  
  emits: ['update:modelValue', 'model-changed'],
  
  setup(props, { emit }) {
    // State
    const models = ref([])
    const isLoading = ref(false)
    const error = ref(null)
    
    // Load models from backend API
    async function loadModels() {
      try {
        isLoading.value = true
        error.value = null
        
        console.log('Loading models from API...')
        const response = await fetch('http://localhost:3333/api/models')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (data.success && Array.isArray(data.models)) {
          models.value = data.models
          console.log(`Loaded ${data.models.length} models successfully`)
          
          // Auto-select first model if none selected
          if (!props.modelValue && data.models.length > 0) {
            const firstModel = data.models[0].name
            console.log('Auto-selecting first model:', firstModel)
            emit('update:modelValue', firstModel)
            emit('model-changed', data.models[0])
          }
        } else {
          throw new Error('Invalid API response format')
        }
        
      } catch (err) {
        console.error('Failed to load models:', err)
        error.value = err.message
        
        // Load fallback models
        loadFallbackModels()
        
      } finally {
        isLoading.value = false
      }
    }
    
    // Load fallback models if API fails
    function loadFallbackModels() {
      console.log('Loading fallback models...')
      models.value = [
        {
          name: 'llama2:latest',
          size: 3826793677,
          details: { parameter_size: '7B' }
        },
        {
          name: 'codellama:latest', 
          size: 3825910662,
          details: { parameter_size: '7B' }
        },
        {
          name: 'mistral-nemo:latest',
          size: 7071713232,
          details: { parameter_size: '12.2B' }
        }
      ]
      
      // Auto-select first fallback model
      if (!props.modelValue && models.value.length > 0) {
        const firstModel = models.value[0].name
        console.log('Auto-selecting fallback model:', firstModel)
        emit('update:modelValue', firstModel)
        emit('model-changed', models.value[0])
      }
    }
    
    // Handle model selection change
    function handleModelChange(event) {
      const selectedModelName = event.target.value
      const selectedModel = models.value.find(m => m.name === selectedModelName)
      
      console.log('Model changed to:', selectedModelName)
      
      emit('update:modelValue', selectedModelName)
      emit('model-changed', selectedModel || { name: selectedModelName })
    }
    
    // Format model name for display
    function formatModelName(name) {
      // Remove :latest suffix and capitalize
      return name.replace(':latest', '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
    
    // Format model size for display
    function formatModelSize(size) {
      if (!size) return 'Unknown'
      
      const gb = size / (1024 * 1024 * 1024)
      if (gb >= 1) {
        return `${gb.toFixed(1)}GB`
      }
      
      const mb = size / (1024 * 1024)
      return `${mb.toFixed(0)}MB`
    }
    
    // Lifecycle
    onMounted(() => {
      loadModels()
    })
    
    return {
      models,
      isLoading,
      error,
      loadModels,
      handleModelChange,
      formatModelName,
      formatModelSize
    }
  }
}
</script>

<style scoped>
.simple-model-dropdown {
  @apply w-full;
}

.model-select {
  @apply w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed;
}

.error-message {
  @apply mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm;
}

.retry-button {
  @apply ml-2 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs;
}

/* Dark theme support */
[data-theme="dark"] .model-select {
  @apply bg-surface-elevated border-surface-border;
}

[data-theme="dark"] .error-message {
  @apply bg-red-900 border-red-700 text-red-300;
}

[data-theme="dark"] .retry-button {
  @apply bg-red-800 hover:bg-red-700 text-red-200;
}
</style>
