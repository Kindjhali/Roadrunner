# Roadrunner Standalone Application - Manual Test Plan

This document provides manual test cases to verify the functionality of the standalone Roadrunner application, which consists of the Electron app defined by `electron.js` and the primary frontend component `frontend/src/App.vue`.
Tests here focus on the independent application.

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
    2.  The UI defined in `frontend/src/App.vue` loads correctly.
    3.  The default view shows four main tabs: "Coder", "Brainstorming", "Conference", and "Configuration". The "Coder" tab is active by default.
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
    1.  The content of the selected file populates the 'Task Description' textarea on the Coder tab.
    2.  An entry appears in the 'Agent Output' panel indicating the file content was loaded into the task description.
    3.  If an invalid file type is selected (though the `accept` attribute should filter), or if the file cannot be read, an appropriate error message should ideally be handled by the UI or logged.

### Test Case 3: Ollama Model Loading (Coder Tab)

*   **Steps**:
    1.  Ensure the Ollama server is running and accessible at `http://localhost:11434` with models available.
    2.  Navigate to the "Coder" tab.
    3.  Observe the "Default Task Model" dropdown. Click the circular refresh button next to it if models are not immediately visible.
    4.  (Error Case) Stop the Ollama server.
    5.  Click the refresh button next to the "Default Task Model" select on the "Coder" tab again (or reload the app).
*   **Expected Result**:
    1.  The "Default Task Model" dropdown on the Coder tab is populated with models fetched from the running Ollama instance, categorized.
    2.  The 'Agent Output' panel (Coder tab) should show a system message about successful model loading or any errors encountered during the fetch.
    3.  If Ollama is not accessible (Error Case step 4 & 5), an error message should be displayed in the 'Agent Output' panel and/or near the model dropdown. The dropdown should then show "Models unavailable" or similar, and the Ollama status banner at the top should indicate a connection issue.
*   **Note:** The Brainstorming and Conference tabs will also require model selection when their features are fully integrated. The "Default Task Model" list from the Coder tab might be shared or re-used.

### Test Case 4: Brainstorming Tab Functionality

*   **Status:** Currently, the Brainstorming tab in `App.vue` is a placeholder. This test case outlines the intended functionality pending full integration.
*   **Intended Steps (Brief):**
    1.  Navigate to the "Brainstorming" tab.
    2.  Select an available LLM model from a dedicated dropdown on this tab.
    3.  Type a prompt into a chat input field.
    4.  Click a "Send" button or press Enter.
*   **Intended Expected Result (Brief):**
    1.  The user's message and the LLM's response appear sequentially in a chat history view on this tab.
    2.  Errors during model interaction (e.g., API errors, connection issues) are clearly displayed.
    3.  Conversation context is maintained for follow-up messages.

### Test Case 5: Run Executor Functionality (Coder Tab)

*   **Steps**:
    1.  Ensure the `roadrunner/backend/server.js` is running.
    2.  Ensure the Ollama server is running and accessible.
    3.  Navigate to the "Coder" tab in the Roadrunner application.
    4.  In the "Task Description" textarea, type a simple task, for example: "Create a file named 'test_output.txt' with the content 'Hello Roadrunner Executor!'".
    5.  Select an available Ollama model from the "Default Task Model" dropdown (e.g., "llama3").
    6.  Ensure the "Enable Safety Mode" checkbox is checked.
    7.  Click the "Run Task" button.
*   **Expected Result**:
    1.  The "Agent Output" panel becomes active and displays messages in real-time.
    2.  Initial messages should indicate that the task is being sent to the backend for execution.
    3.  Subsequently, SSE messages from the backend should appear in the log. This includes:
        *   Log entries from the backend (e.g., agent thoughts, tool selection).
        *   Chunks of the LLM's response/reasoning as they are streamed.
        *   If the task involves a modifying action (like creating a file with Safety Mode on), a "CONFIRMATION_REQUEST" log should appear, and a modal dialog should pop up (see Test Case 6).
        *   A final "EXECUTION_COMPLETE" or similar message from the backend upon task completion or termination.
    4.  The backend server's console (`roadrunner/backend/server.js` terminal) should show:
        *   A log entry for the task execution request.
        *   Logs related to the LLM call (e.g., prompt sent to Ollama, stream starting/ending) and tool usage.
    5.  If any errors occur (e.g., backend cannot connect to LLM, tool error), error messages should be displayed in the "Agent Output".

### Test Case 6: Safety Mode Confirmation (Coder Tab)
*   **Title:** Test Case 6: Safety Mode Confirmation (Coder Tab)
*   **Steps:**
    1.  Ensure backend and Ollama are running.
    2.  In `App.vue` "Coder" tab, ensure "Enable Safety Mode" is CHECKED.
    3.  Enter a task description that requires a modifying action (e.g., "Create a file named 'test_safety.txt' with content 'hello safety mode'").
    4.  Select an appropriate model (e.g., one known to use file system tools) from the "Default Task Model" dropdown.
    5.  Click "Run Task".
*   **Expected Result:**
    1.  The "Agent Output" panel shows the agent planning to create the file (e.g., logs indicating intent to use `CreateFileTool`).
    2.  A confirmation modal dialog appears, displaying details of the proposed file creation (e.g., Tool: `CreateFileTool`, Input: path `test_safety.txt` and content `hello safety mode`).
    3.  Click "Approve" on the modal.
    4.  The file `test_safety.txt` is created in the backend's configured workspace directory (typically `roadrunner/output/`).
    5.  The "Agent Output" panel shows the tool execution result and that the agent is proceeding.
    6.  (Optional) Repeat the task, but this time click "Deny" on the modal. Verify the file is not created and the "Agent Output" panel shows the agent acknowledging the denial and potentially re-planning or halting.

### Test Case 7: Configuration Tab - LLM Provider Change
*   **Title:** Test Case 7: Configuration Tab - LLM Provider Change
*   **Steps:**
    1.  Navigate to the "Configuration" tab.
    2.  Observe the current "LLM Provider" selection.
    3.  Change the "LLM Provider" using the dropdown (e.g., from "ollama" to "openai", or vice-versa).
    4.  Optionally, fill in the "API Key" if changing to a provider that requires it (e.g., OpenAI) and you intend to test execution.
    5.  Navigate to the "Coder" tab and then back to the "Configuration" tab.
    6.  Reload the Electron application (e.g., using Ctrl+R or Cmd+R if dev tools are open, or by closing and restarting `npm start` for the root).
    7.  After reload, navigate back to the "Configuration" tab.
*   **Expected Result:**
    1.  The selected LLM provider in the dropdown persists immediately after selection and upon returning to the Configuration tab (before app reload), due to Vuex state management.
    2.  After reloading the Electron application, the chosen LLM provider should still be selected on the Configuration tab, indicating persistence of settings.
    3.  (Full backend test, optional for this UI-focused case) If settings are correctly saved and reloaded by the backend upon its restart (or if it dynamically picks up changes), subsequent tasks initiated from the "Coder" tab would attempt to use the newly selected provider. Backend logs would confirm which LLM is being initialized/used.

### Test Case 8: Window Controls

*   **Steps**:
    1.  In the application window's custom header (top right), click the "X" (close) button.
*   **Expected Result**:
    1.  The Roadrunner application window closes.
    2.  The Electron process terminates.

This test plan aims to cover the core functionalities of the standalone Roadrunner application. Additional tests for specific edge cases or detailed configuration options can be added as needed.
