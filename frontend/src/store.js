import { createStore } from 'vuex';

const store = createStore({
  state: {
    models: {},
    settings: {
      llmProvider: 'ollama', // Default provider
      apiKey: '',
      defaultOllamaModel: 'codellama', // Default Ollama model
    },
  },
  mutations: {
    SET_MODELS(state, models) {
      state.models = models;
    },
    SET_SETTINGS(state, newSettings) {
      // Ensure all expected keys are present in state.settings after mutation
      state.settings.llmProvider = newSettings.llmProvider !== undefined ? newSettings.llmProvider : state.settings.llmProvider;
      state.settings.apiKey = newSettings.apiKey !== undefined ? newSettings.apiKey : state.settings.apiKey;
      state.settings.defaultOllamaModel = newSettings.defaultOllamaModel !== undefined ? newSettings.defaultOllamaModel : state.settings.defaultOllamaModel;
    },
  },
  actions: {
    updateModels({ commit }, models) {
      commit('SET_MODELS', models);
    },
    async saveSettings({ commit, state }, settingsPayload) {
      // Optimistically update local state
      commit('SET_SETTINGS', settingsPayload);
      try {
        const response = await fetch('/api/settings', {
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
          // For now, just log the error.
          // To revert, you might need to store the old state before commit or re-fetch.
        } else {
          console.log('Settings saved to backend successfully.');
          // Backend might return the saved settings, update state again if needed
          // const savedData = await response.json();
          // commit('SET_SETTINGS', savedData.settings);
        }
      } catch (e) {
        console.error('Error during saveSettings API call:', e);
        // Handle network error, potentially revert or notify
      }
    },
    async loadSettings({ commit }) {
      try {
        const response = await fetch('/api/settings');
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
  },
});

// Dispatch loadSettings when the store is initialized
store.dispatch('loadSettings');

export default store;
