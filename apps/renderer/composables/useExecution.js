import { ref } from 'vue'

export function useExecution() {
  const isRunning = ref(false)
  const output = ref(null)
  const error = ref(null)

  async function execute(prompt) {
    isRunning.value = true
    output.value = null
    error.value = null
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Execution failed')
      output.value = data.output
    } catch (err) {
      error.value = err
    } finally {
      isRunning.value = false
    }
  }

  return { isRunning, output, error, execute }
}
