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
        <button @click="openConferenceInstructions('model_a')" class="pelecanus-button-action text-xs ml-2">Edit Model A Instructions</button>
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
        <button @click="openConferenceInstructions('model_b')" class="pelecanus-button-action text-xs ml-2">Edit Model B Instructions</button>
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
        <button @click="openConferenceInstructions('arbiter')" class="pelecanus-button-action text-xs ml-2">Edit Arbiter Instructions</button>
      </div>
    </div>

    <div class="prompt-section">
      <label for="conference-prompt">Enter your prompt:</label>
      <textarea id="conference-prompt" v-model="prompt" rows="5" placeholder="e.g., What is the best strategy to reduce technical debt?"></textarea>
      <button @click="startConference" :disabled="isLoading || isStreaming">
        {{ isLoading || isStreaming ? (isStreaming ? 'Streaming...' : 'Processing...') : (conferenceLog.length === 0 ? 'Start Conference' : 'Send Message') }}
      </button>
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

      <!-- Consolidated Conference Log Messages Display -->
      <div v-if="logMessages.length > 0" class="conference-summary-log-terminal mt-3 p-2 bg-gray-750 rounded">
        <h4 class="text-md font-semibold text-gray-300 mb-1">Conference Detail Log:</h4>
        <div class="max-h-40 overflow-y-auto text-xs">
            <pre v-for="(line, idx) in logMessages" :key="'conf-log-' + idx">{{ line }}</pre>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-section">
      <h3>Error:</h3>
      <pre>{{ error }}</pre>
    </div>

    <!-- Enhanced System Logs / Conference Status Area -->
    <div class="system-and-conference-status-log-terminal mt-4 p-3 bg-gray-800 rounded-md">
      <div v-if="isLoading && !isStreaming">
        <p class="text-yellow-400 italic mb-2">Initiating conference... Please wait. Background activity:</p>
      </div>
      <div v-if="isStreaming">
        <p class="text-green-400 italic mb-2">Live conference in progress... Background activity:</p>
      </div>

      <!-- Always show generalBackendLogs if they exist, or a placeholder if loading and no logs yet -->
      <div v-if="generalBackendLogs.length > 0" class="max-h-60 overflow-y-auto text-xs">
        <pre v-for="(log, index) in generalBackendLogs" :key="`general-log-${index}`">{{ log }}</pre>
      </div>
      <div v-else-if="isLoading || isStreaming">
        <p class="text-gray-500 text-xs italic">(Waiting for background activity...)</p>
      </div>
      <div v-else-if="!generalBackendLogs.length">
         <!-- Optional: Message if no logs and not loading/streaming -->
         <!-- <p class="text-gray-500 text-xs italic">(No system logs to display at the moment.)</p> -->
      </div>
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
      conversationHistory: [], // History sent to backend { role, content }
      logMessages: [],
      generalBackendLogs: [], // Added for general backend logs
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
      this.logMessages = [];

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

      this.conferenceLog.push({ speaker: 'User', message: this.prompt });
      this.conversationHistory.push({ role: 'user', content: this.prompt });
      const payload = {
        prompt: this.prompt,
        model_a_id: this.selectedModelA,
        model_b_id: this.selectedModelB,
        arbiter_model_id: this.selectedArbiter,
        history: this.conversationHistory,
      };
      this.prompt = '';

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
          if (eventData.summary && Array.isArray(eventData.summary.log_messages)) {
            this.logMessages = eventData.summary.log_messages;
          }
          if (eventData.summary) {
            if (eventData.summary.model_a_response) {
              this.conferenceLog.push({ speaker: 'Model A', message: eventData.summary.model_a_response });
              this.conversationHistory.push({ role: 'model_a', content: eventData.summary.model_a_response });
            }
            if (eventData.summary.model_b_response) {
              this.conferenceLog.push({ speaker: 'Model B', message: eventData.summary.model_b_response });
              this.conversationHistory.push({ role: 'model_b', content: eventData.summary.model_b_response });
            }
            if (eventData.summary.final_response) {
              this.conferenceLog.push({ speaker: 'Arbiter', message: eventData.summary.final_response });
              this.conversationHistory.push({ role: 'arbiter', content: eventData.summary.final_response });
            }
          }
          this.isLoading = false;
          this.isStreaming = false;
          this.conferenceLog.push({ speaker: 'System', message: 'Conference complete. Final summary generated.' });
          break;
        default:
          console.warn('[ConferenceTab] Received unknown conference event type:', eventData.type);
      }
    },
    openConferenceInstructions(role) {
      this.$emit('edit-instructions', role);
    },
    setDefaultModels() {
      console.log('[ConferenceTab setDefaultModels] Attempting to set default models.');
      const models = this.allAvailableModels;
      if (!models || models.length === 0) {
        console.warn('[ConferenceTab setDefaultModels] No available models to set defaults.');
        return;
      }

      // Only set defaults if current selections are null
      if (this.selectedModelA === null && models.length > 0) {
        this.selectedModelA = models[0].id;
        console.log(`[ConferenceTab setDefaultModels] Set Model A to: ${models[0].name} (ID: ${this.selectedModelA})`);
      }

      if (this.selectedModelB === null && models.length > 1) {
        // Try to find a different model for B
        const modelB = models.find(m => m.id !== this.selectedModelA);
        if (modelB) {
          this.selectedModelB = modelB.id;
          console.log(`[ConferenceTab setDefaultModels] Set Model B to: ${modelB.name} (ID: ${this.selectedModelB})`);
        } else { // Fallback if only one unique model exists (e.g. models.length > 1 but all are same id)
          this.selectedModelB = models[0].id; // or models[1].id if sure models[1] exists
           console.log(`[ConferenceTab setDefaultModels] Set Model B (fallback) to: ${models[0].name} (ID: ${this.selectedModelB})`);
        }
      } else if (this.selectedModelB === null && models.length === 1) {
        this.selectedModelB = models[0].id; // Only one model, use it for B too
        console.log(`[ConferenceTab setDefaultModels] Set Model B (single model) to: ${models[0].name} (ID: ${this.selectedModelB})`);
      }


      if (this.selectedArbiter === null && models.length > 0) {
        if (models.length > 2) {
          // Try to find a model different from A and B
          const modelArbiter = models.find(m => m.id !== this.selectedModelA && m.id !== this.selectedModelB);
          if (modelArbiter) {
            this.selectedArbiter = modelArbiter.id;
            console.log(`[ConferenceTab setDefaultModels] Set Arbiter to: ${modelArbiter.name} (ID: ${this.selectedArbiter})`);
          } else { // Fallback if only two unique models (A and B might be different or same)
            // Prefer a model different from A if possible, or just the first one
            const fallbackArbiter = models.find(m => m.id !== this.selectedModelA) || models[0];
            this.selectedArbiter = fallbackArbiter.id;
            console.log(`[ConferenceTab setDefaultModels] Set Arbiter (fallback from 2 unique) to: ${fallbackArbiter.name} (ID: ${this.selectedArbiter})`);
          }
        } else if (models.length > 1) { // Only two models available in total (could be unique or same)
            // Try to pick one different from Model A for arbiter, if A and B ended up being the same
            const fallbackArbiter = models.find(m => m.id !== this.selectedModelA) || models[0];
            this.selectedArbiter = fallbackArbiter.id;
            console.log(`[ConferenceTab setDefaultModels] Set Arbiter (fallback from 2 total) to: ${fallbackArbiter.name} (ID: ${this.selectedArbiter})`);
        }
         else { // Only one model available
          this.selectedArbiter = models[0].id;
          console.log(`[ConferenceTab setDefaultModels] Set Arbiter (single model) to: ${models[0].name} (ID: ${this.selectedArbiter})`);
        }
      }
    },
  },
  watch: {
    categorizedModels: {
      handler(newModels) {
        if (newModels && Object.keys(newModels).length > 0) {
          // Check if defaults are already set by user or previous runs to avoid override
          if (this.selectedModelA === null || this.selectedModelB === null || this.selectedArbiter === null) {
            console.log('[ConferenceTab Watcher categorizedModels] Models loaded, attempting to set defaults.');
            this.setDefaultModels();
          }
        }
      },
      deep: true,
      immediate: true, // Call handler immediately when component is created, if models are already in store
    }
  },
  mounted() {
    this.setDefaultModels(); // Attempt to set defaults on mount
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

      // Listener for general backend logs
      if (window.electronAPI && window.electronAPI.onBackendLogEvent) {
        window.electronAPI.onBackendLogEvent((event, logEntry) => {
          const formattedLog = `[${new Date(logEntry.timestamp).toLocaleTimeString()}] [${logEntry.stream}] ${logEntry.line}`;
          this.generalBackendLogs.push(formattedLog);
          if (this.generalBackendLogs.length > 200) { // Keep last 200 lines
            this.generalBackendLogs.splice(0, this.generalBackendLogs.length - 200);
          }
        });
      } else {
        console.warn('[ConferenceTab] Backend log event API (onBackendLogEvent) not available.');
        // this.generalBackendLogs.push('[Mock] Backend log API not available in this environment.');
      }

    } else {
      console.warn('[ConferenceTab] Electron API (window.electronAPI) not available for mounting conference listeners.');
      this.error = "Conference Tab functionality is currently unavailable. The required backend integration (Electron API) is missing. Please ensure the application is running in the correct Electron environment and all preload scripts are loaded.";
    }
  },
  beforeUnmount() {
    if (window.electronAPI) {
      if (window.electronAPI.removeAllConferenceListeners) {
        console.log('[ConferenceTab] Removing all conference listeners.');
        window.electronAPI.removeAllConferenceListeners();
      } else {
        console.warn('[ConferenceTab] removeAllConferenceListeners API is not available.');
      }
      // Cleanup for general backend logs listener
      if (window.electronAPI.removeBackendLogEventListener) {
        console.log('[ConferenceTab] Removing backend log event listener.');
        window.electronAPI.removeBackendLogEventListener();
      } else {
        console.warn('[ConferenceTab] removeBackendLogEventListener API is not available.');
      }
    }
  }
};
</script>


