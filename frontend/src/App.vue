<template>
    <div class="tyrannidae-main-card">
      <div class="furnariidae-inner-panel">
        <div class="accipiter-header">
          <img src="./icons/Roadrunner.svg" alt="App Logo" class="app-logo" />
          <span class="accipiter-title">Roadrunner AI Executor</span>
          <button @click="closeWindow" class="fringilla-close-button">X</button>
        </div>

        <div v-if="$store.getters.getOllamaStatus && $store.getters.getOllamaStatus.message"
             :class="['ollama-status-banner', $store.getters.getOllamaStatus.isConnected ? 'status-connected' : 'status-disconnected']">
          {{ $store.getters.getOllamaStatus.message }}
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button @click="activeTab = 'coder'" :class="{ 'active': activeTab === 'coder' }">Coder</button>
          <button @click="activeTab = 'brainstorming'" :class="{ 'active': activeTab === 'brainstorming' }">Brainstorming</button>
          <button @click="activeTab = 'conference'" :class="{ 'active': activeTab === 'conference' }">Conference</button>
          <button @click="activeTab = 'configuration'" :class="{ 'active': activeTab === 'configuration' }">Configuration</button>
        </div>

        <!-- Coder Tab Content -->
        <div v-if="activeTab === 'coder'" class="tab-content coder-tab-content p-4 space-y-4">
          <div class="passeriformes-form-area space-y-4">
            <!--
            <div v-if="isIntegratedMode" class="piciformes-input-row flex items-center space-x-2">
              <label for="moduleSelect" class="emberiza-label">Module:</label>
              <select id="moduleSelect" v-model="selectedModule" class="turdus-select">
                <option disabled value="">-- Choose a module --</option>
                <option v-for="mod in modules" :key="mod.value" :value="mod.value">{{ mod.text }}</option>
              </select>
              <button @click="handleRefresh" title="Refresh Modules" class="pelecanus-button-action">
                🔄
              </button>
            </div>
            -->
          <div class="piciformes-input-row">
            <div class="piciformes-input-group">
              <label for="modelSelect" class="emberiza-label" title="This model is used for new tasks. You can override it for individual tasks in the session list below.">Default Task Model:</label>
              <select id="modelSelect" v-model="selectedModelId" class="turdus-select">
                <option disabled value="">-- Select Default Model --</option>
                <optgroup v-for="(group, category) in categorizedCoderModels" :key="category" :label="category.toUpperCase()">
                  <option v-for="model in group" :key="model.id" :value="model.id">
                    {{ model.name }}
                  </option>
                </optgroup>
              </select>
              <p v-if="!$store.getters.getOllamaStatus.isConnected && Object.keys(categorizedCoderModels).length === 0" class="text-xs text-red-400">
                Models unavailable: Ollama connection issue.
              </p>
            </div>
            <button @click="loadAvailableModels" title="Refresh Models" class="pelecanus-button-action">
              🔄
            </button>
          </div>

          <div>
            <label for="taskFileUpload" class="emberiza-label">Custom Task File (.md, .txt):</label>
            <input type="file" id="taskFileUpload" @change="handleFileUpload" accept=".md,.txt" class="turdus-select">
          </div>

          <!-- Safety Mode Toggle -->
          <div class="piciformes-input-row items-center my-2 py-2 border-t border-b border-gray-700">
            <input type="checkbox" id="safetyModeToggle" v-model="safetyModeActive" class="mr-2 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800">
            <label for="safetyModeToggle" class="emberiza-label">Enable Safety Mode</label>
            <span class="text-xs text-gray-400 ml-2 cursor-help" title="When enabled, potentially destructive operations (like file writes or deletions) will require confirmation before executing.">(?)</span>
          </div>

          <!-- Session Management Section -->
          <div class="session-management-area border-t border-b border-gray-700 py-4 my-4 space-y-3">
            <h3 class="text-lg font-semibold text-gray-300">Session Management</h3>
            <div class="piciformes-input-row">
              <label for="newSessionName" class="emberiza-label">Session Name:</label>
              <input type="text" id="newSessionName" v-model="newSessionName" placeholder="Optional, e.g., my-feature-session" class="turdus-select flex-grow">
            </div>
            <div class="flex space-x-2">
              <button @click="saveCurrentSession" class="pelecanus-button-action">Save Session</button>
              <button @click="listSessions" class="pelecanus-button-action">Refresh Sessions List</button>
            </div>
            <div v-if="availableSessions.length > 0" class="piciformes-input-row items-center">
              <label for="availableSessionsDropdown" class="emberiza-label">Load Session:</label>
              <select id="availableSessionsDropdown" @change="loadSelectedSession($event.target.value)" class="turdus-select flex-grow">
                <option value="">-- Select a session --</option>
                <option v-for="session in availableSessions" :key="session.id" :value="session.id">
                  {{ session.name }} ({{ new Date(session.mtime).toLocaleString() }})
                </option>
              </select>
            </div>
             <div v-else class="text-gray-500 text-sm">
              No saved sessions found. Click "Refresh Sessions List" or save a new one.
            </div>
          </div>
          <!-- End Session Management Section -->

          <!-- Task Display Area -->
          <div class="task-display-area border-b border-gray-700 py-4 my-4 space-y-2">
            <h3 class="text-lg font-semibold text-gray-300">Session Tasks ({{ sessionTasks.length }}) <span v-if="activeSessionTaskId && activeSessionTaskDetails" class="text-sm text-gray-400">- Selected: {{ getActiveTaskDescription() }}</span></h3>
            <div v-if="sessionTasks.length > 0" class="flex flex-col md:flex-row">
              <!-- Task List -->
              <div class="w-full md:w-1/3 pr-0 md:pr-2 md:border-r md:border-gray-600 max-h-96 overflow-y-auto mb-4 md:mb-0 min-h-0">
                <ul class="list-none pl-0 text-sm">
                  <li v-for="(task) in sessionTasks" :key="task.taskId"
                      @click="setActiveSessionTask(task.taskId)"
                      :class="['p-2 my-1 rounded cursor-pointer hover:bg-gray-700', { 'bg-blue-700 hover:bg-blue-600 text-white ring-2 ring-blue-400': task.taskId === activeSessionTaskId }]">
                    <div class="font-medium">{{ task.task_description || 'Untitled Task' }}</div>
                    <div class="text-xs text-gray-400">{{ task.steps ? task.steps.length : 0 }} steps - <span class="italic">ID: {{ task.taskId.substring(0,8) }}...</span></div>
                    <!-- Per-task Model Selector -->
                    <div class="mt-1">
                      <label :for="'taskModelSelect-' + task.taskId" class="text-xs text-gray-400 mr-1">Model:</label>
                      <!-- Prevent li click when interacting with select -->
                      <select :id="'taskModelSelect-' + task.taskId"
                              v-model="task.modelConfigId"
                              @change="updateTaskModelConfig(task, $event.target.value)"
                              @click.stop
                              class="turdus-select turdus-select-xs text-xs bg-gray-700 border-gray-600 focus:ring-blue-500 focus:border-blue-500">
                        <option disabled value="">-- Select Model --</option>
                        <optgroup v-for="(group, category) in categorizedCoderModels" :key="category" :label="category.toUpperCase()">
                          <option v-for="model in group" :key="model.id" :value="model.id">
                            {{ model.name }}
                          </option>
                        </optgroup>
                      </select>
                    </div>
                    <div v-if="task.modelConfig" class="text-xs text-gray-500 italic">Using: {{ task.modelConfig.name }} ({{task.modelConfig.type}})</div>


                    <!-- Display Statistics -->
                    <div v-if="task.lastExecutionStats && task.lastExecutionStats.overallStatus !== 'not_run'" class="text-xs mt-1">
                      <span :class="['font-semibold', task.lastExecutionStats.overallStatus === 'success' ? 'text-green-400' : (task.lastExecutionStats.overallStatus === 'failure' ? 'text-red-400' : 'text-yellow-400')]">
                        Status: {{ (task.lastExecutionStats.overallStatus || '').replace('_', ' ') }}
                      </span>
                      <span class="ml-2 text-gray-400">S: {{ task.lastExecutionStats.stepsSucceeded }}/{{ task.lastExecutionStats.stepsTotal }}</span>
                      <span v-if="task.lastExecutionStats.stepsFailed > 0" class="ml-1 text-red-400">F: {{ task.lastExecutionStats.stepsFailed }}</span>
                      <span v-if="task.lastExecutionStats.stepsSkipped > 0" class="ml-1 text-yellow-400">Sk: {{ task.lastExecutionStats.stepsSkipped }}</span>
                      <div v-if="task.lastExecutionStats.logFile" class="text-gray-500 truncate" :title="task.lastExecutionStats.logFile">Log: {{ task.lastExecutionStats.logFile }}</div>
                    </div>
                     <div v-else class="text-xs text-gray-500 mt-1 italic">
                        Not yet run or no stats.
                    </div>
                  </li>
                </ul>
              </div>
              <!-- Steps and Annotations for Active Task -->
              <div class="w-full md:w-2/3 md:pl-2 max-h-96 overflow-y-auto min-h-0">
                <!-- ... (existing steps and annotations display) ... -->
              </div>
            </div>
            <div v-else class="text-gray-500 text-sm">
               No tasks in the current session. Upload a task file or load a session.
            </div>
          </div>
          <!-- End Task Display Area -->

          <button @click="runExecutor" class="cardinalis-button-primary"
                  :disabled="(!activeSessionTaskId && sessionTasks.length === 0) || !$store.getters.getOllamaStatus.isConnected">
            Run Active Task
          </button>

          <!-- Executor Console Output Panel -->
          <div class="executor-output-panel border-t border-gray-700 mt-4 pt-4 space-y-2">
            <h3 class="text-lg font-semibold text-gray-300">Executor Output</h3>
            <div v-if="executorOutput.length === 0" class="text-gray-500 text-sm">
              No output yet. Run a task to see logs.
            </div>
            <div v-else class="max-h-60 overflow-y-auto bg-gray-900 p-2 rounded space-y-1 text-sm">
              <div v-for="(item, index) in executorOutput" :key="index"
                   :class="['whitespace-pre-wrap', item.type === 'error' ? 'text-red-400' : (item.type === 'success' ? 'text-green-400' : 'text-gray-300')]">
                <span class="font-mono text-xs mr-2">{{ new Date(item.timestamp).toLocaleTimeString() }}</span>
                <span>{{ item.message }}</span>
              </div>
            </div>
          </div>
           <div class="mt-4">
              <button @click="openCoderInstructions" class="pelecanus-button-action text-xs">Edit Coder Instructions</button>
            </div>
        </div>
      </div>

        <!-- Brainstorming Tab Content -->
        <div v-if="activeTab === 'brainstorming'" class="tab-content brainstorming-tab-content p-4 flex flex-col space-y-4">
          <!-- Model Selection for Brainstorming -->
          <div class="piciformes-input-row">
            <div class="piciformes-input-group">
              <label for="brainstormingModelSelect" class="emberiza-label">Brainstorming Model:</label>
              <select id="brainstormingModelSelect" v-model="selectedBrainstormingModelId" class="turdus-select">
                <option disabled value="">-- Select Model --</option>
                <!-- Assuming categorizedCoderModels can be used here, or a similar structure for brainstorming models -->
                <optgroup v-for="(group, category) in categorizedCoderModels" :key="category" :label="category.toUpperCase()">
                  <option v-for="model in group" :key="model.id" :value="model.id">
                    {{ model.name }}
                  </option>
                </optgroup>
              </select>
              <p v-if="!$store.getters.getOllamaStatus.isConnected && Object.keys(categorizedCoderModels).length === 0" class="text-xs text-red-400">
                Models unavailable: Ollama connection issue.
              </p>
            </div>
            <!-- Optional: Refresh button for brainstorming models if applicable
            <button @click="loadBrainstormingModels" title="Refresh Models" class="pelecanus-button-action">
              🔄
            </button>
            -->
          </div>

          <!-- Chat History Panel -->
          <div class="chat-history-panel" ref="brainstormingChatHistory">
            <div v-for="(message, index) in brainstormingHistory" :key="index" :class="['chat-message', message.sender === 'user' ? 'user-message' : 'model-message']">
              <div class="sender-label">{{ message.sender === 'user' ? 'You' : (message.modelName || 'Model') }}</div>
              <div class="message-text" v-html="renderMarkdown(message.text)"></div>
              <!-- Basic display for tool events -->
              <div v-if="message.toolEvents && message.toolEvents.length > 0" class="tool-events-display mt-1 p-1 border-l-2 border-gray-500 text-xs">
                <div v-for="event in message.toolEvents" :key="event.id" class="tool-event ml-2 my-1">
                  <span class="font-semibold">{{ event.toolName }}</span> (Status: <span :class="{'text-green-400': event.status === 'success', 'text-red-400': event.status === 'error', 'text-yellow-400': event.status === 'running'}">{{ event.status }}</span>)
                  <pre v-if="event.details" class="bg-gray-800 p-1 rounded text-xs overflow-x-auto">{{ JSON.stringify(event.details, null, 2) }}</pre>
                </div>
              </div>
            </div>
            <div v-if="isStreamingResponse" class="chat-message model-message">
              <div class="sender-label">Model (Streaming...)</div>
              <div class="message-text"><em>Typing...</em></div>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="brainstormingModelError" class="chat-error-message">
            {{ brainstormingModelError }}
          </div>

          <!-- Chat Input Area -->
          <div class="chat-input-area">
            <textarea v-model="brainstormingInput" @keyup.enter.exact="sendBrainstormingMessage" placeholder="Type your message or drop a file..." class="hirundo-text-input"></textarea>

            <label for="brainstormingFileUpload" class="chat-file-upload-button" title="Attach File">
              <!-- Icon is in CSS ::before, or can be text/SVG here -->
            </label>
            <input type="file" id="brainstormingFileUpload" @change="handleBrainstormingFileUpload" class="hidden">

            <button @click="sendBrainstormingMessage" :disabled="isStreamingResponse || !brainstormingInput.trim() || !$store.getters.getOllamaStatus.isConnected" class="pelecanus-button-action chat-send-button">
              Send
            </button>
          </div>
           <div class="mt-4">
              <button @click="openBrainstormingInstructions" class="pelecanus-button-action text-xs">Edit Brainstorming Instructions</button>
            </div>
        </div>

        <!-- Conference Tab Content -->
        <div v-if="activeTab === 'conference'" class="tab-content conference-tab-content p-4">
          <conference-tab @edit-instructions="openConferenceAgentInstructions" />
        </div>

        <!-- Configuration Tab Content -->
        <div v-if="activeTab === 'configuration'" class="tab-content configuration-tab-content p-4 space-y-4">
          <configuration-tab />
        </div>

        <!-- Settings Panel (conditionally rendered) -->      </div>
      <instructions-modal
        :agentType="modalAgentType"
        :agentRole="modalAgentRole"
        v-model:showModal="showInstructionsModal"
      />
   </div>
</template>

<script>
import RoadmapParser from './RoadmapParser';
import Executor from './executor';
import ConfigurationTab from './components/ConfigurationTab.vue';
import ConferenceTab from './components/ConferenceTab.vue';
import InstructionsModal from './components/InstructionsModal.vue'; // Import the modal

export default {
  components: {
    ConfigurationTab,
    ConferenceTab,
    InstructionsModal, // Register the modal
  },
  // ... (name, components)
  data() {
    const isIntegrated = !!(window.electronAPI && window.electronAPI.tokomakRoadrunner);
    return {
      isIntegratedMode: isIntegrated,
      activeTab: 'coder',
      selectedModule: '',
      selectedModelId: '', // ID of the globally selected default model for new tasks
      // categorizedModels: {}, // Will store models fetched from backend, structured by category
      // coderModels and languageModels are now derived from categorizedModels

      sessionTasks: [],
      availableSessions: [],
      currentSessionId: null,
      newSessionName: '',
      activeSessionTaskId: null,
      copyStatusMessage: '',
      stepAnnotationInputs: {},

      brainstormingInput: '',
      brainstormingHistory: [],
      brainstormingModelError: '',
      isStreamingResponse: false,
      isDraggingOver: false,
      uploadedTasksContent: null,
      modules: [],
      errorMessage: '',
      roadmapContentPlaceholder: `...`, // Placeholder content
      highlightKeywords: [ /* ... */ ],
      executorOutput: [],
      // ... other data properties
      useOpenAIFromStorageGlobal: false, // Keep this if it's a global setting
      selectedBrainstormingModelId: '',
      safetyModeActive: true, // Add this line, defaulting to true now

      // Coder Task specific state for confirmations and plans
      coderTaskPendingConfirmationId: null,
      coderTaskProposedPlanId: null,
      coderTaskProposedSteps: [],
      isCoderTaskAwaitingPlanApproval: false,

      // For Instructions Modal
      showInstructionsModal: false,
      modalAgentType: null,
      modalAgentRole: null,
    };
  },
  computed: {
    // ... (selectedModuleShortName, selectedModuleDisplayName, currentModuleStatusIcon)
    selectedBrainstormingModelLabel() {
      if (!this.selectedBrainstormingModelId) return 'None Selected';
      for (const category in this.categorizedCoderModels) { // Assuming categorizedCoderModels is used for brainstorming too
        const model = this.categorizedCoderModels[category].find(m => m.id === this.selectedBrainstormingModelId);
        if (model) return model.name;
      }
      return 'Unknown Model';
    },

    activeSessionTaskDetails() {
      if (!this.activeSessionTaskId || !this.sessionTasks) return null;
      const task = this.sessionTasks.find(t => t.taskId === this.activeSessionTaskId);
      if (task) {
        this.initializeTaskProperties(task); // Ensure modelConfigId is set if needed
      }
      return task;
    },

    categorizedCoderModels() {
      // This will be used for populating dropdowns
      // It's populated by loadAvailableModels
      // Example structure: { ollama: [{id, name, type}], openai: [{id, name, type}]}
      return this.$store.getters.getCategorizedModels || {}; // Assuming models are in Vuex store
    },

    allAvailableModelsForTasks() {
      // Flattens categorizedCoderModels for easier use in per-task select
      let models = [];
      for (const category in this.categorizedCoderModels) {
        models = models.concat(this.categorizedCoderModels[category]);
      }
      // Ensure unique models if IDs might overlap (though they shouldn't if IDs are unique)
      return Array.from(new Map(models.map(m => [m.id, m])).values());
    },
    defaultModelConfig() {
      // Priority 1: Current selectedModelId if valid
      if (this.selectedModelId) {
        const selectedModel = this.allAvailableModelsForTasks.find(m => m.id === this.selectedModelId);
        if (selectedModel) return { ...selectedModel };
      }

      // Priority 2: First available model from configured defaultOllamaModels
      const configuredDefaultModels = this.$store.getters.getSettings?.defaultOllamaModels || [];
      if (configuredDefaultModels.length > 0) {
        for (const defaultModelId of configuredDefaultModels) {
          const model = this.allAvailableModelsForTasks.find(m => m.id === defaultModelId);
          if (model) return { ...model };
        }
      }

      // Priority 3: Fallback to the first available model in the entire list
      if (this.allAvailableModelsForTasks.length > 0) {
        return { ...this.allAvailableModelsForTasks[0] };
      }

      // Absolute fallback
      return { id: 'default/unknown', name: 'Unknown/Default', type: 'unknown' };
    }
  },
  watch: {
    showInstructionsModal(newValue, oldValue) {
      console.log(`[App.vue] showInstructionsModal changed from ${oldValue} to ${newValue}`);
    },
    selectedModule(newModule, oldModule) { /* ... */ },
    categorizedCoderModels: {
      handler(newModels) {
        if (newModels && Object.keys(newModels).length > 0) {
          let defaultModelSet = false;
          const configuredDefaultModels = this.$store.getters.getSettings?.defaultOllamaModels || [];

          // Try to set based on configured default models
          if (configuredDefaultModels.length > 0) {
            for (const defaultModelId of configuredDefaultModels) {
              for (const category in newModels) {
                const foundModel = newModels[category].find(m => m.id === defaultModelId);
                if (foundModel) {
                  if (!this.selectedModelId) {
                    this.selectedModelId = foundModel.id;
                    console.log('[Watcher categorizedCoderModels] Default selectedModelId set from configured defaults to:', foundModel.id);
                  }
                  if (!this.selectedBrainstormingModelId) {
                    this.selectedBrainstormingModelId = foundModel.id;
                    console.log('[Watcher categorizedCoderModels] Default selectedBrainstormingModelId set from configured defaults to:', foundModel.id);
                  }
                  // If both are set, or if we only care about setting them once if they are empty.
                  // For now, let's assume we set both if a configured default is found and they are empty.
                  if (this.selectedModelId && this.selectedBrainstormingModelId) {
                     // If we want to stop after finding the *first* configured default that matches, set a flag.
                     // For now, this logic implies that if multiple configured defaults are present,
                     // the one appearing earliest in the `configuredDefaultModels` array and available will be chosen.
                     defaultModelSet = true; // A configured default was found and applied if slots were empty.
                     break; // Exit inner loop (categories)
                  }
                }
              }
              if (defaultModelSet && this.selectedModelId && this.selectedBrainstormingModelId) break; // Exit outer loop (configured defaults) if both set
            }
          }

          // Fallback: If no configured default was suitable or if lists were empty initially
          if (!this.selectedModelId || !this.allAvailableModelsForTasks.find(m => m.id === this.selectedModelId)) {
            const firstCategory = Object.keys(newModels)[0];
            const firstModelInNew = newModels[firstCategory]?.[0];
            if (firstModelInNew && firstModelInNew.id) {
              this.selectedModelId = firstModelInNew.id;
              console.log('[Watcher categorizedCoderModels] Fallback: Default selectedModelId set to first available:', firstModelInNew.id);
            }
          }
          if (!this.selectedBrainstormingModelId || !this.allAvailableModelsForTasks.find(m => m.id === this.selectedBrainstormingModelId)) {
            const firstCategory = Object.keys(newModels)[0];
            const firstModelInNew = newModels[firstCategory]?.[0]; // Re-evaluate in case selectedModelId took it
            if (firstModelInNew && firstModelInNew.id) {
              this.selectedBrainstormingModelId = firstModelInNew.id;
              console.log('[Watcher categorizedCoderModels] Fallback: Default selectedBrainstormingModelId set to first available:', firstModelInNew.id);
            }
          }
        }
      },
      deep: true,
      immediate: true,
    }
  },
  methods: {
    closeWindow() {
      if (window.electronAPI && window.electronAPI.closeWindow) {
        console.log('[App.vue] closeWindow: Calling electronAPI.closeWindow()');
        window.electronAPI.closeWindow();
      } else {
        console.warn('[App.vue] closeWindow: window.electronAPI.closeWindow is not available. Cannot close window.');
        // Optionally, provide a fallback for non-Electron environments or display an error
        alert('Close operation is not available in this environment.');
      }
    },
    setActiveSessionTask(taskId) {
      this.activeSessionTaskId = taskId;
      console.log(`[App.vue] Active session task set to: ${taskId}`);
      // Ensure getActiveTaskDescription() is available or provide a fallback.
      // The existing getActiveTaskDescription method seems suitable.
      const description = this.getActiveTaskDescription ? this.getActiveTaskDescription() : (this.activeSessionTaskDetails ? this.activeSessionTaskDetails.task_description : 'selected task');
      this.executorOutput.unshift({ message: `Selected task: ${description}. Ready to run.`, type: 'info', timestamp: new Date() });
    },
    // ... (handleRefresh, openDirectoryDialog, saveGeneralConfiguration, etc.)
    // Ensures essential properties (like modelConfig, annotations, lastStatus) exist on a task object.
    initializeTaskProperties(task) {
      if (!task.modelConfig || !task.modelConfig.id) {
        task.modelConfig = { ...this.defaultModelConfig };
      }
      if (!task.modelConfigId) { // Used for v-model on select
          task.modelConfigId = task.modelConfig.id;
      }
      // ... (existing initializeAnnotations logic)
       if (task.steps && Array.isArray(task.steps)) {
          task.steps.forEach(step => {
            if (!step.hasOwnProperty('annotations') || !Array.isArray(step.annotations)) {
              step.annotations = [];
            }
            if (!step.hasOwnProperty('lastStatus')) {
              step.lastStatus = 'not_run';
            }
          });
        }
    },

    updateTaskModelConfig(task, selectedModelId) {
      const model = this.allAvailableModelsForTasks.find(m => m.id === selectedModelId);
      if (model) {
        task.modelConfig = { ...model }; // Store a copy of the full model object
        task.modelConfigId = model.id; // Ensure modelConfigId is also updated if not already
        this.$forceUpdate(); // May be needed if changes are deep and not immediately reactive in the list
        this.executorOutput.unshift({ message: `Model for task "${task.task_description}" changed to ${model.name}. Save session to persist.`, type: 'info', timestamp: new Date() });
      }
    },

    // Adds a new task (e.g., from a file upload or future "new task" button) to the current session's task list.
    // Initializes the task with default properties, including the currently selected default model.
    addTaskToSession(taskDetails) { // Generic method to add a task
        const newTask = {
            taskId: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            task_description: taskDetails.description || 'Untitled Task from Add',
            steps: taskDetails.steps || [],
            modelConfig: { ...this.defaultModelConfig }, // Assign default model
            modelConfigId: this.defaultModelConfig.id,
            timestamp: new Date().toISOString(),
            status: 'defined',
            lastExecutionStats: {
                overallStatus: 'not_run',
                stepsSucceeded: 0,
                stepsTotal: (taskDetails.steps || []).length,
                stepsFailed: 0,
                stepsSkipped: 0,
                logFile: null
            },
        };
        this.initializeTaskProperties(newTask);
        this.sessionTasks.push(newTask);
        this.activeSessionTaskId = newTask.taskId;
        // console.log('[App.vue Coder] addTaskToSession: Task added/updated. Active Task ID:', this.activeSessionTaskId, 'Session tasks:', JSON.stringify(this.sessionTasks)); // Covered by handleFileUpload log
    },

    // Handles the event when a user uploads a task file.
    // Reads the file, parses its content into steps using RoadmapParser (for specific formats),
    // or creates generic steps for other file types, then adds it as a new task to the session.
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileContent = e.target.result;
          let taskDescription = '';
          let stepsToUse = [];

          // Check if the file is a .md or .txt file
          if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
            // Attempt to parse with RoadmapParser
            const parser = new RoadmapParser(fileContent);
            const parsedOutput = parser.parse(); // RoadmapParser returns an object, not an array of steps directly

            // Check if parsedOutput is a valid array of steps (e.g., parsedOutput.steps)
            // For now, RoadmapParser returns an object, so this condition will likely not be met.
            // This structure anticipates a future where RoadmapParser might return { description: '...', steps: [...] }
            if (parsedOutput && Array.isArray(parsedOutput.steps) && parsedOutput.steps.length > 0) {
              stepsToUse = parsedOutput.steps;
              taskDescription = parsedOutput.description || `Uploaded: ${file.name}`;
              this.executorOutput.unshift({ message: `Task file "${file.name}" parsed successfully by RoadmapParser.`, type: 'info', timestamp: new Date() });
            } else {
              // Fallback for .md/.txt files that don't parse into steps or if RoadmapParser's output isn't as expected
              this.executorOutput.unshift({ message: `File "${file.name}" (${file.type}) was not parsable into direct steps by RoadmapParser or parser returned an empty/invalid result. Creating generic file task.`, type: 'info', timestamp: new Date() });
              taskDescription = `Process uploaded file: ${file.name}`;
              stepsToUse = [
                { type: "createFile", details: { filePath: file.name, content: fileContent } },
                { type: "generic_step", details: { description: `The file '${file.name}' has been uploaded. What would you like to do with it? (e.g., execute it if it's a script, summarize it if it's text)` } }
              ];
            }
          } else {
            // Generic file handling for non-.md/.txt files
            this.executorOutput.unshift({ message: `Uploaded generic file "${file.name}" (${file.type}). Creating generic file task.`, type: 'info', timestamp: new Date() });
            taskDescription = `Process uploaded file: ${file.name}`;
            stepsToUse = [
              { type: "createFile", details: { filePath: file.name, content: fileContent } },
              { type: "generic_step", details: { description: `The file '${file.name}' has been uploaded. What would you like to do with it? (e.g., execute it if it's a script, summarize it if it's text)` } }
            ];
          }

          this.addTaskToSession({
            description: taskDescription,
            steps: stepsToUse
          });
          console.log('[App.vue Coder] handleFileUpload: Task added/updated. Active Task ID:', this.activeSessionTaskId, 'Session tasks:', JSON.stringify(this.sessionTasks));

          event.target.value = null; // Reset the file input
        };
        reader.onerror = (error) => {
          console.error('Error reading file:', error);
          this.executorOutput.unshift({ message: `Error reading file "${file.name}": ${error.message}`, type: 'error', timestamp: new Date() });
          event.target.value = null; // Reset the file input even on error
        };
        reader.readAsText(file);
      }
    },
    // Placeholder for potential future use if modules define tasks directly.
    async loadRoadmap() {
        // ... (existing logic to fetch roadmap content)
        // When steps are parsed:
        // const parsedSteps = parser.parse();
        // this.addTaskToSession({ description: `Module: ${prettyModuleName}`, steps: parsedSteps });
        // ...
    },
    // Loads tasks from a previously saved session file into the current session.
    async loadSelectedSession(sessionId) {
      if (!sessionId) return;
      // ... (fetch session data)
      // if (result.success && result.sessionData) {
      //   this.sessionTasks = result.sessionData.tasks || [];
      //   this.sessionTasks.forEach(task => this.initializeTaskProperties(task)); // Ensures modelConfig is set
      // ...
    },

    // Prepares the payload for the currently active task and sends it to the backend via SSE for execution.
    runExecutor() {
      console.log('[App.vue Coder] runExecutor: Called. Active Task ID:', this.activeSessionTaskId);

      if (!this.$store.getters.getOllamaStatus.isConnected) {
        const errorMsg = 'Cannot run task: Ollama is not connected. Please check Configuration.';
        this.executorOutput.unshift({ message: errorMsg, type: 'error', timestamp: new Date() });
        console.error('[App.vue Coder] runExecutor:', errorMsg);
        return;
      }

      const activeTask = this.activeSessionTaskDetails;
      if (!activeTask) {
        const errorMsg = 'Cannot run task: No active task selected or task details are unavailable.';
        this.executorOutput.unshift({ message: errorMsg, type: 'error', timestamp: new Date() });
        console.error('[App.vue Coder] runExecutor:', errorMsg, 'Active Task ID:', this.activeSessionTaskId);
        return;
      }
      console.log('[App.vue Coder] runExecutor: Active task details:', JSON.stringify(activeTask));

      const modelIdForTask = activeTask.modelConfig?.id || this.defaultModelConfig.id;
      if (!modelIdForTask || modelIdForTask === 'default/unknown') {
        const errorMsg = `Cannot run task "${activeTask.task_description}": Model not selected or invalid. Please select a model for this task or a default model.`;
        this.executorOutput.unshift({ message: errorMsg, type: 'error', timestamp: new Date() });
        console.error('[App.vue Coder] runExecutor:', errorMsg, 'Model ID:', modelIdForTask);
        return;
      }

      const payload = {
        task_description: activeTask.task_description,
        steps: JSON.stringify(activeTask.steps),
        modelId: modelIdForTask,
        modelType: activeTask.modelConfig?.type || this.defaultModelConfig.type,
        safetyMode: this.safetyModeActive,
        isAutonomousMode: false,
        sessionId: this.currentSessionId,
        sessionTaskId: this.activeSessionTaskId,
        useOpenAIFromStorage: localStorage.getItem('useStoredOpenAIKey') === 'true',
      };
      this.executorOutput.unshift({ message: `Executing task: "${payload.task_description}". Using model: ${payload.modelId} (${payload.modelType}).`, type: 'info', timestamp: new Date() });

      if (window.electronAPI && window.electronAPI.executeTaskWithEvents) {
        this.executorOutput.unshift({ message: `Initializing task execution: "${payload.task_description}"...`, type: 'info', timestamp: new Date() });
        console.log('[App.vue Coder] runExecutor: Payload for executeTaskWithEvents:', JSON.stringify(payload));
        window.electronAPI.executeTaskWithEvents(payload);
      } else {
        const errorMsg = 'Error: executeTaskWithEvents API is not available. Cannot run task.';
        this.executorOutput.unshift({ message: errorMsg, type: 'error', timestamp: new Date() });
        console.error('[App.vue Coder] runExecutor: executeTaskWithEvents API is not available!');
        // console.error('[App.vue] runExecutor: window.electronAPI.executeTaskWithEvents is not available.'); // Redundant with above
      }
    },

    handleCoderTaskEvent(eventData) {
      console.log('[App.vue Coder] handleCoderTaskEvent: Received event:', JSON.stringify(eventData));
      // console.log('[App.vue] handleCoderTaskEvent:', eventData);
      let message = '';
      let type = eventData.logLevel || 'info'; // Default type

      switch (eventData.type) {
        case 'log_entry':
          message = eventData.message;
          type = eventData.logLevel || 'info';
          break;
        case 'llm_chunk':
          // For simplicity, each chunk creates a new entry.
          // A more sophisticated approach might append to the last message if it's also an llm_chunk.
          message = eventData.content;
          type = 'llm';
          break;
        case 'file_written':
          message = `File Written: ${eventData.path}${eventData.message ? ` - ${eventData.message}` : ''}`;
          type = 'success';
          break;
        case 'error':
          message = `Error: ${eventData.content}`;
          type = 'error';
          break;
        case 'execution_complete':
          message = `Task Complete: ${eventData.message}`;
          if (eventData.finalLogSummary) {
            message += `\nSummary: ${eventData.finalLogSummary}`;
          }
          type = 'success';
          break;
        case 'confirmation_required':
          this.coderTaskPendingConfirmationId = eventData.confirmationId;
          // For now, log and auto-deny. UI for confirmation is a separate feature.
          message = `CONFIRMATION REQUIRED: ${eventData.message}\nDetails: ${JSON.stringify(eventData.details)}\n(Auto-denying for now.)`;
          type = 'warning';
          if (window.electronAPI && window.electronAPI.sendTaskConfirmationResponse) {
            window.electronAPI.sendTaskConfirmationResponse({ confirmationId: eventData.confirmationId, confirmed: false });
          }
          break;
        case 'proposed_plan':
          this.coderTaskProposedPlanId = eventData.planId;
          this.coderTaskProposedSteps = eventData.generated_steps;
          this.isCoderTaskAwaitingPlanApproval = true;
          // For now, log. UI for plan approval is a separate feature.
          message = `PROPOSED PLAN (ID: ${eventData.planId}): Review needed. Steps:\n${JSON.stringify(eventData.generated_steps, null, 2)}`;
          type = 'info';
          // To auto-reject:
          // if (window.electronAPI && window.electronAPI.sendTaskPlanApprovalResponse) {
          //   window.electronAPI.sendTaskPlanApprovalResponse({ planId: eventData.planId, approved: false });
          //   this.isCoderTaskAwaitingPlanApproval = false;
          // }
          break;
        default:
          message = `Unknown event: ${JSON.stringify(eventData)}`;
          type = 'info';
      }

      this.executorOutput.unshift({
        message: message,
        type: type,
        timestamp: new Date(),
        details: eventData.details || (eventData.type === 'proposed_plan' ? eventData.generated_steps : null)
      });
      console.log('[App.vue Coder] handleCoderTaskEvent: executorOutput updated. New length:', this.executorOutput.length);

      // If it was a confirmation or plan, reset relevant flags if auto-action was taken
      if (eventData.type === 'confirmation_required' && !this.safetyModeActive) { // Assuming auto-deny for now
          this.coderTaskPendingConfirmationId = null;
      }
      // if (eventData.type === 'proposed_plan' && !this.isCoderTaskAwaitingPlanApproval) { // If auto-rejected
      //     this.coderTaskProposedPlanId = null;
      //     this.coderTaskProposedSteps = [];
      // }
    },

    async loadAvailableModels() {
      this.$store.dispatch('updateOllamaStatus', { isConnected: false, message: 'Attempting to connect to Ollama and fetch models...' });
      this.executorOutput.unshift({ message: 'ℹ️ Fetching available LLM models...', type: 'info', timestamp: new Date() });
      try {
        const backendPort = this.$store.state.backendPort;
        if (!backendPort || backendPort === 0) {
            console.error("[App.vue] Backend port not available or invalid in store for loadAvailableModels. Cannot fetch models.");
            this.executorOutput.unshift({ message: `❌ Error: Backend port not configured. Cannot fetch models. Check console.`, type: 'error', timestamp: new Date() });
            return;
        }
        const response = await fetch(`http://127.0.0.1:${backendPort}/api/ollama-models/categorized`);
        if (!response.ok) {
          const errorText = await response.text();
          this.executorOutput.unshift({ message: `❌ Error fetching models: ${response.status} ${errorText}`, type: 'error', timestamp: new Date() });
          throw new Error(`Backend model fetch failed: ${response.status} ${errorText}`);
        }

        const categorizedData = await response.json();

        for (const category in categorizedData) {
          if (Array.isArray(categorizedData[category])) {
            categorizedData[category].forEach(model => {
              if (!model.id) {
                model.id = model.model; // or model.name, but model.model seems more like a unique identifier
                console.log(`[App.vue] loadAvailableModels: Added missing 'id' to model: ${model.name} -> ${model.id}`);
              }
            });
          }
        }

        this.$store.dispatch('updateModels', categorizedData); // Dispatch to Vuex store

        // Set a default selectedModelId if not already set and models are available
        if (!this.selectedModelId && this.allAvailableModelsForTasks.length > 0) {
            // Prefer a local model if available, otherwise first in list
            let defaultModel = this.allAvailableModelsForTasks.find(m => m.type === 'ollama');
            if (!defaultModel) defaultModel = this.allAvailableModelsForTasks[0];
            this.selectedModelId = defaultModel.id;
        }
        this.executorOutput.unshift({ message: `✅ Models loaded: ${this.allAvailableModelsForTasks.length} total. Default task model: ${this.defaultModelConfig.name}`, type: 'success', timestamp: new Date() });
        this.$store.dispatch('updateOllamaStatus', { isConnected: true, message: 'Ollama Connected & Models Loaded.' });
        // Ensure the success message to executorOutput is also clear
        const successMsg = `✅ Models loaded: ${this.allAvailableModelsForTasks.length} total. Default task model: ${this.defaultModelConfig.name}. Ollama connection successful.`;
        // Remove previous info/error messages about model loading to prevent clutter
        this.executorOutput = this.executorOutput.filter(item => !item.message.includes('Fetching available LLM models') && !item.message.includes('Error fetching models'));
        this.executorOutput.unshift({ message: successMsg, type: 'success', timestamp: new Date() });

      } catch (error) {
        console.error('Error in loadAvailableModels:', error);
        // Construct a more informative message
        let userFriendlyMessage = `❌ Critical Error: Could not fetch LLM models. This usually means Ollama is not running or not reachable by the backend. Please ensure Ollama is operational. Details: ${error.message.includes('Backend model fetch failed') ? error.message.substring('Backend model fetch failed:'.length).trim() : error.message}`;
        if (error.message.includes('response.status')) { // Likely a fetch error with status
             userFriendlyMessage = `❌ Critical Error: Could not fetch LLM models from backend. Server responded with an error. This may be due to Ollama being unavailable to the backend. Please check backend logs and ensure Ollama is running. Details: ${error.message}`;
        }

        // Update executorOutput (ensure this doesn't duplicate if already handled by specific error throws)
        const existingErrorOutput = this.executorOutput.find(item => item.message.includes('Error fetching models') || item.message.includes('Exception during model load'));
        if (!existingErrorOutput) {
            this.executorOutput.unshift({ message: userFriendlyMessage, type: 'error', timestamp: new Date() });
        } else {
            // Update existing message if it's too generic
            if (!existingErrorOutput.message.includes('Ollama')) {
                existingErrorOutput.message = userFriendlyMessage;
            }
        }
        this.$store.dispatch('updateOllamaStatus', { isConnected: false, message: 'Ollama Connection Failed. Many features will be disabled.' });
      }
    },

    getActiveTaskDescription() {
      if (this.activeSessionTaskDetails && this.activeSessionTaskDetails.task_description) {
        return this.activeSessionTaskDetails.task_description;
      }
      return 'No active task';
    },
    // ... (rest of methods: copyLog, exportLog, IPC handlers, etc.)
    openCoderInstructions() {
      this.modalAgentType = 'coder_agent';
      this.modalAgentRole = null;
      this.showInstructionsModal = true;
    },
    openBrainstormingInstructions() {
      this.modalAgentType = 'brainstorming_agent';
      this.modalAgentRole = null;
      this.showInstructionsModal = true;
    },
    openConferenceAgentInstructions(role) {
      this.modalAgentType = 'conference_agent';
      this.modalAgentRole = role;
      this.showInstructionsModal = true;
    },

    // Sends the user's message from the Brainstorming tab to the main Electron process via IPC for LLM interaction.
    // Manages streaming state and adds placeholders for model responses.
    sendBrainstormingMessage() {
      if (!this.selectedBrainstormingModelId) {
        this.brainstormingModelError = 'Error: Brainstorming model not selected. Please choose a model from the dropdown.';
        console.warn('[App.vue] sendBrainstormingMessage: Prevented sending message because selectedBrainstormingModelId is not set. Value:', JSON.stringify(this.selectedBrainstormingModelId));
        this.scrollToBottom('brainstorming'); // Scroll to make error visible
        return;
      }
      if (!this.brainstormingInput.trim() || this.isStreamingResponse) return;

      const messageText = this.brainstormingInput.trim();
      this.brainstormingHistory.push({
        sender: 'user',
        text: messageText,
        timestamp: new Date().toISOString()
      });
      this.brainstormingInput = '';
      this.scrollToBottom('brainstorming');

      this.isStreamingResponse = true;
      this.brainstormingModelError = ''; // Clear previous errors

      // Add placeholder for model's response
      this.brainstormingHistory.push({
        sender: 'model',
        text: '', // Initially empty, will be filled by stream
        modelName: this.selectedBrainstormingModelLabel || 'Model',
        timestamp: new Date().toISOString(),
        toolEvents: []
      });

      console.log('[App.vue] sendBrainstormingMessage: this.selectedBrainstormingModelId =', JSON.stringify(this.selectedBrainstormingModelId));
      console.log('[App.vue] sendBrainstormingMessage: this.selectedBrainstormingModelLabel =', this.selectedBrainstormingModelLabel);

      let modelIdToSend = this.selectedBrainstormingModelId; // Default
      let selectedModelObject = null;

      // Find the selected model object to check its type
      if (this.selectedBrainstormingModelId) {
        for (const category in this.categorizedCoderModels) {
          const model = this.categorizedCoderModels[category].find(m => m.id === this.selectedBrainstormingModelId);
          if (model) {
            selectedModelObject = model;
            break;
          }
        }
      }

      if (selectedModelObject && selectedModelObject.type === 'ollama') {
        // Check if it already has the prefix, to prevent "ollama:ollama/mistral"
        if (!this.selectedBrainstormingModelId.startsWith('ollama:')) {
             modelIdToSend = `ollama:${this.selectedBrainstormingModelId}`;
        } else {
             modelIdToSend = this.selectedBrainstormingModelId; // Already correctly prefixed
        }
      }
      // Add other conditions if there are other types that need special prefixes.

      console.log('[App.vue] sendBrainstormingMessage: Determined modelIdToSend:', modelIdToSend);

      // Transform brainstormingHistory for the backend
      const processedHistory = this.brainstormingHistory.map(message => {
        return {
          role: message.sender === 'user' ? 'user' : 'assistant',
          content: message.text
        };
      });
      // Note: The current user's message (messageText) is already included in brainstormingHistory
      // before this transformation, so processedHistory will contain it as the last element.

      if (window.electronAPI && window.electronAPI.sendBrainstormingChat) {
        window.electronAPI.sendBrainstormingChat({
          modelId: modelIdToSend, // Use the adjusted modelId
          // prompt: messageText, // Prompt is now part of the history
          history: processedHistory
        });
      } else {
        console.error("electronAPI or sendBrainstormingChat not available.");
        this.brainstormingHistory.pop(); // Remove placeholder
        this.brainstormingHistory.push({
          sender: 'model',
          text: 'Error: Brainstorming feature is not connected to the backend.',
          modelName: 'System',
          timestamp: new Date().toISOString(),
          toolEvents: []
        });
        this.isStreamingResponse = false;
      }
    },

    handleBrainstormingFileUpload(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileContent = e.target.result;
          this.brainstormingHistory.push({
            sender: 'user',
            text: `Attached file: ${file.name}\n\nContent Preview:\n${fileContent.substring(0, 200)}${fileContent.length > 200 ? '...' : ''}`,
            timestamp: new Date().toISOString()
          });
          this.executorOutput.unshift({ message: `Brainstorming: File "${file.name}" attached. First 200 chars logged.`, type: 'info', timestamp: new Date() });
          this.$nextTick(() => { this.scrollToBottom('brainstorming'); });
        };
        reader.onerror = (e) => {
          this.brainstormingModelError = `Error reading file: ${e.target.error.name}`;
          this.executorOutput.unshift({ message: `Brainstorming: Error reading file ${file.name}.`, type: 'error', timestamp: new Date() });
        };
        reader.readAsText(file); // Read as text for preview
        event.target.value = null; // Reset file input
      }
    },

    renderMarkdown(text) {
      if (!text) return '';
      // Basic pseudo-markdown for lists and bold, plus HTML escaping
      let escapedText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      escapedText = escapedText.replace(/^\s*-\s*(.*)/gm, '<ul><li>$1</li></ul>'); // Basic lists (very naive)
      escapedText = escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
      escapedText = escapedText.replace(/\n/g, '<br>'); // Newlines
      // Consolidate multiple <ul> tags that might be adjacent after naive replacement
      escapedText = escapedText.replace(/<\/ul>\s*<ul>/g, '');
      return escapedText;
    },

    scrollToBottom(type) {
      this.$nextTick(() => {
        if (type === 'brainstorming') {
          const container = this.$refs.brainstormingChatHistory;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }
        // Add other chat panel types if needed
      });
    }
  },
  // ... (mounted, beforeUnmount)
  mounted() {
    // ...
    this.loadAvailableModels(); // Load models on mount
    // ...

    // Setup IPC listeners for brainstorming chat responses from the main process.
    if (window.electronAPI) {
      // Update backend port if Electron notifies us of a change
      if (window.electronAPI.onBackendPortUpdated) {
        window.electronAPI.onBackendPortUpdated((event, { port }) => {
          this.$store.commit('SET_BACKEND_PORT', port);
          console.log(`[App.vue] Backend port updated to ${port}`);
          this.$store.dispatch('loadSettings');
        });
      }

      // Handles incoming chunks of text from the LLM stream for brainstorming.
      window.electronAPI.onBrainstormingChatStreamChunk((event, { text }) => {
        if (this.brainstormingHistory.length > 0) {
          const lastMessage = this.brainstormingHistory[this.brainstormingHistory.length - 1];
          if (lastMessage.sender === 'model') {
            lastMessage.text += text;
            this.scrollToBottom('brainstorming');
          }
        }
      });

      // Handles errors reported from the LLM stream during brainstorming.
      window.electronAPI.onBrainstormingChatStreamError((event, { error, details }) => {
        this.isStreamingResponse = false;
        this.brainstormingModelError = `Error from model: ${error}. Details: ${JSON.stringify(details)}`;
        // Optionally add to history
        const lastMessage = this.brainstormingHistory[this.brainstormingHistory.length - 1];
        if (lastMessage && lastMessage.sender === 'model' && lastMessage.text === '') {
            lastMessage.text = `Error: ${error}`;
        } else {
            this.brainstormingHistory.push({
                sender: 'model',
                text: `Error: ${error}`,
                modelName: 'System Error',
                timestamp: new Date().toISOString(),
                toolEvents: []
            });
        }
        this.scrollToBottom('brainstorming');
      });

      // Handles the end of an LLM stream for brainstorming.
      window.electronAPI.onBrainstormingChatStreamEnd(() => {
        this.isStreamingResponse = false;
        this.scrollToBottom('brainstorming');
      });

      // Coder Task Event Listeners
      if (window.electronAPI.onCoderTaskLog) {
        window.electronAPI.onCoderTaskLog((event, data) => { this.handleCoderTaskEvent(data); });
      }
      if (window.electronAPI.onCoderTaskError) {
        window.electronAPI.onCoderTaskError((event, data) => { this.handleCoderTaskEvent({ type: 'error', content: data.error, details: data.details }); });
      }
      if (window.electronAPI.onCoderTaskComplete) {
        window.electronAPI.onCoderTaskComplete((event, data) => { this.handleCoderTaskEvent({ type: 'execution_complete', message: data.message, finalLogSummary: data.finalLogSummary }); });
      }
      if (window.electronAPI.onCoderTaskConfirmationRequired) {
        window.electronAPI.onCoderTaskConfirmationRequired((event, data) => { this.handleCoderTaskEvent({ type: 'confirmation_required', confirmationId: data.confirmationId, message: data.message, details: data.details }); });
      }
      if (window.electronAPI.onCoderTaskProposedPlan) {
        window.electronAPI.onCoderTaskProposedPlan((event, data) => { this.handleCoderTaskEvent({ type: 'proposed_plan', planId: data.planId, generated_steps: data.generated_steps }); });
      }
    }
  },
  beforeUnmount() {
    // It's good practice to remove IPC listeners when the component is unmounted to prevent memory leaks.
    // Brainstorming listeners (example, actual removal depends on preload implementation)
    // if (window.electronAPI && window.electronAPI.removeAllBrainstormingListeners) {
    //   window.electronAPI.removeAllBrainstormingListeners();
    // }

    // Coder Task Event Listeners Removal
    // Assuming a generic remover or that on<Event> methods return a remover function.
    // If specific 'off' methods exist, they should be used.
    // For this subtask, we'll assume a generic remover for Coder task listeners if available.
    if (window.electronAPI && window.electronAPI.removeAllCoderTaskListeners) {
      console.log('[App.vue] Removing all Coder task listeners.');
      window.electronAPI.removeAllCoderTaskListeners();
    } else {
      // If no generic remover, individual listeners would need to be tracked and removed.
      // This part would need to be more robust if individual removal is required.
      console.warn('[App.vue] beforeUnmount: removeAllCoderTaskListeners not available. Specific listeners for Coder tasks might not be cleaned up if not handled by Electron main process or if `on` methods do not return unlistener functions.');
    }
  }
};
</script>

<style scoped>
/* Add specific styles for App.vue if needed, otherwise global styles apply */
.app-logo {
  height: 24px; /* Adjust as needed */
  width: auto;
  margin-right: 8px;
  vertical-align: middle; /* Helps align if not using flex */
}

.accipiter-header {
  display: flex; /* Use flexbox for easier alignment */
  align-items: center; /* Vertically align items in the center */
  -webkit-app-region: drag; /* Make the header draggable */
  cursor: move; /* Indicate draggable area */
}

.fringilla-close-button {
  /* Assuming this class is unique to the close button in the header */
  -webkit-app-region: no-drag; /* Make the button clickable, not draggable */
  cursor: default; /* Or its original cursor if different */
}
</style>
