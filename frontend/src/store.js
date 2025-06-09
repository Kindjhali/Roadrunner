import { createStore } from 'vuex';

const store = createStore({
  state: {
    models: {},
    settings: {
      llmProvider: 'ollama',
      apiKey: '',
      defaultOllamaModels: ['codellama'],
      OLLAMA_BASE_URL: 'http://localhost:11434', // Added for completeness from backend_config
    },
    backendPort: 3030,
    // Enhanced status objects
    settingsStatus: { status: 'idle', message: 'Waiting to load settings...' }, // idle, loading, retrying, success, error
    modelsStatus: { status: 'idle', message: 'Waiting to load models...' }, // idle, loading, retrying, success, error
    ollamaStatus: { isConnected: false, message: 'Initializing...' }, // Retains its specific purpose for Ollama connectivity
    // New state for agent execution logs and UI status
    logOutput: [], // Will store structured log objects
    isExecuting: false, // Tracks if a task is currently running
    confirmationDetails: null, // Stores details for a pending confirmation { confirmationId, message, details }
  },
  mutations: {
    SET_OLLAMA_STATUS(state, status) {
      state.ollamaStatus.isConnected = status.isConnected;
      state.ollamaStatus.message = status.message;
      console.log(`[Mutation] Ollama status set to: ${status.isConnected ? 'Connected' : 'Disconnected'} - ${status.message}`);
    },
    SET_SETTINGS_STATUS(state, { status, message }) {
      state.settingsStatus = { status, message };
      console.log(`[Mutation] Settings status: ${status} - ${message}`);
    },
    SET_MODELS_STATUS(state, { status, message }) {
      state.modelsStatus = { status, message };
      console.log(`[Mutation] Models status: ${status} - ${message}`);
    },
    SET_MODELS(state, models) {
      state.models = models;
    },
    SET_SETTINGS(state, newSettings) {
      // Ensure all relevant fields from backend_config are considered
      const currentSettings = state.settings;
      state.settings = {
        ...currentSettings, // Preserve existing settings
        ...newSettings    // Override with new ones
      };
      // Ensure defaultOllamaModels is always an array
      if (state.settings.defaultOllamaModels && !Array.isArray(state.settings.defaultOllamaModels)) {
        state.settings.defaultOllamaModels = [state.settings.defaultOllamaModels];
      } else if (!state.settings.defaultOllamaModels && state.settings.defaultOllamaModel) {
        // Handle transition from old singular defaultOllamaModel to new array defaultOllamaModels
        state.settings.defaultOllamaModels = [state.settings.defaultOllamaModel];
        delete state.settings.defaultOllamaModel; // remove old key
      } else if (!state.settings.defaultOllamaModels) {
        state.settings.defaultOllamaModels = []; // Ensure it's an array if not present
      }
      console.log('[Mutation] Settings updated:', JSON.stringify(state.settings));
    },
    SET_BACKEND_PORT(state, port) {
      state.backendPort = port;
      console.log(`[Mutation] Backend port set to: ${port}`);
    },
    // New mutations for agent execution
    ADD_STRUCTURED_LOG(state, logEntry) {
      state.logOutput.push(logEntry);
    },
    CLEAR_LOGS(state) {
      state.logOutput = [];
    },
    SET_IS_EXECUTING(state, value) {
      state.isExecuting = value;
    },
    SET_CONFIRMATION_DETAILS(state, details) {
      state.confirmationDetails = details;
    },
  },
  actions: {
    async fetchBackendPort({ commit }) {
      try {
        if (window.electronAPI && window.electronAPI.getBackendPort) {
          const port = await window.electronAPI.getBackendPort();
          commit('SET_BACKEND_PORT', port);
          return port;
        } else {
          console.warn('[Action] electronAPI.getBackendPort not available. Using default port 3030.');
          commit('SET_BACKEND_PORT', 3030);
          return 3030;
        }
      } catch (e) {
        console.error('[Action] Error fetching backend port:', e);
        commit('SET_BACKEND_PORT', 3030);
        return 3030;
      }
    },
    updateModels({ commit }, models) {
      commit('SET_MODELS', models);
    },
    async saveSettings({ commit, state }, settingsPayload) {
      commit('SET_SETTINGS', settingsPayload);
      let responseText = '';
      try {
        const port = state.backendPort;
        console.log('[store.js] saveSettings: Attempting to POST /api/settings with payload:', JSON.stringify(settingsPayload));
        const response = await fetch(`http://127.0.0.1:${port}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', },
          body: JSON.stringify(settingsPayload),
        });
        console.log('[store.js] saveSettings: Received response for /api/settings. Status:', response.status, 'Ok:', response.ok);
        try {
            responseText = await response.clone().text();
            console.log('[store.js] saveSettings: Response text (first 200 chars):', responseText.substring(0, 200));
        } catch (textError) {
            console.error('[store.js] saveSettings: Error cloning or reading response text:', textError);
        }
        if (!response.ok) {
          console.error('Failed to save settings to backend:', response.status, response.statusText, 'Response Body:', responseText.substring(0, 200));
        } else {
          console.log('Settings saved to backend successfully.');
        }
      } catch (e) {
        console.error('[store.js] saveSettings: CATCH block. Error during fetch or processing for /api/settings:', e);
        if (responseText) {
            console.error('[store.js] saveSettings: CATCH block. Response text that might be relevant (first 200 chars):', responseText.substring(0, 200));
        }
      }
    },
    async loadSettings({ commit, state }) {
      commit('SET_SETTINGS_STATUS', { status: 'loading', message: 'Loading settings...' });
      const url = `http://127.0.0.1:${state.backendPort}/api/settings`;
      try {
        const loadedSettings = await fetchWithRetry(url, { method: 'GET' }, 3, 2000, 'loadSettings');
        commit('SET_SETTINGS', loadedSettings);
        commit('SET_SETTINGS_STATUS', { status: 'success', message: 'Settings loaded successfully.' });
      } catch (error) {
        console.error('[store.js] loadSettings: Final error after retries:', error);
        commit('SET_SETTINGS_STATUS', { status: 'error', message: `Failed to load settings: ${error.message}` });
      }
    },

    async loadAvailableModels({ commit, state }) {
      commit('SET_MODELS_STATUS', { status: 'loading', message: 'Loading available models...' });
      commit('SET_OLLAMA_STATUS', { isConnected: false, message: 'Loading models...' }); // Intermediate state
      const url = `http://127.0.0.1:${state.backendPort}/api/ollama-models/categorized`;
      try {
        const categorizedData = await fetchWithRetry(url, { method: 'GET' }, 3, 2500, 'loadAvailableModels');

        // Ensure model IDs are consistent
        for (const category in categorizedData) {
          if (Array.isArray(categorizedData[category])) {
            categorizedData[category].forEach(model => {
              if (!model.id) model.id = model.model || model.name;
            });
          }
        }
        commit('SET_MODELS', categorizedData);
        const totalModels = Object.values(categorizedData).reduce((acc, curr) => acc + (curr ? curr.length : 0), 0);

        if (totalModels > 0 || (categorizedData && Object.keys(categorizedData).length > 0)) {
            // Consider successful if any models (even just static ones like OpenAI) are loaded,
            // or if Ollama is not the provider but we still got some model list (e.g. only OpenAI models)
            const ollamaProvider = state.settings.llmProvider === 'ollama';
            const ollamaModelsPresent = Object.values(categorizedData).some(cat => cat.some(m => m.type === 'ollama_local'));

            if (ollamaProvider && !ollamaModelsPresent && totalModels > 0) {
                 commit('SET_OLLAMA_STATUS', { isConnected: false, message: 'Ollama models not found, but other models loaded.' });
            } else if (ollamaProvider && !ollamaModelsPresent && totalModels === 0) {
                commit('SET_OLLAMA_STATUS', { isConnected: false, message: 'No Ollama models found. Ensure Ollama is running and models are pulled.' });
            } else if (ollamaProvider && ollamaModelsPresent) {
                 commit('SET_OLLAMA_STATUS', { isConnected: true, message: 'Ollama Connected & Models Loaded.' });
            } else if (!ollamaProvider && totalModels > 0) {
                 commit('SET_OLLAMA_STATUS', { isConnected: false, message: 'Models Loaded (Ollama not active provider).' });
            } else {
                 commit('SET_OLLAMA_STATUS', { isConnected: false, message: 'No models loaded.' });
            }
        } else {
            commit('SET_OLLAMA_STATUS', { isConnected: false, message: 'No models found or Ollama not reachable.' });
        }
        commit('SET_MODELS_STATUS', { status: 'success', message: `Models loaded: ${totalModels} total.` });

      } catch (error) {
        console.error('[store.js] loadAvailableModels: Final error after retries:', error);
        commit('SET_MODELS_STATUS', { status: 'error', message: `Failed to load models: ${error.message}` });
        commit('SET_OLLAMA_STATUS', { isConnected: false, message: `Model loading failed: ${error.message}` });
      }
    },

    updateOllamaStatus({ commit }, status) {
      commit('SET_OLLAMA_STATUS', status);
    },
    addStructuredLog({ commit }, logEntry) {
      commit('ADD_STRUCTURED_LOG', logEntry);
    },
  },
  getters: {
    getCategorizedModels: (state) => state.models,
    getSettings: (state) => state.settings,
    getBackendPort: (state) => state.backendPort,
    getOllamaStatus: (state) => state.ollamaStatus, // For general Ollama connection status
    getSettingsStatus: (state) => state.settingsStatus, // For settings loading status
    getModelsStatus: (state) => state.modelsStatus,   // For models loading status
    getLogOutput: (state) => state.logOutput,
    getIsExecuting: (state) => state.isExecuting,
    getConfirmationDetails: (state) => state.confirmationDetails,
  },
});

// Helper function for fetch with retry
async function fetchWithRetry(url, options, retries = 3, delay = 1000, actionName = "fetch") {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[FetchWithRetry - ${actionName}] Attempt ${i + 1}/${retries} to fetch ${url}`);
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        // Don't retry on 4xx client errors, but do on 5xx server errors or network issues
        if (response.status >= 400 && response.status < 500) {
            console.error(`[FetchWithRetry - ${actionName}] Client error: ${response.status} ${errorText}. Not retrying.`);
            throw new Error(`Client error: ${response.status} - ${errorText || response.statusText}`);
        }
        console.warn(`[FetchWithRetry - ${actionName}] Server error or issue: ${response.status} ${errorText}. Retrying...`);
        throw new Error(`Server error: ${response.status} - ${errorText || response.statusText}`); // Will be caught by catch block for retry
      }
      return await response.json();
    } catch (error) {
      console.warn(`[FetchWithRetry - ${actionName}] Attempt ${i + 1} failed: ${error.message}`);
      if (i === retries - 1) { // Last attempt
        console.error(`[FetchWithRetry - ${actionName}] All ${retries} retries failed for ${url}.`);
        throw error; // Re-throw the last error
      }
      // If it's a TypeError: Failed to fetch, it's likely a network error (e.g. backend not up yet)
      // Other errors (like the ones we throw for non-ok responses) also trigger retry
      if (store && store.commit) { // Check if store is available to commit status
        const statusType = actionName === 'loadSettings' ? 'SET_SETTINGS_STATUS' : 'SET_MODELS_STATUS';
        store.commit(statusType, { status: 'retrying', message: `Retrying (${i + 1}/${retries -1})... ${error.message}` });
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}


store.dispatch('fetchBackendPort').then(async (port) => { // make this async
  console.log(`[Store Init] Backend port resolved to: ${port}. Initializing settings and models.`);
  await store.dispatch('loadSettings'); // await settings before loading models, as models might depend on settings (e.g. OLLAMA_BASE_URL)
  await store.dispatch('loadAvailableModels'); // Now load models
});

export default store;
