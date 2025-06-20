import { ref } from 'vue'
// Reuse shared ReACT parser from backend utils
import { parseReactPrompt } from '../../services/api/utils/parseReactPrompt.js'

export function useExecution() {
  const isRunning = ref(false)
  const output = ref(null)
  const error = ref(null)

  async function execute(prompt, provider) {
    isRunning.value = true
    output.value = null
    error.value = null
    try {
      const parsed = parseReactPrompt(prompt)
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, parsed, provider })
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
