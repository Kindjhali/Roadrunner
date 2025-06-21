import { ref } from 'vue'

export function useProviders() {
  const providers = ref([])
  const error = ref(null)

  async function loadProviders() {
    try {
      const res = await fetch('/api/providers')
      if (!res.ok) throw new Error('Failed to load providers')
      providers.value = await res.json()
    } catch (err) {
      error.value = err
    }
  }

  return { providers, error, loadProviders }
}
