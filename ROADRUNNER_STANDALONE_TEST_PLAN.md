# Roadrunner Standalone Application - Manual Test Plan

This document provides manual test cases to verify the functionality of the standalone Roadrunner application, which consists of the Electron app defined by `roadrunner/electron.js` and the frontend `roadrunner/frontend/src/App.vue`.
TokomakAI Desktop includes an integrated version via the `roadrunnercore` module that runs in a modal from the Toko32 dashboard. Tests here focus only on the independent application.

## 1. Prerequisites

Before starting the tests, ensure the following setup is complete:

1.  **Build Frontend**:
    *   The `roadrunner/frontend/` application needs to be built so that `roadrunner/frontend/dist/index.html` exists.
    *   Navigate to the `roadrunner/frontend/` directory.
    *   If a `package.json` exists with a build script (e.g., `npm run build`), run it.
        ```bash
        cd roadrunner/frontend
        # Check for build script in package.json, e.g., "build": "vite build"
        # If it exists (it does in this project):
        npm install # If not done already
        npm run build
        cd ../.. # Return to project root or roadrunner/ directory
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

### Test Case 2: Predefined Task Set (Legacy 'Module') Scanning and Loading (Coder Tab)

*   **Steps**:
    1.  Ensure the "Coder" tab is active.
    2.  Observe the "Module" dropdown.
    3.  Click the "Module" dropdown.
    4.  Select a module from the list (e.g., "Front: someModule" or "Back: anotherModule").
    5.  (Optional) To test error case: Temporarily rename or remove the `roadrunner/roadmap/front` directory (or one configured via `backend_config.json`/env vars). Refresh the modules list using the refresh button next to the dropdown.
*   **Expected Result**:
    1.  The "Module" dropdown is populated with items. Each item should represent a `.md` file found in the configured directories for predefined task sets (legacy 'modules') (e.g., `roadrunner/roadmap/front/` and `roadrunner/roadmap/back/`).
    2.  The display text for modules should be user-friendly (e.g., "Front: heron", "Back: vulturecore").
    3.  The `value` associated with each option should be in the format `type/moduleName` (e.g., `front/heron`, `back/vulturecore`).
    4.  When a module is selected, its content (parsed tasks) should be displayed in the main task display area below the controls.
    5.  If a configured directory for predefined task sets does not exist or is empty, the dropdown should reflect this (e.g., be empty or show an error/message). If all roadmap directories are inaccessible, the list should be empty, and a message like "No roadmap files found" might appear.
    6.  The Electron main process console (for `electron.js`) should log the directories for predefined task sets it's using and any errors encountered during scanning.

### Test Case 3: Custom Task File Upload (Coder Tab)

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
    2.  The "Module" dropdown selection changes to "Uploaded File" (or a similar indicator).
    3.  An entry appears in the "Execution Log" panel (if implemented for this action) or the UI updates to show tasks from the file, indicating successful loading.
    4.  If an invalid file type is selected (though the `accept` attribute should filter), or if the file cannot be read, an appropriate error message should ideally be handled (current implementation might just fail silently or log to console).

### Test Case 4: Ollama Model Loading (Coder & Brainstorming Tabs)

*   **Steps**:
    1.  Ensure the Ollama server is running and accessible at `http://localhost:11434` with models available.
    2.  Navigate to the "Coder" tab.
    3.  Observe the "Model" dropdown. Click the circular refresh button next to it.
    4.  Navigate to the "Brainstorming" tab.
    5.  Observe the "Model (Brainstorming)" dropdown.
    6.  (Error Case) Stop the Ollama server.
    7.  Click the refresh button next to the "Model" select on the "Coder" tab again (or reload the app).
*   **Expected Result**:
    1.  Both "Model" dropdowns (on Coder and Brainstorming tabs) are populated with:
        *   A "Remote (OpenAI/ChatGPT)" option (if still hardcoded or configured).
        *   Models fetched from the running Ollama instance, prefixed with "Ollama:" (e.g., "Ollama: llama3").
    2.  The "Execution Log" (Coder tab) might show a message about successful model loading.
    3.  If Ollama is not accessible (Error Case step 6 & 7), an error message should be displayed in the "Execution Log" or near the model dropdown. The dropdowns should then only contain default/fallback models like "Remote (OpenAI/ChatGPT)".

### Test Case 5: Brainstorming Tab Functionality

*   **Steps**:
    1.  Ensure the Ollama server is running.
    2.  Navigate to the "Brainstorming" tab.
    3.  Select an available Ollama model from the "Model (Brainstorming)" dropdown (e.g., "Ollama: llama3").
    4.  Type a simple prompt (e.g., "What is the capital of France?") into the chat input textarea.
    5.  Press Enter or click the "Send" button.
*   **Expected Result**:
    1.  The user's typed message appears in the chat history panel, marked as "You:".
    2.  A "Waiting for [Model Name]..." message might briefly appear.
    3.  The selected Ollama model processes the prompt, and its response appears in the chat history, marked with the model's name (e.g., "Ollama: llama3:").
    4.  If the model interaction fails or an error occurs (e.g., Ollama server stops responding), an appropriate error message is displayed within the chat interface or in a dedicated error area.
    5.  The Electron main process console (for `electron.js`) should show logs related to the `send-brainstorming-chat` IPC call and the subsequent fetch to Ollama.

### Test Case 6: Run Executor Functionality (Coder Tab)

*   **Steps**:
    1.  Ensure the `roadrunner/backend/server.js` is running.
    2.  Ensure the Ollama server is running (as the backend might try to use it based on the model selected).
    3.  Navigate to the "Coder" tab in the Roadrunner application.
    4.  **Scenario A: Using a Predefined Task Set (Legacy 'Module')**
        a.  Select a module from the "Module" dropdown (e.g., one that contains simple, understandable tasks).
    5.  **Scenario B: Using Uploaded Content**
        a.  Alternatively, upload a custom task file with simple content, for example:
            ```
            This is a test document. Please summarize it.
            ```
    6.  Select an available Ollama model from the "Model" dropdown (e.g., "Ollama: llama3"). If "Remote" is chosen, ensure backend is configured for it or expect it to default/fail gracefully.
    7.  Select a "Mode" (e.g., "full" or "summary").
    8.  Click the "Run" button.
*   **Expected Result**:
    1.  The "Execution Log" panel becomes active and displays messages in real-time.
    2.  Initial messages should indicate:
        *   If a predefined task set (legacy 'module') was used, that its content was read successfully (e.g., "Successfully read content from roadmap/...").
        *   If an uploaded file was used, that its content is being used.
        *   That the task is being sent to the backend endpoint `/process-roadmap-content`.
    3.  Subsequently, SSE messages from the backend should appear in the log. This includes:
        *   Log entries from the backend (e.g., "Backend received request...", "Constructed LLM prompt...").
        *   Chunks of the LLM's response as they are streamed from the backend. These might be prefixed with a type like `llm_chunk` or similar, based on how `generateFromLocal` streams.
        *   A final "Execution complete" or "Processing finished" message from the backend.
    4.  The backend server's console (`roadrunner/backend/server.js` terminal) should show:
        *   A log entry for the `POST /process-roadmap-content` request, including mode, model, and content length.
        *   Logs related to the LLM call (e.g., prompt sent to Ollama, stream starting/ending).
    5.  If any errors occur (e.g., backend cannot connect to LLM, content is malformed for the chosen mode), error messages should be displayed in the "Execution Log".

### Test Case 7: Window Controls

*   **Steps**:
    1.  In the application window's custom header (top right), click the "X" button.
*   **Expected Result**:
    1.  The Roadrunner application window closes.
    2.  The Electron process terminates.

This test plan aims to cover the core functionalities of the standalone Roadrunner application. Additional tests for specific edge cases or detailed configuration options can be added as needed.The manual test plan `ROADRUNNER_STANDALONE_TEST_PLAN.md` has been created in the `roadrunner/` directory.

It includes:
1.  **Prerequisites**: Detailed steps for building the frontend, starting the backend server, launching the standalone Electron application, and ensuring Ollama is running.
2.  **Test Cases**:
    *   **Application Launch & Initial UI**: Verifying the app starts and the UI loads correctly without errors.
    *   **Roadmap Scanning and Loading (Coder Tab)**: Testing the population of the "Module" dropdown from roadmap files and the display of content upon selection. Includes an error case for misconfigured directories.
    *   **Custom Task File Upload (Coder Tab)**: Testing the loading and parsing of tasks from a user-selected local file.
    *   **Ollama Model Loading (Coder & Brainstorming Tabs)**: Verifying that Ollama models are fetched and displayed in the model selection dropdowns. Includes an error case for when Ollama is inaccessible.
    *   **Brainstorming Tab Functionality**: Testing the chat interaction with a selected Ollama model.
    *   **Run Executor Functionality (Coder Tab)**: Testing the end-to-end process of selecting/uploading content, choosing a model/mode, clicking "Run", and observing the streamed SSE output from the backend in the "Execution Log".
    *   **Window Controls**: Testing the custom close button.

Each test case includes specific steps and detailed expected results for verification.

This completes the subtask. I will now submit the report.
