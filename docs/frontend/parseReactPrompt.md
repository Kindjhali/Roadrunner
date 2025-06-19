# parseReactPrompt Utility

This utility parses REACT-style multiline prompts.

## Example
```text
Thought: Plan next action
Action: fsTool
Action Input: {
  "path": "./example.txt"
}
Observation:
```

## Output
```json
{
  "thought": "Plan next action",
  "action": "fsTool",
  "actionInput": "{\n  \"path\": \"./example.txt\"\n}",
  "observation": ""
}
```
