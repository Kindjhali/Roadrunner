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
    *   Triggering batch confirmations after a configurable number of modifying operations (`CONFIRM_AFTER_N_OPERATIONS`).
*   **Conversational Memory:** Features request-scoped conversational memory (`ConversationBufferWindowMemory`), allowing the agent to recall context from earlier parts of the current task execution, even across asynchronous user confirmation steps.
*   **Real-time SSE Streaming:** The frontend receives detailed, real-time updates on the agent's thoughts, chosen tools, tool inputs/outputs, confirmation requests, and LLM token streams via Server-Sent Events (SSE).
*   **Configurable Backend:** Key settings including LLM provider choices, API keys, default models, workspace paths, agent persona instructions (for tools), and model categorizations are externally configurable through JSON files located in `backend/config/`.
*   **Automated Backend Tests:** The backend includes a suite of unit tests for its Langchain tools and integration tests for core agent execution flows, ensuring reliability and maintainability. These can be run using `npm test` in the `backend/` directory.

## High-Level Architecture

The system is composed of a Vue.js frontend and a Node.js backend.

*   **Frontend (`frontend/`):**
    *   Provides the user interface for submitting tasks in natural language.
    *   Displays real-time, structured logs of the agent's progress and actions via SSE.
    *   Manages user interaction for safety confirmations (individual and batch).

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
        *   Copy `config/backend_config.example.json` to `config/backend_config.json`.
        *   Edit `config/backend_config.json` to set your desired `llmProvider` ('ollama' or 'openai').
        *   If using 'openai', provide your `apiKey`.
        *   Set your preferred `defaultOllamaModel` (if using Ollama) and `defaultOpenAIModel` (if using OpenAI).
        *   Ensure `OLLAMA_BASE_URL` is correct (defaults to `http://localhost:11434`).
        *   If using Ollama, ensure your Ollama instance is running and the specified models are pulled (e.g., `ollama pull llama3`).
3.  **Frontend Setup:**
    *   Navigate to the `frontend/` directory: `cd frontend`
    *   Install dependencies: `npm install`

## Running the Application

*   **Backend:**
    *   From the `backend/` directory, run: `npm run dev` (or `npm start` if configured).
*   **Frontend:**
    *   From the `frontend/` directory, run: `npm run dev`
    *   Open your browser to the address indicated by the frontend development server (usually `http://localhost:5173` or similar).

*(Adjust the "Running the Application" section if this is an Electron application that starts with a single command from the root.)*

## Development

### Backend Testing

The backend includes a suite of automated tests.
*   Navigate to the `backend/` directory.
*   Run tests using: `npm test`
*   This uses Jest for unit tests (for individual Langchain tools) and integration tests (for core agent flows, SSE, and confirmation logic).
