import { ref } from 'vue'
// Reuse shared ReACT parser from backend utils
import { parseReactPrompt } from '../../services/api/utils/parseReactPrompt.js'

export function useExecution() {
  const isRunning = ref(false)
  const output = ref(null)
  const error = ref(null)

  async function execute(prompt, provider, stream = false) {
    isRunning.value = true
    output.value = null
    error.value = null
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider, stream })
      })

      if (stream) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
        }
        buffer.split('\n\n').forEach(chunk => {
          const lines = chunk.split('\n').filter(l => l)
          let evt = 'message'
          let data = ''
          lines.forEach(l => {
            if (l.startsWith('event:')) evt = l.replace('event:', '').trim()
            if (l.startsWith('data:')) data += l.replace('data:', '').trim()
          })
          if (evt === 'output') {
            try { output.value = JSON.parse(data).output } catch { output.value = data }
          } else if (evt === 'error') {
            error.value = new Error(JSON.parse(data).message || data)
          }
        })
      } else {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Execution failed')
        output.value = data.output
      }
    } catch (err) {
      error.value = err
    } finally {
      isRunning.value = false
    }
  }

  return { isRunning, output, error, execute }
}
