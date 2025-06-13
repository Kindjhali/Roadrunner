# Conference Tab IPC API Specification

This document outlines the Inter-Process Communication (IPC) API expected by `frontend/src/components/ConferenceTab.vue` for its model conference streaming functionality. These APIs are assumed to be exposed on the `window.electronAPI` object by an Electron preload script.

## Initiating a Conference

### `window.electronAPI.startConferenceStream(payload)`

*   **Purpose**: Called by the frontend to request the start of a new model conference. The backend (Electron main process) should handle this by initiating a conference task and streaming back events.
*   **`payload` (Object)**:
    *   `prompt` (String): The user-provided prompt for the conference.
    *   `model_a_id` (String): The ID/name of the model selected for participant A.
    *   `model_b_id` (String): The ID/name of the model selected for participant B.
    *   `arbiter_model_id` (String): The ID/name of the model selected as the arbiter.
    *   `history` (Array): Optional array of `{ role, content }` messages representing prior turns.

## Receiving Conference Events

The frontend component listens for the following events using `window.electronAPI.on(channelName, handler)` or individual `window.electronAPI.on<EventName>(handler)` methods if defined by the preload script. The `electron.cjs` `start-conference-stream` handler forwards backend SSE events to the renderer using specific channel names:

### 1. `conference-stream-llm-chunk`
   Listener: `window.electronAPI.on('conference-stream-llm-chunk', (event, data) => {})`
*   **Purpose**: Streams content chunks from an LLM (a participant in the conference).
*   **`data` (Object)**:
    *   `type` (String): `"llm_chunk"` (This is part of the original SSE message forwarded by `electron.cjs`)
    *   `content` (String): The text content of the chunk.
    *   `speaker` (String): Identifier for the speaking model (e.g., "ModelA", "ModelB", "Arbiter", or the actual model name/ID).

### 2. `conference-stream-log-entry`
   Listener: `window.electronAPI.on('conference-stream-log-entry', (event, data) => {})`
*   **Purpose**: Provides log messages or system status updates related to the conference.
*   **`data` (Object)**:
    *   `type` (String): `"log_entry"` (This is part of the original SSE message or set by `electron.cjs` for its own logs)
    *   `message` (String): The log message content.
    *   `speaker` (String): Typically "System" or an identifier for the source of the log.
    *   `data` (Object, Optional): If the log entry is for an unknown SSE event type, this will contain the original unknown message.

### 3. `conference-stream-error`
   Listener: `window.electronAPI.on('conference-stream-error', (event, data) => {})`
*   **Purpose**: Signals an error occurred during the conference stream.
*   **`data` (Object)**:
    *   `error` (String): A human-readable error message.
    *   `details` (String | Object, Optional): Additional details or context about the error. This could be a string or an object containing more structured error information from the backend or EventSource.
    *   If the error originates from a backend SSE `step_failed_options` event, the `data` object will be the full payload of that SSE message.

### 4. `conference-stream-complete`
   Listener: `window.electronAPI.on('conference-stream-complete', (event, data) => {})`
*   **Purpose**: Signals that the conference has completed successfully.
*   **`data` (Object)**:
    *   `type` (String): `"execution_complete"` (This is part of the original SSE message)
    *   `message` (String, Optional): A summary message about the completion.
    *   `final_output` (String | Object, Optional): The final result or output of the conference (e.g., arbiter's decision, combined text). The structure of `final_output` depends on the backend agent's implementation.
    *   Other fields from the backend's `execution_complete` SSE message may also be present.

## Cleaning Up Listeners

### `window.electronAPI.removeAllConferenceListeners()`

*   **Purpose**: Called by the frontend (e.g., in `beforeUnmount`) to request the removal of all active listeners for conference events related to this tab/component. The Electron main process or preload script should ensure that the corresponding `ipcRenderer.removeAllListeners()` or individual `removeListener()` calls are made for all the `on<EventName>` channels.
