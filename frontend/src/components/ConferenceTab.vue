<template>
  <div class="conference-tab">
    <h2>Model Conference</h2>

    <div class="model-selection-section">
      <div>
        <label for="modelA-select">Select Model A:</label>
        <select id="modelA-select" v-model="selectedModelA" class="conference-model-select">
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

        <select id="modelB-select" v-model="selectedModelB" class="conference-model-select">
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
        <select id="arbiter-select" v-model="selectedArbiter" class="conference-model-select">
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

      // Setup listeners
      if (window.electronAPI.onConferenceStreamChunk) {
        window.electronAPI.onConferenceStreamChunk((event, data) => {
          this.handleConferenceEvent(data);
        });
      } else {
        console.warn('[ConferenceTab] onConferenceStreamChunk API is not available.');
      }

      if (window.electronAPI.onConferenceStreamError) {
        window.electronAPI.onConferenceStreamError((event, errorDetails) => {
          this.handleConferenceEvent({ type: 'error', message: errorDetails.error, details: errorDetails.details });
        });
      } else {
        console.warn('[ConferenceTab] onConferenceStreamError API is not available.');
      }

      if (window.electronAPI.onConferenceStreamEnd) {
        window.electronAPI.onConferenceStreamEnd((event, summary) => {
          this.handleConferenceEvent({ type: 'complete', summary: summary });
        });
      } else {
        console.warn('[ConferenceTab] onConferenceStreamEnd API is not available.');
      }
    } else {
      console.warn('[ConferenceTab] Electron API (window.electronAPI) not available for mounting conference listeners.');
      this.error = "Conference Tab functionality is currently unavailable. The required backend integration (Electron API) is missing. Please ensure the application is running in the correct Electron environment and all preload scripts are loaded.";
    }
  },
  beforeUnmount() {
    if (window.electronAPI && window.electronAPI.removeAllConferenceListeners) {
      console.log('[ConferenceTab] Removing all conference listeners.');
      window.electronAPI.removeAllConferenceListeners();
    } else {
      console.warn('[ConferenceTab] removeAllConferenceListeners API is not available.');
    }
  }
};
</script>


