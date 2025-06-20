# parseReactPrompt

This utility parses prompts that follow the **ReACT** format used throughout Roadrunner. ReACT stands for *Reasoning, Execution, Action, Choice, Toolchain* and is unrelated to the React JavaScript framework. A prompt typically includes the following sections:

```
Thought: reasoning text
Action: toolName
Action Input: JSON or plain text
Observation: outcome text
Final Answer: final result (optional)
FinalAnswer: same as above (space is optional)
```

## Inputs
- **text**: `string` - raw prompt text containing ReACT markers

## Outputs
- **object** with `thought`, `action`, `actionInput`, `observation`, and
  `finalAnswer` fields

## Example
```js
import { parseReactPrompt } from '@/composables/parseReactPrompt'

const result = parseReactPrompt(`Thought: search docs\nAction: webBrowser\nAction Input: https://example.com\nObservation: page loaded\nFinal Answer: done`)
```

Result:
```
{
  thought: 'search docs',
  action: 'webBrowser',
  actionInput: 'https://example.com',
  observation: 'page loaded',
  finalAnswer: 'done'
}
```
