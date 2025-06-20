import { ref } from 'vue'

export function useModels() {
  const models = ref([])
  const error = ref(null)

  async function loadModels() {
    try {
      const res = await fetch('/api/models')
      if (!res.ok) throw new Error('Failed to load models')
      const data = await res.json()
      if (Array.isArray(data)) {
        models.value = data
      } else if (Array.isArray(data.models)) {
        models.value = data.models
      } else {
        models.value = []
      }
    } catch (err) {
      error.value = err
    }
  }

  return { models, error, loadModels }
}
