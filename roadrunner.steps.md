### roadrunner.steps.md

> Implementation steps for Roadrunner Autonomous AI Agent (TokomakAI v1.2.0+)
> Vision: A self-operating local agent that interprets natural language tasks and performs system-level operations using LLMs.

---

#### ✅ Phase 1: Foundation and UI (COMPLETE)

✅ 1. Scaffold Electron + Vue 3 + Vite application with Tailwind CSS.
✅ 2. Apply Neo Art Deco 2132 style system and font-ui-strange.
✅ 3. Create UI input fields for:
   - Task Goal (Overall task objective)
   - Task Steps (newline-separated commands/instructions)
✅ 4. Add "Execute Autonomous Task" button.
✅ 5. Build log output panel to display execution flow and results.

---

#### 🔄 Phase 2: Backend Routing and LLM Interface

1. ✅ Set up Express.js backend endpoint `/execute-autonomous-task` (now supports GET for SSE and POST).
2. ✅ Accept JSON payload: `{ task_description: string, steps: object[] }` (via POST body or GET query params).
3. ✅ Establish backend connection logic for Ollama (local model) and OpenAI (as an optional fallback).
4. ✅ Read and parse `agent-profile.md` (e.g., from the root directory) into a structured format. Use this profile to modify/augment prompts sent to LLMs to align agent behavior with defined rules and preferences.
5. ✅ Process task steps, send instructions to the appropriate LLM for relevant steps, and utilize LLM outputs (e.g., for generating file content).
6. ✅ Stream LLM responses to frontend for real-time logging (SSE implemented).

---

#### 🧠 Phase 3: Task Execution Logic

1. ✅ Parse steps into actionable commands (e.g., `generic_step`, `create_file_with_llm_content`, `git_operation`, etc.).
2. ✅ Implement LLM-generated file operations (initial: `create_file_with_llm_content`).
3. ✅ Allow step chaining using previous results (text-based output storage and {{outputs.var}} templating implemented, fulfilling direct output/input needs via string resolution).
4. ✅ Include safety guardrails (path traversal prevention, warnings for destructive operations implemented).
5. ✅ Enhanced safety guardrails with a comprehensive confirmation system. This system includes:
    - A global 'Safety Mode' toggle switch in the UI (defaults to ON). When ON, potentially destructive operations require user confirmation.
    - Frontend UI in `RoadrunnerExecutor.vue` that handles `confirmation_required` SSE events from the backend by displaying a confirmation dialog (`window.confirm` for now).
    - Backend logic in `server.js` to:
        - Pause task execution when confirmation is needed.
        - Send a `confirmation_required` event (with a unique `confirmationId`) via SSE.
        - Await a frontend response via a new `/api/confirm-action/:confirmationId` POST endpoint.
        - Resume or cancel the operation based on the user's response.
    - Support for step-level `requireConfirmation: true/false` flags, which interact with the global Safety Mode (e.g., Safety Mode ON confirms unless step says `false`; Safety Mode OFF confirms only if step says `true`).
    - `fsAgent.js` (for file operations) and `gitAgent.js` (for `commit`, `push`, `revert`) updated to participate in this confirmation flow. They signal when confirmation is needed and bypass checks if an action has already been confirmed (via `isConfirmedAction` flag).
    - A "Confirm After X Operations" feature: When Safety Mode is ON, the system automatically requests a batch confirmation from the user after a set number (e.g., 3) of modifying file or git operations. Denial of a batch confirmation terminates the task.

---

#### 📂 Phase 4: Filesystem Integration

1. Define and allow user selection/confirmation of the primary workspace/project directory for agent operations (e.g., via initial setup prompt, UI dialog, or a persistent setting).
2. ✅ Create `fsAgent.js` to manage filesystem commands.
3. ✅ Add logic to `fsAgent.js` (check file existence, create/read/update/delete files & dirs, render LLM output to file content, path validation).
4. ✅ Add directory tree preview via `show_workspace_tree` step (text-based tree logged via SSE, fulfilling core requirement; rich UI is a separate enhancement).

---

#### 🧬 Phase 5: Git Integration

1. ✅ Integrate Git commands via `git_operation` step (add, commit, push, pull supported). Commit message templating and execution logic reviewed and appear correctly implemented.
    - Auto-stage changes when a `git add` step type is successfully executed.
    - Generate commit message per task step or goal (Templated user messages supported; LLM-generation is future)
    - Optionally push to remote branches (Supported via `push` command)
2. ✅ Display Git result logs (via SSE to frontend log).
3. ✅ Key Git operations (e.g., `commit`, `push`, `revert_last_commit`) are integrated into the global 'Safety Mode' confirmation system, requiring user approval for changes when Safety Mode is active.
4. ✅ Implemented "revert_last_commit" git operation, including backend logic, UI button, and task step definition.

---

#### 🤖 Phase 6: Autonomous Agent Logic & Coder Tab Development

**General Autonomous Capabilities:**
1. Plan and implement "autonomous" mode, including a UI checkbox, to:
    - Interpret the overall Goal using an LLM (guided by `agent-profile.md` rules and preferences).
    - Autogenerate a proposed sequence of steps.
2. Implement looped execution or iterative refinement of task chains.
3. Enable LLM-based result evaluation and re-prompting for ambiguous tasks or error correction.
4. Add a plan validation step before execution in autonomous mode (e.g., display proposed steps for user approval).

**"Coder" Tab: Autonomous Coding Agent Implementation:**
5. **Advanced Sniper Document Understanding & Parsing:**
    - Refine parser for `*.sniper.md` (and similar specification) files.
    - Define/solidify schema for parsed information suitable for code generation.
    - Explore NLP techniques for more flexible parsing of requirements.
6. **Module Scaffolding & Code Generation:**
    - Develop code generator for creating directory structures.
    - Generate boilerplate files (e.g., Vue components, CSS, JS/TS, Python modules) based on parsed specs.
    - Investigate automated registration of new modules within the project framework (if applicable).
7. **UI Element Generation (for UI-focused modules):**
    - Implement code generator to add basic HTML/template structures.
    - Generate initial Vue/React/etc. component logic for UI elements based on sniper specifications.
8. **Automated Documentation Generation:**
    - Auto-create initial module documentation, such as `[module_name].functionality.md` or `[module_name].steps.md`, based on the specifications and generated structure.
9. **Agent Orchestration & UI (Coder Tab Specific):**
    - Develop UI within the "Coder" tab to manage the autonomous coding process:
        - Specify input (sniper document, high-level requirements).
        - Trigger and monitor the generation process.
        - View progress, logs, and outputs (generated files, proposed changes).

---

#### 🛡 Phase 7: Error Handling + Fallbacks

1. ✅ Wrap each file or git command in try/catch with visible logs (error propagation reviewed and enhanced).
2. ✅ Auto-backup touched files before changes (.bak files for overwrite/delete).
3. Display errors in red with hoverable detail. (Handled by frontend for SSE `error` messages).
4. On failure, offer retry or convert to manual mode.

---

#### 📡 Phase 8: Multi-Model Integration (Future)

1. Add OpenAI API toggle with key entry via Owlcore.
2. Provide model switch UI (e.g., Ollama `mistral`, `codellama`, `custom`) per task.
3. Route different task types to different models (e.g., config to Mistral, UI to GPT-4).

---

#### 🎨 Phase 9: Advanced UX + Feature Layer

1. Implement a user settings/preferences panel for managing global application configurations:
    - Default workspace path
    - UI theme preferences
    - Primary model preferences
    - API key storage/management (including remote model API keys/endpoints)
2. Add task history with save/load per session.
3. Implement copy/export of task result logs.
4. Allow user annotations on each step post-run.
5. Display summary success/failure statistics per task.
6. Implement Tab-Specific Model Filtering (Backend Driven):
    - Create backend endpoint `/api/ollama-models/categorized` in `roadrunner/backend/server.js`.
    - Fetch models from local Ollama (`/api/tags`).
    - Categorize models based on `roadrunner/backend/config/model_categories.json` (keywords for `coder`, `language`, `default_category`).
    - Return JSON with models grouped by category.
    - Frontend calls new endpoint to populate "Coder" and "Brainstorming" tab dropdowns.
    - Model list refresh button triggers refetch from this backend endpoint.
7. ✅ Implement Direct Ollama Model Downloading from UI:
    - Added UI elements (input field for model name, "Download Model" button) in `RoadrunnerExecutor.vue`.
    - Created a new backend `POST` endpoint `/api/ollama/pull-model` in `server.js` to receive download requests.
    - The backend endpoint interacts with the local Ollama instance's `/api/pull` endpoint (using `stream: true`).
    - Download progress and status (including errors from Ollama) are streamed back from `/api/ollama/pull-model` to the Roadrunner frontend using Server-Sent Events (SSE).
    - Frontend `RoadrunnerExecutor.vue` uses `fetch` to initiate the POST request and then manually parses the SSE stream from the response to display real-time progress and status messages in the UI log.
    - Enhanced error handling for various scenarios (Ollama unreachable, model not found, etc.).

**"Brainstorming" Tab Enhancements:**
8. **Full Remote Model Integration for Chat:**
    - Implement backend logic to connect to and interact with remote AI APIs (e.g., OpenAI) for chat functionality in the Brainstorming tab, using configured API keys.
9. **Contextual File/Image Understanding in Chat:**
    - Allow uploaded files (text, code) to be sent as context to the selected language model in the Brainstorming tab.
    - (Future) Allow uploaded images to be sent as context (for multimodal models).
    - Display summaries or references to file/image content in the chat history.
10. **Conversation Management for Chat:**
    - Implement features to save and load chat conversations.
    - Allow users to clear chat history.
    - Implement robust conversation context management for longer interactions (e.g., sending appropriate message history to the model).
11. **Streaming Responses for Chat:**
    - Implement response streaming for Ollama models in the Brainstorming tab.
    - Implement response streaming for remote models in the Brainstorming tab once integrated.
12. Removed inline CSS from `RoadrunnerExecutor.vue` and `App.vue`. Added matching
    utility classes in `src/styles/roadrunner.css` to comply with the new
    `AGENTS.md` guidelines.
13. Added conversation serializer module for chat history.

---

#### 🧾 Phase 10: Documentation + Metadata

1. ✅ Update `Roadrunner.README.md` to reflect current features.
2. ✅ Implemented storing each task execution as a `.log.md` in the `roadrunner/logs/` folder.
3. 🗑️ **Removed** `roadrunner.roadmap.md` file. (Project direction and tasks are managed through other means; this static file was deprecated).

---

#### 📡 Phase 11: `taskAgent` Decision Support Integration

1. **Define API for `taskAgent` Proxy:**
    - Specify and implement a dedicated backend endpoint (e.g., `/api/request-decision-pathway`) for receiving pathway proposal requests from `tokomakaicore`'s `roadrunnerProxy.js`.
    - This endpoint will accept structured input representing the user's goal or parsed intent from `taskAgent`.
2. **Implement Decision Logic:**
    - Develop or adapt existing Roadrunner logic to analyze the input from `taskAgent`.
    - Utilize Roadrunner's knowledge of available Tokomak modules, their capabilities, and potentially LLM-driven reasoning to determine an optimal sequence of actions/module calls to achieve the goal.
3. **Return Pathway Proposal:**
    - Define a clear structure for the response to `taskAgent`, detailing the proposed sequence of modules, functions to call, and necessary parameters.
    - Ensure this output is easily consumable by `taskAgent`'s `ActionResolver`.
4. **Logging and Error Handling:**
    - Implement robust logging for all interactions with `taskAgent`.
    - Provide clear error responses if a pathway cannot be determined.
    - (Refer to `Info/taskAgent.sniper.md` for `taskAgent` details).
5. **Cross-Platform Renderer Logs:**
    - Store renderer logs in the OS temporary directory to avoid missing path errors on Windows.

---

#### ⚠️ Status

- UI and LLM connectivity: ✅
- Filesystem execution & Interactive Safety Confirmation System: ✅
- Git automation: ✅ (Core commands integrated with the Interactive Safety Confirmation System. Templating and execution logic reviewed.)
- Conference streaming IPC bridge implemented via Electron.
- Step Chaining & Templating: ✅
- Autonomous loop logic: 🔬 early prototyping

---

Target Version: v1.3.0

