import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useRealtimeLogStream(url = '/api/logs') {
  const messages = ref<string[]>([])
  let es: EventSource | null = null

  onMounted(() => {
    es = new EventSource(url)
    es.onmessage = (e) => {
      messages.value.push(e.data)
    }
  })

  onBeforeUnmount(() => {
    es?.close()
  })

  return { messages }
}
