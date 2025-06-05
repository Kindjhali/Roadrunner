<template>
  <div class="conference-tab">
    <h2>Model Conference</h2>

    <div class="model-selection-section">
      <div>
        <label for="modelA-select">Select Model A:</label>
        <select id="modelA-select" v-model="selectedModelA">
          <option :value="null" disabled>-- Select Model A --</option>
          <optgroup v-for="(group, category) in categorizedModels" :key="category" :label="category.toUpperCase()">
            <option v-for="model in group" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </optgroup>
        </select>
      </div>
      <div>
        <label for="modelB-select">Select Model B:</label>
        <select id="modelB-select" v-model="selectedModelB">
          <option :value="null" disabled>-- Select Model B --</option>
          <optgroup v-for="(group, category) in categorizedModels" :key="category" :label="category.toUpperCase()">
            <option v-for="model in group" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </optgroup>
        </select>
      </div>
      <div>
        <label for="arbiter-select">Select Arbiter Model:</label>
        <select id="arbiter-select" v-model="selectedArbiter">
          <option :value="null" disabled>-- Select Arbiter --</option>
          <optgroup v-for="(group, category) in categorizedModels" :key="category" :label="category.toUpperCase()">
            <option v-for="model in group" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </optgroup>
        </select>
      </div>
    </div>

    <div class="prompt-section">
      <label for="conference-prompt">Enter your prompt:</label>
      <textarea id="conference-prompt" v-model="prompt" rows="5" placeholder="e.g., What is the best strategy to reduce technical debt?"></textarea>
      <button @click="startConference" :disabled="isLoading || isStreaming">
        {{ isLoading || isStreaming ? (isStreaming ? 'Streaming...' : 'Processing...') : 'Start Conference' }}
      </button>
    </div>

    <div v-if="isLoading || isStreaming" class="loading-section">
      <p><i>{{ isStreaming ? 'Live conference in progress...' : 'Initiating conference... Please wait.' }}</i></p>
    </div>

    <div v-if="conferenceLog.length > 0" class="conversation-log-section">
      <h3>Conversation Log:</h3>
      <div v-for="(turn, index) in conferenceLog" :key="index" class="turn">
        <strong>{{ turn.speaker }}:</strong>
        <pre>{{ turn.message }}</pre>
      </div>
    </div>

    <div v-if="result && !error" class="result-section">
      <h3>Conference Result (Arbiter's View):</h3>
      <pre>{{ formattedResult }}</pre>
      <div v-if="result.model_a_response">
        <h4>Model A's Response:</h4>
        <pre>{{ result.model_a_response }}</pre>
      </div>
      <div v-if="result.model_b_response">
        <h4>Model B's Response:</h4>
        <pre>{{ result.model_b_response }}</pre>
      </div>
    </div>

    <div v-if="error" class="error-section">
      <h3>Error:</h3>
      <pre>{{ error }}</pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConferenceTab',
  data() {
    return {
      prompt: '',
      result: null, // Will store the full { final_response, model_a_response, model_b_response }
      error: null,
      isLoading: false,
      isStreaming: false, // Added for SSE state
      selectedModelA: null,
      selectedModelB: null,
      selectedArbiter: null,
      conferenceLog: [], // To store conversation turns { speaker, message }
    };
  },
  computed: {
    categorizedModels() {
      return this.$store?.getters?.getCategorizedModels || {};
    },
    allAvailableModels() {
      let models = [];
      for (const category in this.categorizedModels) {
        models = models.concat(this.categorizedModels[category]);
      }
      return Array.from(new Map(models.map(m => [m.id, m])).values());
    },
    formattedResult() {
      if (this.result && typeof this.result === 'object' && this.result.final_response) {
        return this.result.final_response;
      }
      // Fallback if result is a direct string (e.g. from an older version or different error)
      if (typeof this.result === 'string') {
        return this.result;
      }
      return 'No final response from arbiter to display.';
    }
  },
  methods: {
    startConference() { // No longer async directly, IPC call will handle async nature
      this.result = null;
      this.error = null;
      this.isLoading = true;
      this.isStreaming = false; // Reset streaming state
      this.conferenceLog = [];

      if (!this.prompt.trim()) {
        this.error = 'Prompt cannot be empty.';
        this.isLoading = false;
        return;
      }

      if (!this.selectedModelA || !this.selectedModelB || !this.selectedArbiter) {
        this.error = 'Please select all three models (Model A, Model B, Arbiter).';
        this.isLoading = false;
        return;
      }

      const payload = {
        prompt: this.prompt,
        model_a_id: this.selectedModelA,
        model_b_id: this.selectedModelB,
        arbiter_model_id: this.selectedArbiter,
      };

      if (window.electronAPI && window.electronAPI.startConferenceStream) {
        console.log('[ConferenceTab] Calling startConferenceStream with payload:', payload);
        window.electronAPI.startConferenceStream(payload);
        // isLoading is already true, isStreaming will be set by an event or first chunk
      } else {
        this.error = "Error: Conference streaming API is not available. Ensure you're in the Electron environment and preload scripts are loaded.";
        this.isLoading = false;
        console.error("[ConferenceTab] window.electronAPI.startConferenceStream is not available.");
      }
    },

    handleConferenceEvent(eventData) {
      console.log('[ConferenceTab] Received conference event:', eventData);
      if (!this.isStreaming && eventData.type !== 'error' && eventData.type !== 'complete') {
        // First chunk of data means streaming has started
        this.isStreaming = true;
        this.isLoading = false; // No longer just loading, now actively streaming
      }

      switch (eventData.type) {
        case 'turn':
          this.conferenceLog.push({ speaker: eventData.speaker, message: eventData.message });
          break;
        case 'arbiter_summary':
          // The arbiter_summary might be a part of the log or a preliminary result
          this.conferenceLog.push({ speaker: eventData.speaker || 'Arbiter', message: eventData.message });
          // If the summary also contains model responses, you might want to update this.result partially
          if (eventData.model_a_response) {
            if (!this.result) this.result = {};
            this.result.model_a_response = eventData.model_a_response;
          }
          if (eventData.model_b_response) {
            if (!this.result) this.result = {};
            this.result.model_b_response = eventData.model_b_response;
          }
          break;
        case 'error':
          this.error = `${eventData.message}${eventData.details ? ` (Details: ${JSON.stringify(eventData.details)})` : ''}`;
          this.isLoading = false;
          this.isStreaming = false;
          break;
        case 'complete':
          this.result = eventData.summary; // This should contain final_response, model_a_response, model_b_response
          this.isLoading = false;
          this.isStreaming = false;
          // Optionally, add a final "Conference Complete" message to the log
          this.conferenceLog.push({ speaker: 'System', message: 'Conference complete. Final summary generated.' });
          break;
        default:
          console.warn('[ConferenceTab] Received unknown conference event type:', eventData.type);
      }
    },
  },
  mounted() {
    if (window.electronAPI) {
      window.electronAPI.onConferenceStreamChunk && window.electronAPI.onConferenceStreamChunk((event, data) => {
        this.handleConferenceEvent(data);
      });
      window.electronAPI.onConferenceStreamError && window.electronAPI.onConferenceStreamError((event, errorDetails) => {
        this.handleConferenceEvent({ type: 'error', message: errorDetails.error, details: errorDetails.details });
      });
      window.electronAPI.onConferenceStreamEnd && window.electronAPI.onConferenceStreamEnd((event, summary) => {
        this.handleConferenceEvent({ type: 'complete', summary: summary });
      });
    } else {
      console.warn('[ConferenceTab] Electron API not available for mounting conference listeners.');
    }
  },
  beforeUnmount() {
    if (window.electronAPI && window.electronAPI.removeAllConferenceListeners) {
      console.log('[ConferenceTab] Removing all conference listeners.');
      window.electronAPI.removeAllConferenceListeners();
    }
  }
};
</script>

<style scoped>
.conference-tab {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin: 10px;
}

.model-selection-section {
  margin-bottom: 15px;
  display: flex;
  gap: 15px;
}

.model-selection-section > div {
  flex: 1;
}

.model-selection-section label {
  display: block;
  margin-bottom: 5px;
}

.model-selection-section select {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
  box-sizing: border-box; /* Ensures padding doesn't expand width */
}

.prompt-section textarea {
  width: 100%;
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.prompt-section button {
  padding: 10px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.prompt-section button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.loading-section, .result-section, .error-section {
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.conversation-log-section {
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.conversation-log-section .turn {
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #f0f0f0; /* Slightly different background for turns */
}

.conversation-log-section .turn strong {
  display: block;
  margin-bottom: 4px;
  color: #333; /* Darker text for speaker */
}


.error-section {
  color: red;
  background-color: #ffe0e0;
  border-color: #ffc0c0;
}

pre {
  white-space: pre-wrap; /* Allows text to wrap */
  word-wrap: break-word; /* Breaks long words */
  background-color: #fff;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

h3, h4 {
  margin-top: 0;
}
</style>
