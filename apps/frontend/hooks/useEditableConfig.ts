import { ref, Ref } from 'vue'

export function useEditableConfig(file: Ref<string>) {
  const content = ref('')
  const valid = ref(true)

  async function load() {
    const res = await fetch(`/api/config/${file.value}`)
    content.value = await res.text()
    validate()
  }

  function validate() {
    try {
      JSON.parse(content.value)
      valid.value = true
    } catch {
      valid.value = false
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

  return { content, valid, load, save, validate }
}
