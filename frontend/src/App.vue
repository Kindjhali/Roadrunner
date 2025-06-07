<template>
    <div class="tyrannidae-main-card">
      <div class="furnariidae-inner-panel">
        <div class="accipiter-header">
          <img src="./icons/Roadrunner.svg" alt="App Logo" class="app-logo" />
          <span class="accipiter-title">Roadrunner AI Executor</span>
          <button @click="closeWindow" class="fringilla-close-button">
            <img :src="icons.close" class="icon" alt="Close" />
          </button>
        </div>

        <div v-if="ollamaStatus && ollamaStatus.message"
             :class="['ollama-status-banner', ollamaStatus.isConnected ? 'status-connected' : 'status-disconnected']">
          {{ ollamaStatus.message }}
        </div>

        <div class="tab-navigation">
          <button @click="activeTab = 'coder'" :class="{ 'active': activeTab === 'coder' }">Coder</button>
          <button @click="activeTab = 'brainstorming'" :class="{ 'active': activeTab === 'brainstorming' }">Brainstorming</button>
          <button @click="activeTab = 'conference'" :class="{ 'active': activeTab === 'conference' }">Conference</button>
          <button @click="activeTab = 'configuration'" :class="{ 'active': activeTab === 'configuration' }">Configuration</button>
        </div>

        <div v-if="activeTab === 'coder'" class="tab-content coder-tab-content p-4 space-y-4">
          <div class="passeriformes-form-area space-y-4">
            <div class="piciformes-input-row">
              <div class="piciformes-input-group">
                <label for="modelSelect" class="emberiza-label" title="This model is used for new tasks.">Default Task Model:</label>
                <select id="modelSelect" v-model="selectedModelId" class="turdus-select">
                  <option disabled value="">-- Select Default Model --</option>
                  <optgroup v-for="(group, category) in categorizedCoderModels" :key="category" :label="category.toUpperCase()">
                    <option v-for="model in group" :key="model.id" :value="model.id">{{ model.name }}</option>
                  </optgroup>
                </select>
                <p v-if="!ollamaStatus.isConnected && Object.keys(categorizedCoderModels).length === 0" class="text-xs text-red-400">
                  Models unavailable: Ollama connection issue.
                </p>
              </div>
              <button @click="loadAvailableModels" title="Refresh Models" class="pelecanus-button-action">
                <img :src="icons.refresh" class="icon" alt="Refresh" />
              </button>
            </div>

            <div class="chat-file-input-container">
              <label for="taskFileUpload" class="chat-file-input-label" title="Upload Task File">
                <img :src="icons.upload" class="icon" alt="Upload" />
                Custom Task File (.md, .txt)
              </label>
              <input type="file" id="taskFileUpload" @change="handleFileUpload" accept=".md,.txt" class="chat-file-input">
            </div>

            <div class="piciformes-input-row items-center my-2 py-2 border-t border-b border-gray-700">
              <input type="checkbox" id="safetyModeToggle" v-model="safetyModeActive" class="mr-2 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800">
              <label for="safetyModeToggle" class="emberiza-label">Enable Safety Mode</label>
              <span class="text-xs text-gray-400 ml-2 cursor-help" title="When enabled, potentially destructive operations will require confirmation.">(?)</span>
            </div>

            <!-- Task Input (replaces session/task list for simplicity in this phase) -->
             <div class="task-input-area border-b border-gray-700 py-4 my-4 space-y-2">
                <h3 class="text-lg font-semibold text-gray-300">Task Description</h3>
                <textarea v-model="currentTaskDescription" placeholder="Describe the task for the AI agent..." class="hirundo-text-input w-full h-24"></textarea>
            </div>


            <button @click="runCurrentTask" class="cardinalis-button-primary" :disabled="isExecuting || !currentTaskDescription.trim() || !ollamaStatus.isConnected">
              <img :src="icons.run" class="icon" alt="Run" />
              Run Task
            </button>

            <div class="executor-output-panel border-t border-gray-700 mt-4 pt-4 space-y-2">
              <h3 class="text-lg font-semibold text-gray-300">Agent Output</h3>
              <div v-if="logOutput.length === 0" class="text-gray-500 text-sm">
                No output yet. Run a task to see logs.
              </div>
              <div v-else class="max-h-96 overflow-y-auto bg-gray-900 p-2 rounded space-y-1 text-sm" ref="logContainer">
                <div v-for="log in logOutput" :key="log.id" :class="getLogClass(log)">
                  <span class="font-mono text-xs mr-2">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
                  <span><strong>[{{ log.type }}]</strong> {{ log.message }}</span>
                  <pre v-if="log.data && Object.keys(log.data).length > 0" class="text-xs bg-gray-800 p-1 mt-1 rounded overflow-x-auto">{{ formatLogData(log.data) }}</pre>
                </div>
              </div>
            </div>
             <div class="mt-4">
                <button @click="openCoderInstructions" class="pelecanus-button-action text-xs">Edit Coder Instructions</button>
              </div>
          </div>
        </div>

        <div v-if="activeTab === 'brainstorming'" class="tab-content brainstorming-tab-content p-4 flex flex-col space-y-4">
          </div>

        <div v-if="activeTab === 'conference'" class="tab-content conference-tab-content p-4">
          <conference-tab @edit-instructions="openConferenceAgentInstructions" />
        </div>

        <div v-if="activeTab === 'configuration'" class="tab-content configuration-tab-content p-4 space-y-4">
          <configuration-tab />
        </div>
      </div>

      <!-- Confirmation Modal -->
      <div v-if="showConfirmationModal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
          <h3 class="text-lg font-semibold text-white mb-4">Confirmation Required</h3>
          <p class="text-sm text-gray-300 mb-2"><strong>Type:</strong> {{ confirmationDetails.details.type || 'Individual Action' }}</p>
          <p class="text-sm text-gray-300 mb-2"><strong>Tool:</strong> {{ confirmationDetails.details.toolName }}</p>
          <p class="text-sm text-gray-300 mb-1"><strong>Input:</strong></p>
          <pre class.="text-xs bg-gray-700 p-2 rounded overflow-x-auto text-gray-200 mb-4">{{ formatToolInput(confirmationDetails.details.toolInput) }}</pre>
          <p class="text-sm text-gray-300 mb-4">{{ confirmationDetails.message }}</p>
          <div class="flex justify-end space-x-3">
            <button @click="handleConfirmation(false)" class="pelecanus-button-secondary">Deny</button>
            <button @click="handleConfirmation(true)" class="cardinalis-button-primary">Approve</button>
          </div>
        </div>
      </div>

      <instructions-modal
        :agentType="modalAgentType"
        :agentRole="modalAgentRole"
        v-model:showModal="showInstructionsModal"
      />
   </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex';
import Executor from './executor';
import ConfigurationTab from './components/ConfigurationTab.vue';
import ConferenceTab from './components/ConferenceTab.vue';
import InstructionsModal from './components/InstructionsModal.vue';
import runIcon from './icons/run.svg';
import refreshIcon from './icons/refresh.svg';
import saveIcon from './icons/save.svg';
import uploadIcon from './icons/upload.svg';
import closeIcon from './icons/close.svg';

export default {
  name: 'App',
  components: {
    ConfigurationTab,
    ConferenceTab,
    InstructionsModal,
  },
  data() {
    return {
      executor: null, // Executor instance
      icons: { run: runIcon, refresh: refreshIcon, save: saveIcon, upload: uploadIcon, close: closeIcon },
      activeTab: 'coder',
      selectedModelId: '',
      safetyModeActive: true,
      currentTaskDescription: '', // For the new single task input field

      // Brainstorming specific (can be refactored later if needed)
      brainstormingInput: '',
      brainstormingHistory: [],
      brainstormingModelError: '',
      isStreamingResponse: false,
      selectedBrainstormingModelId: '',

      // Instructions Modal
      showInstructionsModal: false,
      modalAgentType: null,
      modalAgentRole: null,
      // Obsolete Coder task specific state, replaced by Vuex store for logs and confirmation
      // coderTaskPendingConfirmationId: null,
      // coderTaskProposedPlanId: null,
      // coderTaskProposedSteps: [],
      // isCoderTaskAwaitingPlanApproval: false,
    };
  },
  computed: {
    ...mapState({
      logOutput: state => state.logOutput,
      isExecuting: state => state.isExecuting,
      confirmationDetailsStore: state => state.confirmationDetails, // aliasing to avoid conflict
    }),
    ...mapGetters({
      categorizedCoderModels: 'getCategorizedModels', // Assuming this getter provides the model list
      ollamaStatus: 'getOllamaStatus',
    }),
    showConfirmationModal() {
      return !!this.confirmationDetailsStore;
    },
    // Renamed confirmationDetails to avoid conflict with data property if any existed
    // Using confirmationDetailsStore from mapState directly in template is also an option
    confirmationDetails() {
        return this.confirmationDetailsStore;
    }
  },
  watch: {
    logOutput: {
      handler() {
        this.scrollToLogBottom();
      },
      deep: true,
    },
    categorizedCoderModels: { // To set default model when models load
      handler(newModels) {
        if (newModels && Object.keys(newModels).length > 0) {
          if (!this.selectedModelId || !this.findModelById(this.selectedModelId)) {
            const firstCategory = Object.keys(newModels)[0];
            const firstModelInNew = newModels[firstCategory]?.[0];
            if (firstModelInNew) this.selectedModelId = firstModelInNew.id;
          }
          if (!this.selectedBrainstormingModelId || !this.findModelById(this.selectedBrainstormingModelId)) {
             const firstCategory = Object.keys(newModels)[0];
            const firstModelInNew = newModels[firstCategory]?.[0];
            if (firstModelInNew) this.selectedBrainstormingModelId = firstModelInNew.id;
          }
        }
      },
      deep: true,
      immediate: true,
    }
  },
  methods: {
    findModelById(modelId) {
      for (const category in this.categorizedCoderModels) {
        const model = this.categorizedCoderModels[category].find(m => m.id === modelId);
        if (model) return model;
      }
      return null;
    },
    closeWindow() {
      if (window.electronAPI && window.electronAPI.closeWindow) {
        window.electronAPI.closeWindow();
      } else {
        alert('Close operation not available in this environment.');
      }
    },
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileContent = e.target.result;
          this.currentTaskDescription = `Process uploaded file: ${file.name}\n\nContent:\n${fileContent}`;
          this.$store.dispatch('addStructuredLog', { id: Date.now(), type: 'SYSTEM_MESSAGE', message: `File "${file.name}" loaded into task description.`, timestamp: new Date() });
        };
        reader.readAsText(file);
        event.target.value = null;
      }
    },
    runCurrentTask() {
      if (!this.currentTaskDescription.trim()) {
        this.$store.dispatch('addStructuredLog', { id: Date.now(), type: 'ERROR_CLIENT', message: "Task description cannot be empty.", timestamp: new Date() });
        return;
      }
      if (!this.ollamaStatus.isConnected && this.$store.state.settings.llmProvider === 'ollama') {
         this.$store.dispatch('addStructuredLog', { id: Date.now(), type: 'ERROR_CLIENT', message: "Cannot run task: Ollama is not connected.", timestamp: new Date() });
        return;
      }
      this.executor.startTaskExecution(this.currentTaskDescription, this.safetyModeActive);
    },
    async handleConfirmation(confirmed) {
      if (this.confirmationDetails && this.confirmationDetails.confirmationId) {
        await this.executor.sendConfirmation(this.confirmationDetails.confirmationId, confirmed);
        // Store handles clearing confirmationDetails
      }
    },
    getLogClass(log) {
      switch (log.type.toUpperCase()) {
        case 'ERROR_CLIENT':
        case 'ERROR_SERVER':
        case 'ERROR_CONNECTION':
          return 'text-red-400';
        case 'SUCCESS':
        case 'EXECUTION_COMPLETE':
          return 'text-green-400';
        case 'CONFIRMATION_REQUEST':
          return 'text-yellow-400 font-semibold';
        case 'AGENT_ACTION':
          return 'text-blue-300';
        case 'TOOL_RESULT':
          return 'text-purple-300';
        case 'LLM_CHUNK':
          return 'text-gray-400 italic';
        default:
          return 'text-gray-300';
      }
    },
    formatLogData(data) {
      // Only show relevant parts of agent_event data, not the whole original data object
      if (data.type === 'agent_event' && data.data) {
        const relevantData = { ...data.data }; // Clone
        delete relevantData.type; // Already shown
        delete relevantData.message; // Already shown
        // delete relevantData.timestamp; // Already shown
        // delete relevantData.id; // Already shown
        // For on_agent_action, toolInput might be stringified JSON, try to parse for display
        if (relevantData.event_type === 'on_agent_action' && relevantData.data?.toolInput && typeof relevantData.data.toolInput === 'string') {
            try {
                relevantData.data.toolInput = JSON.parse(relevantData.data.toolInput);
            } catch (e) { /* ignore if not JSON */ }
        }
        return JSON.stringify(relevantData, null, 2);
      }
      return JSON.stringify(data, null, 2);
    },
    formatToolInput(toolInput) {
        if (typeof toolInput === 'string') {
            try {
                // Try to parse if it's a JSON string, then re-stringify for pretty printing
                return JSON.stringify(JSON.parse(toolInput), null, 2);
            } catch (e) {
                // If not a JSON string, return as is (it's a simple string input)
                return toolInput;
            }
        }
        // If it's already an object (shouldn't happen if backend sends stringified JSON)
        return JSON.stringify(toolInput, null, 2);
    },
    scrollToLogBottom() {
      this.$nextTick(() => {
        const container = this.$refs.logContainer;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    },
    async loadAvailableModels() {
      this.$store.dispatch('updateOllamaStatus', { isConnected: false, message: 'Attempting to connect to Ollama and fetch models...' });
      this.$store.dispatch('addStructuredLog', {id: this._getNextLogId(), type: 'SYSTEM_MESSAGE', message: 'ℹ️ Fetching available LLM models...', timestamp: new Date() });
      try {
        const backendPort = this.$store.state.backendPort;
        if (!backendPort || backendPort === 0) {
            this.$store.dispatch('addStructuredLog', {id: this._getNextLogId(), type: 'ERROR_CLIENT', message: `❌ Error: Backend port not configured. Cannot fetch models. Check console.`, timestamp: new Date() });
            return;
        }
        const response = await fetch(`http://127.0.0.1:${backendPort}/api/ollama-models/categorized`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Backend model fetch failed: ${response.status} ${errorText}`);
        }
        const categorizedData = await response.json();
        // Ensure model IDs are consistent (sometimes Ollama API might return model field as identifier)
        for (const category in categorizedData) {
          if (Array.isArray(categorizedData[category])) {
            categorizedData[category].forEach(model => {
              if (!model.id) model.id = model.model || model.name;
            });
          }
        }
        this.$store.dispatch('updateModels', categorizedData);
        const totalModels = Object.values(categorizedData).reduce((acc, curr) => acc + curr.length, 0);
        this.$store.dispatch('addStructuredLog', {id: this._getNextLogId(), type: 'SUCCESS', message: `✅ Models loaded: ${totalModels} total.`, timestamp: new Date() });
        this.$store.dispatch('updateOllamaStatus', { isConnected: true, message: 'Ollama Connected & Models Loaded.' });
      } catch (error) {
        console.error('Error in loadAvailableModels:', error);
        this.$store.dispatch('addStructuredLog', {id: this._getNextLogId(), type: 'ERROR_CLIENT', message: `❌ Error fetching models: ${error.message}`, timestamp: new Date() });
        this.$store.dispatch('updateOllamaStatus', { isConnected: false, message: 'Ollama Connection Failed.' });
      }
    },
    openCoderInstructions() { /* ... */ },
    openBrainstormingInstructions() { /* ... */ },
    openConferenceAgentInstructions(role) { /* ... */ },
  },
  mounted() {
    this.executor = new Executor(this.$store); // Pass store to executor
    this.$store.dispatch('fetchBackendPort').then(() => {
      this.loadAvailableModels();
    });
    // Removed old IPC listeners for coder tasks as Executor.js handles SSE now.
    // Brainstorming and other specific IPC can remain if they use a different mechanism.
    if (window.electronAPI) {
      if (window.electronAPI.onBackendPortUpdated) {
        window.electronAPI.onBackendPortUpdated((event, { port }) => {
          this.$store.commit('SET_BACKEND_PORT', port);
          this.$store.dispatch('loadSettings');
        });
      }
      // Brainstorming listeners (if they are still separate from main agent execution)
      // window.electronAPI.onBrainstormingChatStreamChunk(...);
      // window.electronAPI.onBrainstormingChatStreamError(...);
      // window.electronAPI.onBrainstormingChatStreamEnd(...);
    }
  },
  beforeUnmount() {
    if (this.executor) {
      this.executor.closeConnection();
    }
    // Remove any other specific listeners if necessary
  }
};
</script>

<style scoped>
.app-logo { height: 24px; width: auto; margin-right: 8px; vertical-align: middle; }
.accipiter-header { display: flex; align-items: center; -webkit-app-region: drag; cursor: move; }
.fringilla-close-button { -webkit-app-region: no-drag; cursor: default; }

/* Log specific styles */
.log-entry { margin-bottom: 4px; line-height: 1.4; }
.log-AGENT_ACTION { color: #90caf9; } /* Light blue */
.log-TOOL_RESULT { color: #ce93d8; } /* Light purple */
.log-LLM_CHUNK { color: #a5d6a7; font-style: italic; } /* Light green */
.log-CONFIRMATION_REQUEST { color: #ffcc80; font-weight: bold; } /* Orange */
.log-ERROR_CLIENT, .log-ERROR_SERVER, .log-ERROR_CONNECTION { color: #ef9a9a; } /* Light red */
.log-SUCCESS, .log-EXECUTION_COMPLETE { color: #81c784; } /* Green */
.log-SYSTEM_MESSAGE, .log-LOG_ENTRY_SERVER { color: #b0bec5; } /* Blue-grey */
</style>
