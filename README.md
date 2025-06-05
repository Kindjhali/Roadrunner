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
- **Markdown-driven**: Tasks can be defined in markdown files (e.g., `.steps.md` or custom task files) and are processed by the execution engine.
- **Executable**: Tasks can include file creation, code generation, shell commands, or AI prompts
- **Modular**: Frontend and backend are separated and extendable
- **Agent Personalization**: Customize the AI's behavior, communication style, and operational preferences via the `agent-profile.md` file located in the root directory. This profile is processed by the agent before task execution.

---

## 🧩 Core Components

### `runner.js`
- Main application logic for the Electron app is in `electron.js` and `roadrunner.js`. The backend server (`server.js`) handles task processing and LLM interactions.

### `roadrunner_ui`
- The user interface is a Vue.js application within the `frontend/` directory, providing a tabbed interface (Coder, Brainstorming) for task management, execution, and chat.

### `backend/`
- Contains logic for executing shell commands, modifying files, interacting with local models (e.g. via Ollama)

### `frontend/`
- Interface code for displaying input forms, execution logs, and step controls
- All component styles live in `frontend/src/styles/`; Vue files contain no `<style>` blocks.

### `logs/`
- Stores detailed execution logs for each task run. Logs are saved as markdown files in the format `logs/task-YYYY-MM-DDTHH-MM-SS-MSZ.log.md`.

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
Each task execution is logged in detail to a markdown file in the `logs/` directory, typically named like `task-YYYY-MM-DDTHH-MM-SS-MSZ.log.md`.

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

## 🛠️ Development Plan and Progress

The detailed development plan, ongoing tasks, and history of completed work are maintained in the [roadrunner.steps.md](./roadrunner.steps.md) file. This document provides the most up-to-date information on the project's status and future direction.

### Potential Future Enhancements
- AI model integration (Ollama, GPT via local proxy)
- File diff viewer
- Step editor UI
- Roadmap generator (from project folders)

## ⏳ Partially Implemented Features

### Multi-Model Conferencing Protocol
A backend API endpoint (`POST /execute-conference-task`) is available for a multi-model conferencing feature, allowing different LLMs to respond to a prompt and a third to arbitrate. Frontend integration for this feature is pending. For more conceptual details, see the [roadrunner.model_conference.md](./roadrunner.model_conference.md) document.
---

Roadrunner is a **decisive, agentic decision layer**. It is intended for multi-model coordination, arbitration, and logical refinement of actions or outputs from distributed reasoning systems. No dependency. No noise. Just reasoned resolution.
