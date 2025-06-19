<template>
  <div class="tachornis-button-container">
    <button class="tachornis-floating-button" @click="closeWindow">
      ✕
    </button>
  </div>
  <div class="geococcyx-executor-page">
    <div class="bubo-executor-card">
      <div class="furnariidae-inner-panel">
        <h1 class="aquila-executor-title">
          Roadrunner Autonomous Agent
        </h1>

        <div class="apodiformes-form-grid">
        <section class="task-definition-section p-4 border rounded-md mb-6">
          <div>
            <label for="taskGoal" class="emberiza-label">Overall Task Goal:</label>
            <input
              id="taskGoal"
              v-model="taskGoal"
              type="text"
              placeholder="e.g., Create a new Vue component for user profiles"
              class="hirundo-text-input"
            />
          </div>

          <div class="apodiformes-form-row flex items-center mb-4">
            <input
              id="autonomousMode"
              v-model="isAutonomousMode"
              type="checkbox"
              class="cuculus-checkbox-input mr-2"
            />
            <label for="autonomousMode" class="emberiza-label-checkbox mb-0">Enable Autonomous Mode</label>
          </div>

          <div class="apodiformes-form-row flex items-center mb-4">
            <input
              id="safetyMode"
              v-model="safetyModeActive"
              type="checkbox"
              class="cuculus-checkbox-input mr-2" />
            <label for="safetyMode" class="emberiza-label-checkbox mb-0">Safety Mode: Confirm potentially destructive actions</label>
          </div>

          <div>
            <label for="taskSteps" class="emberiza-label">Task Steps (one per line):</label>
            <textarea
              id="taskSteps"
              v-model="taskSteps"
              :disabled="isAutonomousMode"
              rows="5"
              placeholder="e.g., Define component requirements\nGenerate initial component code\nAdd basic styling"
              class="hirundo-text-input"
            ></textarea>
          </div>

          <div>
            <button
              class="cardinalis-button-large-action"
              @click="executeAutonomousTask"
              :disabled="isAwaitingPlanApproval"
            >
              {{ isAwaitingPlanApproval ? 'Awaiting Plan Approval...' : 'Execute Autonomous Task' }}
            </button>
          </div>
        </section>

          <div v-if="isAwaitingPlanApproval" class="apodiformes-form-row flex flex-col gap-4 mt-4">
            <div>
              <label class="emberiza-label">Proposed Plan (ID: {{ proposedPlanId }}):</label>
              <div v-if="proposedSteps.length > 0" class="otus-log-area max-h-52 overflow-y-auto mt-2">
                <pre class="tyto-log-preformatted">{{ JSON.stringify(proposedSteps, null, 2) }}</pre>
              </div>
              <p v-else class="emberiza-label-checkbox">No steps in the proposed plan.</p>
            </div>
            <div class="flex gap-4">
              <button class="cardinalis-button-action bg-green-600" @click="approveProposedPlan">
                Approve Plan
              </button>
              <button class="cardinalis-button-action bg-red-600" @click="declineProposedPlan">
                Decline Plan
              </button>
            </div>
          </div>

          <hr class="coloeus-divider my-6">

        <section class="utilities-section p-4 border rounded-md mb-6">
          <div class="apodiformes-form-row mb-4">
            <label class="emberiza-label">Git Operations:</label>
            <div class="flex gap-2 mt-2">
              <button class="cardinalis-button-action" @click="triggerGitOperation('revert_last_commit')">
                Revert Last Commit
              </button>
            </div>
          </div>

          <hr class="coloeus-divider my-6">

          <div class="apodiformes-form-row">
            <h2 class="emberiza-label text-xl mb-4">Coder Tools</h2>
            <div>
              <label for="sniperFileInput" class="emberiza-label">Upload Sniper.md File:</label>
              <input type="file" id="sniperFileInput" @change="handleSniperFileUpload" accept=".md" class="hirundo-text-input mb-2">
            </div>
            <div>
              <label for="targetBaseDir" class="emberiza-label">Target Base Directory:</label>
              <input type="text" id="targetBaseDir" v-model="targetBaseDir" placeholder="e.g., roadrunner/output/generated_modules" class="hirundo-text-input mb-2">
            </div>
            <button class="cardinalis-button-action mt-2" @click="handleGenerateCode">
              Generate Code from Sniper File
            </button>
          </div>

          <hr class="coloeus-divider my-6">

        <section class="task-output-section p-4 border rounded-md mb-6">
          <div v-if="showFailureOptions" class="apodiformes-form-row mt-4 p-4 border border-red-400 rounded bg-red-50">
            <h3 class="text-red-700 font-bold">Task Execution Failed</h3>
            <p v-if="currentErrorDetails"><strong>Error:</strong> {{ currentErrorDetails.message }}</p>
            <p v-if="currentFailedStep"><strong>Failed Step Type:</strong> {{ currentFailedStep.type }}</p>
            <p v-if="currentFailedStep && currentFailedStep.details"><strong>Failed Step Details:</strong> {{ JSON.stringify(currentFailedStep.details) }}</p>
            <div class="mt-4 flex gap-4">
              <button class="cardinalis-button-action bg-green-600" @click="handleRetryStep">
                Retry Step
              </button>
              <button class="cardinalis-button-action bg-orange-500" @click="handleSkipStep">
                Skip Step
              </button>
              <button class="cardinalis-button-action bg-red-600" @click="handleConvertToManual">
                Convert to Manual Mode
              </button>
            </div>
          </div>

          <div>
            <label for="modelToDownload" class="emberiza-label">Download New Ollama Model:</label>
            <div class="flex items-center gap-2 mt-2">
              <input
                id="modelToDownload"
                v-model="modelToDownload"
                type="text"
                placeholder="Enter model name (e.g., llama3, phi3:medium)"
                class="hirundo-text-input flex-grow"
              />
              <button class="cardinalis-button-action" @click="requestModelDownload" :disabled="isDownloadingModel">
                {{ isDownloadingModel ? 'Downloading...' : 'Download Model' }}
              </button>
            </div>
          </div>
        </section>

          <div v-if="logEntries.length > 0" class="corvus-log-controls mb-2 flex gap-2 justify-end">
            <button class="cardinalis-button-action" @click="copyLogToClipboard" :disabled="!logEntries.length">
              Copy Log
            </button>
            <button class="cardinalis-button-action" @click="exportLogToFile" :disabled="!logEntries.length">
              Export Log
            </button>
          </div>
          <div v-if="logStatusMessage" class="phoenicurus-status-message mb-2 text-right text-sm text-gray-600">
            {{ logStatusMessage }}
          </div>

          <div v-if="logEntries.length > 0" class="otus-log-area bg-gray-900 text-gray-200 p-3 rounded-md shadow-md min-h-[200px] font-mono text-sm">
            <div v-for="entry in logEntries" :key="entry.id" class="log-entry whitespace-pre-wrap border-b border-gray-700 py-1">
              <span class="log-timestamp text-gray-500">[{{ new Date(entry.timestamp).toLocaleTimeString() }}]</span>
              <span :class="getLogEntryClass(entry)" :title="getLogEntryTitle(entry)" class="ml-2">
                {{ entry.text }}
              </span>
              <pre v-if="entry.type === 'llm_chunk'" class="log-llm-chunk-details text-gray-400 ml-4">{{ entry.details }}</pre>
            </div>
          </div>

        </section>

          <hr class="coloeus-divider my-6">

          <div class="apodiformes-form-row">
            <h2 class="emberiza-label text-xl mb-4">Brainstorming Chat</h2>
            <div>
              <label for="brainstormingModelSelect" class="emberiza-label">Select Model for Chat:</label>
              <select id="brainstormingModelSelect" v-model="brainstormingSelectedModel" class="hirundo-text-input mb-2 w-full">
                <option disabled value="">Please select a model</option>
                <optgroup v-for="(models, category) in categorizedModels" :key="category" :label="category.toUpperCase()">
                  <option v-for="model in models" :key="model.id || model.name" :value="model.id || model.name">
                    {{ model.name }}
                  </option>
                </optgroup>
              </select>
            </div>
            <div class="mb-2">
              <label for="brainstormingFileInput" class="emberiza-label">Upload File for Context (Optional):</label>
              <input type="file" id="brainstormingFileInput" ref="brainstormingFileRef" @change="handleBrainstormingFileUpload" accept=".txt,.md,.js,.py,.html,.css,.json" class="hirundo-text-input mb-1">
              <div v-if="brainstormingFileName" class="text-sm text-gray-700 mt-1">
                Selected file: {{ brainstormingFileName }}
                <button @click="clearBrainstormingFileContext" class="ml-2 text-red-600 bg-transparent border-0 cursor-pointer text-xs">Clear</button>
              </div>
            </div>
            <div class="brainstorming-log-area h-72 overflow-y-auto mb-2 border border-gray-300 p-2.5 bg-gray-100 text-black">
              <div v-for="(message, index) in brainstormingChatHistory" :key="index" :class="message.role === 'user' ? 'user-message' : 'model-message'" class="mb-2">
                <strong class="capitalize sender-label">{{ message.role }}:</strong>
                <pre class="whitespace-pre-wrap mt-1 message-text">{{ message.content }}</pre>
              </div>
            </div>
            <textarea v-model="brainstormingCurrentInput" placeholder="Type your message..." class="hirundo-text-input mb-2" rows="3"></textarea>
            <button class="cardinalis-button-action" @click="sendBrainstormingMessage">Send Message</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import RoadmapParser from './RoadmapParser';

export default {
  name: 'RoadrunnerExecutor',
  data() {
    return {
      taskGoal: '',
      taskSteps: '',
      isAutonomousMode: false,
      logEntries: [], // Changed from log: ''
      eventSource: null,
      proposedPlanId: null,
      proposedSteps: [],
      isAwaitingPlanApproval: false,
      backendHealthy: false,
      safetyModeActive: true,
      pendingConfirmationDetails: null,
      modelToDownload: '',
      modelDownloadReader: null,
      isDownloadingModel: false,
      showFailureOptions: false,
      currentFailureId: null,
      currentErrorDetails: null,
      currentFailedStep: null,
      sniperFileContent: '',
      parsedSniperJSON: null,
      targetBaseDir: 'roadrunner/output/generated_modules',
      generatedScaffoldingSteps: [],
      categorizedModels: {},
      brainstormingSelectedModel: '',
      brainstormingChatHistory: [],
      brainstormingCurrentInput: '',
      brainstormingEventSource: null,
      currentBrainstormingModelType: null,
      brainstormingFileContent: null,
      brainstormingFileName: null,
      logStatusMessage: '',
    };
  },
  async mounted() {
    this.addLogEntry('🔎 Checking backend health...', 'info');
    this.fetchOllamaModels();
    try {
      const response = await fetch('http://127.0.0.1:3333/health');
      if (response.ok) {
        const data = await response.json();
        this.addLogEntry(`✅ Backend is healthy: ${data.status || 'OK'}`, 'info');
        this.backendHealthy = true;
      } else {
        this.addLogEntry(`⚠️ Backend health check failed. Status: ${response.status}`, 'error');
        this.backendHealthy = false;
      }
    } catch (error) {
      this.addLogEntry(`💥 Error connecting to backend: ${error.message}`, 'error', error);
      this.addLogEntry('Ensure the backend server is running at http://127.0.0.1:3333', 'info');
      this.backendHealthy = false;
    }
  },
  beforeUnmount() {
    if (this.eventSource) {
      this.eventSource.close(); this.eventSource = null;
    }
    if (this.modelDownloadReader?.cancel) {
      this.modelDownloadReader.cancel('Component unmounting').catch(e => console.error('Error cancelling model download:', e));
    }
    if (this.brainstormingEventSource) {
      this.brainstormingEventSource.close(); this.brainstormingEventSource = null;
    }
  },
  methods: {
    addLogEntry(text, type = 'info', details = null) {
      this.logEntries.push({
        id: Date.now() + Math.random(),
        text: String(text), // Ensure text is always a string
        type,
        timestamp: new Date().toISOString(),
        details,
      });
      // Auto-scroll logic can be added here if needed, by targeting the log container element
    },
    getLogEntryClass(entry) {
      return {
        'log-info-message': entry.type === 'info',
        'log-error-message': entry.type === 'error',
        'log-llm-chunk': entry.type === 'llm_chunk',
        'log-confirmation-message': entry.type === 'confirmation',
        'log-plan-message': entry.type === 'plan',
        // Add more classes as needed
      };
    },
    getLogEntryTitle(entry) {
      if (entry.type === 'error' && entry.details) {
        try {
          return JSON.stringify(entry.details, null, 2);
        } catch (e) {
          return String(entry.details);
        }
      }
      return null; // No title for non-error or no-detail entries
    },
    closeWindow() {
      if (window.electronAPI?.closeApp) window.electronAPI.closeApp();
      if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
    },
    executeAutonomousTask() {
      if (!this.backendHealthy) {
        this.addLogEntry('❌ Error: Backend is not healthy. Cannot start task.', 'error');
        return;
      }
      if (!this.taskGoal.trim()) {
        this.addLogEntry('❌ Error: Overall Task Goal cannot be empty.', 'error');
        return;
      }

      let stepsPayloadString;
      let initialLogMessage = '';

      if (this.generatedScaffoldingSteps && this.generatedScaffoldingSteps.length > 0) {
        initialLogMessage = `🚀 Initiating task with generated scaffolding steps: ${this.taskGoal}`;
        stepsPayloadString = JSON.stringify(this.generatedScaffoldingSteps);
        this.generatedScaffoldingSteps = [];
        this.isAutonomousMode = false; // Scaffolding implies defined steps
      } else if (this.isAutonomousMode) {
        initialLogMessage = `🚀 Initiating autonomous task: ${this.taskGoal}`;
        this.addLogEntry('ℹ️ Autonomous Mode enabled. Task steps will be generated by the backend.', 'info');
        stepsPayloadString = JSON.stringify([]);
      } else {
        initialLogMessage = `🚀 Initiating task with manual steps: ${this.taskGoal}`;
        if (!this.taskSteps.trim()) {
          this.addLogEntry('❌ Error: Task Steps cannot be empty when Autonomous Mode is disabled.', 'error');
          return;
        }
        const stepsArray = this.taskSteps.trim().split('\n').filter(line => line.trim() !== '').map(line => ({ type: 'generic_step', details: { description: line.trim() } }));
        if (stepsArray.length === 0) {
          this.addLogEntry('❌ Error: No valid steps provided.', 'error');
          return;
        }
        stepsPayloadString = JSON.stringify(stepsArray);
      }
      this.addLogEntry(initialLogMessage, 'info');


      if (this.eventSource) this.eventSource.close();

      const params = new URLSearchParams();
      params.append('task_description', this.taskGoal);
      params.append('steps', stepsPayloadString);
      params.append('safetyMode', this.safetyModeActive);
      params.append('isAutonomousMode', this.isAutonomousMode);
      const usePreference = localStorage.getItem('useStoredOpenAIKey') === 'true';
      params.append('useOpenAIFromStorage', usePreference);
      this.addLogEntry(`executeAutonomousTask: useOpenAIFromStorage preference set to ${usePreference}`, 'debug');


      this.eventSource = new EventSource(`http://127.0.0.1:3333/execute-autonomous-task?${params.toString()}`);
      this.eventSource.onopen = () => this.addLogEntry('✅ Connection to backend opened. Waiting for task updates...', 'info');
      this.eventSource.onmessage = this.handleSseMessage; // Changed to call the refactored method
      this.eventSource.onerror = (error) => {
        console.error('EventSource failed:', error);
        this.addLogEntry('💥 Connection error or stream interrupted.', 'error', error);
        if (this.eventSource) {
          if (this.eventSource.readyState === EventSource.CLOSED) this.addLogEntry('Connection was closed by the server.', 'info');
          this.eventSource.close(); this.eventSource = null;
        }
      };
    },
    // Refactored SSE message handler
    handleSseMessage(event) {
      try {
        const message = JSON.parse(event.data);
        let logText = '';
        let logType = 'info'; // Default type
        let logDetails = null;

        switch (message.type) {
          case 'llm_chunk':
            // For LLM chunks, we might want to append to the last log entry if it's also an llm_chunk,
            // or just create new small entries. For simplicity, creating new small entries.
            // Or, better, accumulate them into a specific display area if a more chat-like UI is desired.
            // For now, pushing as distinct entries, but could be refined.
            this.logEntries[this.logEntries.length-1].text += message.content; // Append to last entry's text
            // To avoid creating too many entries, we don't push a new one here.
            // This assumes LLM chunks are part of a larger ongoing log entry.
            // If each chunk should be its own entry, use:
            // logText = message.content; logType = 'llm_chunk';
            return; // Return early as we've modified the last entry
          case 'log_entry':
            logText = message.message;
            logType = message.logLevel || 'info'; // Assuming backend might send logLevel
            break;
          case 'file_written':
            logText = `📄 File written: ${message.path} - ${message.message || ''}`;
            logType = 'info';
            logDetails = { path: message.path, message: message.message };
            break;
          case 'error':
            logText = `❌ Backend Error: ${message.content}`;
            logType = 'error';
            logDetails = message; // Store the whole error message object
            break;
          case 'execution_complete':
            logText = `\n🏁 Task execution complete. ${message.message || ''}`;
            if (message.finalLogSummary && Array.isArray(message.finalLogSummary)) {
                this.addLogEntry(logText, 'info'); // Log the main message first
                this.addLogEntry('\n--- Server Execution Summary ---', 'info');
                message.finalLogSummary.forEach(summaryEntry => this.addLogEntry(summaryEntry, 'info'));
            } else {
                 this.addLogEntry(logText, 'info');
            }
            if (message.message?.includes("Task cancelled") || message.message?.includes("terminated") || message.message?.includes("Plan declined") || message.message?.includes("Autonomous task execution finished.")) {
                if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
            }
            this.isAwaitingPlanApproval = false; this.proposedPlanId = null; this.proposedSteps = [];
            return; // Return as we've handled logging
          case 'proposed_plan':
            this.proposedPlanId = message.planId; this.proposedSteps = message.generated_steps; this.isAwaitingPlanApproval = true;
            logText = `📄 Proposed plan (ID: ${message.planId}) received. Review required.`;
            logType = 'plan';
            logDetails = message.generated_steps;
            this.addLogEntry(logText, logType, logDetails); // Log the main message
            this.addLogEntry(JSON.stringify(message.generated_steps, null, 2), 'debug'); // Log plan details as debug
            return; // Return as we've handled logging
          case 'step_failed_options':
            logText = `❌ Step Failed: ${message.errorDetails?.message || 'Unknown error'} (Type: ${message.failedStep?.type || 'N/A'})`;
            logType = 'error';
            logDetails = { error: message.errorDetails, step: message.failedStep };
            this.showFailureOptions = true; this.currentFailureId = message.failureId;
            this.currentErrorDetails = message.errorDetails; this.currentFailedStep = message.failedStep;
            break;
          case 'manual_mode_activated':
            logText = `ℹ️ ${message.message}`;
            logDetails = message.remainingSteps;
            this.addLogEntry(logText, 'info', logDetails);
            if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
            this.showFailureOptions = false; this.isAwaitingPlanApproval = false;
            return; // Return as we've handled logging
          case 'confirmation_required':
            logText = `⚠️ Confirmation required: ${message.message}`;
            logType = 'confirmation';
            logDetails = message.details;
            this.addLogEntry(logText, logType, logDetails); // Log the main confirmation message
            // Auto-deny:
            this.addLogEntry(`⚠️ Action required confirmation: '${message.message}'. Auto-denied.`, 'warning');
            this.sendConfirmationResponse(message.confirmationId, false);
            this.pendingConfirmationDetails = null;
            return; // Return as we've handled logging
          default:
            logText = `Unknown message type: ${message.type}. Data: ${event.data}`;
            logType = 'debug';
            logDetails = message;
            break;
        }
        if (logText) { // Ensure logText is not empty before pushing
            this.addLogEntry(logText, logType, logDetails);
        }

      } catch (e) {
        console.error('Failed to parse SSE message data:', event.data, e);
        this.addLogEntry(`Error parsing message from server: ${event.data}`, 'error', { rawData: event.data, parseError: e.toString() });
      }
    },
    async approveProposedPlan() {
      if (!this.proposedPlanId) return;
      this.addLogEntry(`\n➡️ Approving plan ID: ${this.proposedPlanId}...`, 'info');
      try {
        const response = await fetch(`http://127.0.0.1:3333/api/approve-plan/${this.proposedPlanId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const result = await response.json();
        if (response.ok) this.addLogEntry(`✅ Plan approved. Server: ${result.message}`, 'info');
        else this.addLogEntry(`❌ Error approving plan: ${response.status} ${result.message || ''}`, 'error', result);
      } catch (error) { this.addLogEntry(`💥 Network error approving plan: ${error.message}`, 'error', error); }
      this.isAwaitingPlanApproval = false;
    },
    async declineProposedPlan() {
      if (!this.proposedPlanId) return;
      this.addLogEntry(`\n➡️ Declining plan ID: ${this.proposedPlanId}...`, 'info');
      try {
        const response = await fetch(`http://127.0.0.1:3333/api/decline-plan/${this.proposedPlanId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const result = await response.json();
        if (response.ok) this.addLogEntry(`ℹ️ Plan declined. Server: ${result.message}`, 'info');
        else this.addLogEntry(`❌ Error declining plan: ${response.status} ${result.message || ''}`, 'error', result);
      } catch (error) { this.addLogEntry(`💥 Network error declining plan: ${error.message}`, 'error', error); }
      this.isAwaitingPlanApproval = false; this.proposedPlanId = null; this.proposedSteps = [];
    },
    triggerGitOperation(command) {
      if (!this.backendHealthy) {
        this.addLogEntry('Error: Backend is not healthy. Cannot perform Git operation.', 'error');
        return;
      }
      if (this.isAutonomousMode) {
        this.addLogEntry('Git operations via direct buttons are not available in Autonomous Mode.', 'error');
        return;
      }
      const descriptions = {
        revert_last_commit: 'Revert the last Git commit',
        commit: 'Commit changes',
        push: 'Push commits to remote',
        pull: 'Pull latest changes',
      };
      const taskDescription = descriptions[command] || `Run git ${command}`;
      const steps = [{ type: 'git_operation', details: { command } }];
      this.addLogEntry(`Triggering Git operation: ${command}`, 'info');
      if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
      const params = new URLSearchParams();
      params.append('task_description', taskDescription);
      params.append('steps', JSON.stringify(steps));
      params.append('safetyMode', this.safetyModeActive);
      params.append('isAutonomousMode', false);
      this.eventSource = new EventSource(`http://127.0.0.1:3333/execute-autonomous-task?${params.toString()}`);
      this.eventSource.onopen = () => this.addLogEntry(`Connecting to backend for Git operation: ${command}`, 'info');
      this.eventSource.onmessage = this.handleSseMessage;
      this.eventSource.onerror = (error) => {
        this.addLogEntry('Connection error during Git operation.', 'error', error);
        if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
      };
    },
    async sendConfirmationResponse(confirmationId, confirmed) {
      try {
        const response = await fetch(`http://127.0.0.1:3333/api/confirm-action/${confirmationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed }),
        });
        const result = await response.json();
        if (response.ok) this.addLogEntry(`Confirmation sent: ${confirmed}. ${result.message}`, 'info');
        else this.addLogEntry(`Error sending confirmation: ${response.status} ${result.message || ''}`, 'error', result);
      } catch (e) {
        this.addLogEntry(`Network error sending confirmation: ${e.message}`, 'error', e);
      }
    },
    async requestModelDownload() {
      const modelName = this.modelToDownload.trim();
      if (!modelName) {
        this.addLogEntry('Model name required to download.', 'error');
        return;
      }
      this.addLogEntry(`Requesting download for model: ${modelName}`, 'info');
      this.isDownloadingModel = true;
      try {
        const response = await fetch('http://127.0.0.1:3333/api/ollama/pull-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelName }),
        });
        if (!response.ok) {
          const text = await response.text();
          this.addLogEntry(`Download request failed: ${response.status} ${text}`, 'error');
          this.isDownloadingModel = false;
          return;
        }
        this.modelDownloadReader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const readChunk = async () => {
          const { done, value } = await this.modelDownloadReader.read();
          if (done) { this.isDownloadingModel = false; return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            const trimmed = line.replace(/^data:\s*/, '').trim();
            if (!trimmed) continue;
            try {
              const msg = JSON.parse(trimmed);
              this.handleModelDownloadMessage(msg, modelName);
            } catch (err) {
              console.error('Failed to parse model download message:', line, err);
            }
          }
          readChunk();
        };
        readChunk();
      } catch (err) {
        this.addLogEntry(`Download request error: ${err.message}`, 'error', err);
        this.isDownloadingModel = false;
      }
    },
    handleModelDownloadMessage(message, modelName) {
      if (message.type === 'model_pull_status') {
        const status = message.payload.status || JSON.stringify(message.payload);
        this.addLogEntry(`[${modelName}] ${status}`, 'info');
        if (message.payload.final) this.isDownloadingModel = false;
      } else if (message.type === 'model_pull_error') {
        this.addLogEntry(`Model download error for ${modelName}: ${message.message}`, 'error', message);
        this.isDownloadingModel = false;
      }
    },
    handleRevertCommit() {
      this.triggerGitOperation('revert_last_commit');
    },
    async handleRetryStep() {
      if (!this.currentFailureId) return;
      try {
        const response = await fetch(`http://127.0.0.1:3333/api/retry-step/${this.currentFailureId}`, { method: 'POST' });
        const result = await response.json();
        if (response.ok) this.addLogEntry(`Retrying step. ${result.message}`, 'info');
        else this.addLogEntry(`Retry request failed: ${response.status} ${result.message || ''}`, 'error', result);
        this.showFailureOptions = false;
      } catch (err) {
        this.addLogEntry(`Network error retrying step: ${err.message}`, 'error', err);
      }
    },
    async handleSkipStep() {
      if (!this.currentFailureId) return;
      try {
        const response = await fetch(`http://127.0.0.1:3333/api/skip-step/${this.currentFailureId}`, { method: 'POST' });
        const result = await response.json();
        if (response.ok) this.addLogEntry(`Skipped step. ${result.message}`, 'info');
        else this.addLogEntry(`Skip request failed: ${response.status} ${result.message || ''}`, 'error', result);
        this.showFailureOptions = false;
      } catch (err) {
        this.addLogEntry(`Network error skipping step: ${err.message}`, 'error', err);
      }
    },
    async handleConvertToManual() {
      if (!this.currentFailureId) return;
      try {
        const response = await fetch(`http://127.0.0.1:3333/api/convert-to-manual/${this.currentFailureId}`, { method: 'POST' });
        const result = await response.json();
        if (response.ok) this.addLogEntry(`Converted to manual mode. ${result.message}`, 'info');
        else this.addLogEntry(`Convert request failed: ${response.status} ${result.message || ''}`, 'error', result);
        this.showFailureOptions = false;
      } catch (err) {
        this.addLogEntry(`Network error converting to manual: ${err.message}`, 'error', err);
      }
    },
    async fetchOllamaModels() {
      try {
        const response = await fetch('http://127.0.0.1:3333/api/ollama-models/categorized');
        if (!response.ok) {
          const text = await response.text();
          this.addLogEntry(`Model fetch failed: ${response.status} ${text}`, 'error');
          return;
        }
        const data = await response.json();
        this.categorizedModels = data;
        if (!this.brainstormingSelectedModel) {
          const firstCat = Object.keys(data)[0];
          if (firstCat && data[firstCat].length > 0) {
            this.brainstormingSelectedModel = data[firstCat][0].id || data[firstCat][0].name;
          }
        }
        this.addLogEntry('Ollama models loaded.', 'info');
      } catch (err) {
        this.addLogEntry(`Error fetching models: ${err.message}`, 'error', err);
      }
    },
    handleSniperFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.sniperFileContent = e.target.result;
        this.addLogEntry(`Sniper file loaded: ${file.name}`, 'info');
      };
      reader.onerror = (e) => {
        this.addLogEntry(`Error reading file ${file.name}: ${e.target.error.message}`, 'error');
      };
      reader.readAsText(file);
      event.target.value = null;
    },
    handleGenerateCode() {
      if (!this.sniperFileContent) {
        this.addLogEntry('No Sniper file loaded.', 'error');
        return;
      }
      const parser = new RoadmapParser(this.sniperFileContent);
      const parsed = parser.parse();

      if (parsed && parsed.metadata && parsed.steps) {
        this.addLogEntry('✅ Sniper.md file parsed successfully.', 'info', { metadata: parsed.metadata, numberOfSteps: parsed.steps.length });
      } else if (parsed && parsed.error) {
        this.addLogEntry(`❌ Error parsing Sniper.md file: ${parsed.error}`, 'error', parsed);
        this.parsedSniperJSON = null; // Clear any partial data
        this.generatedScaffoldingSteps = []; // Clear steps
        return; // Stop further processing
      } else {
        this.addLogEntry('❌ Error parsing Sniper.md file: Unknown parsing error or invalid structure.', 'error', parsed);
        this.parsedSniperJSON = null;
        this.generatedScaffoldingSteps = [];
        return; // Stop further processing
      }

      this.parsedSniperJSON = parsed; // Store the successfully parsed JSON

      this.addLogEntry('ℹ️ Preparing scaffolding steps based on parsed Sniper file...', 'info');

      const moduleName = parsed.metadata?.ModuleName || 'module';
      const baseDir = this.targetBaseDir.replace(/\/$/, ''); // Ensure no trailing slash

      // Basic scaffolding steps - customize as needed based on parsed.steps
      this.generatedScaffoldingSteps = [
        { type: 'createDirectory', details: { dirPath: `${baseDir}/${moduleName}` } },
        { type: 'create_file_with_llm_content', details: { filePath: `${baseDir}/${moduleName}/README.md`, prompt: `Write a README for ${moduleName}. Summary: ${parsed.summary || 'No summary provided in Sniper file.'}` } },
        // Potentially iterate over parsed.steps to create more detailed scaffolding
        // For example:
        // ...parsed.steps.map(step => ({ type: 'placeholder_step', details: { description: step.description } }))
      ];

      if (this.generatedScaffoldingSteps && this.generatedScaffoldingSteps.length > 0) {
        this.addLogEntry(`✅ Generated ${this.generatedScaffoldingSteps.length} scaffolding steps. Click "Execute Autonomous Task" to run them.`, 'info', this.generatedScaffoldingSteps);
        console.log('Generated scaffolding steps:', JSON.stringify(this.generatedScaffoldingSteps, null, 2)); // For browser console debugging
      } else {
        this.addLogEntry('⚠️ No scaffolding steps were generated from the Sniper file. Check the file content and structure.', 'warning');
      }
    },
    handleBrainstormingFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.brainstormingFileContent = e.target.result;
        this.brainstormingFileName = file.name;
        this.addLogEntry(`Brainstorming context file loaded: ${file.name}`, 'info');
      };
      reader.onerror = (e) => {
        this.addLogEntry(`Error reading brainstorming file ${file.name}: ${e.target.error.message}`, 'error');
      };
      reader.readAsText(file);
      event.target.value = null;
    },
    clearBrainstormingFileContext() {
      this.brainstormingFileContent = null;
      this.brainstormingFileName = null;
      this.addLogEntry('Cleared brainstorming file context.', 'info');
    },
   sendBrainstormingMessage() {
      if (!this.brainstormingCurrentInput.trim()) return;
      const message = this.brainstormingCurrentInput.trim();
      this.brainstormingChatHistory.push({ role: 'user', content: message });
      this.brainstormingCurrentInput = '';
      if (window.electronAPI && window.electronAPI.sendBrainstormingChat) {
        window.electronAPI.sendBrainstormingChat({
          modelId: this.brainstormingSelectedModel,
          prompt: message,
          history: this.brainstormingChatHistory,
          fileContent: this.brainstormingFileContent || undefined,
        });
      } else {
        this.addLogEntry('Brainstorming IPC not available.', 'error');
      }
    },
    handleBrainstormingSseMessage(message) {
      if (message.role === 'assistant') {
        this.brainstormingChatHistory.push({ role: 'assistant', content: message.content });
      }
    },
    async copyLogToClipboard() {
      if (!this.logEntries.length) return;
      const logText = this.logEntries.map(entry => `[${new Date(entry.timestamp).toLocaleTimeString()}] [${entry.type.toUpperCase()}] ${entry.text}${entry.details ? '\nDetails: ' + JSON.stringify(entry.details, null, 2) : ''}`).join('\n');
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(logText);
        else { /* fallback */ const ta = document.createElement('textarea'); ta.value = logText; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
        this.setLogStatusMessage('📋 Log copied!');
      } catch (err) { this.setLogStatusMessage('❌ Copy failed.'); this.addLogEntry('Failed to copy log.', 'error', err); }
    },
    exportLogToFile() {
      if (!this.logEntries.length) return;
      const logText = this.logEntries.map(entry => `[${new Date(entry.timestamp).toISOString()}] [${entry.type.toUpperCase()}] ${entry.text}${entry.details ? '\nDetails: ' + JSON.stringify(entry.details, null, 2) : ''}`).join('\n\n');
      try {
        const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `roadrunner-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        this.setLogStatusMessage('💾 Log export initiated.');
      } catch (err) { this.setLogStatusMessage('❌ Export failed.'); this.addLogEntry('Failed to export log.', 'error', err); }
    },
    setLogStatusMessage(message) { this.logStatusMessage = message; setTimeout(() => { this.logStatusMessage = ''; }, 3000); },
  },
};
</script>

