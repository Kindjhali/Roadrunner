import store from './store'; // Assuming this path is correct relative to tests
import { jest } from '@jest/globals'; // Or import { jest } from '@jest/globals'; if using ESM tests

// Manual mock for fetch
global.fetch = jest.fn();

describe('Vuex Store - Settings', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    fetch.mockClear();
    // Reset store state to initial (or a known state) if necessary.
    // Vuex store instance is typically a singleton, so mutations will persist.
    // For robust tests, you might re-initialize the store or parts of its state.
    // Here, we'll rely on loadSettings to overwrite or set initial state.
    // Or, directly mutate to a known default:
    store.commit('SET_SETTINGS', {
        llmProvider: 'ollama',
        apiKey: '',
        defaultOllamaModel: 'codellama'
    });
  });

  describe('mutations', () => {
    it('SET_SETTINGS updates settings state correctly', () => {
      const newSettings = {
        llmProvider: 'openai',
        apiKey: 'test_key',
        defaultOllamaModel: 'gpt-3.5-turbo',
      };
      store.commit('SET_SETTINGS', newSettings);
      expect(store.state.settings).toEqual(newSettings);
    });

    it('SET_SETTINGS handles partial updates', () => {
      store.commit('SET_SETTINGS', { llmProvider: 'anthropic' });
      expect(store.state.settings.llmProvider).toBe('anthropic');
      expect(store.state.settings.apiKey).toBe(''); // Should remain from initial/previous
      expect(store.state.settings.defaultOllamaModel).toBe('codellama');

      store.commit('SET_SETTINGS', { apiKey: 'anthropic_key' });
      expect(store.state.settings.llmProvider).toBe('anthropic');
      expect(store.state.settings.apiKey).toBe('anthropic_key');
      expect(store.state.settings.defaultOllamaModel).toBe('codellama');

      store.commit('SET_SETTINGS', { defaultOllamaModel: 'claude-2' });
      expect(store.state.settings.llmProvider).toBe('anthropic');
      expect(store.state.settings.apiKey).toBe('anthropic_key');
      expect(store.state.settings.defaultOllamaModel).toBe('claude-2');
    });
  });

  describe('actions', () => {
    describe('loadSettings', () => {
      it('fetches settings from API and commits SET_SETTINGS on success', async () => {
        const mockSettingsData = {
          llmProvider: 'ollama_from_api',
          apiKey: 'api_key_123',
          defaultOllamaModel: 'model_from_api',
        };
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSettingsData,
        });

        await store.dispatch('loadSettings');

        expect(fetch).toHaveBeenCalledWith('/api/settings');
        expect(store.state.settings).toEqual(mockSettingsData);
      });

      it('handles API error during loadSettings gracefully', async () => {
        const initialSettings = JSON.parse(JSON.stringify(store.state.settings)); // Deep clone
        fetch.mockResolvedValueOnce({
          ok: false,
          text: async () => 'API Error', // text() for error response
        });

        await store.dispatch('loadSettings');

        expect(fetch).toHaveBeenCalledWith('/api/settings');
        // State should remain unchanged or reset to defaults depending on error handling policy.
        // The current implementation keeps existing (default) state on error.
        expect(store.state.settings).toEqual(initialSettings);
      });

       it('handles network error during loadSettings gracefully', async () => {
        const initialSettings = JSON.parse(JSON.stringify(store.state.settings));
        fetch.mockRejectedValueOnce(new Error('Network failure'));

        await store.dispatch('loadSettings');

        expect(fetch).toHaveBeenCalledWith('/api/settings');
        expect(store.state.settings).toEqual(initialSettings);
      });
    });

    describe('saveSettings', () => {
      it('commits SET_SETTINGS and POSTs settings to API', async () => {
        const settingsToSave = {
          llmProvider: 'openai',
          apiKey: 'openai_key_456',
          defaultOllamaModel: 'text-davinci-003',
        };
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ settings: settingsToSave }), // Assuming backend returns saved settings
        });

        await store.dispatch('saveSettings', settingsToSave);

        // Check optimistic update
        expect(store.state.settings).toEqual(settingsToSave);

        expect(fetch).toHaveBeenCalledWith('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsToSave),
        });
      });

      it('handles API error during saveSettings', async () => {
        const initialSettings = JSON.parse(JSON.stringify(store.state.settings));
        const settingsToSave = {
          llmProvider: 'new_provider_fail',
          apiKey: 'new_key_fail',
          defaultOllamaModel: 'new_model_fail',
        };

        fetch.mockResolvedValueOnce({
          ok: false,
          text: async () => 'Failed to save',
        });

        await store.dispatch('saveSettings', settingsToSave);

        // State was optimistically updated, current implementation doesn't revert.
        expect(store.state.settings).toEqual(settingsToSave);

        expect(fetch).toHaveBeenCalledWith('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsToSave),
        });
        // Test would be stronger if we could check for an error log or notification.
      });

      it('handles network error during saveSettings', async () => {
        const initialSettings = JSON.parse(JSON.stringify(store.state.settings));
         const settingsToSave = {
          llmProvider: 'new_provider_network_fail',
          apiKey: 'new_key_network_fail',
          defaultOllamaModel: 'new_model_network_fail',
        };
        fetch.mockRejectedValueOnce(new Error('Network failure'));

        await store.dispatch('saveSettings', settingsToSave);

        expect(store.state.settings).toEqual(settingsToSave); // Optimistic update
        expect(fetch).toHaveBeenCalledWith('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsToSave),
        });
      });
    });
  });
});
