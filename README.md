# AI Agent Task Execution System

This project implements an advanced AI agent powered by Langchain.js, capable of understanding natural language commands, planning execution steps, and utilizing a diverse set of tools to perform complex tasks. It supports interactions with both OpenAI and local Ollama language models, offering flexibility and power for various automation and generation needs.

## Features

*   **Dynamic Task Execution:** Employs a Langchain.js ReAct agent (for Ollama) or Functions agent (for OpenAI) for intelligent planning and execution of tasks based on natural language descriptions.
*   **Extensible Toolset:** The agent is equipped with a versatile suite of tools, including:
    *   **File System Management:** Create, read, update, and delete files and directories.
    *   **Git Version Control:** Stage changes, commit, push, pull, and revert commits.
    *   **Automated Code Generation:** Generate code snippets, Vue components, and services based on specifications.
    *   **Multi-Model Debates (`ConferenceTool`):** Facilitate structured discussions between multiple AI personas to explore topics and synthesize comprehensive answers.
*   **Flexible LLM Backend:** Supports both OpenAI API (e.g., GPT-3.5, GPT-4) and local Ollama models (e.g., Llama 3, Mistral, Phi-3). Configuration is managed via `backend/config/backend_config.json`.
*   **Interactive Safety Mode:** An optional `safetyMode` enhances control and prevents unintended changes by:
    *   Requiring user confirmation for individual modifying operations (e.g., writing a file, committing to Git).
*   **Conversational Memory:** Features request-scoped conversational memory (`ConversationBufferWindowMemory`), allowing the agent to recall context from earlier parts of the current task execution, even across asynchronous user confirmation steps.
*   **Real-time SSE Streaming:** The frontend receives detailed, real-time updates on the agent's thoughts, chosen tools, tool inputs/outputs, confirmation requests, and LLM token streams via Server-Sent Events (SSE).
*   **Configurable Backend:** Key settings including LLM provider choices, API keys, default models, workspace paths, agent persona instructions (for tools), and model categorizations are externally configurable through JSON files located in `backend/config/`.
*   **Automated Backend Tests:** The backend includes a suite of unit tests for its Langchain tools and integration tests for core agent execution flows, ensuring reliability and maintainability. These can be run using `npm test` in the `backend/` directory.

## High-Level Architecture

The system is composed of a Vue.js frontend and a Node.js backend.

*   **Frontend (`frontend/`):**
    *   Provides the user interface for submitting tasks in natural language.
    *   Displays real-time, structured logs of the agent's progress and actions via SSE.
    *   Manages user interaction for safety confirmations for individual actions.

*   **Backend (`backend/`):**
    *   Built with Node.js and Express.js.
    *   **`server.js`:** The core orchestrator. It initializes and runs the Langchain.js `AgentExecutor`, manages agent memory, handles the `safetyMode` confirmation lifecycle, processes API requests, and streams SSE updates to the frontend.
    *   **`langchain_tools/`:** This directory houses custom Langchain.js `Tool` classes. These tools provide the agent with its capabilities by wrapping the logic of underlying modules.
    *   **Core Modules (`fsAgent.js`, `gitAgent.js`, `codeGenerator.js`):** These modules contain the foundational logic for file system operations, Git interactions, and code generation tasks, respectively. They are utilized by the Langchain tools.
    *   **Configuration (`config/`):** Contains JSON files for all major backend configurations, allowing for easy customization without code changes.

## Setup

1.  **Clone the repository.**
2.  **Backend Setup:**
    *   Navigate to the `backend/` directory: `cd backend`
    *   Install dependencies: `npm install`
    *   Configure the backend:
        *   Copy `config/backend_config.example.json` to `config/backend_config.json` in the `backend/config/` directory.
        *   Edit `backend_config.json` to set your desired LLM provider and related settings. Key fields include:
            *   `llmProvider`: Set to "ollama" (default) or "openai".
            *   `apiKey`: If using "openai", provide your OpenAI API key here.
            *   `defaultOllamaModel`: Specify the default model for Ollama (e.g., "mistral", "llama3").
            *   `defaultOpenAIModel`: Specify the default model for OpenAI (e.g., "gpt-4", "gpt-3.5-turbo").
            *   `OLLAMA_BASE_URL`: The base URL for your Ollama instance (defaults to `http://localhost:11434`).
            *   Other paths like `componentDir`, `logDir`, and `workspaceDir` can also be configured.
        *   If using Ollama, ensure your Ollama instance is running and the specified models (e.g., `ollama pull llama3`) are available.
        *   **Configuration Precedence**: Settings are applied in the following order of priority: 1. Environment Variables (e.g., `RR_LLM_PROVIDER`), 2. Values in `backend_config.json`, 3. Default values coded into `server.js`.
3.  **Frontend Setup:**
    *   Navigate to the `frontend/` directory: `cd frontend`
    *   Install dependencies: `npm install`
4.  **Root Setup (for Electron):**
    *   Navigate to the project root directory (if you're not already there).
    *   Install dependencies: `npm install` (This installs Electron and other root-level dependencies).


## Running the Application (Electron App)

The primary way to run this application is as an Electron desktop app:

1.  **Ensure Setup is Complete:** Follow all steps in the "Setup" section (installing dependencies for root, backend, and frontend, and configuring the backend).
2.  **Build and Start:** From the **project root directory**, run:
    ```bash
    npm start
    ```
    This command typically executes the following (as defined in `package.json`):
    *   Builds the frontend application (`npm run build` in `frontend/`).
    *   Launches the Electron application using `electron.cjs`. The Electron window should load the built frontend.

### Development Mode (Alternative)

For development, you might prefer to run the backend and frontend services separately with hot-reloading:

*   **Backend:**
    *   Navigate to the `backend/` directory: `cd backend`
    *   Run: `npm run dev` (if a dev script with nodemon or similar is configured) or `npm start`.
    *   The backend server will typically start on `http://localhost:3030`.
*   **Frontend (Vite Dev Server):**
    *   Navigate to the `frontend/` directory: `cd frontend`
    *   Run: `npm run dev`
    *   Open your browser to the address indicated by the Vite development server (usually `http://localhost:5173` or similar).
    *   **Note:** When running in this mode, you are interacting directly with the frontend in your browser, not within the Electron shell. The Electron-specific APIs (`window.electronAPI`) might not be available or fully functional.

## Development

### Backend Testing

The backend includes a suite of automated tests.
*   Navigate to the `backend/` directory.
*   Run tests using: `npm test`
*   This uses Jest for unit tests (for individual Langchain tools) and integration tests (for core agent flows, SSE, and confirmation logic).
