# Roadrunner Standalone Application - Manual Test Plan

This document provides manual test cases to verify the functionality of the standalone Roadrunner application, which consists of the Electron app defined by `roadrunner/electron.js` and the frontend `roadrunner/frontend/src/App.vue`.
TokomakAI Desktop includes an integrated version via the `roadrunnercore` module that runs in a modal from the Toko32 dashboard. Tests here focus only on the independent application.

## 1. Prerequisites

Before starting the tests, ensure the following setup is complete:

1.  **Build Frontend**:
    *   The frontend application needs to be built so that `frontend/dist/index.html` exists (relative to the project root).
    *   Navigate to the main project directory (e.g., `roadrunner/`).
    *   Install dependencies and build the frontend from the project root.
        ```bash
        # Navigate to the project root directory (e.g., 'roadrunner/')
        # Install dependencies (if not done already or if package.json changed)
        npm install

        # Build the frontend
        npm run build
        # This command uses vite.config.mjs which is configured
        # to build the frontend from ./frontend and output to ./frontend/dist/
        ```

2.  **Start Backend Server**:
    *   The `roadrunner/backend/server.js` must be running.
    *   Open a terminal, navigate to `roadrunner/backend/`, and run:
        ```bash
        cd roadrunner/backend
        npm install # If not done already
        npm start
        ```
    *   The backend should be listening on `http://localhost:3030`. Verify this from its console output.

3.  **Start Standalone Roadrunner Electron Application**:
    *   The main file for this Electron app is `roadrunner/electron.js`.
    *   The `package.json` in the `roadrunner/` directory should have a script to start it (e.g., `"start": "electron ."`, assuming `electron.js` is specified as `main`).
    *   Open another terminal, navigate to the `roadrunner/` directory, and run:
        ```bash
        cd roadrunner
        npm install # If not done already (for Electron dependency)
        npm start 
        ```
    *   Alternatively, if `npm start` is not configured in `roadrunner/package.json` to point to `electron.js`, you can run `electron .` directly from the `roadrunner/` directory if Electron is globally installed or use `npx electron .`.

4.  **Ollama Server**:
    *   Ensure an Ollama server is running locally at `http://localhost:11434`.
    *   Verify that it has at least one model downloaded and available (e.g., `llama3`, `codellama`). You can check by visiting `http://localhost:11434/api/tags` in a browser or using curl.

## 2. Test Cases

### Test Case 1: Application Launch & Initial UI

*   **Steps**:
    1.  Follow all prerequisite steps to build the frontend, start the backend server, and launch the Roadrunner Electron application from the `roadrunner/` directory.
*   **Expected Result**:
    1.  The Roadrunner application window (titled "Roadrunner AI Executor" or similar, based on `App.vue`) appears.
    2.  The UI defined in `roadrunner/frontend/src/App.vue` loads correctly.
    3.  The default view shows three main tabs: "Coder", "Brainstorming", and "Configuration". The "Coder" tab is active by default.
    4.  Check the Electron main process console (the terminal where you ran `npm start` for Electron) for any errors related to `electron.js` execution.
    5.  Open the renderer process DevTools (usually Ctrl+Shift+I or Cmd+Option+I within the app) and check the Console tab for any JavaScript errors from `App.vue` or related frontend code. No critical errors should be present.

### Test Case 2: Custom Task File Upload (Coder Tab)

*   **Steps**:
    1.  Navigate to the "Coder" tab.
    2.  Click the "Choose File" button for "Custom Task File (.md, .txt)".
    3.  Select a local text file (e.g., a simple `.txt` or `.md` file with a few lines of text representing tasks).
        Example `test_tasks.md`:
        ```markdown
        - Create a new component named TestComponent.
        - Add a button to TestComponent.
        - Style the button.
        ```
*   **Expected Result**:
    1.  The content of the selected file is parsed, and tasks are displayed in the main task display area.
    2.  An entry appears in the "Executor Output" panel indicating the file was processed and generic tasks created.
    3.  If an invalid file type is selected (though the `accept` attribute should filter), or if the file cannot be read, an appropriate error message should ideally be handled.

### Test Case 3: Ollama Model Loading (Coder & Brainstorming Tabs)

*   **Steps**:
    1.  Ensure the Ollama server is running and accessible at `http://localhost:11434` with models available.
    2.  Navigate to the "Coder" tab.
    3.  Observe the "Default Task Model" dropdown. Click the circular refresh button next to it.
    4.  Navigate to the "Brainstorming" tab.
    5.  Observe the "Brainstorming Model" dropdown.
    6.  (Error Case) Stop the Ollama server.
    7.  Click the refresh button next to the "Default Task Model" select on the "Coder" tab again (or reload the app).
*   **Expected Result**:
    1.  Both model dropdowns (on Coder and Brainstorming tabs) are populated with models fetched from the running Ollama instance, categorized (e.g., "OLLAMA", "OPENAI").
    2.  The "Executor Output" (Coder tab) should show a message about successful model loading or any errors.
    3.  If Ollama is not accessible (Error Case step 6 & 7), an error message should be displayed in the "Executor Output" or near the model dropdown. The dropdowns should then show "Models unavailable" or similar.

### Test Case 4: Brainstorming Tab Functionality

*   **Steps**:
    1.  Ensure the Ollama server is running.
    2.  Navigate to the "Brainstorming" tab.
    3.  Select an available Ollama model from the "Brainstorming Model" dropdown (e.g., "Ollama: llama3").
    4.  Type a simple prompt (e.g., "What is the capital of France?") into the chat input textarea.
    5.  Press Enter or click the "Send" button.
*   **Expected Result**:
    1.  The user's typed message appears in the chat history panel, marked as "You:".
    2.  A "Waiting for [Model Name]..." message might briefly appear.
    3.  The selected Ollama model processes the prompt, and its response appears in the chat history, marked with the model's name (e.g., "llama3:").
    4.  If the model interaction fails or an error occurs (e.g., Ollama server stops responding), an appropriate error message is displayed within the chat interface or in a dedicated error area.
    5.  The Electron main process console (for `electron.js`) should show logs related to the `sendBrainstormingChat` IPC call and the subsequent fetch to Ollama.

### Test Case 5: Run Executor Functionality (Coder Tab)

*   **Steps**:
    1.  Ensure the `roadrunner/backend/server.js` is running.
    2.  Ensure the Ollama server is running.
    3.  Navigate to the "Coder" tab in the Roadrunner application.
    4.  Upload a custom task file with simple content, for example:
        `test_run.txt`:
        ```
        This is a test document. Please summarize it.
        ```
    5.  Select an available Ollama model from the "Default Task Model" dropdown (e.g., "Ollama: llama3"). This model will be assigned to the new task by default.
    6.  The uploaded task should appear in the "Session Tasks" list. Click on it to make it active.
    7.  Click the "Run Active Task" button.
*   **Expected Result**:
    1.  The "Executor Output" panel becomes active and displays messages in real-time.
    2.  Initial messages should indicate:
        *   That the uploaded file's content is being used to create a task.
        *   That the task is being sent to the backend endpoint for execution.
    3.  Subsequently, SSE messages from the backend should appear in the log. This includes:
        *   Log entries from the backend (e.g., "Backend received request...", "Constructed LLM prompt...").
        *   Chunks of the LLM's response as they are streamed from the backend.
        *   A final "Execution complete" or "Processing finished" message from the backend.
    4.  The backend server's console (`roadrunner/backend/server.js` terminal) should show:
        *   A log entry for the task execution request.
        *   Logs related to the LLM call (e.g., prompt sent to Ollama, stream starting/ending).
    5.  If any errors occur (e.g., backend cannot connect to LLM), error messages should be displayed in the "Executor Output".

### Test Case 6: Window Controls

*   **Steps**:
    1.  In the application window's custom header (top right), click the "X" button.
*   **Expected Result**:
    1.  The Roadrunner application window closes.
    2.  The Electron process terminates.

This test plan aims to cover the core functionalities of the standalone Roadrunner application. Additional tests for specific edge cases or detailed configuration options can be added as needed.
