<template>
  <SettingsSection
    title="Integration Settings"
    description="Configure external integrations and API connections"
    icon="api"
  >
    <div class="space-y-6">
      <!-- API Integrations -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">API Integrations</h3>
        
        <!-- OpenAI Integration -->
        <div class="integration-item">
          <div class="integration-header">
            <Icon name="brain" class="w-6 h-6" />
            <span class="integration-name">OpenAI</span>
            <span class="integration-status" :class="openaiConnected ? 'connected' : 'disconnected'">
              {{ openaiConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          <div class="integration-config">
            <div class="setting-group">
              <label class="setting-label">API Key</label>
              <input
                v-model="openaiApiKey"
                type="password"
                placeholder="sk-..."
                class="setting-input"
              />
            </div>
            <div class="setting-group">
              <label class="setting-label">Default Model</label>
              <select v-model="openaiModel" class="setting-select">
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Anthropic Integration -->
        <div class="integration-item">
          <div class="integration-header">
            <Icon name="brain" class="w-6 h-6" />
            <span class="integration-name">Anthropic Claude</span>
            <span class="integration-status" :class="anthropicConnected ? 'connected' : 'disconnected'">
              {{ anthropicConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          <div class="integration-config">
            <div class="setting-group">
              <label class="setting-label">API Key</label>
              <input
                v-model="anthropicApiKey"
                type="password"
                placeholder="sk-ant-..."
                class="setting-input"
              />
            </div>
            <div class="setting-group">
              <label class="setting-label">Default Model</label>
              <select v-model="anthropicModel" class="setting-select">
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Local Model Integration -->
        <div class="integration-item">
          <div class="integration-header">
            <Icon name="server" class="w-6 h-6" />
            <span class="integration-name">Local Models (Ollama)</span>
            <span class="integration-status" :class="ollamaConnected ? 'connected' : 'disconnected'">
              {{ ollamaConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          <div class="integration-config">
            <div class="setting-group">
              <label class="setting-label">Server URL</label>
              <input
                v-model="ollamaUrl"
                type="url"
                placeholder="http://localhost:11434"
                class="setting-input"
              />
            </div>
            <div class="setting-group">
              <label class="setting-label">Default Model</label>
              <select v-model="ollamaModel" class="setting-select">
                <option value="llama2">Llama 2</option>
                <option value="codellama">Code Llama</option>
                <option value="mistral">Mistral</option>
                <option value="neural-chat">Neural Chat</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Development Tools -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Development Tools</h3>
        
        <!-- GitHub Integration -->
        <div class="integration-item">
          <div class="integration-header">
            <Icon name="code" class="w-6 h-6" />
            <span class="integration-name">GitHub</span>
            <span class="integration-status" :class="githubConnected ? 'connected' : 'disconnected'">
              {{ githubConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          <div class="integration-config">
            <div class="setting-group">
              <label class="setting-label">Personal Access Token</label>
              <input
                v-model="githubToken"
                type="password"
                placeholder="ghp_..."
                class="setting-input"
              />
            </div>
            <div class="setting-group">
              <label class="setting-checkbox">
                <input
                  v-model="githubAutoCommit"
                  type="checkbox"
                />
                <span class="checkmark"></span>
                Auto-commit generated code
              </label>
            </div>
          </div>
        </div>

        <!-- Docker Integration -->
        <div class="integration-item">
          <div class="integration-header">
            <Icon name="server" class="w-6 h-6" />
            <span class="integration-name">Docker</span>
            <span class="integration-status" :class="dockerConnected ? 'connected' : 'disconnected'">
              {{ dockerConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          <div class="integration-config">
            <div class="setting-group">
              <label class="setting-label">Docker Host</label>
              <input
                v-model="dockerHost"
                type="text"
                placeholder="unix:///var/run/docker.sock"
                class="setting-input"
              />
            </div>
            <div class="setting-group">
              <label class="setting-checkbox">
                <input
                  v-model="dockerAutoContainerize"
                  type="checkbox"
                />
                <span class="checkmark"></span>
                Auto-containerize applications
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Cloud Services -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Cloud Services</h3>
        
        <!-- AWS Integration -->
        <div class="integration-item">
          <div class="integration-header">
            <Icon name="cloud" class="w-6 h-6" />
            <span class="integration-name">AWS</span>
            <span class="integration-status" :class="awsConnected ? 'connected' : 'disconnected'">
              {{ awsConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          <div class="integration-config">
            <div class="setting-group">
              <label class="setting-label">Access Key ID</label>
              <input
                v-model="awsAccessKey"
                type="password"
                placeholder="AKIA..."
                class="setting-input"
              />
            </div>
            <div class="setting-group">
              <label class="setting-label">Secret Access Key</label>
              <input
                v-model="awsSecretKey"
                type="password"
                placeholder="..."
                class="setting-input"
              />
            </div>
            <div class="setting-group">
              <label class="setting-label">Default Region</label>
              <select v-model="awsRegion" class="setting-select">
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">Europe (Ireland)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Webhook Settings -->
      <div class="setting-group">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Webhooks</h3>
        
        <div class="setting-group">
          <label class="setting-checkbox">
            <input
              v-model="enableWebhooks"
              type="checkbox"
            />
            <span class="checkmark"></span>
            Enable Webhooks
          </label>
          <p class="setting-description">
            Allow external services to trigger actions via webhooks
          </p>
        </div>

        <div v-if="enableWebhooks" class="setting-group">
          <label class="setting-label">Webhook URL</label>
          <input
            v-model="webhookUrl"
            type="url"
            placeholder="https://your-app.com/webhook"
            class="setting-input"
          />
        </div>
      </div>
    </div>
  </SettingsSection>
</template>

<script>
import { ref, watch, computed } from 'vue'
import SettingsSection from './SettingsSection.vue'
import Icon from '../shared/Icon.vue'
import { useSettingsStore } from '../../stores/settingsStore'

export default {
  name: 'IntegrationSettings',
  components: {
    SettingsSection,
    Icon
  },
  setup() {
    const settingsStore = useSettingsStore()

    // API Integration settings
    const openaiApiKey = ref(settingsStore.integrations.openai.apiKey || '')
    const openaiModel = ref(settingsStore.integrations.openai.model || 'gpt-4')
    const anthropicApiKey = ref(settingsStore.integrations.anthropic.apiKey || '')
    const anthropicModel = ref(settingsStore.integrations.anthropic.model || 'claude-3-opus')
    const ollamaUrl = ref(settingsStore.integrations.ollama.url || 'http://localhost:11434')
    const ollamaModel = ref(settingsStore.integrations.ollama.model || 'llama2')

    // Development tools
    const githubToken = ref(settingsStore.integrations.github.token || '')
    const githubAutoCommit = ref(settingsStore.integrations.github.autoCommit || false)
    const dockerHost = ref(settingsStore.integrations.docker.host || 'unix:///var/run/docker.sock')
    const dockerAutoContainerize = ref(settingsStore.integrations.docker.autoContainerize || false)

    // Cloud services
    const awsAccessKey = ref(settingsStore.integrations.aws.accessKey || '')
    const awsSecretKey = ref(settingsStore.integrations.aws.secretKey || '')
    const awsRegion = ref(settingsStore.integrations.aws.region || 'us-east-1')

    // Webhooks
    const enableWebhooks = ref(settingsStore.integrations.webhooks.enabled || false)
    const webhookUrl = ref(settingsStore.integrations.webhooks.url || '')

    // Connection status (computed based on API keys/configs)
    const openaiConnected = computed(() => openaiApiKey.value.length > 0)
    const anthropicConnected = computed(() => anthropicApiKey.value.length > 0)
    const ollamaConnected = computed(() => ollamaUrl.value.length > 0)
    const githubConnected = computed(() => githubToken.value.length > 0)
    const dockerConnected = computed(() => dockerHost.value.length > 0)
    const awsConnected = computed(() => awsAccessKey.value.length > 0 && awsSecretKey.value.length > 0)

    // Watch for changes and update store
    watch([
      openaiApiKey, openaiModel, anthropicApiKey, anthropicModel,
      ollamaUrl, ollamaModel, githubToken, githubAutoCommit,
      dockerHost, dockerAutoContainerize, awsAccessKey, awsSecretKey,
      awsRegion, enableWebhooks, webhookUrl
    ], () => {
      settingsStore.updateIntegrationSettings({
        openai: {
          apiKey: openaiApiKey.value,
          model: openaiModel.value
        },
        anthropic: {
          apiKey: anthropicApiKey.value,
          model: anthropicModel.value
        },
        ollama: {
          url: ollamaUrl.value,
          model: ollamaModel.value
        },
        github: {
          token: githubToken.value,
          autoCommit: githubAutoCommit.value
        },
        docker: {
          host: dockerHost.value,
          autoContainerize: dockerAutoContainerize.value
        },
        aws: {
          accessKey: awsAccessKey.value,
          secretKey: awsSecretKey.value,
          region: awsRegion.value
        },
        webhooks: {
          enabled: enableWebhooks.value,
          url: webhookUrl.value
        }
      })
    })

    return {
      openaiApiKey,
      openaiModel,
      anthropicApiKey,
      anthropicModel,
      ollamaUrl,
      ollamaModel,
      githubToken,
      githubAutoCommit,
      dockerHost,
      dockerAutoContainerize,
      awsAccessKey,
      awsSecretKey,
      awsRegion,
      enableWebhooks,
      webhookUrl,
      openaiConnected,
      anthropicConnected,
      ollamaConnected,
      githubConnected,
      dockerConnected,
      awsConnected
    }
  }
}
</script>

<style scoped>
.setting-group {
  @apply space-y-4;
}

.integration-item {
  @apply border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4;
}

.integration-header {
  @apply flex items-center space-x-3;
}

.integration-name {
  @apply text-lg font-medium text-gray-900 dark:text-white flex-1;
}

.integration-status {
  @apply px-2 py-1 text-xs font-medium rounded-full;
}

.integration-status.connected {
  @apply bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200;
}

.integration-status.disconnected {
  @apply bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200;
}

.integration-config {
  @apply space-y-3 pl-9;
}

.setting-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.setting-description {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.setting-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.setting-select {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.setting-checkbox {
  @apply flex items-center space-x-3 cursor-pointer;
}

.setting-checkbox input[type="checkbox"] {
  @apply sr-only;
}

.checkmark {
  @apply w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded;
  @apply flex items-center justify-center transition-colors;
}

.setting-checkbox input[type="checkbox"]:checked + .checkmark {
  @apply bg-blue-500 border-blue-500;
}

.setting-checkbox input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  @apply text-white text-sm font-bold;
}
</style>
