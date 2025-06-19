import { ref } from 'vue'

export function usePromptExecutor() {
  const output = ref('')
  const loading = ref(false)

  async function executePrompt(prompt: string) {
    loading.value = true
    output.value = ''
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      if (!response.body) {
        output.value = await response.text()
      } else {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          output.value += decoder.decode(value, { stream: true })
        }
      }
    } finally {
      loading.value = false
    }
  }

  return { output, loading, executePrompt }
}
