<template>
  <div class="brainstorming-tab-content p-4 space-y-4 text-white">
    <h2 class="text-xl font-semibold">Brainstorming Session</h2>

    <div class="form-group">
      <label for="brainstorming-topic" class="emberiza-label block mb-2">Enter your brainstorming topic or prompt:</label>
      <textarea
        id="brainstorming-topic"
        v-model="brainstormingTopic"
        class="hirundo-text-input w-full h-24 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="e.g., How can we improve remote team collaboration?"
      ></textarea>
    </div>

    <button
      @click="startBrainstormingSession"
      :disabled="isLoading"
      class="cardinalis-button-action px-4 py-2 rounded-md"
      :class="{ 'opacity-50 cursor-not-allowed': isLoading }"
    >
      <span v-if="isLoading">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Brainstorming...
      </span>
      <span v-else>Start Brainstorming</span>
    </button>

    <div v-if="statusMessage" class="mt-4 p-3 rounded-md text-sm"
         :class="{
           'bg-red-800 text-red-200': statusMessage.toLowerCase().includes('error'),
           'bg-blue-800 text-blue-200': !statusMessage.toLowerCase().includes('error') && !statusMessage.toLowerCase().includes('complete'),
           'bg-green-800 text-green-200': statusMessage.toLowerCase().includes('complete')
         }">
      {{ statusMessage }}
    </div>

    <div v-if="sseRawLog" class="mt-6 brainstorming-log">
      <h4 class="text-md font-semibold mb-1">Activity Log:</h4>
      <pre>{{ sseRawLog }}</pre>
    </div>

    <div v-if="finalOutput" class="mt-6 final-output">
      <h4 class="text-md font-semibold mb-1">Final Result:</h4>
      <pre>{{ finalOutput }}</pre>
    </div>

  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

const brainstormingTopic = ref('');
const sseRawLog = ref('');
const finalOutput = ref('');
const isLoading = ref(false);
const statusMessage = ref('');
let eventSourceInstance = null;

const startBrainstormingSession = async () => {
  if (!brainstormingTopic.value.trim()) {
    statusMessage.value = 'Please enter a topic to brainstorm.';
    return;
  }

  isLoading.value = true;
  sseRawLog.value = '';
  finalOutput.value = '';
  statusMessage.value = 'Initiating brainstorming session...';
  console.log("[BrainstormingTab] Starting session with topic:", brainstormingTopic.value);

  if (eventSourceInstance) {
    eventSourceInstance.close();
    console.log("[BrainstormingTab] Closed existing EventSource instance.");
  }

  const userTopic = brainstormingTopic.value;
  const taskDescription = `Use the multi_model_debate tool to brainstorm ideas on the following topic: "${userTopic}". Use roles like 'Idea_Generator', 'Critical_Evaluator', and 'Synthesizer' for the debate.`;

  const backendPort = store.state.backendPort || 3030;
  console.log(`[BrainstormingTab] Using backend port: ${backendPort}`);

  const eventSourceUrl = `http://127.0.0.1:${backendPort}/execute-autonomous-task?task_description=${encodeURIComponent(taskDescription)}&safetyMode=false`;
  console.log(`[BrainstormingTab] EventSource URL: ${eventSourceUrl}`);

  eventSourceInstance = new EventSource(eventSourceUrl);

  eventSourceInstance.onopen = () => {
    const openMsg = "Connection opened. Waiting for brainstorming data...";
    statusMessage.value = openMsg;
    sseRawLog.value += `[SYSTEM] ${openMsg}\n`;
    console.log("[BrainstormingTab] SSE connection opened.");
  };

  eventSourceInstance.onmessage = (event) => {
    console.log("[BrainstormingTab] SSE message received:", event.data);
    sseRawLog.value += event.data + '\n';

    try {
      const parsedData = JSON.parse(event.data);

      if (parsedData.type === 'execution_complete') {
        finalOutput.value = parsedData.final_output || 'Brainstorming session finished, but no specific final output was provided in the event.';
        statusMessage.value = 'Brainstorming complete.';
        isLoading.value = false;
        if (eventSourceInstance) eventSourceInstance.close();
      } else if (parsedData.type === 'error') {
        statusMessage.value = `Error: ${parsedData.content || parsedData.details || 'Unknown error from backend.'}`;
        isLoading.value = false;
        if (eventSourceInstance) eventSourceInstance.close();
      } else if (parsedData.type === 'log_entry') {
        statusMessage.value = `Progress: ${parsedData.message}`;
      }
      // Further detailed handling of other event types like 'agent_event', 'llm_chunk' can be added here
      // For now, they are just added to sseRawLog
    } catch (error) {
      console.error('[BrainstormingTab] Error parsing SSE event JSON:', error, "Raw data:", event.data);
      // sseRawLog already contains the problematic data, so user can see it.
      // statusMessage.value = "Received non-JSON data from backend."; // Optional: inform user
    }
  };

  eventSourceInstance.onerror = (event) => {
    const errorMsg = 'Error connecting to backend for brainstorming. Ensure backend is running and check console.';
    statusMessage.value = errorMsg;
    sseRawLog.value += `[SYSTEM ERROR] ${errorMsg}\nFull event: ${JSON.stringify(event)}\n`;
    isLoading.value = false;
    console.error("[BrainstormingTab] SSE error:", event);
    if (eventSourceInstance) {
      eventSourceInstance.close();
    }
  };
};

onUnmounted(() => {
  if (eventSourceInstance) {
    eventSourceInstance.close();
    console.log('[BrainstormingTab] EventSource closed on unmount.');
  }
});

</script>

<style scoped>
.brainstorming-tab-content {
  /* Basic layout */
}
.brainstorming-log, .final-output {
  background-color: #2d3748; /* bg-gray-800 */
  color: #e2e8f0; /* text-gray-300 */
  border: 1px solid #4a5568; /* border-gray-600 */
  padding: 10px;
  margin-top: 10px;
  border-radius: 0.25rem; /* rounded-md */
  white-space: pre-wrap;
  word-break: break-all;
}
.brainstorming-log {
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.875rem; /* text-sm */
}
.final-output {
   background-color: #1a3622; /* ~bg-green-900 for contrast */
   color: #a7f3d0; /* ~text-green-200 */
   border-color: #2f855a; /* ~border-green-600 */
}
</style>
