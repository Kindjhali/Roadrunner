/**
 * OpenAiProvider - Connects to OpenAI API.
 *
 * This class implements the IAiProvider interface from types/ai-provider.d.ts.
 * Logic is intentionally minimal to satisfy AGENTS.md modularity rules.
 */
import { IAiProvider } from '../../types/ai-provider.d.ts'

export class OpenAiProvider /** @implements {IAiProvider} */ {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.baseUrl = 'https://api.openai.com/v1'
  }

  async getAvailableModels() {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    const data = await response.json()
    return (data.data || []).map(m => m.id)
  }

  async getCompletion(request) {
    const body = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: request.prompt }],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 256
    }
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    return { text: data.choices?.[0]?.message?.content || '' }
  }
}

export default OpenAiProvider
