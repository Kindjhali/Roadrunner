import { ref, Ref } from 'vue'

export function useEditableConfig(file: Ref<string>) {
  const content = ref('')
  const valid = ref(true)
  const error = ref('')

  async function load() {
    const res = await fetch(`/api/config/${file.value}`)
    content.value = await res.text()
    validate()
  }

  function validate() {
    try {
      JSON.parse(content.value)
      valid.value = true
      error.value = ''
    } catch (e: any) {
      valid.value = false
      error.value = e.message
    }
  }

  async function save() {
    if (!valid.value) return
    await fetch(`/api/config/${file.value}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: content.value
    })
  }

  return { content, valid, error, load, save, validate }
}
