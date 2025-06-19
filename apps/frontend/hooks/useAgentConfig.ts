import { ref } from 'vue'
import { validateConfig } from '../composables/useValidatedConfig'

export function useAgentConfig(url: string) {
  const config = ref<any>(null)
  const valid = ref(true)
  const errors = ref<string[]>([])

  async function load() {
    const res = await fetch(url)
    config.value = await res.json()
    validate()
  }

  function validate() {
    const result = validateConfig(config.value)
    valid.value = result.valid
    errors.value = result.errors
  }

  async function save() {
    if (!valid.value) return
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value)
    })
  }

  return { config, valid, errors, load, save, validate }
}
