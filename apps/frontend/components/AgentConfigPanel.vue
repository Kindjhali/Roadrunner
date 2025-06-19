<template>
  <div class="p-4 space-y-4">
    <div v-for="field in fields" :key="field.key" class="flex flex-col">
      <label class="font-semibold mb-1">{{ field.label }}</label>
      <input
        v-if="field.type === 'text'"
        v-model="localConfig[field.key]"
        class="input"
        type="text"
      />
      <textarea
        v-else-if="field.type === 'textarea'"
        v-model="localConfig[field.key]"
        class="textarea"
      />
      <select
        v-else-if="field.type === 'select'"
        v-model="localConfig[field.key]"
        class="select"
      >
        <option v-for="m in models" :key="m.identifier" :value="m.identifier">
          {{ m.name }}
        </option>
      </select>
    </div>
    <div class="flex gap-2">
      <button @click="save" :disabled="!isValid" class="btn-primary">Save</button>
      <button @click="reset" class="btn-secondary">Reset</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAgentConfig } from '../hooks/useAgentConfig'

const { loadConfig, validate, saveConfig, models } = useAgentConfig()
const localConfig = reactive({})
const fields = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'model', label: 'Model', type: 'select' },
  { key: 'description', label: 'Description', type: 'textarea' }
]
const isValid = ref(true)

const load = async () => {
  const cfg = await loadConfig('agent_instructions_template.json')
  Object.assign(localConfig, cfg)
  isValid.value = validate(cfg)
}

const save = async () => {
  if (!validate(localConfig)) return
  await saveConfig('agent_instructions_template.json', localConfig)
}

const reset = () => load()

onMounted(load)
</script>

<style scoped>
.input, .textarea, .select {
  @apply border rounded p-2 bg-gray-800 text-white;
}
.btn-primary {
  @apply bg-orange-600 text-white px-4 py-2 rounded;
}
.btn-secondary {
  @apply bg-gray-600 text-white px-4 py-2 rounded;
}
</style>
