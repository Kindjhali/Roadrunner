import { createStore } from 'vuex';

const store = createStore({
  state: {
    models: {},
    settings: {
      llmProvider: 'ollama',
      apiKey: '',
      defaultOllamaModels: ['codellama'],
    },
    backendPort: 3030,
    ollamaStatus: { isConnected: false, message: 'Initializing...' },
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
    SET_MODELS(state, models) {
      state.models = models;
    },
    SET_SETTINGS(state, newSettings) {
      state.settings.llmProvider = newSettings.llmProvider !== undefined ? newSettings.llmProvider : state.settings.llmProvider;
      state.settings.apiKey = newSettings.apiKey !== undefined ? newSettings.apiKey : state.settings.apiKey;
      if (newSettings.defaultOllamaModels !== undefined) {
        state.settings.defaultOllamaModels = Array.isArray(newSettings.defaultOllamaModels) ? newSettings.defaultOllamaModels : [newSettings.defaultOllamaModels];
      } else if (newSettings.defaultOllamaModel !== undefined) {
        state.settings.defaultOllamaModels = [newSettings.defaultOllamaModel];
      }
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
      let responseText = '';
      try {
        const port = state.backendPort;
        const url = `http://127.0.0.1:${port}/api/settings`;
        console.log('[store.js] loadSettings: Attempting to fetch /api/settings');
        const response = await fetch(url);
        console.log('[store.js] loadSettings: Received response for /api/settings. Status:', response.status, 'Ok:', response.ok);
        responseText = await response.clone().text();
        console.log('[store.js] loadSettings: Response text (first 200 chars):', responseText.substring(0, 200));
        if (!response.ok) {
          console.error('Failed to load settings from backend:', response.status, responseText);
          return;
        }
        const loadedSettings = await response.json();
        commit('SET_SETTINGS', loadedSettings);
        console.log('Settings loaded from backend successfully.');
      } catch (e) {
        console.error('[store.js] loadSettings: CATCH block. Error during fetch or JSON parsing for /api/settings:', e);
        if (responseText) {
            console.error('[store.js] loadSettings: CATCH block. Response text that may have caused JSON parse error (first 200 chars):', responseText.substring(0, 200));
        }
      }
    },
    updateOllamaStatus({ commit }, status) {
      commit('SET_OLLAMA_STATUS', status);
    },
    // New action for adding structured logs
    addStructuredLog({ commit }, logEntry) {
      commit('ADD_STRUCTURED_LOG', logEntry);
    },
  },
  getters: {
    getCategorizedModels: (state) => state.models,
    getSettings: (state) => state.settings,
    getBackendPort: (state) => state.backendPort,
    getOllamaStatus: (state) => state.ollamaStatus,
    // New getters
    getLogOutput: (state) => state.logOutput,
    getIsExecuting: (state) => state.isExecuting,
    getConfirmationDetails: (state) => state.confirmationDetails,
  },
});

store.dispatch('fetchBackendPort').then((port) => {
  console.log(`[Store Init] Backend port resolved to: ${port}. Initializing settings.`);
  store.dispatch('loadSettings');
});

export default store;
