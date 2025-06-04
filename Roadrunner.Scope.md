# 🏁 Roadrunner Project Scope

## 🎯 Summary
Roadrunner is a standalone, local-first desktop automation tool. It reads markdown-based task plans and executes them step-by-step using AI or script logic. It is designed for indie developers, tinkerers, and non-coders who work outside rigid Git/devops pipelines but still want structured, reproducible workflows.

---

## 🧠 Core Concepts
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
- Stores execution logs for traceability and debugging

### `Roadmaps/`
- Predefined `.roadmap.md` files for common tasks (e.g. scaffold Vue app, write README, refactor files)

### `output/`
- Directory for generated files and results

---

## 🧰 Supported Task Types (Markdown Step Blocks)
- `# Create` — make files/folders with boilerplate
- `# Modify` — edit config/code
- `# Prompt` — send structured prompt to AI
- `# Shell` — run safe shell commands
- `# Extract` — copy information from files or folders

---

## 🔐 Optional Enhancements
- AI model integration (Ollama, GPT via local proxy)
- File diff viewer
- Step editor UI
- Roadmap generator (from project folders)

---

## 📦 Packaging
- Delivered as a standalone Electron app
- Requires Node.js + npm to build, no server required
- Optional model downloads handled via script or Ollama CLI

---

## 🧩 Ideal Use Cases
- Indie devs prototyping fast
- Script-light automation workflows
- Developers tired of repeating boilerplate tasks manually
- Users who prefer plain-text tooling over cloud dashboards
