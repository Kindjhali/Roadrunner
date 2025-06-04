import { mount } from '@vue/test-utils';
import SettingsPanel from './SettingsPanel.vue'; // Adjust path as necessary
import { jest } from '@jest/globals';

// Mock Vuex store
const createMockStore = (settings = {}, getters = {}, actions = {}) => {
  return {
    state: {
      settings: {
        llmProvider: 'ollama',
        apiKey: '',
        defaultOllamaModel: 'codellama',
        ...settings, // Allow overriding defaults for specific tests
      },
    },
    getters: {
      getSettings: (state) => state.settings,
      ...getters,
    },
    actions: {
      saveSettings: jest.fn(),
      loadSettings: jest.fn(),
      ...actions,
    },
    dispatch: jest.fn((actionName, payload) => {
        if (actions[actionName]) {
            return actions[actionName](payload);
        }
        return Promise.resolve();
    }),
    commit: jest.fn(),
  };
};

describe('SettingsPanel.vue', () => {
  let mockStore;

  beforeEach(() => {
    // Create a new mock store for each test to ensure isolation
    mockStore = createMockStore();
  });

  const mountComponent = (store = mockStore) => {
    return mount(SettingsPanel, {
      global: {
        plugins: [store], // Provide the mock store to the component
      },
    });
  };

  it('renders correctly with initial settings from store', () => {
    mockStore = createMockStore({
        llmProvider: 'openai',
        apiKey: 'testkey123',
        defaultOllamaModel: 'gpt-4-test',
    });
    const wrapper = mountComponent(mockStore);

    expect(wrapper.find('h2').text()).toBe('Settings');

    const providerSelect = wrapper.find('#llm-provider');
    expect(providerSelect.exists()).toBe(true);
    expect(providerSelect.element.value).toBe('openai');

    const apiKeyInput = wrapper.find('#api-key');
    expect(apiKeyInput.exists()).toBe(true);
    // Note: value of password fields is not directly readable for security reasons in some test environments.
    // We're checking its existence and can test its interaction.
    // If needed, change to type="text" for testing or check v-model binding via computed prop.

    const ollamaModelInput = wrapper.find('#default-ollama-model');
    expect(ollamaModelInput.exists()).toBe(true);
    expect(ollamaModelInput.element.value).toBe('gpt-4-test');

    // Check if 'ollama' is an option
    expect(wrapper.find('#llm-provider option[value="ollama"]').exists()).toBe(true);
  });

  it('dispatches saveSettings when LLM provider is changed', async () => {
    const wrapper = mountComponent();
    const providerSelect = wrapper.find('#llm-provider');

    await providerSelect.setValue('openai');

    expect(mockStore.dispatch).toHaveBeenCalledWith('saveSettings', {
      llmProvider: 'openai', // New value
      apiKey: mockStore.state.settings.apiKey, // Existing value
      defaultOllamaModel: mockStore.state.settings.defaultOllamaModel, // Existing value
    });
  });

  it('dispatches saveSettings when API key is changed', async () => {
    const wrapper = mountComponent();
    const apiKeyInput = wrapper.find('#api-key');

    await apiKeyInput.setValue('newapikey');

    expect(mockStore.dispatch).toHaveBeenCalledWith('saveSettings', {
      llmProvider: mockStore.state.settings.llmProvider, // Existing value
      apiKey: 'newapikey', // New value
      defaultOllamaModel: mockStore.state.settings.defaultOllamaModel, // Existing value
    });
  });

  it('dispatches saveSettings when Default Ollama Model is changed', async () => {
    const wrapper = mountComponent();
    const ollamaModelInput = wrapper.find('#default-ollama-model');

    await ollamaModelInput.setValue('new-ollama-model');

    expect(mockStore.dispatch).toHaveBeenCalledWith('saveSettings', {
      llmProvider: mockStore.state.settings.llmProvider, // Existing value
      apiKey: mockStore.state.settings.apiKey, // Existing value
      defaultOllamaModel: 'new-ollama-model', // New value
    });
  });

  it('dispatches loadSettings when "Refresh Settings" button is clicked', async () => {
    const wrapper = mountComponent();
    const refreshButton = wrapper.find('button.action-button'); // Assuming class from previous step
    expect(refreshButton.exists()).toBe(true);
    expect(refreshButton.text()).toBe('Refresh Settings');

    await refreshButton.trigger('click');

    expect(mockStore.dispatch).toHaveBeenCalledWith('loadSettings');
  });

  it('does not have the local storage notice', () => {
    const wrapper = mountComponent();
    expect(wrapper.find('p.storage-notice').exists()).toBe(false);
  });
});
