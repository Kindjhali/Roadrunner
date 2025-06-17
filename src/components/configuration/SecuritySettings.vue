<template>
  <SettingsSection
    title="Security Settings"
    description="Configure security and privacy settings"
    icon="config"
  >
    <div class="space-y-6">
      <!-- Authentication -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="requireAuthentication"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Require Authentication
        </label>
        <p class="setting-description">
          Require user authentication to access the application
        </p>
      </div>

      <!-- Session Settings -->
      <div class="setting-group">
        <label class="setting-label">Session Timeout (minutes)</label>
        <input
          v-model.number="sessionTimeout"
          type="number"
          min="5"
          max="480"
          step="5"
          class="setting-input"
        />
        <p class="setting-description">
          Automatically log out users after this period of inactivity
        </p>
      </div>

      <!-- Data Encryption -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="encryptData"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Encrypt Stored Data
        </label>
        <p class="setting-description">
          Encrypt sensitive data stored locally
        </p>
      </div>

      <!-- Secure Communication -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="httpsOnly"
            type="checkbox"
          />
          <span class="checkmark"></span>
          HTTPS Only
        </label>
        <p class="setting-description">
          Force all communications to use HTTPS
        </p>
      </div>

      <!-- API Security -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="apiKeyRequired"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Require API Keys
        </label>
        <p class="setting-description">
          Require API keys for external service access
        </p>
      </div>

      <!-- Rate Limiting -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="enableRateLimit"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Enable Rate Limiting
        </label>
        <p class="setting-description">
          Limit the number of requests per time period
        </p>
      </div>

      <div v-if="enableRateLimit" class="setting-group">
        <label class="setting-label">Requests per Minute</label>
        <input
          v-model.number="requestsPerMinute"
          type="number"
          min="10"
          max="1000"
          step="10"
          class="setting-input"
        />
      </div>

      <!-- Audit Logging -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="auditLogging"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Enable Audit Logging
        </label>
        <p class="setting-description">
          Log all user actions and system events
        </p>
      </div>

      <!-- Content Security -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="sanitizeInput"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Sanitize User Input
        </label>
        <p class="setting-description">
          Automatically sanitize and validate user input
        </p>
      </div>

      <!-- File Upload Security -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="scanUploads"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Scan File Uploads
        </label>
        <p class="setting-description">
          Scan uploaded files for security threats
        </p>
      </div>

      <!-- Privacy Settings -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="anonymizeData"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Anonymize Analytics Data
        </label>
        <p class="setting-description">
          Remove personally identifiable information from analytics
        </p>
      </div>

      <!-- Backup Security -->
      <div class="setting-group">
        <label class="setting-checkbox">
          <input
            v-model="encryptBackups"
            type="checkbox"
          />
          <span class="checkmark"></span>
          Encrypt Backups
        </label>
        <p class="setting-description">
          Encrypt backup files for additional security
        </p>
      </div>
    </div>
  </SettingsSection>
</template>

<script>
import { ref, watch } from 'vue'
import SettingsSection from './SettingsSection.vue'
import { useSettingsStore } from '../../stores/settingsStore'

export default {
  name: 'SecuritySettings',
  components: {
    SettingsSection
  },
  setup() {
    const settingsStore = useSettingsStore()

    // Security settings
    const requireAuthentication = ref(settingsStore.security.requireAuthentication || false)
    const sessionTimeout = ref(settingsStore.security.sessionTimeout || 60)
    const encryptData = ref(settingsStore.security.encryptData || true)
    const httpsOnly = ref(settingsStore.security.httpsOnly || true)
    const apiKeyRequired = ref(settingsStore.security.apiKeyRequired || true)
    const enableRateLimit = ref(settingsStore.security.enableRateLimit || true)
    const requestsPerMinute = ref(settingsStore.security.requestsPerMinute || 100)
    const auditLogging = ref(settingsStore.security.auditLogging || false)
    const sanitizeInput = ref(settingsStore.security.sanitizeInput || true)
    const scanUploads = ref(settingsStore.security.scanUploads || true)
    const anonymizeData = ref(settingsStore.security.anonymizeData || true)
    const encryptBackups = ref(settingsStore.security.encryptBackups || true)

    // Watch for changes and update store
    watch([
      requireAuthentication, sessionTimeout, encryptData, httpsOnly,
      apiKeyRequired, enableRateLimit, requestsPerMinute, auditLogging,
      sanitizeInput, scanUploads, anonymizeData, encryptBackups
    ], () => {
      settingsStore.updateSecuritySettings({
        requireAuthentication: requireAuthentication.value,
        sessionTimeout: sessionTimeout.value,
        encryptData: encryptData.value,
        httpsOnly: httpsOnly.value,
        apiKeyRequired: apiKeyRequired.value,
        enableRateLimit: enableRateLimit.value,
        requestsPerMinute: requestsPerMinute.value,
        auditLogging: auditLogging.value,
        sanitizeInput: sanitizeInput.value,
        scanUploads: scanUploads.value,
        anonymizeData: anonymizeData.value,
        encryptBackups: encryptBackups.value
      })
    })

    return {
      requireAuthentication,
      sessionTimeout,
      encryptData,
      httpsOnly,
      apiKeyRequired,
      enableRateLimit,
      requestsPerMinute,
      auditLogging,
      sanitizeInput,
      scanUploads,
      anonymizeData,
      encryptBackups
    }
  }
}
</script>

<style scoped>
.setting-group {
  @apply space-y-2;
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
