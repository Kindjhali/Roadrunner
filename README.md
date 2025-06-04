# 🏃 Roadrunner – Agentic Arbitration Engine

## ❗ Independence Notice

Roadrunner is a **standalone multi-model deliberation system**. It is not embedded within or dependent on any larger agent framework. It provides **modular, agentic arbitration** by evaluating multiple inputs from various logic or model sources and producing a unified resolution.

---

## 🎯 Overview

Roadrunner is a **lightweight agentic deliberation engine** and a **standalone, local-first desktop automation tool**. It reads markdown-based task plans and executes them step-by-step using AI or script logic. When multiple agents or logic modules receive the same input, Roadrunner:

* Gathers their proposals
* Evaluates confidence, context, and logic flags
* Optionally applies inter-agent influence or synthesis
* Selects or constructs the most suitable action

This is not a passive ranking system. It is built to support **multi-agent reasoning**, conditional vetoes, preference rules, and arbitration logic.
It is designed for indie developers, tinkerers, and non-coders who work outside rigid Git/devops pipelines but still want structured, reproducible workflows.

---

## 💡 Core Concepts
- **Local-first**: No cloud sync or dependency by default
- **Markdown-driven**: All tasks are declared in `.steps.md` or `.roadmap.md` files
- **Executable**: Tasks can include file creation, code generation, shell commands, or AI prompts
- **Modular**: Frontend and backend are separated and extendable

---

## 🧩 Core Components

### `runner.js`
- The main task executor
- Reads markdown task files, parses steps, triggers logic
- Supports local scripting and AI-assisted operations

### `roadrunner_ui`
- Electron-based interface
- Accepts markdown task file input
- Displays logs, output results, and execution status

### `backend/`
- Contains logic for executing shell commands, modifying files, interacting with local models (e.g. via Ollama)

### `frontend/`
- Interface code for displaying input forms, execution logs, and step controls

### `logs/`
- Stores execution logs for traceability and debugging (Note: existing README mentions `/logs/roadrunner/YYYY-MM-DD_HHMMSS.json`)

### `Roadmaps/`
- Predefined `.roadmap.md` files for common tasks (e.g. scaffold Vue app, write README, refactor files)

### `output/`
- Directory for generated files and results

---

## ⚙️ Core Function

```
INPUT → Multiple Agent Responses
           ↓
   Roadrunner evaluates, compares, or synthesises
           ↓
       Outputs unified or best decision
```

---

## 🧠 Agent Model

* Agents are **independent logic modules or subsystems**.
* Each receives identical context/input and returns a proposal.
* Roadrunner performs:

  * Confidence filtering
  * Conflict resolution
  * Optional synthesis (averaging, summarisation, fallback)

Agent responses follow this format:

```json
{
  "agent": "[string: unique name]",
  "proposal": "[string: proposed action]",
  "confidence": 0.0 - 1.0,
  "flags": [optional list of string markers]
}
```

---

## 🧪 Process Flow

```
1. Input event or user prompt is captured.
2. All registered agents receive input context.
3. Agents respond with structured proposals.
4. Roadrunner evaluates:
   - Confidence scores
   - Flag markers (e.g. veto, urgent)
   - Agent reliability (optional)
5. Resolution:
   - Select highest-confidence
   - Combine if compatible
   - Trigger fallback if no valid results
```

---

## 🗞️ Sample Output

```json
{
  "input": "Summarise today's meeting notes",
  "responses": [
    {
      "agent": "Blackbird",
      "proposal": "Rephrase notes into plain English summary",
      "confidence": 0.82
    },
    {
      "agent": "Snapdragon",
      "proposal": "Tag all entries with #today and archive",
      "confidence": 0.76
    }
  ],
  "selected": "Rephrase notes into plain English summary",
  "justification": "Higher confidence, no conflicts"
}
```

---

## 🧰 Supported Task Types (Markdown Step Blocks)
- `# Create` — make files/folders with boilerplate
- `# Modify` — edit config/code
- `# Prompt` — send structured prompt to AI
- `# Shell` — run safe shell commands
- `# Extract` — copy information from files or folders

---

## 📦 Packaging
- Delivered as a standalone Electron app
- Requires Node.js + npm to build, no server required
- Optional model downloads handled via script or Ollama CLI

---

## 🎯 Ideal Use Cases
- Indie devs prototyping fast
- Script-light automation workflows
- Developers tired of repeating boilerplate tasks manually
- Users who prefer plain-text tooling over cloud dashboards

---

## 📁 Logs

Stored at:

```
/logs/roadrunner/YYYY-MM-DD_HHMMSS.json
```

Includes:

* Input content
* All agent responses
* Evaluation reasoning
* Chosen output

---

## 🧱 Constraints

* Maximum number of agents: configurable (default: 5)
* No external memory or recursion loops
* No required inter-agent communication (can be passive)
* All logic is local and stateless per request

---

# 📅 Implementation Steps

## Phase 1: Foundation

1. Create `roadrunner.js` as a standalone arbitration module.
2. Define `registerAgentResponse(inputID, agentID, proposal, confidence, flags)`.
3. Define `evaluateResponses(inputID)` to select outcome.
4. Write results and decision chain to `/logs/roadrunner/`.

## Phase 2: Agent Integration

5. Enable API, CLI, or socket interface for external agent modules.
6. Add timeout or max-wait mechanism for agent responses.

## Phase 3: Visualisation (Optional)

7. Create a log viewer panel or CLI output renderer.
8. Allow override and replay of past decisions.

## Phase 4: Optimisation

9. Add throttling to avoid redundant re-evaluation.
10. Weight agents dynamically based on performance metrics.
11. Add internal fallback agent if no valid answers are returned.

### Potential Future Enhancements
- AI model integration (Ollama, GPT via local proxy)
- File diff viewer
- Step editor UI
- Roadmap generator (from project folders)

---

Roadrunner is a **decisive, agentic decision layer**. It is intended for multi-model coordination, arbitration, and logical refinement of actions or outputs from distributed reasoning systems. No dependency. No noise. Just reasoned resolution.
