<template>
  <div class="config-panel">
    <ProviderDropdown v-model="localProvider" />
    <select v-model="localModel" class="model-select">
      <option disabled value="">Select model</option>
      <option v-for="m in models" :key="m.identifier" :value="m.identifier">
        {{ m.name }}
      </option>
    </select>

    <label class="flex items-center gap-2">
      <input type="checkbox" v-model="localSafety" />
      Safety Mode
    </label>

    <button class="run-btn" :disabled="disabled" @click="$emit('run')">
      {{ runLabel }}
    </button>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useModels } from '../../composables/useModels.js'
import { useProviders } from '../../composables/useProviders.js'
import ProviderDropdown from '../shared/ProviderDropdown.vue'

const props = defineProps({
  model: { type: String, default: '' },
  safety: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  runLabel: { type: String, default: 'Run' }
})

const emit = defineEmits(['update:model', 'update:provider', 'update:safety', 'run'])

const { models, loadModels } = useModels()
const { providers, loadProviders } = useProviders()

onMounted(() => {
  loadModels()
  loadProviders()
})

const localModel = ref(props.model)
const localProvider = ref(props.provider || '')
const localSafety = ref(props.safety)

watch(() => props.model, val => (localModel.value = val))
watch(() => props.provider, val => (localProvider.value = val))
watch(() => props.safety, val => (localSafety.value = val))

watch(localModel, val => emit('update:model', val))
watch(localProvider, val => emit('update:provider', val))
watch(localSafety, val => emit('update:safety', val))
</script>

<style scoped>
.config-panel {
  @apply flex items-center gap-4 mb-4;
}
.model-select {
  @apply px-2 py-1 bg-surface-elevated border border-border rounded text-primary;
}
.provider-select {
  @apply px-2 py-1 bg-surface-elevated border border-border rounded text-primary;
}
.run-btn {
  @apply px-4 py-2 bg-primary text-surface rounded hover:bg-primary-light disabled:opacity-50;
}
</style>
