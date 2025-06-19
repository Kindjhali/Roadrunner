import { ref } from 'vue'

export function useModels() {
  const models = ref([])
  const error = ref(null)

  async function loadModels() {
    try {
      const res = await fetch('/api/models')
      if (!res.ok) throw new Error('Failed to load models')
      models.value = await res.json()
    } catch (err) {
      error.value = err
    }
  }

  return { models, error, loadModels }
}
