<template>
  <div class="configuration-tab-content p-4 space-y-4">
    <h2 class="text-xl font-semibold text-white">Configuration</h2>

    <!-- OpenAI Configuration Section -->
    <!-- LLM Configuration Section -->
    <section class="space-y-2 p-3 bg-gray-700 rounded-md">
      <h3 class="text-lg font-medium text-gray-200">LLM Configuration</h3>
      <div class="form-group">
        <label for="llm-provider" class="emberiza-label">LLM Provider:</label>
        <select id="llm-provider" v-model="computedLlmProvider" class="hirundo-text-input w-full">
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
          <!-- Add other providers as needed -->
        </select>
      </div>
      <div class="form-group">
        <label for="api-key" class="emberiza-label">API Key (Optional for Ollama):</label>
        <input type="password" id="api-key" v-model="computedApiKey" class="hirundo-text-input w-full" />
      </div>
      <div class="form-group">
        <label for="default-ollama-model-1" class="emberiza-label">Default Ollama Model 1 (if Ollama is provider):</label>
        <input type="text" id="default-ollama-model-1" v-model="defaultModel1" @input="handleDefaultModelsChange" class="hirundo-text-input w-full" />
      </div>
      <div class="form-group">
        <label for="default-ollama-model-2" class="emberiza-label">Default Ollama Model 2 (Optional):</label>
        <input type="text" id="default-ollama-model-2" v-model="defaultModel2" @input="handleDefaultModelsChange" class="hirundo-text-input w-full" />
      </div>
      <div class="form-group">
        <label for="default-ollama-model-3" class="emberiza-label">Default Ollama Model 3 (Optional):</label>
        <input type="text" id="default-ollama-model-3" v-model="defaultModel3" @input="handleDefaultModelsChange" class="hirundo-text-input w-full" />
      </div>
      <div class="form-group">
        <button @click="refreshSettings" class="cardinalis-button-action mt-2">Refresh Settings</button>
      </div>
    </section>

    <!-- OpenAI Configuration Section -->
    <section class="space-y-2 p-3 bg-gray-700 rounded-md">
      <h3 class="text-lg font-medium text-gray-200">OpenAI Configuration</h3>
      <div>
        <label for="openaiApiKeyInput" class="emberiza-label">OpenAI API Key:</label>
        <input type="password" id="openaiApiKeyInput" v-model="openaiApiKey" class="hirundo-text-input w-full" placeholder="Enter your OpenAI API Key">
      </div>
      <div class="flex items-center mt-2">
        <input type="checkbox" id="useStoredOpenAIKey" v-model="useStoredOpenAIKey" @change="updateOpenAIUsagePreference" class="cuculus-checkbox-input mr-2">
        <label for="useStoredOpenAIKey" class="emberiza-label-checkbox">Use Stored OpenAI Key for tasks</label>
      </div>
      <button @click="saveOpenAIKey" class="cardinalis-button-action mt-2">Save OpenAI Key</button>
      <p v-if="configStatusMessage" class="text-sm mt-2" :class="configStatusIsSuccess ? 'text-green-400' : 'text-red-400'">
        {{ configStatusMessage }}
      </p>
    </section>

    <section class="space-y-2 p-3 bg-gray-700 rounded-md mt-4">
      <h3 class="text-lg font-medium text-gray-200">General Settings</h3>
      <div>
        <label for="outputDirectory" class="emberiza-label">Output Directory:</label>
        <div class="flex items-center space-x-2">
          <input type="text" id="outputDirectory" v-model="localOutputDirectory" class="hirundo-text-input flex-grow" placeholder="No directory selected" readonly>
          <button @click="openDirectoryDialog" class="pelecanus-button-action">Select Directory</button>
        </div>
        <p v-if="selectionError" class="text-red-500 text-sm mt-1">{{ selectionError }}</p>
      </div>
    </section>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';

export default {
  name: 'ConfigurationTab',
  data() {
    return {
      localOutputDirectory: '',
      selectionError: '',
      openaiApiKey: '', // For the new OpenAI API Key input
      useStoredOpenAIKey: false, // For the toggle/checkbox
      configStatusMessage: '', // For feedback messages (e.g., save success/failure)
      configStatusIsSuccess: false, // To control the color of the status message
      defaultModel1: '',
      defaultModel2: '',
      defaultModel3: '',
      // For Agent Instruction Templates
      agentInstructions: {},
      newAgentType: '',
      newInstructionText: '',
      instructionStatusMessage: '',
      instructionStatusIsSuccess: false,
      // For Ollama Status
      ollamaPingStatus: null,
      isPingingOllama: false,
    };
  },
  watch: {
    currentSettings: {
      handler(newSettings) {
        if (newSettings && newSettings.defaultOllamaModels) {
          this.defaultModel1 = newSettings.defaultOllamaModels[0] || '';
          this.defaultModel2 = newSettings.defaultOllamaModels[1] || '';
          this.defaultModel3 = newSettings.defaultOllamaModels[2] || '';
        } else {
          this.defaultModel1 = '';
          this.defaultModel2 = '';
          this.defaultModel3 = '';
        }
      },
      deep: true,
      immediate: true, // Populate on component load
    },
  },
  computed: {
    sortedAgentInstructionKeys() {
      return Object.keys(this.agentInstructions).sort((a, b) => {
        if (a === 'global_instructions') return -1;
        if (b === 'global_instructions') return 1;
        if (a.includes('_specific_')) return -1;
        if (b.includes('_specific_')) return 1;
        return a.localeCompare(b);
      });
    },
    ...mapGetters({
      currentSettings: 'getSettings', // Assuming 'getSettings' is your getter for the settings object
    }),
    computedLlmProvider: {
      get() {
        return this.currentSettings ? this.currentSettings.llmProvider : null;
      },
      set(value) {
        const newSettings = { ...(this.currentSettings || {}) };
        newSettings.llmProvider = value;
        this.saveSettings(newSettings);
      },
    },
    computedApiKey: {
      get() {
        return this.currentSettings ? this.currentSettings.apiKey : ''; // Return empty string as default for input field
      },
      set(value) {
        const newSettings = { ...(this.currentSettings || {}) };
        newSettings.apiKey = value;
        this.saveSettings(newSettings);
      },
    },
    // computedDefaultOllamaModel removed
  },
  mounted() {
    console.log('[ConfigurationTab] Mounted. Initial currentSettings:', JSON.stringify(this.currentSettings));
    this.loadOpenAIConfig();
    this.fetchAgentInstructions(); // Fetch agent instructions
    // loadSettings is called, and the watcher for currentSettings will populate defaultModel1, etc.
    this.loadSettings().then(() => {
      console.log('[ConfigurationTab] After loadSettings(). currentSettings:', JSON.stringify(this.currentSettings));
      // Watcher for currentSettings should handle populating defaultModel1, defaultModel2, defaultModel3
    }).catch(error => {
      console.error('[ConfigurationTab] Error during loadSettings:', error);
    });
  },
  methods: {
    ...mapActions(['saveSettings', 'loadSettings']),

    async testOllamaConnection() {
      this.isPingingOllama = true;
      this.ollamaPingStatus = null;
      this.setInstructionStatusMessage('Pinging Ollama server...', false, true); // Reusing for general feedback

      try {
        const response = await fetch('http://localhost:3030/api/ollama/ping');
        const data = await response.json();
        this.ollamaPingStatus = data;
        if (this.instructionStatusMessage === 'Pinging Ollama server...') {
             this.setInstructionStatusMessage(''); // Clear temp message
        }
      } catch (error) {
        console.error('[ConfigurationTab] testOllamaConnection fetch error:', error);
        this.ollamaPingStatus = {
          status: 'error',
          message: 'Failed to reach backend for Ollama ping or received an invalid response.',
          details: error.message,
          url: (this.currentSettings && this.currentSettings.OLLAMA_BASE_URL) ? this.currentSettings.OLLAMA_BASE_URL : 'Ollama URL not available'
        };
        if (this.instructionStatusMessage === 'Pinging Ollama server...') {
            this.setInstructionStatusMessage('Error during Ollama ping attempt.', false);
        }
      } finally {
        this.isPingingOllama = false;
      }
    },

    setInstructionStatusMessage(message, isSuccess, persistent = false) {
      this.instructionStatusMessage = message;
      this.instructionStatusIsSuccess = isSuccess;
      if (!persistent) {
        setTimeout(() => {
          if (this.instructionStatusMessage === message) {
            this.instructionStatusMessage = '';
          }
        }, 4000);
      }
    },

    async fetchAgentInstructions() {
      this.setInstructionStatusMessage('Fetching agent instructions...', false, true);
      try {
        const response = await fetch('http://localhost:3030/api/instructions/all');
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch agent instructions: ${response.status} ${errorText}`);
        }
        this.agentInstructions = await response.json();
        this.setInstructionStatusMessage('Agent instructions loaded successfully.', true);
      } catch (error) {
        console.error('[ConfigurationTab] fetchAgentInstructions error:', error);
        this.setInstructionStatusMessage(error.message || 'Error fetching agent instructions.', false);
        this.agentInstructions = {};
      }
    },

    async saveAgentInstruction(agentType) {
      if (!agentType || !this.agentInstructions.hasOwnProperty(agentType)) {
        this.setInstructionStatusMessage('Invalid agent type specified.', false);
        return;
      }
      const instructionText = this.agentInstructions[agentType];
      this.setInstructionStatusMessage(`Saving instructions for ${agentType}...`, false, true);
      try {
        const response = await fetch(`http://localhost:3030/api/instructions/${agentType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructions: instructionText }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || `Server error ${response.status}`);
        }
        this.setInstructionStatusMessage(result.message || `Instructions for ${agentType} saved.`, true);
      } catch (error) {
        console.error(`[ConfigurationTab] saveAgentInstruction for ${agentType} error:`, error);
        this.setInstructionStatusMessage(`Failed to save instructions for ${agentType}: ${error.message}`, false);
      }
    },

    async saveNewAgentInstruction() {
      if (!this.newAgentType.trim()) {
        this.setInstructionStatusMessage('New agent type name cannot be empty.', false);
        return;
      }
      if (this.agentInstructions.hasOwnProperty(this.newAgentType.trim())) {
        this.setInstructionStatusMessage(`Agent type "${this.newAgentType.trim()}" already exists. Use its dedicated save button to update.`, false);
        return;
      }
      this.setInstructionStatusMessage(`Saving new agent type ${this.newAgentType}...`, false, true);
      try {
        const response = await fetch(`http://localhost:3030/api/instructions/${this.newAgentType.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructions: this.newInstructionText }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || `Server error ${response.status}`);
        }
        this.setInstructionStatusMessage(result.message || `New agent type ${this.newAgentType} saved.`, true);
        this.newAgentType = '';
        this.newInstructionText = '';
        await this.fetchAgentInstructions();
      } catch (error) {
        console.error('[ConfigurationTab] saveNewAgentInstruction error:', error);
        this.setInstructionStatusMessage(`Failed to save new agent instruction: ${error.message}`, false);
      }
    },

    refreshSettings() {
      this.loadSettings(); // This will dispatch the loadSettings action from Vuex
      this.fetchAgentInstructions(); // Also refresh agent instructions
    },
    handleDefaultModelsChange() {
      const models = [this.defaultModel1, this.defaultModel2, this.defaultModel3].filter(model => model.trim() !== '');
      const newSettings = {
        ...(this.currentSettings || {}),
        defaultOllamaModels: models,
      };
      // Remove the old singular key if it exists to avoid confusion
      delete newSettings.defaultOllamaModel;
      this.saveSettings(newSettings);
    },
    async openDirectoryDialog() {
      this.selectionError = ''; // Clear previous errors
      if (window.electron && window.electron.ipcRenderer) {
        try {
          const result = await window.electron.ipcRenderer.invoke('select-directory');
          if (result.success && result.path) {
            this.localOutputDirectory = result.path;
          } else if (result.success === false && !result.error) { // User cancelled
            console.log('Directory selection cancelled by user.');
          } else if (result.error) {
            console.error('Failed to select directory:', result.error);
            this.selectionError = `Failed to select directory: ${result.error}`;
          }
        } catch (error) {
          console.error('Error calling selectDirectory:', error);
          this.selectionError = `Error selecting directory: ${error.message || 'Unknown error'}`;
        }
      } else {
        this.selectionError = 'IPC renderer for directory selection is not available.';
        console.error('window.electron.ipcRenderer is not available.');
      }
    },

    async saveOpenAIKey() {
      if (!this.openaiApiKey.trim()) {
        this.setConfigStatusMessage('OpenAI API Key cannot be empty.', false);
        return;
      }
      this.setConfigStatusMessage('Saving OpenAI API Key...', false, true);
      let responseText = '';

      try {
        const response = await fetch('http://localhost:3030/api/config/openai-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: this.openaiApiKey }),
        });

        responseText = await response.text(); // Get raw response text first

        if (!response.ok) {
          // Attempt to parse JSON error if possible, otherwise use responseText
          let serverMessage = `Server returned status ${response.status}.`;
          try {
            const errorResult = JSON.parse(responseText);
            serverMessage = errorResult.message || serverMessage;
          } catch (e) {
            // Not a JSON response, use a snippet of the raw text if it's short, or a generic message
            serverMessage = responseText.length < 100 ? responseText : serverMessage;
          }
          this.setConfigStatusMessage(`Failed to save: ${serverMessage}`, false);
          console.error(`[ConfigurationTab.vue] saveOpenAIKey: Server error. Status: ${response.status}. Response: ${responseText.substring(0,200)}`);
          return;
        }

        // If response.ok, try to parse JSON
        const result = JSON.parse(responseText);
        if (result.success) {
          this.setConfigStatusMessage(result.message || 'OpenAI API Key saved successfully!', true);
          this.openaiApiKey = '';
        } else {
          // This case might occur if response.ok is true but backend explicitly signals failure
          this.setConfigStatusMessage(result.message || 'Failed to save OpenAI API Key due to a server issue.', false);
        }

      } catch (error) {
        // This catch block now primarily handles network errors or unexpected issues
        console.error('[ConfigurationTab.vue] saveOpenAIKey: CATCH block. Error during fetch or processing:', error);
        let userMessage = `Error saving OpenAI API Key: ${error.message}`;
        if (error.message.toLowerCase().includes('failed to fetch')) {
            userMessage = 'Network error: Could not connect to the server. Please ensure it is running and accessible.';
        } else if (responseText) {
            // If responseText was captured but another error occurred (e.g. JSON.parse on an OK response that wasn't JSON)
            userMessage = `Unexpected response from server. Content: ${responseText.substring(0,100)}...`;
        }
        this.setConfigStatusMessage(userMessage, false);
      }
    },

    updateOpenAIUsagePreference() {
      try {
        localStorage.setItem('useStoredOpenAIKey', this.useStoredOpenAIKey);
        this.setConfigStatusMessage(`Preference to use stored OpenAI key updated to: ${this.useStoredOpenAIKey}.`, true);
      } catch (error) {
        console.error('Error saving OpenAI usage preference to localStorage:', error);
        this.setConfigStatusMessage('Failed to save OpenAI usage preference.', false);
      }
    },

    loadOpenAIConfig() {
      try {
        const storedPreference = localStorage.getItem('useStoredOpenAIKey');
        if (storedPreference !== null) {
          this.useStoredOpenAIKey = JSON.parse(storedPreference);
        }
      } catch (error) {
        console.error('Error loading OpenAI configuration from localStorage:', error);
      }
    },

    setConfigStatusMessage(message, isSuccess, persistent = false) {
      this.configStatusMessage = message;
      this.configStatusIsSuccess = isSuccess;
      if (!persistent) {
        setTimeout(() => {
          // Only clear if it's the same message to avoid race conditions with multiple quick calls
          if (this.configStatusMessage === message) {
            this.configStatusMessage = '';
          }
        }, 4000); // Clear message after 4 seconds
      }
    }
  }
};
</script>


