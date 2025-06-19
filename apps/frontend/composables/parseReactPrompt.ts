export interface ReactPromptParts {
  thought?: string
  action?: string
  actionInput?: string
  observation?: string
  finalAnswer?: string
}

export function parseReactPrompt(text: string): ReactPromptParts {
  const lines = text.split(/\r?\n/)
  const parts: ReactPromptParts = {}
  for (const line of lines) {
    if (line.startsWith('Thought:')) {
      parts.thought = line.replace('Thought:', '').trim()
    } else if (line.startsWith('Action:')) {
      parts.action = line.replace('Action:', '').trim()
    } else if (line.startsWith('Action Input:')) {
      parts.actionInput = line.replace('Action Input:', '').trim()
    } else if (line.startsWith('Observation:')) {
      parts.observation = line.replace('Observation:', '').trim()
    } else if (line.startsWith('Final Answer:')) {
      parts.finalAnswer = line.replace('Final Answer:', '').trim()
    }
  }
  return parts
}
