<template>
  <div>
    <div v-if="config">
      <div v-for="(value, key) in config" :key="key" class="mb-2">
        <label class="block text-sm mb-1">{{ key }}</label>
        <select v-if="key === 'model'" v-model="config[key]" class="w-full p-1 bg-surface-card text-primary">
          <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
        </select>
        <textarea v-else-if="Array.isArray(value)" v-model="arrayString[key]" @input="updateArray(key)" class="w-full p-1 bg-surface-card text-primary" />
        <input v-else v-model="config[key]" class="w-full p-1 bg-surface-card text-primary" />
      </div>
      <button :disabled="!valid" @click="save" class="px-3 py-1 bg-primary text-white">Save</button>
      <div v-if="!valid" class="text-error text-sm mt-1">Invalid configuration</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useAgentConfig } from '../hooks/useAgentConfig'

const { config, valid, load, save, validate } = useAgentConfig('/api/config/agent_instructions_template.json')
const models = ref<string[]>([])
const arrayString = reactive<Record<string, string>>({})

onMounted(async () => {
  await load()
  const res = await fetch('/api/models')
  models.value = await res.json()
  initArrayStrings()
})

watch(config, () => {
  validate()
})

function initArrayStrings() {
  if (!config.value) return
  Object.keys(config.value).forEach(k => {
    if (Array.isArray(config.value[k])) {
      arrayString[k] = (config.value[k] as unknown[]).join(', ')
    }
  })
}

function updateArray(key: string) {
  config.value[key] = arrayString[key].split(',').map(s => s.trim())
  validate()
}
</script>
