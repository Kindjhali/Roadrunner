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

## Receiving Conference Events

The frontend component listens for the following events using `window.electronAPI.on<EventName>(handler)`:

### 1. `window.electronAPI.onConferenceStreamChunk((event, data) => {})`

*   **Purpose**: Streams individual turns or log entries from the ongoing conference.
*   **`data` (Object)**: Can be one of a few structures, typically identified by a `type` field:
    *   **Turn Event**:
        *   `type` (String): `"turn"`
        *   `speaker` (String): Identifier for who is speaking (e.g., "ModelA", "ModelB", "Arbiter", or the actual model name).
        *   `message` (String): The content of the turn/utterance.
    *   **Arbiter Summary (Intermediate)**: This might be used if the arbiter provides thoughts or summaries before the final result.
        *   `type` (String): `"arbiter_summary"`
        *   `speaker` (String): Typically "Arbiter" or the arbiter model name.
        *   `message` (String): The arbiter's intermediate message.
        *   `model_a_response` (String, Optional): A specific segment attributed to Model A by the arbiter.
        *   `model_b_response` (String, Optional): A specific segment attributed to Model B by the arbiter.

### 2. `window.electronAPI.onConferenceStreamError((event, errorDetails) => {})`

*   **Purpose**: Signals an error occurred during the conference stream.
*   **`errorDetails` (Object)**:
    *   `error` (String): A human-readable error message.
    *   `details` (Object, Optional): Additional details or context about the error.

### 3. `window.electronAPI.onConferenceStreamEnd((event, summary) => {})`

*   **Purpose**: Signals that the conference has completed successfully and provides the final summary.
*   **`summary` (Object)**:
    *   `final_response` (String): The final, synthesized response from the arbiter.
    *   `model_a_response` (String): The complete final response or contribution from Model A, as determined by the arbiter.
    *   `model_b_response` (String): The complete final response or contribution from Model B, as determined by the arbiter.
    *   (Other summary fields can be added as needed).

## Cleaning Up Listeners

### `window.electronAPI.removeAllConferenceListeners()`

*   **Purpose**: Called by the frontend (e.g., in `beforeUnmount`) to request the removal of all active listeners for conference events related to this tab/component. The Electron main process or preload script should ensure that the corresponding `ipcRenderer.removeAllListeners()` or individual `removeListener()` calls are made for all the `on<EventName>` channels.
