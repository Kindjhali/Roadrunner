# Testing Plan

This document outlines the manual testing procedures for features implemented and refactored in recent tasks.

## I. Unit Tests for IPC Handlers (Automated)

**Location**: `TokomakAI.Desktop/tests/ipc.spec.js`

**Framework**: Vitest (Jest compatible)

**Setup**:
1.  Ensure `vitest` is listed in `devDependencies` in `TokomakAI.Desktop/package.json`.
2.  Modify the `test` script in `TokomakAI.Desktop/package.json` to: `"test": "vitest run"`.
3.  Run `npm install` in `TokomakAI.Desktop/` if `vitest` was added or updated.
4.  Execute tests using `npm test` from the `TokomakAI.Desktop/` directory.

**Covered Handlers**:
*   `list-directory`
*   `read-file-content`

**Mocking**:
*   `fs.promises.readdir` and `fs.promises.readFile` are mocked to avoid actual file system interaction and to simulate various scenarios.

**Test Cases (Automated in `ipc.spec.js`)**:

*   **`list-directory` Handler**:
    *   **Success**: Returns a correctly formatted list of files and directories.
    *   **Error - Not Found**: Simulates `fs.promises.readdir` throwing an "ENOENT" error and verifies the handler returns `{ success: false, error: '...' }`.
    *   **Error - Permission Denied**: Simulates `fs.promises.readdir` throwing an "EACCES" error and verifies the handler returns `{ success: false, error: '...' }`.

*   **`read-file-content` Handler**:
    *   **Success**: Returns the correct file content as a string.
    *   **Error - Not Found**: Simulates `fs.promises.readFile` throwing an "ENOENT" error.
    *   **Error - Permission Denied**: Simulates `fs.promises.readFile` throwing an "EACCES" error.

**Expected Outcome**: All unit tests should pass.

## II. Manual Test Plan for UI Components

### A. `FileExplorer.vue` (`TokomakAI.Desktop/src/components/layout/FileExplorer.vue`)

**Prerequisites**:
*   TokomakAI.Desktop application is built and running.
*   The File Explorer UI is accessible (e.g., within the "Explorer" panel).

**Test Cases**:

1.  **Initial Display**:
    *   **Action**: Open the application and navigate to where `FileExplorer.vue` is displayed.
    *   **Expected**: The file explorer shows the content of the initial default path (e.g., `.`, the application's root, or user's home directory if configured). Files and directories are listed.
    *   **Visual Cue Check**: Verify directories are visually distinct from files (e.g., different icons 📁 vs 📄, bold text for directories).

2.  **Directory Navigation - Into Directory**:
    *   **Action**: Click on a listed directory name.
    *   **Expected**: The view updates to show the contents of the clicked directory. The path bar updates to the new directory path.

3.  **Directory Navigation - Up to Parent**:
    *   **Action**: Navigate into a subdirectory. Then, click the "Up" button.
    *   **Expected**: The view updates to show the contents of the parent directory. The path bar updates.
    *   **Action**: Continue clicking "Up" until at the root or initial path.
    *   **Expected**: The "Up" button might become disabled or do nothing if at the defined root.

4.  **Directory Navigation - Manual Path Entry**:
    *   **Action**: Type a valid absolute path to a known directory in the path input field and press Enter or click "Go".
    *   **Expected**: The view updates to show the contents of the entered directory.
    *   **Action**: Type an invalid/non-existent path and press Enter or click "Go".
    *   **Expected**: An error message "Error listing directory: ..." should be displayed. The file list area should be empty or show the previous valid listing.

5.  **File Content Viewing**:
    *   **Action**: Click on a listed text-based file (e.g., `.txt`, `.js`, `.json`, `.md`).
    *   **Expected**: The content of the file is displayed below the file list in a designated area (e.g., within a `<pre>` tag). The path of the selected file is displayed as a header for the content view.
    *   **Action**: Click the "Close File" button.
    *   **Expected**: The file content view disappears.

6.  **Error Handling - Directory Access**:
    *   **Action**: Attempt to navigate to a directory for which the application does not have read permissions (manual setup might be needed for this, or use a known restricted system directory if testing with appropriate caution). Or, type an invalid path in the input bar.
    *   **Expected**: An error message like "Error listing directory: permission denied" or "Error listing directory: no such file or directory" is displayed.

7.  **Error Handling - File Read**:
    *   **Action**: Attempt to read a file that is locked or for which permissions are denied (manual setup may be needed). Or, if possible, simulate this via a backend modification if direct testing is too complex. (Note: The IPC handler unit tests cover `fs` errors, this is more about the UI displaying that error).
    *   **Expected**: A file read error message like "Error reading file: permission denied" or "Error reading file: no such file or directory" is displayed in the file content view area.

### B. `TaskRunner.vue` (`TokomakAI.Desktop/src/components/tools/TaskRunner.vue`)

**Prerequisites**:
*   TokomakAI.Desktop application is built and running.
*   The Task Runner UI is accessible (e.g., via a sidebar button).
*   `roadrunner/backend/server.js` is **running** for most tests, except where noted.

**Test Cases**:

1.  **Default Task Display**:
    *   **Action**: Open the Task Runner view.
    *   **Expected**: The `textarea` is pre-populated with a sample JSON task.

2.  **Valid Task Execution & SSE Display**:
    *   **Action**: Use the default pre-filled task (or paste a known valid simple task, e.g., creating a file). Click "Run Task".
    *   **Expected**:
        *   "Run Task" button might change to "Executing..." or become disabled.
        *   SSE messages start appearing in the display area below.
        *   Messages should be formatted clearly (timestamp, type, content).
        *   Expect to see messages like `[INFO] Initiating task execution...`, `[LOG_ENTRY] Processing Step 1...`, `[FILE_WRITTEN] ...`, `[EXECUTION_COMPLETE] ...`.
        *   The button reverts to "Run Task" after completion.

3.  **Invalid JSON Task**:
    *   **Action**: Modify the JSON in the `textarea` to be invalid (e.g., remove a comma, bracket). Click "Run Task".
    *   **Expected**: An error message "Invalid JSON: ..." is displayed near the `textarea`. No request is sent to the backend.

4.  **Backend Connection Error**:
    *   **Action**: Ensure the `roadrunner/backend/server.js` is **NOT** running. Click "Run Task" with a valid JSON task.
    *   **Expected**: An error message "Error connecting to backend: Connection to backend SSE stream failed or was interrupted." (or similar, depending on exact fetch/EventSource error) is displayed. SSE display area might show an initial client-side error message.

5.  **SSE Message Formatting**:
    *   **Action**: During a successful task execution, observe various types of SSE messages.
    *   **Expected**:
        *   `log_entry` messages are displayed.
        *   `error` messages (if any deliberately triggered by a test task) are displayed distinctly (e.g., red text).
        *   `file_written` messages show the path.
        *   Other specific types (`confirmation_required`, `proposed_plan`, etc.) are displayed with their type and content.
        *   Messages with a `details` object in the SSE data should have the details pretty-printed in a `<pre>` block.

## III. Manual Test Plan for Backend Integration (UI <-> Backend)

**Prerequisites**:
*   `roadrunner/backend/server.js` is started and running.
*   `TokomakAI.Desktop` application is built and running.

**Test Cases**:

1.  **Execute `createFile` Task**:
    *   **Action**:
        1.  Navigate to the Task Runner view in the TokomakAI Desktop app.
        2.  Use the default sample task, which includes a `createFile` step:
            ```json
            {
              "task_description": "Test task from TokomakAI Desktop UI",
              "steps": [
                {
                  "type": "createFile",
                  "details": {
                    "filePath": "tokomakai_desktop_test.txt",
                    "content": "Hello from TokomakAI Desktop via backend task execution! @ TIMESTAMP" 
                  }
                }
              ],
              "safetyMode": "true",
              "isAutonomousMode": "false"
            }
            ```
            (Optionally, update the content to include a fresh timestamp for each run).
        3.  Click "Run Task".
    *   **Expected**:
        1.  SSE messages are displayed in the Task Runner UI, showing the progress (e.g., "Processing Step 1: Type: createFile...", "File created successfully at: ...").
        2.  Verify that the file `tokomakai_desktop_test.txt` is created in the backend's configured `WORKSPACE_OUTPUT_DIR`. The location of this directory will depend on the backend's path configuration (see Section IV).
        3.  The content of the created file matches what was specified in the task.

2.  **Execute `generic_step` Task**:
    *   **Action**:
        1.  In the Task Runner, modify the task to include or primarily be a `generic_step`:
            ```json
            {
              "task_description": "Test generic_step from UI",
              "steps": [
                {
                  "type": "generic_step",
                  "details": {
                    "description": "This is a test prompt for the generic_step from the UI."
                  }
                }
              ],
              "safetyMode": "true",
              "isAutonomousMode": "false"
            }
            ```
        2.  Click "Run Task".
    *   **Expected**:
        1.  SSE messages appear in the UI.
        2.  One of the log entries should show the LLM prompt being sent (if an LLM is configured and connected to the backend) or at least the attempt to process the generic step.
        3.  The log should include the response from the LLM if available, or a message indicating the step was processed.

## IV. Manual Test Plan for Backend Path Configuration (`roadrunner/backend/server.js`)

**Prerequisites**:
*   Access to the environment where `roadrunner/backend/server.js` can be run.
*   Ability to set environment variables for the Node.js process.
*   Ability to create/modify `roadrunner/backend/config/backend_config.json`.
*   TokomakAI.Desktop application (or any HTTP client capable of POSTing to `/execute-autonomous-task`, like Postman/curl) to trigger file operations. The Task Runner UI is suitable.

**General Verification Method**:
*   After starting `roadrunner/backend/server.js`, check its console output for lines starting with `[Config]` or `[Paths]`. These lines indicate the source (environment variable, JSON config, default) and the resolved path for each configured directory.
*   Perform a file operation (e.g., the `createFile` task from Section III.1) and verify the file is created in the *expected* `WORKSPACE_OUTPUT_DIR` based on the active configuration.

**Test Cases**:

1.  **Test Case 1: Environment Variables**:
    *   **Action**:
        1.  Define custom paths for the following environment variables **before** starting the backend server (choose paths different from defaults and JSON config if present):
            *   `RR_WORKSPACE_DIR` (e.g., `/tmp/rr_ws_env` or `C:\temp\rr_ws_env`)
            *   `RR_LOG_DIR` (e.g., `/tmp/rr_logs_env` or `C:\temp\rr_logs_env`)
            *   `RR_FRONTEND_ROADMAP_DIR`
            *   `RR_BACKEND_ROADMAP_DIR`
            *   `RR_COMPONENT_DIR`
        2.  Ensure `roadrunner/backend/config/backend_config.json` either does not exist or does not define these same keys, or that its values are different, to confirm environment variables take precedence.
        3.  Start `roadrunner/backend/server.js`.
    *   **Expected**:
        1.  Backend console logs show that `WORKSPACE_OUTPUT_DIR`, `LOG_DIR`, `FRONTEND_ROADMAP_DIR`, etc., are using the paths set via environment variables. The log should explicitly state "Using environment variable (...)".
        2.  If you created the specified `RR_WORKSPACE_DIR` and `RR_LOG_DIR` paths and they didn't exist, verify the backend created them (if applicable, based on backend logic for auto-creation).
        3.  Execute a `createFile` task using the Task Runner UI (or other client). Verify the test file is created in the custom path specified by `RR_WORKSPACE_DIR`.
        4.  Check if logs are being written to the custom `RR_LOG_DIR` (e.g., `task-streamed-....log.md`).

2.  **Test Case 2: `backend_config.json`**:
    *   **Action**:
        1.  **Important**: Ensure the environment variables from Test Case 1 (`RR_WORKSPACE_DIR`, `RR_LOG_DIR`, etc.) are **unset** or cleared.
        2.  Create or modify `roadrunner/backend/config/backend_config.json`. Define custom paths for `workspaceDir`, `logDir`, `frontendRoadmapDir`, etc. Use paths different from defaults.
            Example `backend_config.json`:
            ```json
            {
              "workspaceDir": "../rr_ws_json", 
              "logDir": "../rr_logs_json",
              "frontendRoadmapDir": "./roadmap/front_json"
            }
            ```
            (Note: relative paths in JSON are relative to `roadrunner/backend/`)
        3.  Start `roadrunner/backend/server.js`.
    *   **Expected**:
        1.  Backend console logs show that the configured paths are being used from the JSON file. The log should explicitly state "Using JSON config (...)". Paths should be resolved correctly (e.g., `../rr_ws_json` becomes an absolute path like `/path/to/roadrunner/rr_ws_json`).
        2.  Execute a `createFile` task. Verify the test file is created in the custom path specified by `workspaceDir` in the JSON file (e.g., `roadrunner/rr_ws_json/tokomakai_desktop_test.txt`).
        3.  Check if logs are being written to the custom `logDir` from the JSON file.

3.  **Test Case 3: Default Paths**:
    *   **Action**:
        1.  Ensure relevant environment variables (`RR_...`) are **unset**.
        2.  Ensure `roadrunner/backend/config/backend_config.json` either **does not exist**, or is empty, or does not contain the keys for `workspaceDir`, `logDir`, etc. (Renaming it temporarily is a good way to test).
        3.  Start `roadrunner/backend/server.js`.
    *   **Expected**:
        1.  Backend console logs show that default paths are being used for `WORKSPACE_OUTPUT_DIR`, `LOG_DIR`, etc. The log should explicitly state "Using default (...)". Default paths are typically relative to `roadrunner/backend/` (e.g., `../output`, `../logs`).
        2.  Execute a `createFile` task. Verify the test file is created in the default `WORKSPACE_OUTPUT_DIR` (e.g., `roadrunner/../output/tokomakai_desktop_test.txt`, which resolves to `roadrunner/output/`).
        3.  Check if logs are being written to the default `LOG_DIR`.

4.  **Test Case 4: Path Resolution for Relative Paths in JSON config**:
    *   **Action**:
        1.  Unset relevant `RR_...` environment variables.
        2.  In `roadrunner/backend/config/backend_config.json`, set a path like `"workspaceDir": "./test_workspace_json_relative"` (which is relative to `roadrunner/backend/`).
        3.  Start `roadrunner/backend/server.js`.
    *   **Expected**:
        1.  The console log for `WORKSPACE_OUTPUT_DIR` should show the absolute path corresponding to `roadrunner/backend/test_workspace_json_relative/`.
        2.  A `createFile` task should create files within this resolved directory.

5.  **Test Case 5: Fallback and Directory Creation (Advanced)**
    *   **Action**:
        1. Set `RR_WORKSPACE_DIR` to a path that requires new directory creation, e.g., `/tmp/new_rr_test_ws/subdir` (ensure `/tmp/new_rr_test_ws` does not exist).
        2. Start backend.
    *   **Expected**:
        1. Backend logs indicate it's using `RR_WORKSPACE_DIR`.
        2. Backend logs indicate it created the directory `/tmp/new_rr_test_ws/subdir`.
        3. File operations work correctly within this new directory.
    *   **Action (Failure Fallback)**:
        1. Set `RR_WORKSPACE_DIR` to a path where creation would fail (e.g., `/root/no_permission_ws` if running as non-root).
        2. Start backend.
    *   **Expected**:
        1. Backend logs an error attempting to create the specified `RR_WORKSPACE_DIR`.
        2. Backend logs that it's falling back to the default `WORKSPACE_OUTPUT_DIR`.
        3. File operations use the default directory.

This comprehensive testing approach should help verify the functionality of the recent implementations.The unit test file `TokomakAI.Desktop/tests/ipc.spec.js` and the `TESTING_PLAN.md` document have been created.

**Summary of actions taken:**

1.  **Unit Tests (`ipc.spec.js`)**:
    *   Created `TokomakAI.Desktop/tests/ipc.spec.js`.
    *   Used Vitest (Jest-compatible) for structuring tests (`describe`, `it`, `expect`, `vi`).
    *   Mocked `fs.promises.readdir` and `fs.promises.readFile` using `vi.fn()` and `vi.mock('fs', ...)`.
    *   Included test cases for successful directory listing and file reading.
    *   Included test cases for "not found" (ENOENT) and "permission denied" (EACCES) errors for both IPC handlers.
    *   **Note**: The tests duplicate the handler logic from `main.js` because `main.js` doesn't currently export these handlers. Recommendations for refactoring `main.js` for better testability were included as comments in the spec file and noted in my thoughts.
    *   Instructions on how to run these tests (updating `package.json` script to `vitest run`) were also included as comments.

2.  **Manual Test Plan (`TESTING_PLAN.md`)**:
    *   Created `TESTING_PLAN.md` in the root directory.
    *   **Section I**: Detailed the setup and expected outcomes for the automated unit tests for IPC handlers.
    *   **Section II**: Provided comprehensive manual test cases for UI components:
        *   `FileExplorer.vue`: Covering navigation (into directories, up to parent, manual path entry), display of files/folders, file content viewing and closing, and error display for directory/file access issues.
        *   `TaskRunner.vue`: Covering default task display, valid task execution with SSE message observation, invalid JSON input, backend connection errors, and SSE message formatting.
    *   **Section III**: Outlined manual test steps for backend integration, specifically using the `TaskRunner.vue` to execute tasks (`createFile`, `generic_step`) on the `roadrunner/backend/server.js` and verifying SSE communication and file system effects.
    *   **Section IV**: Detailed manual test procedures for the backend path configuration, covering:
        *   Precedence of environment variables (`RR_...`).
        *   Usage of `backend_config.json`.
        *   Fallback to default paths.
        *   Correct resolution of relative paths in `backend_config.json`.
        *   Directory auto-creation and fallback mechanisms for user-specified paths.

All deliverables for this subtask have been created. The next step for a developer would be to ensure the Vitest setup is correctly configured in `package.json` and then run the unit tests. Following that, the manual test plan can be executed.
