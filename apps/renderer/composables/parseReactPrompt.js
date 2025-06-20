// Parse prompts that follow the ReACT pattern used in Roadrunner.
// Note: "ReACT" here stands for Reasoning, Execution, Action, Choice, Toolchain
// and is unrelated to the React UI framework.
export function parseReactPrompt(text) {
  const parts = {
    thought: '',
    action: '',
    actionInput: '',
    observation: '',
    finalAnswer: ''
  }

  if (!text) return parts

  const lines = text.split(/\r?\n/)
  let current = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^Thought:/i.test(trimmed)) {
      current = 'thought'
      parts.thought += trimmed.replace(/^Thought:\s*/i, '') + '\n'
    } else if (/^Action:/i.test(trimmed)) {
      current = 'action'
      parts.action += trimmed.replace(/^Action:\s*/i, '') + '\n'
    } else if (/^Action Input:/i.test(trimmed)) {
      current = 'actionInput'
      parts.actionInput += trimmed.replace(/^Action Input:\s*/i, '') + '\n'
    } else if (/^Observation:/i.test(trimmed)) {
      current = 'observation'
      parts.observation += trimmed.replace(/^Observation:\s*/i, '') + '\n'
    } else if (/^Final\s*Answer:/i.test(trimmed)) {
      current = 'finalAnswer'
      parts.finalAnswer += trimmed.replace(/^Final\s*Answer:\s*/i, '') + '\n'
    } else if (current) {
      parts[current] += line + '\n'
    }
  }

  for (const key in parts) {
    parts[key] = parts[key].trim()
  }
  return parts
}
