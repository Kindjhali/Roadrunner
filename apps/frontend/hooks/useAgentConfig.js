import { ref } from 'vue'
import { useValidatedConfig } from '../composables/useValidatedConfig'

export function useAgentConfig() {
  const models = ref([])
  const { validate } = useValidatedConfig()

  const loadModels = async () => {
    const res = await fetch('/api/models')
    models.value = await res.json()
  }

  const loadConfig = async (file) => {
    const res = await fetch(`/api/config/${file}`)
    return res.ok ? res.json() : {}
  }

  const saveConfig = async (file, data) => {
    await fetch(`/api/config/${file}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  }

  loadModels()

  return {
    models,
    loadConfig,
    saveConfig,
    validate
  }
}
