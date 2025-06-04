import { createStore } from 'vuex';

const store = createStore({
  state: {
    models: {},
    settings: {
      llmProvider: 'ollama', // Default provider
      apiKey: '',
      defaultOllamaModel: 'codellama', // Default Ollama model
    },
    backendPort: 3030, // Default backend port
    ollamaStatus: { isConnected: false, message: 'Initializing...' },
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
      // Ensure all expected keys are present in state.settings after mutation
      state.settings.llmProvider = newSettings.llmProvider !== undefined ? newSettings.llmProvider : state.settings.llmProvider;
      state.settings.apiKey = newSettings.apiKey !== undefined ? newSettings.apiKey : state.settings.apiKey;
      state.settings.defaultOllamaModel = newSettings.defaultOllamaModel !== undefined ? newSettings.defaultOllamaModel : state.settings.defaultOllamaModel;
    },
    SET_BACKEND_PORT(state, port) {
      state.backendPort = port;
      console.log(`[Mutation] Backend port set to: ${port}`);
    },
  },
  actions: {
    async fetchBackendPort({ commit }) {
      try {
        if (window.electronAPI && window.electronAPI.getBackendPort) {
          const port = await window.electronAPI.getBackendPort();
          commit('SET_BACKEND_PORT', port);
          // console.log(`[Action] Backend port fetched and set to: ${port}`); // Log in mutation for clarity
          return port;
        } else {
          console.warn('[Action] electronAPI.getBackendPort not available. Using default port 3030.');
          commit('SET_BACKEND_PORT', 3030);
          return 3030;
        }
      } catch (e) {
        console.error('[Action] Error fetching backend port:', e);
        commit('SET_BACKEND_PORT', 3030); // Fallback on error
        return 3030;
      }
    },
    updateModels({ commit }, models) {
      commit('SET_MODELS', models);
    },
    async saveSettings({ commit, state }, settingsPayload) {
      // Optimistically update local state
      commit('SET_SETTINGS', settingsPayload);
      try {
        const port = state.backendPort;
        const response = await fetch(`http://127.0.0.1:${port}/api/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settingsPayload), // Send only the payload
        });
        if (!response.ok) {
          const errorData = await response.text();
          console.error('Failed to save settings to backend:', response.status, errorData);
          // Optionally revert optimistic update here or notify user
        } else {
          console.log('Settings saved to backend successfully.');
        }
      } catch (e) {
        console.error('Error during saveSettings API call:', e);
        // Handle network error, potentially revert or notify
      }
    },
    async loadSettings({ commit, state }) {
      try {
        const port = state.backendPort;
        const response = await fetch(`http://127.0.0.1:${port}/api/settings`);
        if (!response.ok) {
          const errorData = await response.text();
          console.error('Failed to load settings from backend:', response.status, errorData);
          // Keep default settings if backend fetch fails
          return;
        }
        const loadedSettings = await response.json();
        commit('SET_SETTINGS', loadedSettings);
        console.log('Settings loaded from backend successfully.');
      } catch (e) {
        console.error('Error during loadSettings API call:', e);
        // Keep default settings on network error
      }
    },
  },
  getters: {
    getCategorizedModels: (state) => state.models,
    getSettings: (state) => state.settings,
    getBackendPort: (state) => state.backendPort,
    getOllamaStatus: (state) => state.ollamaStatus,
  },
});

// Dispatch fetchBackendPort then loadSettings when the store is initialized
store.dispatch('fetchBackendPort').then((port) => {
  console.log(`[Store Init] Backend port resolved to: ${port}. Initializing settings.`);
  store.dispatch('loadSettings');
});

export default store;
