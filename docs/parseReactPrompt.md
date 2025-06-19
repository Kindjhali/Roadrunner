# parseReactPrompt

This utility parses prompts that follow the ReACT format used throughout Roadrunner. A prompt typically includes the following sections:

```
Thought: reasoning text
Action: toolName
Action Input: JSON or plain text
Observation: outcome text
```

## Inputs
- **text**: `string` - raw prompt text containing ReACT markers

## Outputs
- **object** with `thought`, `action`, `actionInput`, and `observation` fields

## Example
```js
import { parseReactPrompt } from '@/composables/parseReactPrompt'

const result = parseReactPrompt(`Thought: search docs\nAction: webBrowser\nAction Input: https://example.com\nObservation: page loaded`)
```

Result:
```
{
  thought: 'search docs',
  action: 'webBrowser',
  actionInput: 'https://example.com',
  observation: 'page loaded'
}
```
