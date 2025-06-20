/**
 * AiFactory - Returns an IAiProvider based on current settings.
 */
import { useSettingsStore } from '../stores/settingsStore.js'
import OpenAiProvider from './providers/OpenAiProvider.js'
import OllamaProvider from './providers/OllamaProvider.js'

/**
 * Return provider instance derived from persisted settings.
 */
export function createAiProvider() {
  const settings = useSettingsStore()
  const provider = settings.general?.aiProvider || 'ollama'

  switch (provider) {
    case 'openai':
      if (!settings.general?.openaiApiKey) throw new Error('OpenAI API key missing')
      return new OpenAiProvider(settings.general.openaiApiKey)
    case 'ollama':
    default:
      return new OllamaProvider(settings.general?.ollamaUrl)
  }
}
