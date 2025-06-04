# Roadrunner Project

> **Important Note on Project Structure:**
> The `roadrunner/` directory contains the components of a **standalone Electron application (frontend in `roadrunner/frontend/`, main process in `roadrunner/electron.js`) and its backend server (`roadrunner/backend/`).** The `roadrunner/backend/` is stabilized to support this standalone `roadrunner/` application, which is developed and maintained independently. Its core logic and agents (fsAgent, gitAgent) have informed the `TokomakCore/roadrunnercore` module, which serves as the backend for Roadrunner features integrated within `TokomakAI.Desktop`.
> Task definition for this application is via UI inputs for a task goal and a sequence of steps.
> This README focuses on the standalone Roadrunner application within the `roadrunner/` directory. (Information about `TokomakAI.Desktop` and `TokomakCore/roadrunnercore` is for context on shared lineage only).

The newer `roadrunnercore` module within `TokomakCore/` repurposes this application's backend logic so that TokomakAI Desktop can offer the same Roadrunner features internally. When users open the Roadrunner panel from the Toko32 dashboard, the desktop app launches its own copy of this frontend in a modal while communicating with `roadrunnercore` rather than this standalone server. Despite sharing code, the standalone `roadrunner/` app and the integrated `roadrunnercore` setup are maintained as separate projects.

**This README primarily concerns the standalone application components within the `roadrunner/` directory (Electron main process, Vue.js frontend, and Node.js backend).**

---

**Roadrunner was originally conceived as an experimental desktop application to function as an autonomous AI agent. It leverages Large Language Models (LLMs), primarily through Ollama (for local model execution) and potentially OpenAI (for remote model access), to understand, plan, and execute complex tasks.**

The goal of Roadrunner is to automate various aspects of the software development lifecycle and other digital tasks by interpreting natural language instructions and interacting with system resources. LLM responses are streamed to the frontend for real-time logging.

---

## 🚀 Core Capabilities

Roadrunner's key features include:

- **Task Definition:** Users define tasks by uploading a file containing a "Sequence of Steps" and an "Overall Task Goal" via the UI. These are then managed as part of a session.
- **Session Management:** Roadrunner now supports saving and loading task sessions. Users can manage collections of tasks, save them with custom names, and reload them later. This allows for better organization and persistence of work. For details, see [Session Management](#session-management).
- **LLM Integration:**
    - Connects to LLM services (e.g., Ollama) for natural language interpretation and content generation, with responses streamed to the UI.
    - Supports OpenAI models if an API key is provided via Owlcore secure storage (requires `useOpenAIFromStorage: true` in task request).
    - Steps can specify preferred LLM providers and models (e.g., `"ollama/mistral"`, `"openai/gpt-4-turbo"` via `details.model` field).
- **Task Execution Engine:**
    - Parses steps into commands (e.g., `generic_step`, `create_file_with_llm_content`, `read_file_to_output`, `git_operation`, `show_workspace_tree`, `loop_iterations`).
    - Supports step chaining using outputs from previous steps (e.g., `{{outputs.variable_name}}`).
    - Manages a `taskContext` for output storage.
    - Supports LLM-based evaluation of step outputs (`evaluationPrompt`) with configurable recovery actions like re-prompting (`reprompt_step_llm`), refining, or retrying.
- **Filesystem Integration (`fsAgent.js`):**
    - Performs file operations (create, read, update, delete, tree view) primarily within `roadrunner/output/`, with safety guardrails and backups.
- **Git Automation (`gitAgent.js`):**
    - Integrates Git commands (`add`, `commit`, `push`, `pull`, `revert_last_commit`) via the `git_operation` step.
- **Autonomous Execution:** Aims to execute defined steps sequentially with minimal intervention.
- **Error Handling & Logging:** Streams errors and logs to the UI. If critical operations fail (e.g., directory creation for logs/workspace) the server will prevent startup. For task execution errors, the system can pause and provide options for retry/skip/manual intervention. Task execution logs are saved to disk.

For a more detailed features list, see [ROADRUNNER_SETUP_AND_FEATURES.md](./ROADRUNNER_SETUP_AND_FEATURES.md).

---

## Session Management

Roadrunner provides robust session management capabilities, allowing users to save, load, and manage their task collections effectively. This is crucial for preserving work, organizing different projects, and resuming tasks later.

**Key Session Management Features:**

*   **Saving Sessions:**
    *   Users can input a custom name for their current session in the "Session Name" field on the "Coder" tab.
    *   Clicking the "Save Session" button persists the current set of tasks (including their goals and step definitions) to a JSON file in the configured sessions directory (typically `roadrunner/output/sessions/`).
    *   If no name is provided, a timestamp-based filename is automatically generated.
*   **Loading Sessions:**
    *   Previously saved sessions are listed in the "Load Session" dropdown menu on the "Coder" tab.
    *   Selecting a session from this dropdown loads its tasks into the application, making them available in the "Session Tasks" list.
*   **Managing Tasks within a Session:**
    *   Tasks can be added to the current session by uploading a task file or selecting a predefined module.
    *   The "Session Tasks" list displays all tasks in the currently active session.
    *   Users can select an "active task" from this list, which is then the target for the "Run Active Task" command.

**Workflow:**

1.  **Start or Load:** Launch Roadrunner. Either start with a new, empty session or load an existing session using the "Load Session" dropdown.
2.  **Define Tasks:** Add tasks by uploading task definition files or choosing predefined modules.
3.  **Name Session (Optional but Recommended):** Enter a descriptive name in the "Session Name" input.
4.  **Save Session:** Click "Save Session".
5.  **Continue Work:** Select tasks, run them, and if you make changes to the task set (e.g., add new tasks from a file), remember to save the session again to include these changes.

Session files are stored in a human-readable JSON format, which also allows for manual inspection or modification if necessary, though direct editing is generally not recommended during active use.

---

## 🛠️ High-Level Workflow

Interacting with Roadrunner typically follows these steps:

1.  **Launch:** Start the Roadrunner Electron application and backend server.
2.  **Define/Load Task(s) into Session:**
    - **Upload a task file:** Use the "Custom Task File" option in the "Coder" tab. This adds the parsed steps as a new task to your current session.
    - **Load a predefined task set ( 'module'):** Select a predefined set from the dropdown. This adds the set's tasks (based on a  'module' definition) to your current session.
    - **Load a saved session:** Use the "Load Session" dropdown to load a previously saved set of tasks.
    - Optionally, give your current session a name using the "Session Name" input.
3.  **Save Session (Optional but Recommended):**
    - Click "Save Session" to persist the tasks currently in your session.
4.  **Select Active Task:**
    - From the "Session Tasks" list, click on the task you wish to run. It will become the highlighted "active task".
5.  **Initiate Task:** Click the **"Run Active Task"** button.
6.  **Monitor:** Observe the application's log output in the UI. This log provides real-time feedback on:
    - The task and steps being processed.
    - LLM interactions (with responses streamed).
    - Filesystem operations (creations, reads, deletions, tree views) and any backup statuses.
    - Git command execution.
    - Any errors, warnings, or successes encountered during each step.

---

## 💻 Technical Stack

- **Desktop Application:** Electron
- **Frontend:** Vue.js 3 (with Vite), using `EventSource` for real-time updates.
- **Backend:** Node.js with Express.js, providing Server-Sent Events (SSE) for streaming.
- **LLM Interface:** Primarily via Ollama for local models; OpenAI API for remote models (streaming supported for both).
- **Agents:** Modular agents for filesystem (`fsAgent.js`) and Git (`gitAgent.js`) operations.

---

## Installation & Setup

1.  **Backend Server Setup (`roadrunner/backend/`)**:
    ```bash
    cd roadrunner/backend
    npm install
    npm start 
    # The backend server will run on http://localhost:3030 by default.
    # Configure paths as needed via environment variables or config/backend_config.json
    # See roadrunner/backend/README.md for details.
    ```

2.  **Standalone Roadrunner App Setup (`roadrunner/`)**:
    This refers to the Electron application defined by `roadrunner/electron.js` and its frontend in `roadrunner/frontend/`.

    *   **Prerequisite:** Ensure the **Backend Server** (see point 1 above, `roadrunner/backend/server.js`) is running, as this standalone application relies on it (e.g., for loading AI models via `http://127.0.0.1:3030`).
    *   **Running the app:**
        Navigate to the `roadrunner` directory (i.e., the root of this project) and run:
        ```bash
        # Install dependencies (if first time or after changes)
        npm install

        # Build the frontend and launch the Electron app
        npm start
        ```

**Configuration**:
*   **Backend**: Refer to the `roadrunner/backend/README.md` for detailed instructions on path configuration and other settings.

---

## ⚠️ Current Status & Disclaimer

**The `roadrunner/` application (frontend, Electron main process, and backend) is a standalone application. The `roadrunner/backend/` is being stabilized for this purpose, and its core components have informed the `TokomakCore/roadrunnercore` module, which provides Roadrunner functionalities within the modern `TokomakAI.Desktop` application.**

- The vision of a fully autonomous AI agent is a work in progress.
- **Core Features Implemented:** UI for task definition, backend for step-based execution, LLM integration with streaming, filesystem operations (within `roadrunner/output/` and configurable external roots) with safety guardrails and backups, Git integration for basic commands, step chaining, and a task interruption/confirmation flow (backend supports robust confirmation handling; UI interaction may vary).
- **Areas for Future Development:** More advanced autonomous decision-making by the LLM, complex Git workflows, UI enhancements for specific step types and confirmation handling, robust error recovery, and user-configurable settings.
- The application's UI and backend are evolving. While the `/execute-autonomous-task` endpoint is the focus, older endpoints like `/run` may not be fully functional with recent streaming-focused refactoring of LLM utilities.

Use with curiosity and for local development tasks. It is not yet a production-ready tool. Your feedback and contributions are welcome!

---

## Known Issues / Non-Functioning Features

*   **Legacy `/run` Endpoint:**
    *   As noted in the 'Current Status & Disclaimer', the older `/run` backend endpoint (related to previous component generation functionality) may not be fully functional with recent refactoring of LLM utilities. The primary focus for task execution is the `/execute-autonomous-task` endpoint.

---

## Further Reading

- [HOW_TO_USE_ROADRUNNER.md](./HOW_TO_USE_ROADRUNNER.md): TODO: Create comprehensive user guide.
- [ROADRUNNER_SETUP_AND_FEATURES.md](./ROADRUNNER_SETUP_AND_FEATURES.md): Information on setting up Roadrunner and an overview of its capabilities.
- [BUILD_AND_THEME_GUIDE.md](./BUILD_AND_THEME_GUIDE.md): A guide for building Roadrunner and customizing its theme.
- [roadrunner.steps.md](./roadrunner.steps.md): Development phases and historical task tracking for the Roadrunner project.

---

## Suggested Enhancements

*   **1. Resolve Build/Environment Issues:**
    *   Investigate and fix the root cause of `npm install` failures that prevent the Vite frontend from building. This is critical for any further development.
*   **2. Application and Model Update Mechanism (User Feedback):**
    *   Implement robust in-app update capabilities for the Electron application itself.
    *   Provide a user interface or automated process for updating local LLM models (e.g., those managed by Ollama).
*   **3. Improved Error Handling and Reporting in UI:**
    *   Enhance the user interface to more clearly display errors from backend processes, Ollama interactions, or file operations, rather than relying solely on console logs.
*   **4. Refine UI/UX:**
    *   Consider modernizing the user interface and improving user experience with features like progress indicators for long-running tasks.
*   **5. Comprehensive Test Suite:**
    *   Develop unit and integration tests for both frontend and backend components to ensure stability and facilitate future development.
*   **6. Enhanced Configuration Management:**
    *   Allow users to manage backend configurations (paths, default models, etc.) more easily from the application's UI.
*   **7. Clarify/Refactor Legacy Endpoints:**
    *   Fully refactor and test the legacy `/run` backend endpoint if its functionality is still desired, or remove it to prevent confusion.
*   **8. Security Review:**
    *   Conduct a thorough security review, especially concerning filesystem access and the execution of LLM-generated content or commands.

---

## API Endpoints

This section details primary API endpoints available on the Roadrunner backend server (typically `http://localhost:3030`).

### Task Execution

*   **Endpoint:** `POST /execute-autonomous-task` (also supports `GET` for simplicity, but `POST` is preferred for complex bodies)
*   **Description:** Initiates a task execution sequence. This is the main endpoint for Roadrunner operations.
*   **Request Body:**
    ```json
    {
      "task_description": "Description of the overall task goal",
      "steps": [
        {
          "type": "generic_step", // Or execute_generic_task_with_llm
          "details": {
            "prompt": "Instruction for LLM for this step.",
            "output_id": "optional_variable_name_to_store_output",
            // New optional fields for LLM and evaluation:
            "model": "ollama/mistral", // e.g., "ollama/mistral", "openai/gpt-4-turbo". Defaults to ollama/codellama.
            "evaluationModel": "ollama/phi3", // Model for evaluationPrompt. Defaults to ollama/phi3.
            "evaluationPrompt": "Prompt for an LLM to evaluate the main output of this step. Use {{step_output}} and {{original_prompt}}.",
            "onEvaluationFailure": "reprompt_step_llm", // "retry", "refine_and_retry", "reprompt_step_llm", or "fail_step"
            "maxEvaluationRetries": 2, // Default 1
            "maxRepromptRetries": 1 // Default 1 (for reprompt_step_llm)
          }
        },
        {
          "type": "create_file_with_llm_content",
          "details": {
            "filePath": "path/to/file.txt",
            "prompt": "Prompt for file content. This will use the 'model' specified below if any.",
            "model": "ollama/mistral", // Optional: specify model for this LLM call
            "output_id": "file_content_var",
            // Evaluation fields can also be added here as above
            "evaluationPrompt": "Does the content '{{step_output}}' adequately address '{{original_prompt}}'?",
            "onEvaluationFailure": "fail_step"
          }
        },
        {
          "type": "loop_iterations",
          "details": {
            "count": 3, // Number of iterations
            "iterator_var": "idx", // Optional: stores current index (0-based) as {{outputs.idx}}
            "loop_steps": [ // Array of step objects to execute in each iteration
              { "type": "createFile", "details": { "filePath": "output/file_{{outputs.idx}}.txt", "content": "Content for file {{outputs.idx}}" } },
              { "type": "generic_step", "details": { "prompt": "Log iteration number {{outputs.idx}}" } }
            ]
          }
        }
        // ... other step types ...
      ],
      "safetyMode": true, // boolean, true by default. If true, requires confirmation for destructive operations.
      "isAutonomousMode": false, // boolean, false by default. If true, 'steps' are ignored and task_description is used as a goal for LLM to generate steps.
      "useOpenAIFromStorage": false // boolean, optional, defaults to false. If true, attempts to use OpenAI API key from Owlcore secure storage if an openai/... model is specified.
    }
    ```
*   **Response:** Streams Server-Sent Events (SSE) with progress, logs, LLM chunks, confirmation requests, failure options, and completion status.
*   **Authentication:** None.

### Multi-Model Conference

*   **Endpoint:** `POST /execute-conference-task`
*   **Description:** Triggers a multi-model conference (debate and synthesis) using three LLM calls based on the provided prompt.
*   **Request Body:**
    ```json
    {
      "prompt": "Your question or topic for the conference"
      // Optional: "model_a_role", "model_b_role", "arbiter_model_role", "num_rounds"
    }
    ```
*   **Response:**
    ```json
    {
      "conference_id": "uuid",
      "final_arbiter_response": "The arbiter's final synthesized answer",
      // ... other details like full debate history ...
    }
    ```
    On error, may return a 500 status with `{"error": "Failed to execute conference task.", "details": "..."}`.
*   **Authentication:** None.

### Session Management

*   **`POST /api/session/save`**
    *   **Description:** Saves the current session tasks to a file.
    *   **Request Body:** `{ name?: "sessionName", tasks: [array_of_task_objects] }`. `name` is optional; if not provided, a timestamp-based name is generated.
    *   **Response (201):** `{ message: "Session saved successfully.", sessionId: "filename.json" }`.
*   **`GET /api/sessions/list`**
    *   **Description:** Lists available saved sessions.
    *   **Response (200):** `[{ id: "filename.json", name: "User Friendly Name" }, ...]`.
*   **`GET /api/session/load/:sessionId`**
    *   **Description:** Loads a specific session by its filename.
    *   **URL Parameter:** `sessionId` (string) - The filename of the session (e.g., `mySession.json`).
    *   **Response (200):** The session data (typically an array of task objects). (404 if not found).

### Log Retrieval

*   **`GET /api/logs/:filename`**
    *   **Description:** Retrieves a specific task execution log file.
    *   **URL Parameter:** `filename` (string) - The name of the log file (e.g., `task-XYZ-timestamp.log.md`).
    *   **Response (200 OK):** Raw markdown content of the log file.
    *   **Errors:** 400 for invalid filename, 404 if log file not found.
*   **Authentication:** None for any of these current endpoints.

---

## Available Task Step Types

The `/execute-autonomous-task` endpoint processes a sequence of steps. Each step object must have a `type` and a `details` object. Here are some common step types:

*   **`generic_step` / `execute_generic_task_with_llm`**
    *   **Purpose:** General-purpose step to instruct an LLM.
    *   **Key `details`:**
        *   `prompt`: The instruction for the LLM.
        *   `output_id` (optional): Variable name to store the LLM's output in the task context (e.g., `{{outputs.variable_name}}`).
        *   `model` (optional): Specify LLM model (e.g., "ollama/mistral", "openai/gpt-4-turbo").
        *   `evaluationModel` (optional): Model for evaluating the main output.
        *   `evaluationPrompt` (optional): Prompt for LLM to evaluate the step's output. Can use `{{step_output}}` and `{{original_prompt}}`.
        *   `onEvaluationFailure` (optional): Action if evaluation fails (e.g., "retry", "reprompt_step_llm", "fail_step").
        *   `maxEvaluationRetries` (optional): Number of retries for evaluation.
        *   `maxRepromptRetries` (optional): Number of retries for `reprompt_step_llm`.

*   **`create_file_with_llm_content`**
    *   **Purpose:** Generate content using an LLM and save it to a file.
    *   **Key `details`:**
        *   `filePath`: Path to the file to be created (e.g., "path/to/file.txt").
        *   `prompt`: Prompt for the LLM to generate file content.
        *   `model` (optional): Specify LLM model for content generation.
        *   `output_id` (optional): Variable name to store the generated content.
        *   (Supports evaluation fields similar to `generic_step`).

*   **`loop_iterations`**
    *   **Purpose:** Execute a sub-sequence of steps multiple times.
    *   **Key `details`:**
        *   `count`: Number of iterations.
        *   `iterator_var` (optional): Variable name to store the current loop index (0-based) in task context (e.g., `{{outputs.idx}}`).
        *   `loop_steps`: An array of step objects to be executed in each iteration. These steps can use the `iterator_var`.

*   **`git_operation`**
    *   **Purpose:** Perform Git operations.
    *   **Key `details`:**
        *   `operation`: The Git command to execute (e.g., "add", "commit", "push", "pull", "revert_last_commit").
        *   `args`: Arguments for the Git command (e.g., for `add`: `["."]`, for `commit`: `["-m", "My commit message"]`).
        *   `commit_message` (specific for `commit` operation if `args` are not used for message).

*   **`show_workspace_tree`**
    *   **Purpose:** Display the file and directory structure of the workspace.
    *   **Key `details`:**
        *   `path` (optional): Specific path within the workspace to list. Defaults to the workspace root.

*   **`conference_task`** (Likely a higher-level step, might be used differently or invoke `/execute-conference-task` API)
    *   **Purpose:** To facilitate a multi-model "conference" or debate on a given prompt to arrive at a synthesized answer.
    *   **Key `details`:**
        *   `prompt`: The topic or question for the conference.
        *   (May include other parameters like roles for different models, number of rounds).

*   **Filesystem Steps (via `fsAgent.js`):**
    *   **`createDirectory`**:
        *   `path`: Path of the directory to create.
    *   **`createFile`**:
        *   `filePath`: Full path of the file to create.
        *   `content`: Content to write into the file.
    *   **`readFile` / `read_file_to_output`**:
        *   `filePath`: Path of the file to read.
        *   `output_id`: Variable name to store the file content in task context.
    *   **`updateFile`**:
        *   `filePath`: Path of the file to update.
        *   `content`: New content to overwrite the file or specific instructions for update (behavior might vary).
    *   **`deleteFile`**:
        *   `filePath`: Path of the file to delete.
    *   **`deleteDirectory`**:
        *   `path`: Path of the directory to delete (usually requires it to be empty).

This list is not exhaustive but covers the primary step types used in task definitions. Refer to the backend server code (specifically `roadrunner/backend/agentController.js` and related agent files) for the most up-to-date details on step processing logic.

<!-- Test modification for autonomous commit -->
