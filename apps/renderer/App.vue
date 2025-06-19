<template>
  <div id="app" class="roadrunner-app">
    <!-- Header -->
    <header class="app-header">
      <div class="header-content">
        <div class="logo-section">
          <img src="./assets/icons/Roadrunner.svg" alt="Roadrunner" class="logo" />
          <h1 class="app-title">Roadrunner Autocoder</h1>
        </div>
        
        <div class="header-controls">
          <button 
            class="btn btn-icon"
            @click="showSettings = !showSettings"
            title="Settings"
          >
            <Icon name="config" />
          </button>
          
          <button 
            class="btn btn-icon"
            @click="showHelp = !showHelp"
            title="Help"
          >
            <Icon name="help" />
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="app-main">
      <!-- Navigation Tabs -->
      <nav class="tab-navigation">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          :class="['tab-button', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <Icon :name="tab.iconName" class="tab-icon" />
          {{ tab.label }}
        </button>
      </nav>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Planning Tab -->
        <PlanningTab 
          v-if="activeTab === 'planning'"
          :engine="autocoderEngine"
          @plan-created="handlePlanCreated"
          @plan-executed="handlePlanExecuted"
        />

        <!-- Brainstorming Tab -->
        <BrainstormingTab 
          v-if="activeTab === 'brainstorming'"
          :engine="autocoderEngine"
          @session-completed="handleSessionCompleted"
          @ideas-exported="handleIdeasExported"
        />

        <!-- Execution Tab -->
        <ExecutionTab 
          v-if="activeTab === 'execution'"
          :engine="autocoderEngine"
          @code-generated="handleCodeGenerated"
          @execution-completed="handleExecutionCompleted"
        />

        <!-- Configuration Tab -->
        <ConfigurationTab 
          v-if="activeTab === 'configuration'"
          @config-updated="handleConfigUpdated"
        />
      </div>
    </main>

    <!-- Status Bar -->
    <footer class="status-bar">
      <div class="status-left">
        <span class="status-item">
          <span class="status-label">Backend:</span>
          <span :class="['status-value', backendStatus.class]">
            {{ backendStatus.text }}
          </span>
        </span>
        
        <span class="status-item">
          <span class="status-label">Models:</span>
          <span class="status-value">{{ availableModels.length }}</span>
        </span>
      </div>
      
      <div class="status-center">
        <span v-if="currentActivity" class="activity-indicator">
          {{ currentActivity }}
        </span>
      </div>
      
      <div class="status-right">
        <span class="status-item">
          <span class="status-label">Version:</span>
          <span class="status-value">{{ version }}</span>
        </span>
      </div>
    </footer>

    <!-- Modals -->
    <SettingsModal 
      v-if="showSettings"
      @close="showSettings = false"
      @settings-saved="handleSettingsSaved"
    />

    <HelpModal 
      v-if="showHelp"
      @close="showHelp = false"
    />

    <!-- Notifications -->
    <NotificationContainer 
      :notifications="notifications"
      @dismiss="dismissNotification"
    />

    <!-- Backend Log Viewer -->
    <BackendLogViewer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue'
import { useSettingsStore } from './stores/settingsStore.js'
import { usePlanningStore } from './stores/planningStore.js'
import { useExecutionStore } from './stores/executionStore.js'
import { useNotifications } from './composables/useNotifications.js'
import { AutocoderEngine } from './core/AutocoderEngine.js'

// Components
import PlanningTab from './components/planning/PlanningTab.vue'
import ExecutionTab from './components/execution/ExecutionTab.vue'
import BrainstormingTab from './components/brainstorming/BrainstormingTab.vue'
import ConfigurationTab from './components/configuration/ConfigurationTab.vue'
import SettingsModal from './components/shared/SettingsModal.vue'
import HelpModal from './components/shared/HelpModal.vue'
import NotificationContainer from './components/shared/NotificationContainer.vue'
import BackendLogViewer from './components/shared/BackendLogViewer.vue'
import Icon from './components/shared/Icon.vue'

// Stores
const settingsStore = useSettingsStore()
const planningStore = usePlanningStore()
const executionStore = useExecutionStore()

// Notifications
const { notifications, addNotification, removeNotification } = useNotifications()

// State
const activeTab = ref('planning')
const showSettings = ref(false)
const showHelp = ref(false)
const isLoading = ref(true)
const autocoderEngine = ref(null)
const currentActivity = ref('')
const version = ref('2.0.0')
const availableModels = ref([])

// Tab configuration
const tabs = [
  {
    id: 'planning',
    label: 'Planning',
    iconName: 'blueprint'
  },
  {
    id: 'brainstorming',
    label: 'Brainstorming',
    iconName: 'brain'
  },
  {
    id: 'execution',
    label: 'Execution',
    iconName: 'execute'
  },
  {
    id: 'configuration',
    label: 'Configuration',
    iconName: 'config'
  }
]

// Computed properties
const backendStatus = computed(() => {
  if (isLoading.value) {
    return { text: 'Initializing...', class: 'status-warning' }
  }
  
  if (autocoderEngine.value) {
    const state = autocoderEngine.value.getState()
    if (state.servicesInitialized) {
      return { text: 'Connected', class: 'status-success' }
    }
  }
  
  return { text: 'Disconnected', class: 'status-error' }
})

// Initialize autocoder engine with better error handling
const initializeEngine = async () => {
  try {
    currentActivity.value = 'Initializing Autocoder Engine...'
    
    // Create engine with default configuration
    autocoderEngine.value = new AutocoderEngine({
      enablePipelines: true,
      enableWorkflows: true,
      maxConcurrentOperations: 3,
      operationTimeout: 600000,
      enableLogging: true,
      enableMetrics: true
    })

    // Initialize services with graceful error handling
    currentActivity.value = 'Connecting to backend services...'
    try {
      await autocoderEngine.value.initializeServices()
    } catch (serviceError) {
      console.warn('Some services failed to initialize:', serviceError)
      // Continue anyway - partial initialization is OK
    }

    // Set up event listeners
    setupEngineEventListeners()

    // Load available models with fallback
    currentActivity.value = 'Loading AI models...'
    try {
      availableModels.value = await autocoderEngine.value.getAvailableModels()
    } catch (modelError) {
      console.warn('Failed to load models:', modelError)
      availableModels.value = []
    }

    currentActivity.value = ''
    isLoading.value = false
    
    addNotification({
      type: 'success',
      title: 'Autocoder Ready',
      message: 'System initialized successfully!'
    })

  } catch (error) {
    console.error('Failed to initialize engine:', error)
    
    // Create a minimal engine anyway
    autocoderEngine.value = new AutocoderEngine({})
    
    currentActivity.value = ''
    isLoading.value = false
    
    addNotification({
      type: 'warning',
      title: 'Partial Initialization',
      message: 'System running with limited functionality'
    })
  }
}

// Set up engine event listeners
const setupEngineEventListeners = () => {
  if (!autocoderEngine.value) return

  const engine = autocoderEngine.value

  // Workflow events
  engine.on('workflowStarted', ({ operationId, request }) => {
    currentActivity.value = `Starting workflow: ${request.goal}`
    addNotification({
      type: 'info',
      title: 'Workflow Started',
      message: `Started: ${request.goal}`
    })
  })

  engine.on('workflowCompleted', ({ operationId, results }) => {
    currentActivity.value = ''
    addNotification({
      type: 'success',
      title: 'Workflow Completed',
      message: 'Autocoding workflow finished successfully'
    })
  })

  engine.on('workflowError', ({ error }) => {
    currentActivity.value = ''
    addNotification({
      type: 'error',
      title: 'Workflow Error',
      message: error
    })
  })

  // Planning events
  engine.on('planCreated', (data) => {
    addNotification({
      type: 'info',
      title: 'Plan Created',
      message: `Created plan with ${data.plan?.steps?.length || 0} steps`
    })
  })

  engine.on('planValidated', (data) => {
    if (!data.validation?.isValid) {
      addNotification({
        type: 'warning',
        title: 'Plan Validation Issues',
        message: `${data.validation?.errors?.length || 0} errors found`
      })
    }
  })

  // Execution events
  engine.on('executionStarted', ({ executionId, plan }) => {
    currentActivity.value = `Executing: ${plan.name || 'Plan'}`
    addNotification({
      type: 'info',
      title: 'Execution Started',
      message: `Started executing plan`
    })
  })

  engine.on('executionProgress', ({ progress }) => {
    currentActivity.value = `Executing... ${progress}%`
  })

  engine.on('executionCompleted', ({ results }) => {
    currentActivity.value = ''
    addNotification({
      type: 'success',
      title: 'Execution Completed',
      message: 'Plan executed successfully'
    })
  })

  engine.on('executionError', ({ error }) => {
    currentActivity.value = ''
    addNotification({
      type: 'error',
      title: 'Execution Error',
      message: error
    })
  })

  // Brainstorming events
  engine.on('brainstormingStarted', ({ result }) => {
    currentActivity.value = 'Brainstorming session active...'
  })

  engine.on('brainstormingCompleted', ({ result }) => {
    currentActivity.value = ''
    addNotification({
      type: 'success',
      title: 'Brainstorming Completed',
      message: 'Ideas generated successfully'
    })
  })

  // Code generation events
  engine.on('codeGenerated', ({ result }) => {
    addNotification({
      type: 'success',
      title: 'Code Generated',
      message: `Generated ${result.language || 'code'}`
    })
  })

  // Conference events
  engine.on('conferenceStarted', ({ result }) => {
    currentActivity.value = 'Conference session active...'
  })

  engine.on('conferenceCompleted', ({ result }) => {
    currentActivity.value = ''
    addNotification({
      type: 'success',
      title: 'Conference Completed',
      message: 'Multi-agent session finished'
    })
  })

  // Error handling
  engine.on('serviceInitializationError', ({ error }) => {
    addNotification({
      type: 'error',
      title: 'Service Error',
      message: error
    })
  })
}

// Event handlers
const handlePlanCreated = (plan) => {
  console.log('Plan created:', plan)
}

const handlePlanExecuted = (result) => {
  console.log('Plan executed:', result)
}

const handleSessionCompleted = (session) => {
  console.log('Brainstorming session completed:', session)
}

const handleIdeasExported = (exportResult) => {
  addNotification({
    type: 'success',
    title: 'Ideas Exported',
    message: `Exported as ${exportResult.format}`
  })
}

const handleCodeGenerated = (codeResult) => {
  console.log('Code generated:', codeResult)
}

const handleExecutionCompleted = (result) => {
  console.log('Execution completed:', result)
}

const handleConfigUpdated = (config) => {
  if (autocoderEngine.value) {
    autocoderEngine.value.updateConfig(config)
  }
  
  addNotification({
    type: 'info',
    title: 'Configuration Updated',
    message: 'Settings have been saved'
  })
}

const handleSettingsSaved = (settings) => {
  handleConfigUpdated(settings)
  showSettings.value = false
}

// Notification management
const dismissNotification = (id) => {
  removeNotification(id)
}

// Lifecycle
onMounted(async () => {
  try {
    // Load settings first
    await settingsStore.loadSettings()
    
    // Initialize other stores
    planningStore.loadPlanTemplates()
    planningStore.loadStepTemplates()
    
    // Initialize the autocoder engine
    await initializeEngine()
    
  } catch (error) {
    console.error('Failed to initialize app:', error)
    isLoading.value = false
    addNotification({
      type: 'error',
      title: 'Initialization Error',
      message: error.message
    })
  }
})

// Provide global services
provide('notifications', { addNotification, removeNotification })
provide('autocoderEngine', autocoderEngine)
</script>

<style scoped>
/* Following Neo Art Deco 2332 design system */
.roadrunner-app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e94560;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Header */
.app-header {
  background: rgba(233, 69, 96, 0.1);
  border-bottom: 1px solid rgba(233, 69, 96, 0.3);
  padding: 1rem 2rem;
  backdrop-filter: blur(10px);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  width: 32px;
  height: 32px;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(45deg, #e94560, #f39c12);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-controls {
  display: flex;
  gap: 0.5rem;
}

/* Main Content */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 0 2rem;
}

/* Navigation */
.tab-navigation {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(233, 69, 96, 0.2);
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 8px;
  color: #e94560;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-button:hover {
  background: rgba(233, 69, 96, 0.1);
  border-color: rgba(233, 69, 96, 0.5);
}

.tab-button.active {
  background: rgba(233, 69, 96, 0.2);
  border-color: #e94560;
  box-shadow: 0 0 20px rgba(233, 69, 96, 0.3);
}

.tab-icon {
  width: 16px;
  height: 16px;
}

/* Tab Content */
.tab-content {
  flex: 1;
  padding: 2rem 0;
  overflow-y: auto;
}

/* Status Bar */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 2rem;
  background: rgba(26, 26, 46, 0.8);
  border-top: 1px solid rgba(233, 69, 96, 0.2);
  font-size: 0.875rem;
}

.status-left,
.status-right {
  display: flex;
  gap: 1.5rem;
}

.status-item {
  display: flex;
  gap: 0.5rem;
}

.status-label {
  color: rgba(233, 69, 96, 0.7);
}

.status-value {
  color: #e94560;
  font-weight: 500;
}

.status-value.status-success {
  color: #27ae60;
}

.status-value.status-warning {
  color: #f39c12;
}

.status-value.status-error {
  color: #e74c3c;
}

.activity-indicator {
  color: #3498db;
  font-weight: 500;
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 6px;
  color: #e94560;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.btn:hover {
  background: rgba(233, 69, 96, 0.1);
  border-color: rgba(233, 69, 96, 0.5);
}

.btn-icon {
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon svg {
  width: 16px;
  height: 16px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .app-header {
    padding: 1rem;
  }
  
  .app-main {
    padding: 0 1rem;
  }
  
  .status-bar {
    padding: 0.75rem 1rem;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .tab-navigation {
    flex-wrap: wrap;
  }
  
  .tab-button {
    flex: 1;
    min-width: 120px;
  }
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(26, 26, 46, 0.5);
}

::-webkit-scrollbar-thumb {
  background: rgba(233, 69, 96, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(233, 69, 96, 0.5);
}
</style>
