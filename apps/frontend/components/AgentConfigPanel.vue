<template>
  <div>
    <div v-if="config">
      <div v-for="(value, key) in config" :key="key" class="mb-2">
        <label class="block text-sm">{{ key }}</label>
        <input v-model="config[key]" class="w-full p-1 bg-surface-card text-primary" />
      </div>
      <button :disabled="!valid" @click="save" class="px-3 py-1 bg-primary text-white">Save</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAgentConfig } from '../hooks/useAgentConfig'

const { config, valid, load, save } = useAgentConfig('/api/config/agent_instructions_template.json')

onMounted(load)
</script>
