import { parseReactPrompt as baseParse } from '../../renderer/composables/parseReactPrompt.js'

/**
 * Wrapper for parseReactPrompt to provide TypeScript typing
 * and re-export for frontend modules.
 */
export type ReactPromptParts = {
  thought: string
  action: string
  actionInput: string
  observation: string
  finalAnswer: string
}

export function parseReactPrompt(text: string): ReactPromptParts {
  return baseParse(text) as ReactPromptParts
}
