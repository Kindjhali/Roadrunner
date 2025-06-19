// frontend/src/components/ConfigurationTab.spec.js
import { mount } from '@vue/test-utils';
import ConfigurationTab from './ConfigurationTab.vue'; // Adjust path if necessary
import { createStore } from 'vuex';

// Mock initial settings
const mockInitialSettings = {
  llmProvider: 'ollama',
  apiKey: 'testkey123',
  defaultOllamaModel: 'llama2',
  // Mock other parts of the settings object if ConfigurationTab interacts with them
  // For now, focusing on the LLM parts.
};

let store;
let mockSaveSettingsAction;
let mockLoadSettingsAction;

beforeEach(() => {
  // Create new mock functions for each test to reset call counts
  mockSaveSettingsAction = jest.fn();
  mockLoadSettingsAction = jest.fn();

  store = createStore({
    state: {}, // Add mock state if component directly accesses it
    getters: {
      getSettings: () => mockInitialSettings,
      // Mock any other getters ConfigurationTab might use.
      // Example: getCategorizedModels: () => ({ ollama: [], openai: [] }),
      // Based on App.vue, ConfigurationTab itself doesn't directly use getCategorizedModels
      // but it's good practice to be aware of dependencies.
    },
    actions: {
      saveSettings: mockSaveSettingsAction,
      loadSettings: mockLoadSettingsAction,
      // Mock any other actions ConfigurationTab might dispatch.
    },
    mutations: {}, // Add mock mutations if needed
  });
});

describe('ConfigurationTab.vue - LLM Configuration', () => {
  let wrapper;

  // Helper function to mount the component
  const mountComponent = () => {
    return mount(ConfigurationTab, {
      global: {
        plugins: [store],
        // Provide stubs for child components if they are complex and not relevant to these tests
        // stubs: { SomeChildComponent: true }
      },
      // Attach to document if needed for certain DOM interactions, though usually not required
      // attachTo: document.body,
    });
  };

  beforeEach(() => {
    // Mount the component before each test in this describe block
    // This ensures `loadSettings` in `mounted()` is called.
    wrapper = mountComponent();
  });

  it('renders LLM configuration inputs with initial values from Vuex store', () => {
    expect(wrapper.find('#llm-provider').element.value).toBe(mockInitialSettings.llmProvider);
    // For password fields, the .value property still gives the actual value in test-utils
    expect(wrapper.find('#api-key').element.value).toBe(mockInitialSettings.apiKey);
    expect(wrapper.find('#default-ollama-model').element.value).toBe(mockInitialSettings.defaultOllamaModel);
  });

  it('calls "loadSettings" action when the component is mounted', () => {
    // The component is mounted in beforeEach, so loadSettings should have been called.
    expect(mockLoadSettingsAction).toHaveBeenCalled();
  });

  it('calls "saveSettings" action with updated provider when LLM Provider select changes', async () => {
    const newProvider = 'openai';
    const selectElement = wrapper.find('#llm-provider');
    await selectElement.setValue(newProvider);

    expect(mockSaveSettingsAction).toHaveBeenCalledTimes(1);
    expect(mockSaveSettingsAction).toHaveBeenCalledWith(
      expect.anything(), // Vuex action context
      {
        ...mockInitialSettings,
        llmProvider: newProvider,
      }
    );
  });

  it('calls "saveSettings" action with updated API key when API Key input changes', async () => {
    const newApiKey = 'newkey456';
    const inputElement = wrapper.find('#api-key');
    await inputElement.setValue(newApiKey);

    expect(mockSaveSettingsAction).toHaveBeenCalledTimes(1);
    expect(mockSaveSettingsAction).toHaveBeenCalledWith(
      expect.anything(), // Vuex action context
      {
        ...mockInitialSettings,
        apiKey: newApiKey,
      }
    );
  });

  it('calls "saveSettings" action with updated model when Default Ollama Model input changes', async () => {
    const newModel = 'codellama';
    const inputElement = wrapper.find('#default-ollama-model');
    await inputElement.setValue(newModel);

    expect(mockSaveSettingsAction).toHaveBeenCalledTimes(1);
    expect(mockSaveSettingsAction).toHaveBeenCalledWith(
      expect.anything(), // Vuex action context
      {
        ...mockInitialSettings,
        defaultOllamaModel: newModel,
      }
    );
  });

  it('calls "loadSettings" action when "Refresh Settings" button is clicked', async () => {
    // Reset call count from the mounted hook call
    mockLoadSettingsAction.mockClear();

    // Find the button by its text content or a more specific selector if available
    const refreshButton = wrapper.findAll('button').find(b => b.text() === 'Refresh Settings');
    expect(refreshButton.exists()).toBe(true); // Ensure the button is found
    await refreshButton.trigger('click');

    expect(mockLoadSettingsAction).toHaveBeenCalledTimes(1);
  });

  // Example of a more robust way to find the button if there are many:
  // it('calls "loadSettings" action when the specific "Refresh Settings" button is clicked', async () => {
  //   mockLoadSettingsAction.mockClear();
  //   const llmSection = wrapper.find('section h3.text-lg.font-medium.text-gray-200'); // Find by section title
  //   // This assumes a structure, might need adjustment based on exact final HTML
  //   // A more direct approach is to add a data-testid attribute to the button
  //   const refreshButton = wrapper.find('button[data-testid="refresh-llm-settings-button"]');
  //   await refreshButton.trigger('click');
  //   expect(mockLoadSettingsAction).toHaveBeenCalledTimes(1);
  // });
});
