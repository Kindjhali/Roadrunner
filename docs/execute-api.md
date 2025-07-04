# Execute API

This document describes the `/api/execute` endpoint implemented in
`services/api/server.js`. The root `server.js` file does not provide this
route; it is part of the main API server under the `services/api` directory.

## Overview

The endpoint accepts a ReACT-formatted prompt and dispatches it to a matching
tool or agent defined in `example_agents.js`. For details on how ReACT prompts
are parsed, see [`parseReactPrompt.md`](./parseReactPrompt.md). **ReACT** stands
for *Reasoning, Execution, Action, Choice, Toolchain* and is unrelated to the
React UI framework. The backend relies on a simple regex-based parser, while the
frontend and backend share a helper located at
`services/api/utils/parseReactPrompt.js`.
`apps/renderer/composables/parseReactPrompt.js`.


## Prompt Format
The API expects prompts with the following labeled sections:

```
Thought: your reasoning
Action: toolName
Action Input: tool parameters
Observation: result text
Final Answer: optional final output
```

## Inputs
- `prompt` – full text prompt in ReACT format.
- `toolId` – optional explicit tool identifier.
- `provider` – optional model provider such as `ollama` or `openai`.


## Outputs
- `success` – boolean result flag.
- `output` – tool output text or error message.

## Example

```bash
curl -X POST http://localhost:3333/api/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Thought: say hello\nAction: echo"}'
```

## Flow
1. Parse the prompt using the ReACT format.
2. Determine the tool via `toolId` or `Action:` line.
3. Run the matching tool function.
4. Return the output as JSON.

```mermaid
graph TD;
    A[Client Request] --> B{Parse Prompt};
    B --> C{Select Tool};
    C -->|Valid| D[Execute Tool];
    D --> E[Return Result];
    C -->|Invalid| F[Return Error];
```

## Known Issues
- Only two example tools are provided (`echo` and `reverse`).
- Streaming responses are not yet supported.
