<template>
  <div class="step-properties">
    <div v-if="!step" class="no-step">
      <Icon name="corvidae-code" size="lg" class="text-gray-400" />
      <p class="text-gray-500">Select a step to edit properties</p>
    </div>
    
    <div v-else class="step-form">
      <!-- Step Header -->
      <div class="step-header">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Step Properties
        </h3>
        <BaseButton
          variant="ghost"
          size="sm"
          icon="fi-ss-cross"
          @click="closeProperties"
        />
      </div>

      <!-- Basic Properties -->
      <div class="property-section">
        <h4 class="section-title">Basic Information</h4>
        
        <div class="form-group">
          <label class="form-label">Step Name</label>
          <input
            v-model="localStep.name"
            type="text"
            class="form-input"
            placeholder="Enter step name"
            @input="updateStep"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea
            v-model="localStep.description"
            class="form-textarea"
            rows="3"
            placeholder="Describe what this step does"
            @input="updateStep"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Step Type</label>
          <select
            v-model="localStep.type"
            class="form-select"
            @change="updateStep"
          >
            <option value="code">Code Generation</option>
            <option value="file">File Operation</option>
            <option value="api">API Call</option>
            <option value="validation">Validation</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <!-- Configuration -->
      <div class="property-section">
        <h4 class="section-title">Configuration</h4>
        
        <div class="form-group">
          <label class="form-label">Template</label>
          <select
            v-model="localStep.template"
            class="form-select"
            @change="updateStep"
          >
            <option value="">Select template</option>
            <option value="component">Vue Component</option>
            <option value="service">Service Class</option>
            <option value="utility">Utility Function</option>
            <option value="test">Test File</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Output Path</label>
          <input
            v-model="localStep.outputPath"
            type="text"
            class="form-input"
            placeholder="src/components/MyComponent.vue"
            @input="updateStep"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Dependencies</label>
          <div class="dependency-list">
            <div
              v-for="(dep, index) in localStep.dependencies"
              :key="index"
              class="dependency-item"
            >
              <input
                v-model="localStep.dependencies[index]"
                type="text"
                class="form-input"
                placeholder="Dependency name"
                @input="updateStep"
              />
              <button
                @click="removeDependency(index)"
                class="remove-button"
              >
                <Icon name="fi-ss-cross" size="sm" />
              </button>
            </div>
            <button
              @click="addDependency"
              class="add-button"
            >
              <Icon name="fi-ss-plus" size="sm" />
              Add Dependency
            </button>
          </div>
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="property-section">
        <h4 class="section-title">Advanced Settings</h4>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="localStep.async"
              type="checkbox"
              class="form-checkbox"
              @change="updateStep"
            />
            <span>Asynchronous execution</span>
          </label>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="localStep.optional"
              type="checkbox"
              class="form-checkbox"
              @change="updateStep"
            />
            <span>Optional step</span>
          </label>
        </div>
        
        <div class="form-group">
          <label class="form-label">Timeout (seconds)</label>
          <input
            v-model.number="localStep.timeout"
            type="number"
            class="form-input"
            min="1"
            max="3600"
            @input="updateStep"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">Retry Count</label>
          <input
            v-model.number="localStep.retryCount"
            type="number"
            class="form-input"
            min="0"
            max="10"
            @input="updateStep"
          />
        </div>
      </div>

      <!-- Custom Parameters -->
      <div class="property-section">
        <h4 class="section-title">Custom Parameters</h4>
        
        <div class="parameter-list">
          <div
            v-for="(param, key) in localStep.parameters"
            :key="key"
            class="parameter-item"
          >
            <input
              :value="key"
              type="text"
              class="form-input"
              placeholder="Parameter name"
              @input="updateParameterKey($event, key)"
            />
            <input
              v-model="localStep.parameters[key]"
              type="text"
              class="form-input"
              placeholder="Parameter value"
              @input="updateStep"
            />
            <button
              @click="removeParameter(key)"
              class="remove-button"
            >
              <Icon name="fi-ss-cross" size="sm" />
            </button>
          </div>
          <button
            @click="addParameter"
            class="add-button"
          >
            <Icon name="fi-ss-plus" size="sm" />
            Add Parameter
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="step-actions">
        <BaseButton
          variant="primary"
          @click="saveStep"
        >
          Save Changes
        </BaseButton>
        
        <BaseButton
          variant="outline"
          @click="resetStep"
        >
          Reset
        </BaseButton>
        
        <BaseButton
          variant="ghost"
          @click="deleteStep"
          class="text-red-600 hover:text-red-700"
        >
          Delete Step
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, watch } from 'vue'
import Icon from '../shared/Icon.vue'
import BaseButton from '../shared/BaseButton.vue'

export default {
  name: 'StepProperties',
  
  components: {
    Icon,
    BaseButton
  },
  
  props: {
    step: {
      type: Object,
      default: null
    }
  },
  
  emits: ['update', 'close', 'delete'],
  
  setup(props, { emit }) {
    // Local step state
    const localStep = reactive({
      name: '',
      description: '',
      type: 'code',
      template: '',
      outputPath: '',
      dependencies: [],
      async: false,
      optional: false,
      timeout: 30,
      retryCount: 0,
      parameters: {}
    })
    
    // Watch for prop changes
    watch(() => props.step, (newStep) => {
      if (newStep) {
        Object.assign(localStep, {
          name: newStep.name || '',
          description: newStep.description || '',
          type: newStep.type || 'code',
          template: newStep.template || '',
          outputPath: newStep.outputPath || '',
          dependencies: newStep.dependencies || [],
          async: newStep.async || false,
          optional: newStep.optional || false,
          timeout: newStep.timeout || 30,
          retryCount: newStep.retryCount || 0,
          parameters: newStep.parameters || {}
        })
      }
    }, { immediate: true })
    
    // Event handlers
    const updateStep = () => {
      emit('update', { ...localStep })
    }
    
    const closeProperties = () => {
      emit('close')
    }
    
    const saveStep = () => {
      emit('update', { ...localStep })
      // Could show a success message here
    }
    
    const resetStep = () => {
      if (props.step) {
        Object.assign(localStep, props.step)
      }
    }
    
    const deleteStep = () => {
      if (confirm('Are you sure you want to delete this step?')) {
        emit('delete', props.step.id)
      }
    }
    
    // Dependency management
    const addDependency = () => {
      localStep.dependencies.push('')
      updateStep()
    }
    
    const removeDependency = (index) => {
      localStep.dependencies.splice(index, 1)
      updateStep()
    }
    
    // Parameter management
    const addParameter = () => {
      const key = `param${Object.keys(localStep.parameters).length + 1}`
      localStep.parameters[key] = ''
      updateStep()
    }
    
    const removeParameter = (key) => {
      delete localStep.parameters[key]
      updateStep()
    }
    
    const updateParameterKey = (event, oldKey) => {
      const newKey = event.target.value
      if (newKey && newKey !== oldKey) {
        const value = localStep.parameters[oldKey]
        delete localStep.parameters[oldKey]
        localStep.parameters[newKey] = value
        updateStep()
      }
    }
    
    return {
      localStep,
      updateStep,
      closeProperties,
      saveStep,
      resetStep,
      deleteStep,
      addDependency,
      removeDependency,
      addParameter,
      removeParameter,
      updateParameterKey
    }
  }
}
</script>

<style scoped>
.step-properties {
  @apply h-full flex flex-col;
}

.no-step {
  @apply flex-1 flex flex-col items-center justify-center space-y-3;
}

.step-form {
  @apply space-y-6 p-4;
}

.step-header {
  @apply flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700;
}

.property-section {
  @apply space-y-4;
}

.section-title {
  @apply text-sm font-medium text-gray-900 dark:text-white;
}

.form-group {
  @apply space-y-2;
}

.form-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.form-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.form-textarea {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
  resize: vertical;
}

.form-select {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.form-checkbox {
  @apply rounded border-gray-300 dark:border-gray-600 text-blue-600;
  @apply focus:ring-blue-500 dark:focus:ring-blue-600;
}

.checkbox-label {
  @apply flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300;
}

.dependency-list,
.parameter-list {
  @apply space-y-2;
}

.dependency-item,
.parameter-item {
  @apply flex gap-2 items-center;
}

.remove-button {
  @apply p-1 text-gray-400 hover:text-red-500 transition-colors;
}

.add-button {
  @apply flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700;
  @apply border border-dashed border-blue-300 rounded-md hover:border-blue-400;
  @apply transition-colors;
}

.step-actions {
  @apply flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700;
}
</style>
