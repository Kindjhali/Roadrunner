# Roadrunner: Setup and Features

This document provides a summary of the Roadrunner application's features and the steps required to set up the development environment, build, and run the application. It describes the standalone version located in the `roadrunner/` directory. TokomakAI Desktop includes a separate `roadrunnercore` module that reuses this logic for an integrated modal interface within the Toko32 module.

## Features Overview

Roadrunner is an experimental desktop application designed to function as an autonomous AI agent. It leverages Large Language Models (LLMs) to understand, plan, and execute complex tasks. Key features include:

- **Task Definition:** Users can define an "Overall Task Goal" and a "Sequence of Steps" through the UI.
- **LLM Integration:** Connects to LLM services (primarily Ollama for local models) to interpret natural language steps and generate content (e.g., code, text). LLM responses are streamed to the UI.
- **Task Execution Engine:**
  - Parses steps into actionable commands (e.g., `generic_step`, `create_file_with_llm_content`, `read_file_to_output`, `git_operation`, `show_workspace_tree`).
  - Supports basic step chaining using outputs from previous steps (e.g., `{{outputs.variable_name}}`).
  - Maintains a `taskContext` to store outputs.
- **`taskAgent` Decision Support**: Roadrunner's inference capabilities are leveraged by the `taskAgent` feature (within `tokomakaicore`). When `taskAgent` parses a user's natural language command, it consults Roadrunner (via `roadrunnerProxy.js`) to determine the optimal sequence of modules and actions to achieve the user's goal. Roadrunner proposes a pathway, which `taskAgent` then uses to execute the task. (Details in `Info/taskAgent.sniper.md`).
- **Filesystem Integration (`fsAgent.js`):**
  - Performs operations (create, read, update, delete files/directories, display tree) primarily within the `roadrunner/output/` directory for safety.
  - Includes path traversal prevention and automatic `.bak` backups for overwritten/deleted files.
- **Git Automation (`gitAgent.js`):**
  - Integrates Git commands (`add`, `commit`, `push`, `pull`) via the `git_operation` step.
- **Session Management:** Supports saving and loading collections of tasks.
- **Autonomous Execution:** Aims to carry out defined steps sequentially with minimal manual intervention.
- **Error Handling & Logging:** Errors and logs are streamed to the UI.

For the most detailed and current feature list, API endpoint definitions, and available task step types, please refer to the main [README.md](./README.md) file.

## Setup and Running the Application

To set up and run the Roadrunner application locally, follow these steps:

1.  **Prerequisites:**

    - Node.js and npm must be installed.
    - Git must be installed (for Git operations).
    - An Ollama instance (or a compatible LLM service) should be running and accessible if you intend to test features involving LLM interaction.

2.  **Install Backend Dependencies:**

    - Open a terminal.
    - Navigate to the `roadrunner/backend` directory.
    - Run: `npm install`

3.  **Install Root/Electron & Frontend Dependencies:**

    - In the terminal, navigate to the `roadrunner` root directory.
    - Run: `npm install`
    - _Note: You might encounter some warnings about vulnerabilities or deprecated packages, which generally don't prevent the app from running._

4.  **Start the Backend Server:**

    - In the terminal, navigate to the `roadrunner/backend` directory.
    - Run: `npm start`
    - This will start the Node.js server on `http://127.0.0.1:3030` by default. Keep this terminal window open and the server running.

5.  **Start the Electron Application:**
    - In a new terminal window, navigate to the `roadrunner` root directory.
    - Run:
      ```bash
      # Install dependencies (if first time or after changes to root/frontend package.json)
      # npm install # This was step 3, usually done once.

      # Build the frontend and launch the Electron app
      npm start
      ```
    - This `npm start` command in the root directory typically handles building the frontend (using Vite, as configured in `package.json`) and then launches the Electron application.

The application should now be running. The backend server (from step 4) needs to remain running for the Electron application to function correctly.
