import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useLogs() {
  const logs = ref<string[]>([])
  const paused = ref(false)
  let es: EventSource | null = null

  function clear() {
    logs.value = []
  }
  function pause(value: boolean) {
    paused.value = value
  }

  onMounted(() => {
    es = new EventSource('/api/logs')
    es.onmessage = (e) => {
      if (!paused.value) {
        logs.value.push(e.data)
      }
    }
  })

  onBeforeUnmount(() => {
    es?.close()
  })

  return { logs, clear, pause, paused }
}
