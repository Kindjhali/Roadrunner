# Roadrunner Implementation Checklist

> Implementation steps for Roadrunner Autonomous AI Agent (TokomakAI v1.2.0+). Vision: A self-operating local agent that interprets natural language tasks and performs system-level operations using LLMs.

---

## Phase 1: Foundation and UI

- [x] Scaffold Electron + Vue 3 + Vite application with Tailwind CSS.
- [x] Apply Neo Art Deco 2132 style system and font-ui-strange.
- [x] Create UI input fields for:
  - Task Goal (Overall task objective)
  - Task Steps (newline-separated commands/instructions)
- [x] Add "Execute Autonomous Task" button.
- [x] Build log output panel to display execution flow and results.

## Phase 2: Backend Routing and LLM Interface

- [x] Set up Express.js backend endpoint `/execute-autonomous-task` supporting GET (SSE) and POST.
- [x] Accept JSON payload `{ task_description: string, steps: object[] }` via POST body or GET params.
- [x] Establish backend connection logic for Ollama (local model) and OpenAI as fallback.
- [x] Read and parse `agent-profile.md` to modify prompts for LLMs.
- [x] Process task steps, send instructions to the appropriate LLM, and utilize LLM outputs.
- [x] Stream LLM responses to frontend for real-time logging (SSE).

## Phase 3: Task Execution Logic

- [x] Parse steps into actionable commands such as `generic_step`, `create_file_with_llm_content`, and `git_operation`.
- [x] Implement LLM-generated file operations like `create_file_with_llm_content`.
- [x] Allow step chaining using previous results via `{{outputs.var}}` templating.
- [x] Include safety guardrails for path traversal prevention and destructive warnings.
- [x] Add a confirmation system integrated with Safety Mode for potentially destructive steps.

## Phase 4: Filesystem Integration

- [ ] Allow user selection/confirmation of the workspace directory for agent operations.
- [x] Create `fsAgent.js` to manage filesystem commands.
- [x] Implement logic in `fsAgent.js` to check, create, read, update, and delete files and directories with path validation.
- [x] Provide directory tree preview via `show_workspace_tree` step (text-based output via SSE).

## Phase 5: Git Integration

- [x] Integrate Git commands through the `git_operation` step (add, commit, push, pull).
  - [x] Auto-stage changes for `git add`.
  - [x] Generate commit messages per step or goal.
  - [x] Optionally push to remote branches.
- [x] Display Git result logs via SSE to the frontend log panel.
- [x] Require confirmation for key Git operations when Safety Mode is active.
- [x] Implement `revert_last_commit` operation with backend logic, UI button, and task step support.

## Phase 6: Autonomous Agent Logic & Coder Tab Development

**General Autonomous Capabilities**

- [ ] Implement an "autonomous" mode with a UI checkbox to interpret the overall goal using LLMs and autogenerate steps.
- [ ] Add looped execution or iterative refinement of task chains.
- [ ] Enable LLM-based result evaluation and re-prompting for ambiguous tasks or error correction.
- [ ] Add plan validation before execution in autonomous mode (display proposed steps for approval).

**"Coder" Tab: Autonomous Coding Agent Implementation**

- [ ] Advanced Sniper document understanding and parsing.
- [ ] Module scaffolding and code generation based on parsed specs.
- [ ] UI element generation for UI-focused modules.
- [ ] Automated documentation generation for new modules.
- [ ] UI to manage autonomous coding process, display progress, and show generated files.

## Phase 7: Error Handling & Fallbacks

- [x] Wrap file and Git commands in try/catch blocks with visible logs.
- [x] Auto-backup touched files before changes using `.bak` files.
- [x] Display errors in red with hoverable details via SSE messages.
- [ ] Offer retry options or manual mode upon failure.

## Phase 8: Multi-Model Integration (Future)

- [ ] Add an OpenAI API toggle with key entry via Owlcore.
- [ ] Provide a model switch UI (e.g., choose between `mistral`, `codellama`, or custom models).
- [ ] Route different task types to different models.

## Phase 9: Advanced UX & Feature Layer

- [ ] Implement a user settings/preferences panel to manage:
  - Default workspace path
  - UI theme preferences
  - Primary model preferences
  - API key storage/management
- [ ] Add task history with save/load per session.
- [ ] Implement copy/export of task result logs.
- [ ] Allow user annotations on each step post-run.
- [ ] Display summary success/failure statistics per task.
- [ ] Implement tab-specific model filtering using `/api/ollama-models/categorized`.
- [x] Implement direct Ollama model downloading from the UI with progress streaming and error handling.

**"Brainstorming" Tab Enhancements**

- [ ] Integrate remote AI APIs for chat functionality.
- [ ] Allow contextual file or image uploads in chat.
- [ ] Save and load chat conversations with history management.
- [ ] Stream responses for both local and remote models.
- [x] Remove inline CSS from `RoadrunnerExecutor.vue` and `App.vue`; add matching utility classes in `src/styles/roadrunner.css`.
- [x] Add conversation serializer module for chat history.

## Phase 10: Documentation & Metadata

- [x] Update `Roadrunner.README.md` to reflect current features.
- [x] Store each task execution as a `.log.md` file in `roadrunner/logs/`.
- [x] Remove deprecated `roadrunner.roadmap.md` file.

## Phase 11: `taskAgent` Decision Support Integration

- [ ] Define an API endpoint `/api/request-decision-pathway` for pathway proposals from `taskAgent`.
- [ ] Implement decision logic analyzing input from `taskAgent` using available Tokomak modules.
- [ ] Return a structured pathway proposal to `taskAgent`'s `ActionResolver`.
- [ ] Add robust logging and clear error responses for this integration.
- [ ] Store renderer logs in the OS temporary directory to avoid path errors on Windows.

---

### Status

- [x] UI and LLM connectivity working
- [x] Filesystem execution & Interactive Safety Confirmation System active
- [x] Git automation operational
- [x] Step chaining & templating available
- [ ] Autonomous loop logic (early prototyping)

Target Version: **v1.3.0**
