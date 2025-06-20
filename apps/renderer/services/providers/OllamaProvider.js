/**
 * OllamaProvider - Connects to a local Ollama server.
 * Implements IAiProvider for local model completions.
 */
import { IAiProvider } from '../../types/ai-provider.d.ts'

export class OllamaProvider /** @implements {IAiProvider} */ {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl
  }

  async getAvailableModels() {
    const response = await fetch(`${this.baseUrl}/api/tags`)
    const data = await response.json()
    return (data.models || []).map(m => m.name)
  }

  async getCompletion(request) {
    const body = { model: 'llama2', prompt: request.prompt,
      options: { temperature: request.temperature ?? 0.7 },
      stream: false }
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    return { text: data.response || '' }
  }
}

export default OllamaProvider
