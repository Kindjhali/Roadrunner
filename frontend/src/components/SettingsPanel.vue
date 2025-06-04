<template>
  <div class="settings-panel">
    <h2>Settings</h2>
    <div class="form-group">
      <label for="llm-provider">LLM Provider:</label>
      <select id="llm-provider" v-model="computedLlmProvider">
        <option value="ollama">Ollama</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="google">Google</option>
        <!-- Add other providers as needed -->
      </select>
    </div>
    <div class="form-group">
      <label for="api-key">API Key (Optional for Ollama):</label>
      <input type="password" id="api-key" v-model="computedApiKey" />
    </div>
    <div class="form-group">
      <label for="default-ollama-model">Default Ollama Model (if Ollama is provider):</label>
      <input type="text" id="default-ollama-model" v-model="computedDefaultOllamaModel" />
    </div>
    <div class="form-group">
      <button @click="refreshSettings" class="action-button">Refresh Settings</button>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';

export default {
  name: 'SettingsPanel',
  computed: {
    ...mapGetters({
      // Using a direct getter for the settings object
      currentSettings: 'getSettings', // Assuming 'getSettings' is your getter for the settings object
    }),
    computedLlmProvider: {
      get() {
        return this.currentSettings.llmProvider;
      },
      set(value) {
        this.saveSettings({
          ...this.currentSettings,
          llmProvider: value,
        });
      },
    },
    computedApiKey: {
      get() {
        return this.currentSettings.apiKey;
      },
      set(value) {
        this.saveSettings({
          ...this.currentSettings,
          apiKey: value,
        });
      },
    },
    computedDefaultOllamaModel: {
      get() {
        return this.currentSettings.defaultOllamaModel;
      },
      set(value) {
        this.saveSettings({
          ...this.currentSettings,
          defaultOllamaModel: value,
        });
      },
    },
  },
  methods: {
    ...mapActions(['saveSettings', 'loadSettings']), // Added loadSettings
    refreshSettings() {
      this.loadSettings(); // This will dispatch the loadSettings action from Vuex
    },
  },
  created() {
    // Settings are loaded when the Vuex store is initialized.
    // No explicit this.$store.dispatch('loadSettings') needed here anymore.
  },
};
</script>

<style scoped>
.settings-panel {
  padding: 20px;
  border-radius: 8px;
  background-color: #2d3748; /* gray-800 */
  color: #e2e8f0; /* gray-300 */
}
.form-group {
  margin-bottom: 20px;
}
label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}
select, input[type="password"], input[type="text"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #4a5568; /* gray-600 */
  border-radius: 4px;
  box-sizing: border-box;
  background-color: #1a202c; /* gray-900 */
  color: #e2e8f0; /* gray-300 */
}
select:focus, input[type="password"]:focus, input[type="text"]:focus {
  outline: none;
  border-color: #4299e1; /* blue-500 */
  box-shadow: 0 0 0 2px #4299e1; /* Focus ring */
}
.action-button {
  background-color: #2b6cb0; /* blue-700 */
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.action-button:hover {
  background-color: #2c5282; /* blue-800 */
}
/* Removed .storage-notice as it's no longer applicable */
</style>
