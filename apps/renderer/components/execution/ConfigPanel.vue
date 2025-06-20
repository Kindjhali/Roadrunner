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
    <label class="flex items-center gap-2">
      <input type="checkbox" v-model="localStream" />
      Stream Output
    </label>

    <button class="run-btn" :disabled="disabled" @click="$emit('run')">
      {{ runLabel }}
    </button>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useModels } from '../../composables/useModels.js'
import ProviderDropdown from '../shared/ProviderDropdown.vue'

const props = defineProps({
  model: { type: String, default: '' },
  provider: { type: String, default: '' },
  safety: { type: Boolean, default: true },
  stream: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  runLabel: { type: String, default: 'Run' }
})

const emit = defineEmits(['update:model', 'update:provider', 'update:safety', 'update:stream', 'run'])

const { models, loadModels } = useModels()

onMounted(() => {
  loadModels()
})

const localModel = ref(props.model)
const localProvider = ref(props.provider || '')
const localSafety = ref(props.safety)
const localStream = ref(props.stream)

watch(() => props.model, val => (localModel.value = val))
watch(() => props.provider, val => (localProvider.value = val))
watch(() => props.safety, val => (localSafety.value = val))
watch(() => props.stream, val => (localStream.value = val))

watch(localModel, val => emit('update:model', val))
watch(localProvider, val => emit('update:provider', val))
watch(localSafety, val => emit('update:safety', val))
watch(localStream, val => emit('update:stream', val))
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
