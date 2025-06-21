<template>
  <div class="provider-dropdown">
    <select
      :value="modelValue"
      @change="handleChange"
      class="provider-select"
      :disabled="isLoading"
    >
      <option value="">{{ isLoading ? 'Loading providers...' : 'Select provider...' }}</option>
      <option v-for="p in providers" :key="p" :value="p">
        {{ formatProviderName(p) }}
      </option>
    </select>
    <div v-if="error" class="error-message">
      Failed to load providers: {{ error.message || error }}
      <button @click="loadProviders" class="retry-button">Retry</button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useProviders } from '../../composables/useProviders.js'
export default {
  name: 'ProviderDropdown',
  props: {
    modelValue: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'provider-changed'],
  setup(props, { emit }) {
    const { providers, error, loadProviders } = useProviders()
    const isLoading = ref(false)

    async function init() {
      isLoading.value = true
      await loadProviders()
      isLoading.value = false
      if (!props.modelValue && providers.value.length > 0) {
        emit('update:modelValue', providers.value[0])
        emit('provider-changed', providers.value[0])
      }
    }

    function handleChange(e) {
      const val = e.target.value
      emit('update:modelValue', val)
      emit('provider-changed', val)
    }

    function formatProviderName(name) {
      return name.charAt(0).toUpperCase() + name.slice(1)
    }

    onMounted(init)
    return { providers, isLoading, error, loadProviders: init, handleChange, formatProviderName }
  }
}
</script>

<style scoped>
.provider-select {
  @apply w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none;
}
.error-message {
  @apply mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm;
}
.retry-button {
  @apply ml-2 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs;
}
</style>
