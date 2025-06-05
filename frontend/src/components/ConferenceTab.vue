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

<style scoped>
.conference-tab {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin: 10px;
  /* Consider adding dark mode background for the whole tab if not already themed by parent */
  /* background-color: #1F2937; /* Tailwind gray-800 example */
  /* color: #D1D5DB; /* Tailwind gray-300 for text */
}

.model-selection-section {
  margin-bottom: 15px;
  display: flex;
  gap: 15px;
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
  color: #D1D5DB; /* Light text for labels in dark mode */
/*
.model-selection-section select {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;

  box-sizing: border-box;
 */

.conference-model-select {
  width: 100%;
  padding: 0.375rem 0.5rem; /* Smaller padding: py-1.5 px-2 equivalent */
  font-size: 0.875rem; /* text-sm */
  line-height: 1.25rem;
  color: #D1D5DB; /* Tailwind gray-300 for text */
  background-color: #374151; /* Tailwind gray-700 for background */
  border: 1px solid #4B5563; /* Tailwind gray-600 for border */
  border-radius: 0.25rem; /* Tailwind rounded */
  box-sizing: border-box;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  /* Basic SVG arrow for dark mode - can be improved or made a component */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 1.25em 1.25em;
}

.conference-model-select optgroup,
.conference-model-select option {
  background-color: #374151; /* Background for the dropdown list itself */
  color: #D1D5DB; /* Text color for options */
}

.conference-model-select option:hover {
  background-color: #4B5563; /* Darker hover for options */
}

.conference-model-select:focus {
  outline: none;
  border-color: #60A5FA; /* Tailwind blue-400 for focus */
  box-shadow: 0 0 0 2px #3B82F660; /* Example focus ring */
}
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
  /* Consider dark mode for these sections too if the tab itself becomes dark */
}

.conversation-log-section {
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #4B5563; /* Darker border */
  border-radius: 4px;
  background-color: #1F2937; /* Dark background for log area */
}

.conversation-log-section h3 {
 color: #E5E7EB; /* Lighter text for heading in dark mode */
}

.conversation-log-section .turn {
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #374151; /* Darker border for turns */
  border-radius: 4px;
  background-color: #374151; /* Dark background for individual turns */
}
.conversation-log-section .turn strong {
  display: block;
  margin-bottom: 4px;
  color: #9CA3AF; /* Lighter gray for speaker */
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
  color: #FCA5A5; /* Tailwind red-300 for dark mode error text */
  background-color: #5B2121; /* Tailwind red-900 for dark mode error background */
  border-color: #7F1D1D; /* Tailwind red-800 for dark mode error border */
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background-color: #1F2937; /* Tailwind gray-800 for pre background */
  color: #D1D5DB; /* Tailwind gray-300 for pre text */
  padding: 10px;
  border: 1px solid #374151; /* Tailwind gray-700 for pre border */
  border-radius: 4px;
}

h2 {
  color: #E5E7EB; /* Lighter text for main heading */
}
h3, h4 {
  margin-top: 0;
  color: #D1D5DB; /* Lighter text for sub-headings */
}
</style>
