import { ref, onBeforeUnmount } from 'vue'

/**
 * Connect to /api/logs and emit log lines in real time.
 */
export function useRealtimeLogStream() {
  const lines = ref<string[]>([])
  const error = ref<string | null>(null)
  let source: EventSource | null = null

  function start() {
    if (source) return
    source = new EventSource('/api/logs')
    source.onmessage = e => {
      try {
        const data = JSON.parse(e.data)
        lines.value.push(`[${data.file}] ${data.line}`)
      } catch (err: any) {
        error.value = err.message
      }
    }
    source.onerror = err => {
      error.value = 'Connection lost'
      source?.close()
      source = null
    }
  }

  function stop() {
    source?.close()
    source = null
  }

  onBeforeUnmount(stop)

  return { lines, error, start, stop }
}
