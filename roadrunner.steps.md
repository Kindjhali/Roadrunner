# Roadrunner Implementation Checklist

> Implementation steps for Roadrunner Autonomous AI Agent (TokomakAI v1.2.0+). Vision: A self-operating local agent that interprets natural language tasks and performs system-level operations using LLMs.

---

## 1. Foundation & UI
- [x] Scaffold Electron + Vue 3 + Vite application with Tailwind CSS
- [x] Apply Neo Art Deco 2132 style system and font-ui-strange
- [x] Create UI input fields for task goal and step list
- [x] Add "Execute Autonomous Task" button
- [x] Build log output panel for execution results

## 2. Backend & LLM Interface
- [x] Create Express endpoint `/execute-autonomous-task` supporting POST and SSE
- [x] Accept JSON `{ task_description: string, steps: object[] }`
- [x] Connect to Ollama with OpenAI fallback
- [x] Parse `agent-profile.md` to shape prompts
- [x] Process steps through the LLM and stream results to the UI

## 3. Task Execution & Safety
- [x] Parse steps into commands (`generic_step`, `create_file_with_llm_content`, `git_operation`)
- [x] Implement file generation using LLM output
- [x] Support step chaining via `{{outputs.var}}` templating
- [x] Enforce path traversal guardrails and destructive step warnings
- [x] Confirmation system integrated with Safety Mode

## 4. Filesystem Operations
- [ ] Allow user selection/confirmation of the workspace directory
- [x] Create `fsAgent.js` to manage filesystem commands
- [x] Implement safe file and directory operations with path validation
- [x] Provide directory tree preview via `show_workspace_tree`

## 5. Git Integration
- [x] Implement `git_operation` step for add/commit/push/pull
  - [x] Auto-stage changes for `git add`
  - [x] Generate commit messages
  - [x] Optional push to remote
- [x] Stream Git logs to the frontend
- [x] Require confirmation for Git operations in Safety Mode
- [x] Support `revert_last_commit` with UI control

## 6. Autonomous Agent & Coder Tab
### General Capabilities
- [ ] UI checkbox for autonomous mode to generate steps automatically
- [ ] Loop execution or iterative refinement of tasks
- [ ] LLM-based result evaluation and re-prompting
- [ ] Plan validation before execution

### "Coder" Tab
- [ ] Advanced Sniper document parsing
- [ ] Module scaffolding and code generation
- [ ] UI element generation for UI modules
- [ ] Automated documentation for new modules
- [ ] UI to manage the autonomous coding process and generated files

## 7. Error Handling & Fallbacks
- [x] Wrap file and Git commands in try/catch blocks with logs
- [x] Auto-backup files before changes (`.bak`)
- [x] Display errors in red with hover details via SSE
- [ ] Offer retry options or manual mode on failure

## 8. Multi-Model Integration
- [ ] OpenAI API toggle with key entry via Owlcore
- [ ] Model switch UI (e.g., `mistral`, `codellama`, custom)
- [ ] Route task types to different models

## 9. Advanced UX & Feature Layer
- [ ] User settings/preferences panel
  - Default workspace path
  - UI theme preferences
  - Primary model preferences
  - API key storage/management
- [ ] Task history with save/load per session
- [ ] Copy/export task result logs
- [ ] User annotations on each step
- [ ] Summary success/failure statistics per task
- [ ] Tab-specific model filtering (`/api/ollama-models/categorized`)
- [x] Direct Ollama model downloading with SSE progress

## 10. Brainstorming Tab Enhancements
- [ ] Integrate remote AI APIs for chat
- [ ] Allow contextual file or image uploads in chat
- [ ] Save and load chat conversations
- [ ] Stream responses for local and remote models
- [x] Remove inline CSS from Vue components; use `src/styles/roadrunner.css`
- [x] Add conversation serializer module for chat history

## 11. Documentation & Metadata
- [x] Update README with current features
- [x] Store each task execution as a `.log.md` file in `roadrunner/logs/`
- [x] Remove deprecated `roadrunner.roadmap.md` file

## 12. `taskAgent` Decision Support Integration
- [ ] Endpoint `/api/request-decision-pathway` for proposals from `taskAgent`
- [ ] Implement decision logic using available Tokomak modules
- [ ] Return structured pathway proposal to `ActionResolver`
- [ ] Robust logging and clear error responses
- [ ] Store renderer logs in the OS temporary directory

## Status
- [x] UI and LLM connectivity working
- [x] Filesystem execution & interactive safety confirmation active
- [x] Git automation operational
- [x] Step chaining & templating available
- [ ] Autonomous loop logic (early prototyping)

Target Version: **v1.3.0**
- Added terminal-style conference log display per model in ConferenceTab
- [x] Added SVG icon set and updated buttons
- [x] Fixed service import path and migrated modal styles
- [x] Corrected API service import in App.vue build
