import { ref } from 'vue'

/**
 * Load template files and inject parameter values.
 */
export function useTemplateInjection() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(name: string): Promise<string> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error('Failed to load template')
      return await res.text()
    } catch (err: any) {
      error.value = err.message
      return ''
    } finally {
      loading.value = false
    }
  }

  function inject(template: string, params: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] || '')
  }

  return { load, inject, loading, error }
}
