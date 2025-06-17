// import store from './store'; // If accessing store directly, otherwise pass it in

class Executor {
  constructor(store) {
    this.eventSource = null;
    this.store = store; // Vuex store instance
    this._logBuffer = []; // Internal buffer before committing to store, for potential batching or complex logic
    this._logIdCounter = 0;
  }

  _getBaseUrl() {
    const host = this.store?.state?.backendHost || '127.0.0.1';
    const port = this.store?.state?.backendPort || 3030;
    return `http://${host}:${port}`;
  }

  _getNextLogId() {
    return this._logIdCounter++;
  }

  // Unified method to add log entries to the store
  // This will be the primary way components get log updates
  _commitLogEntry(logEntry) {
    if (this.store) {
      this.store.dispatch('addStructuredLog', logEntry);
    } else {
      // Fallback if store is not available (e.g., testing, or if not using Vuex for logs)
      console.warn("Vuex store not available in Executor, logging to console:", logEntry);
      this._logBuffer.push(logEntry); // Keep in internal buffer as a fallback
    }
  }

  startTaskExecution(taskDescription, safetyMode) {
    if (this.eventSource) {
      this.closeConnection();
    }

    // Clear previous logs for this new execution run from the Vuex store
    if (this.store) {
        this.store.commit('CLEAR_LOGS');
        this.store.commit('SET_CONFIRMATION_DETAILS', null); // Clear any previous confirmation
        this.store.commit('SET_IS_EXECUTING', true);
    }
    this._logIdCounter = 0; // Reset log ID counter

    const params = new URLSearchParams({
      task_description: taskDescription,
      safetyMode: safetyMode.toString(),
      // isAutonomousMode is true by default now on the backend for agent execution
    });

<<<<<<< HEAD
    // Backend defaults to 127.0.0.1:3333 (allowed by Electron CSP)
    // TODO: Make the base URL configurable
    const backendPort = this.store?.state?.backendPort || 3333; // Use store port or fallback
    const fullUrl = `http://127.0.0.1:${backendPort}/execute-autonomous-task?${params.toString()}`;
=======
    // Build backend URL from store configuration
    const fullUrl = `${this._getBaseUrl()}/execute-autonomous-task?${params.toString()}`;
>>>>>>> 77c7eb4619567bc74fe2ae1f8a7771e02cbda1f5

    this._commitLogEntry({
      id: this._getNextLogId(),
      type: 'SYSTEM_MESSAGE',
      message: `Connecting to backend for task: "${taskDescription}" (Safety Mode: ${safetyMode})`,
      timestamp: new Date(),
    });

    this.eventSource = new EventSource(fullUrl);

    this.eventSource.onopen = () => {
      console.log("[Executor] SSE Connection opened.");
      this._commitLogEntry({
        id: this._getNextLogId(),
        type: 'SYSTEM_MESSAGE',
        message: "SSE Connection established with backend.",
        timestamp: new Date(),
      });
    };

    this.eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        console.log("[Executor] SSE Message received:", parsedData);

        const logEntry = {
          id: this._getNextLogId(),
          type: parsedData.type.toUpperCase(), // Standardize type to uppercase
          message: parsedData.message || '', // Generic message if available
          data: parsedData,       // Store the full data object for flexibility in components
          timestamp: new Date(),
        };

        // Enhance message for specific types for better readability
        switch (parsedData.type) {
          case 'agent_event':
            logEntry.message = `Agent Event: ${parsedData.event_type}`;
            if (parsedData.data?.tool) { // For on_agent_action
                logEntry.message += ` - Tool: ${parsedData.data.tool}`;
            }
            if (parsedData.data?.output) { // For on_tool_end
                 logEntry.message += ` - Output (summary): ${String(parsedData.data.output).substring(0,100)}...`;
            }
            break;
          case 'llm_chunk':
            logEntry.type = 'LLM_CHUNK'; // More specific type
            logEntry.message = `LLM Chunk from ${parsedData.speaker || 'LLM'}: ${parsedData.content}`;
            logEntry.speaker = parsedData.speaker;
            logEntry.content = parsedData.content;
            break;
          case 'confirmation_required':
            logEntry.type = 'CONFIRMATION_REQUEST';
            logEntry.message = `Confirmation Required: ${parsedData.message}`;
            logEntry.confirmationId = parsedData.confirmationId;
            logEntry.details = parsedData.details || { toolName: parsedData.toolName, toolInput: parsedData.toolInput, type: parsedData.type };
            if (this.store) this.store.commit('SET_CONFIRMATION_DETAILS', logEntry);
            break;
          case 'log_entry': // Generic log from backend
            logEntry.type = 'LOG_ENTRY_SERVER';
            logEntry.message = parsedData.content || JSON.stringify(parsedData);
            break;
          case 'error':
            logEntry.type = 'ERROR_SERVER';
            logEntry.message = `Server Error: ${parsedData.content || parsedData.message || JSON.stringify(parsedData)}`;
            if (this.store) this.store.commit('SET_IS_EXECUTING', false);
            this.closeConnection(); // Often good to close on error
            break;
          case 'execution_complete':
            logEntry.type = 'EXECUTION_COMPLETE';
            logEntry.message = parsedData.message || "Task execution complete.";
            logEntry.final_output = parsedData.final_output;
            if (this.store) this.store.commit('SET_IS_EXECUTING', false);
            this.closeConnection();
            break;
          default:
            logEntry.message = `Unknown event type: ${parsedData.type}. Data: ${JSON.stringify(parsedData)}`;
        }
        this._commitLogEntry(logEntry);

      } catch (error) {
        console.error("[Executor] Error parsing SSE event data:", error, "Raw data:", event.data);
        this._commitLogEntry({
          id: this._getNextLogId(),
          type: 'ERROR_CLIENT',
          message: "Error parsing SSE event data from backend.",
          data: { raw: event.data, error: error.message },
          timestamp: new Date(),
        });
      }
    };

    this.eventSource.onerror = (error) => {
      console.error("[Executor] SSE Connection error:", error);
      this._commitLogEntry({
        id: this._getNextLogId(),
        type: 'ERROR_CONNECTION',
        message: "Error with SSE connection to backend. Task may have been interrupted.",
        data: error,
        timestamp: new Date(),
      });
      if (this.store) this.store.commit('SET_IS_EXECUTING', false);
      this.closeConnection();
    };
  }

  closeConnection() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log("[Executor] SSE Connection closed.");
      this._commitLogEntry({
        id: this._getNextLogId(),
        type: 'SYSTEM_MESSAGE',
        message: "SSE Connection closed.",
        timestamp: new Date(),
      });
      if (this.store) this.store.commit('SET_IS_EXECUTING', false);
    }
  }

  // Method to send confirmation back to the backend
  async sendConfirmation(confirmationId, confirmed) {
    if (!confirmationId) {
      console.error("[Executor] confirmationId is required to send confirmation.");
      return { success: false, message: "Missing confirmationId." };
    }
    try {
<<<<<<< HEAD
      // TODO: Make the base URL configurable
      const backendPort = this.store?.state?.backendPort || 3333; // Use store port or fallback
      const response = await fetch(`http://127.0.0.1:${backendPort}/api/confirm-action/${confirmationId}`, {
=======
      const response = await fetch(`${this._getBaseUrl()}/api/confirm-action/${confirmationId}`, {
>>>>>>> 77c7eb4619567bc74fe2ae1f8a7771e02cbda1f5
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      this._commitLogEntry({
        id: this._getNextLogId(),
        type: 'SYSTEM_MESSAGE',
        message: `Confirmation sent for ${confirmationId}. User confirmed: ${confirmed}. Server response: ${result.message}`,
        timestamp: new Date(),
      });
      if (this.store) this.store.commit('SET_CONFIRMATION_DETAILS', null); // Clear confirmation details
      // If the action was denied or if it was the final confirmation, the backend might close the SSE.
      // If it was approved and more actions/confirmations are expected, the SSE should remain open.
      // The backend's response to /api/confirm-action might also indicate if further confirmations are immediately pending.
      return { success: true, ...result };
    } catch (error) {
      console.error("[Executor] Error sending confirmation:", error);
      this._commitLogEntry({
        id: this._getNextLogId(),
        type: 'ERROR_CLIENT',
        message: `Error sending confirmation for ${confirmationId}: ${error.message}`,
        timestamp: new Date(),
      });
      if (this.store) this.store.commit('SET_CONFIRMATION_DETAILS', null);
      return { success: false, message: error.message };
    }
  }
}

export default Executor;
