# Backend Documentation

This backend is a Node.js/Express.js application that powers an advanced AI agent system built with Langchain.js. It handles task processing, LLM interactions, tool execution, and real-time communication with the frontend via Server-Sent Events (SSE).

## Core Architecture: Langchain.js Agent

The heart of the backend is an AI agent orchestrated by `server.js` using the `AgentExecutor` class from Langchain.js. This agent dynamically plans and executes tasks based on natural language input.

*   **Agent Types & Initialization (`initializeAgentExecutor` in `server.js`):**
    *   **OpenAI Models:** Utilizes an agent compatible with OpenAI's function calling capabilities (via `createOpenAIFunctionsAgent`). This allows the LLM to request tool usage in a structured JSON format. A specific prompt template (`AGENT_PROMPT_TEMPLATE_OPENAI`) guides this agent.
    *   **Ollama Models:** Employs a ReAct (Reasoning and Acting) agent (via `createReactAgent`). The agent uses a detailed prompting style (`REACT_AGENT_PROMPT_TEMPLATE_TEXT` in `server.js`) to reason step-by-step, choose appropriate tools, format their inputs, and process their outputs (observations). This prompt includes instructions for handling tool errors and user denials.
*   **LLM Interaction (`generateFromLocal` in `server.js`):**
    *   All direct LLM calls, whether by the agent's core LLM or by tools needing generative capabilities (e.g., `ConferenceTool`, `CodeGeneratorTool`), are routed through the `generateFromLocal` utility.
    *   This function dynamically selects the LLM client (`ChatOpenAI` or `ChatOllama`) based on `backend_config.json` settings and handles streaming of responses.
    *   It also applies persona-specific instructions from `config/agent_instructions_template.json` based on the `agentType` and `agentRole` passed in options.
*   **Conversational Memory (`ConversationBufferWindowMemory`):**
    *   The `AgentExecutor` is configured with `ConversationBufferWindowMemory` (e.g., `k=5` recent interactions).
    *   This provides the agent with request-scoped memory, allowing it to recall context from earlier parts of the *current task execution*.
    *   Chat history (`chat_history` in prompts) is meticulously managed, especially during the confirmation flow: it's saved when a confirmation is triggered and reloaded into a fresh memory instance when the agent resumes, ensuring context continuity.

## Langchain Tools (`langchain_tools/`)

The agent's capabilities are defined by a suite of custom tools. These tools are JavaScript classes extending Langchain's `Tool` base class and are located in the `backend/langchain_tools/` directory. They wrap the functionality of underlying modules (`fsAgent.js`, `gitAgent.js`, `codeGenerator.js`).

*   **`common.js`:**
    *   `ConfirmationRequiredError`: A custom error class. Modifying tools throw this error when `safetyMode` is active and an action requires user approval. It carries `toolName`, `toolInput`, `confirmationId`, and `confirmationType` (currently 'individual').
*   **`fs_tools.js` (File System Operations):**
    *   Wraps `fsAgent.js`. Tools generally expect a single string argument (e.g., a path) or a JSON string for multiple arguments. Descriptions include input format examples.
    *   `ListDirectoryTool`: Lists files/directories. Input: relative path string.
    *   `CreateFileTool`: Creates/overwrites a file. Input: JSON string `{"filePath": "path/to/file.txt", "content": "File content"}`.
    *   `ReadFileTool`: Reads file content. Input: relative path string.
    *   `UpdateFileTool`: Updates or appends to a file. Input: JSON string `{"filePath": "path/to/file.txt", "content": "New content", "append": true/false}`.
    *   `DeleteFileTool`: Deletes a file. Input: relative path string.
    *   `CreateDirectoryTool`: Creates a directory (and parents if needed). Input: relative path string.
    *   `DeleteDirectoryTool`: Deletes a directory recursively. Input: relative path string.
*   **`git_tools.js` (Git Operations):**
    *   Wraps `gitAgent.js`. All tools expect a JSON string as input. Descriptions include input format examples.
    *   `GitAddTool`: Stages changes. Input: JSON `{"filePath": "path/to/file_or_'.'"}`.
    *   `GitCommitTool`: Commits staged changes. Input: JSON `{"message": "Your commit message"}`.
    *   `GitPushTool`: Pushes to a remote. Input: JSON `{"remote": "origin", "branch": "main"}` (remote/branch are optional).
    *   `GitPullTool`: Pulls from a remote. Input: JSON `{"remote": "origin", "branch": "main"}` (remote/branch are optional).
    *   `GitRevertTool`: Reverts the last commit. Input: JSON `{}`.
*   **`code_generator_tool.js` (`CodeGeneratorTool`):**
    *   Wraps functionalities from `codeGenerator.js` to scaffold directories and generate files (e.g., Vue components, services) based on a detailed plan.
    *   Input: A JSON string representing a `codeGenPlan`. The description details required keys like `moduleName`, `targetBaseDir`, `scaffolding` (with `directories` and `files`), `specs`, and `modelPreference`.
    *   Uses `generateFromLocal` for any LLM-powered content generation within the plan.
*   **`conference_tool.js` (`ConferenceTool`, invoked by agent as `multi_model_debate`):**
    *   Orchestrates a multi-model debate involving different AI personas (e.g., Model A, Model B, Arbiter).
    *   Input: JSON string with a required `prompt` key and optional keys for roles (`model_a_role`, etc.), `num_rounds`, and `model_name`.
    *   Uses `generateFromLocal` for each participant's turn, applying persona instructions.
    *   Logs the full debate transcript to `CONFERENCES_LOG_FILE` (in `conferencesLogDir`).
    *   Returns the arbiter's final synthesized response.

## Safety Mode & Confirmation Flow (`server.js`)

The backend features an interactive `safetyMode` to prevent unintended operations.

*   **Triggering Confirmation:**
    *   **Individual Actions:** Modifying tools (identified in `MODIFYING_TOOLS` list in `server.js`), when `safetyMode` is active and the specific tool call isn't pre-confirmed (via `runManager.config.isConfirmedActionForTool`), throw `ConfirmationRequiredError` (type 'individual').
*   **Handling User Confirmation (`/api/confirm-action/:confirmationId`):**
    *   When `ConfirmationRequiredError` is caught in `handleExecuteAutonomousTask`, agent execution pauses. Relevant state (original task input, chat history, SSE handlers, confirmation type) is stored in `pendingToolConfirmations`. An SSE `confirmation_required` message (with `confirmationId`, type, and details) is sent to the client.
    *   The frontend sends the user's decision to `/api/confirm-action/:confirmationId`.
    *   This endpoint retrieves the stored state.
        *   If approved:
            *   For 'individual' confirmations, the `isConfirmedActionForTool` flag is set for the specific tool/input.
            *   The agent is informed via a constructed "Observation" message.
            *   `agentExecutor.stream()` is re-invoked with the original task, updated configuration, and reloaded chat history.
        *   If denied:
            *   The agent is informed of the denial via an "Observation" and instructed to re-plan or halt.
            *   `agentExecutor.stream()` is re-invoked.

## Server-Sent Events (SSE) Stream

The backend uses SSE (`Content-Type: text/event-stream`) to provide rich, real-time feedback to the client during task execution. Key event types include:

*   `agent_event`: Carries data from `AgentExecutor` callbacks (e.g., `on_agent_action`, `on_tool_start`, `on_tool_end`, `on_chain_end`/`on_agent_finish`), providing insight into the agent's reasoning and tool usage.
*   `llm_chunk`: Streams tokens from LLM responses, particularly when tools like `ConferenceTool` use `generateFromLocal`. Includes `speaker` context.
*   `confirmation_required`: Notifies the client that user input is needed. Payload includes `confirmationId`, `message`, and `details` (tool name, input, confirmation type (currently 'individual')).
*   `log_entry`: For general server-side log messages passed to the client.
*   `error`: For broadcasting backend errors.
*   `execution_complete`: Signals the successful or failed end of a task.

## Configuration Files (`config/`)

All primary configurations are externalized in JSON files within the `backend/config/` directory. It's crucial to understand the configuration precedence:

1.  **Environment Variables:** Highest priority. Variables like `RR_LLM_PROVIDER`, `RR_API_KEY`, `OLLAMA_BASE_URL`, etc., will override any other settings.
2.  **`backend_config.json` File:** Settings defined in this file override the default values.
3.  **Default Values:** Lowest priority. These are hardcoded in `server.js`.

*   **`backend_config.json`:** This is the primary configuration file for the backend. It **must be created by copying `backend_config.example.json`** and then modified to suit your setup.
    *   `llmProvider`: (String) Specifies the LLM provider. Set to `"ollama"` to use local Ollama models or `"openai"` to use OpenAI's API.
        *   *Environment Variable:* `RR_LLM_PROVIDER`
    *   `apiKey`: (String) Your API key. Required if `llmProvider` is set to `"openai"`. For Ollama, this can be left empty.
        *   *Environment Variable:* `RR_API_KEY`
    *   `defaultOllamaModel`: (String) The default model name to be used with Ollama (e.g., `"mistral"`, `"llama3:latest"`). Ensure this model is pulled in your Ollama instance.
        *   *Environment Variable:* `RR_DEFAULT_OLLAMA_MODEL`
    *   `defaultOpenAIModel`: (String) The default model name for OpenAI (e.g., `"gpt-4"`, `"gpt-3.5-turbo"`).
        *   *Environment Variable:* `RR_DEFAULT_OPENAI_MODEL`
    *   `OLLAMA_BASE_URL`: (String) The base URL for your local Ollama API (e.g., `"http://localhost:11434"`).
        *   *Environment Variable:* `OLLAMA_BASE_URL` (note: this is also used directly by Langchain's Ollama integration if `backendSettings.OLLAMA_BASE_URL` is not set).
    *   `componentDir`: (String) Path to the directory for frontend components generated by the agent (e.g., Vue components via CodeGeneratorTool). Default: `'../frontend/src/components/generated_by_agent'` (relative to `roadrunner/backend`). Can be absolute or relative.
        *   *Environment Variable:* `RR_COMPONENT_DIR`
    *   `logDir`: (String) Directory path for saving task summary Markdown logs and other backend logs. Can be absolute or relative.
        *   *Environment Variable:* `RR_LOG_DIR`
    *   `workspaceDir`: (String) The root directory where the agent performs file operations (e.g., creating files, git operations). Tools operate relative to this path. Can be absolute or relative.
        *   *Environment Variable:* `RR_WORKSPACE_DIR`
    *   `// conferencesLogDir`: (Commented out in example, but can be used) Subdirectory within `workspaceDir` for storing detailed logs of `ConferenceTool` debates.

    **Setup for Ollama:**
    1.  Set `llmProvider` to `"ollama"`.
    2.  Ensure `OLLAMA_BASE_URL` points to your running Ollama instance.
    3.  Make sure the model specified in `defaultOllamaModel` (and any other models you intend to use) are pulled (e.g., `ollama pull mistral`).

    **Setup for OpenAI:**
    1.  Set `llmProvider` to `"openai"`.
    2.  Provide your OpenAI API key in the `apiKey` field.
    3.  Specify your desired model in `defaultOpenAIModel`.

*   **`conference_agent_instructions.json`:**
    *   Defines role-specific instructions exclusively for the different personas within the `ConferenceTool` (multi-model debate).
    *   Keys are agent roles (e.g., "Idea_Generator", "Critical_Evaluator"), and values are their instruction sets.
    *   Managed via `GET /api/instructions/conference_agent/:agentRole` and `POST /api/instructions/conference_agent/:agentRole`.
*   **`agent_instructions_template.json`:**
    *   This file stores general-purpose and role-specific instructions that can be applied to the LLM by various tools (like `CodeGeneratorTool`) or other operations that utilize the `generateFromLocal` function with an `agentType` or `agentRole` option.
    *   It's a JSON object where keys represent a generic "agent type" or "role" (e.g., `coder_agent`, `global_instructions`, `ollama_specific_instructions`, `openai_specific_instructions`), and values are the corresponding instruction strings.
    *   The `generateFromLocal` function in `server.js` can be passed an `agentType` and/or `agentRole` in its `options` parameter. These are used to retrieve the relevant instructions from this file, which are then prepended to the user's prompt.
    *   This allows for customization of LLM behavior for specific tasks or contexts.
    *   If the file doesn't exist, it will be created automatically when an endpoint tries to access or modify it.
    *   **Managed via API Endpoints:**
        *   `GET /api/instructions/:agentType?`
        *   `POST /api/instructions/:agentType`
        (See "Agent Instructions API" section below for details).
*   **`model_categories.json`:**
    *   Used by an API endpoint (`/api/ollama-models/categorized`) to group available Ollama models (and display static/remote models like OpenAI) in the UI based on keywords in their names or predefined categories.

## API Endpoints

The backend exposes several API endpoints for interaction and configuration. Key endpoints include:

*   `/execute-autonomous-task` (POST, GET): Initiates an agent task.
*   `/api/settings` (GET, POST): Manages backend settings from `backend_config.json`.
*   `/api/confirm-action/:confirmationId` (POST): Handles user responses to safety confirmations.
*   `/api/ollama/ping` (GET): Tests connectivity to the configured Ollama server.
*   `/api/ollama-models/categorized` (GET): Retrieves categorized LLM models.
*   `/api/ollama/pull-model` (POST): Triggers pulling an Ollama model.

### Conference Agent Instructions API (`conference_agent_instructions.json`)
*   **`GET /api/instructions/conference_agent/:agentRole`**:
    *   Retrieves the instructions for a specific `agentRole` within the `ConferenceTool`.
    *   Example: `GET /api/instructions/conference_agent/Arbiter`
*   **`POST /api/instructions/conference_agent/:agentRole`**:
    *   Updates the instructions for a specific `agentRole`.
    *   Request Body: `{ "instructions": "New instruction text for this role." }`
    *   Example: `POST /api/instructions/conference_agent/Arbiter` with the JSON body.

### General Agent Instructions API (`agent_instructions_template.json`)
*   **`GET /api/instructions/:agentType?`** (Note: `:agentType` is optional here):
    *   Retrieves instructions from `agent_instructions_template.json`.
    *   If `agentType` is specified (e.g., `coder_agent`), it returns the instructions for that type: `{ "coder_agent": "You are a coding assistant..." }`.
    *   If `agentType` is "all" or omitted, it returns the entire JSON object from the file.
    *   If the specified `agentType` is not found, returns a 404 error.
    *   If `agent_instructions_template.json` does not exist, it will be created with an empty object `{}` and that will be returned.
    *   Examples:
        *   `GET /api/instructions/coder_agent` - Returns instructions for `coder_agent`.
        *   `GET /api/instructions/all` - Returns all instructions.
        *   `GET /api/instructions` - Returns all instructions.
*   **`POST /api/instructions/:agentType`**:
    *   Updates or adds instructions for a specific `agentType` in `agent_instructions_template.json`.
    *   The `agentType` URL parameter is mandatory and cannot be "all".
    *   Request Body: Must be a JSON object like `{ "instructions": "New instruction text for this agent type." }`.
    *   If `agent_instructions_template.json` does not exist, it will be created.
    *   Example: `POST /api/instructions/vue_expert` with JSON body `{"instructions": "You are an expert Vue.js developer..."}`. This will add or update the "vue_expert" entry.

## Key Backend Files & Modules

*   **`server.js`:** The main Express application file. Handles API routing, sets up middleware, initializes the `AgentExecutor` (`initializeAgentExecutor`), manages the main task execution loop (`handleExecuteAutonomousTask`), orchestrates the confirmation flow, and handles SSE communication.
*   **`fsAgent.js`:** A module providing low-level, sandboxed file system operations (CRUD for files/directories, path resolution) within the defined `workspaceDir`.
*   **`gitAgent.js`:** A module for executing Git commands (add, commit, push, pull, revert) within the project repository.
*   **`codeGenerator.js`:** Contains logic for scaffolding directories and generating code (e.g., Vue components, services) based on structured plans (`codeGenPlan`).
*   **`langchain_tools/*.js`:** Individual files defining the custom Langchain `Tool` classes available to the agent.
*   **`common.js` (in `langchain_tools`):** Defines shared elements like `ConfirmationRequiredError`.

## Development & Testing

The backend includes a suite of automated tests using Jest.

*   **Test Location:** Tests are located in `backend/tests/` for integration tests and alongside the tools in `backend/langchain_tools/` (e.g., `fs_tools.test.js`) for unit tests.
*   **Running Tests:**
    ```bash
    cd backend
    npm test
    ```
*   **Testing Strategy:**
    *   **Unit Tests:** Focus on individual Langchain tools. Dependencies (like `fsAgent`, `gitAgent`, `generateFromLocal`) are mocked to test tool logic in isolation, including input parsing, output formatting, error handling, and the `ConfirmationRequiredError` mechanism for `safetyMode`.
    *   **Integration Tests:** Target `server.js` functionality. Core agent flows (simple tasks, individual and batch confirmations, error propagation) are tested by mocking the LLM clients (`ChatOpenAI`, `ChatOllama`) and the Langchain tools to return predefined responses or throw specific errors. This verifies the control flow, SSE event generation, and state management in `server.js`.

```
