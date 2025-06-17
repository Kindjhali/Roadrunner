<template>
  <div v-if="showModal" class="instructions-modal-overlay">
    <div class="instructions-modal-content">
      <h3 class="modal-title">
        Manage Instructions for: {{ agentType }}
        <span v-if="agentType === 'conference_agent' && agentRole" class="role-specifier"> (Role: {{ agentRole }})</span>
      </h3>

      <div v-if="isLoading" class="loading-indicator">Loading instructions...</div>
      <div v-if="error" class="error-message">{{ error }}</div>

      <div v-if="!isLoading && !error" class="instructions-editor">
        <!-- Table Layout -->
        <table class="w-full text-sm text-left text-gray-400 dark:text-gray-400 instructions-table">
          <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" class="px-6 py-3 instruction-column">Instruction</th>
              <th scope="col" class="px-6 py-3 actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(instruction, index) in instructions" :key="index" class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
              <td class="px-6 py-4">
                <div v-if="editingIndex === index">
                  <textarea v-model="editableInstructionText" class="instruction-textarea"></textarea>
                  <div class="mt-1">
                    <button @click="saveEdit()" class="button-save-edit text-xs">Save Edit</button>
                    <button @click="cancelEdit()" class="button-cancel-edit text-xs ml-1">Cancel</button>
                  </div>
                </div>
                <div v-else @click="startEditing(index)" class="cursor-pointer hover:bg-gray-600 dark:hover:bg-gray-700 p-1 rounded min-h-[30px]">
                  {{ instruction }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap"> <!-- Added whitespace-nowrap -->
                <button @click="startEditing(index)" :disabled="editingIndex === index" class="text-blue-500 hover:text-blue-700 text-xs mr-2 disabled:opacity-50">[Edit]</button>
                <button @click="removeInstruction(index)" class="text-red-500 hover:text-red-700 text-xs">[Remove]</button>
              </td>
            </tr>
            <tr v-if="instructions.length === 0">
              <td colspan="2" class="px-6 py-4 text-center text-gray-500">No instructions yet. Add one below.</td>
            </tr>
          </tbody>
        </table>
        <!-- End Table Layout -->

        <div class="add-instruction-area mt-4"> <!-- Added mt-4 for spacing -->
          <textarea v-model="newInstruction" @keyup.enter.prevent="addInstruction" class="instruction-textarea" placeholder="Add new instruction..."></textarea>
          <button @click="addInstruction" class="button-add-instruction ml-2">[+] Add</button>
        </div>
      </div>

      <div class="modal-actions">
        <button @click="saveInstructions" :disabled="isLoading" class="button-save">
          {{ isLoading ? 'Saving...' : 'Save & Close' }}
        </button>
        <button @click="close" class="button-cancel">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InstructionsModal',
  props: {
    agentType: {
      type: String,
      required: true,
    },
    agentRole: {
      type: String,
      default: null,
    },
    showModal: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['update:showModal'],
  data() {
    return {
      instructions: [],
      isLoading: false,
      error: '',
      newInstruction: '',
      backendPort: 0, // Will be fetched from store or context
      editingIndex: null,
      editableInstructionText: '',
    };
  },
  watch: {
    showModal(newVal) {
      if (newVal) {
        this.fetchInstructions();
      } else {
        // Reset state when modal is hidden
        this.instructions = [];
        this.error = '';
        this.newInstruction = '';
        this.isLoading = false;
      }
    },
    agentType() {
      if (this.showModal) {
        this.fetchInstructions();
      }
    },
    agentRole() {
      if (this.showModal && this.agentType === 'conference_agent') {
        this.fetchInstructions();
      }
    },
  },
  methods: {
    getApiBaseUrl() {
      // In a real app, this might come from Vuex store or environment config
      // For now, try to access the store similar to App.vue or default.
      if (this.$store && this.$store.state.backendPort) {
        return `http://127.0.0.1:${this.$store.state.backendPort}`;
      }
      // Fallback if store is not available or port is not set
      // This port should match your backend server's port
      console.warn("Backend port not found in store, using default 3333 for API calls.");
      return 'http://127.0.0.1:3333';
    },
    async fetchInstructions() {
      if (!this.agentType) return;
      this.isLoading = true;
      this.error = '';
      this.instructions = []; // Clear previous instructions

      let url = `${this.getApiBaseUrl()}/api/instructions/`;
      if (this.agentType === 'conference_agent' && this.agentRole) {
        url += `conference_agent/${this.agentRole}`;
      } else {
        url += this.agentType;
      }

      console.log(`[InstructionsModal] Fetching instructions from: ${url}`);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        const data = await response.json();
        // Ensure data is always an array, even if API returns single object for conference_agent (which it shouldn't based on spec)
        if (this.agentType === 'conference_agent' && !this.agentRole && typeof data === 'object' && data !== null && !Array.isArray(data)) {
            // If fetching the whole conference_agent object, we can't directly edit it here.
            // This modal is designed to edit a list of instructions for a *specific* type/role.
            // For now, we'll show an error or a message.
            // A better approach might be to disable editing or show roles if no specific role is selected.
            console.warn('[InstructionsModal] Fetched entire conference_agent object. This modal edits specific roles. Displaying raw or error.');
            this.error = `Cannot directly edit all conference roles. Select a specific role or display as read-only. Data: ${JSON.stringify(data).substring(0,100)}...`;
            this.instructions = []; // Or try to find a default role like 'arbiter' if applicable.
        } else {
             this.instructions = Array.isArray(data) ? data : [];
        }

      } catch (err) {
        console.error('[InstructionsModal] Error fetching instructions:', err);
        this.error = `Failed to load instructions: ${err.message}`;
      } finally {
        this.isLoading = false;
      }
    },
    async saveInstructions() {
      console.log('[InstructionsModal] Attempting to save instructions for:', this.agentType, this.agentRole ? 'Role: ' + this.agentRole : '');
      if (!this.agentType) {
        this.error = "Agent type is not specified. Cannot save."; // Added error for user visibility
        return;
      }
      this.isLoading = true;
      this.error = '';
      let errorData = null;

      let url = `${this.getApiBaseUrl()}/api/instructions/`;
      if (this.agentType === 'conference_agent' && this.agentRole) {
        url += `conference_agent/${this.agentRole}`;
      } else if (this.agentType === 'conference_agent' && !this.agentRole) {
        this.error = "Cannot save instructions for 'conference_agent' without specifying a role.";
        this.isLoading = false;
        console.error('[InstructionsModal] Attempted to save conference_agent without a role.');
        return;
      }
      else {
        url += this.agentType;
      }

      const payload = { instructions: this.instructions };
      console.log('[InstructionsModal] Payload:', JSON.stringify(payload));
      console.log(`[InstructionsModal] Saving instructions to: ${url}`);


      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          try {
            errorData = await response.json();
          } catch (parseErr) {
            errorData = `Status: ${response.status}, StatusText: ${response.statusText}, Body: ${await response.text().catch(() => 'Could not read body')}`;
          }
          throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        const data = await response.json();
        console.log('[InstructionsModal] Save successful. Response:', data);
        this.close(); // Close modal on successful save
      } catch (err) {
        console.error('[InstructionsModal] Save failed. Error:', err, 'Response body:', errorData);
        this.error = `Failed to save instructions: ${err.message}.`;
        if (typeof errorData === 'string') {
             this.error += ` Details: ${errorData}`;
        } else if (errorData && errorData.message && err.message !== errorData.message) {
            this.error += ` Server: ${errorData.message}`;
        } else if (errorData) {
            this.error += ` Details: ${JSON.stringify(errorData)}`;
        }
      } finally {
        this.isLoading = false;
      }
    },
    addInstruction() {
      console.log('[InstructionsModal] addInstruction called. New instruction:', this.newInstruction, 'Current instructions:', JSON.stringify(this.instructions));
      if (this.newInstruction.trim() !== '') {
        this.instructions.push(this.newInstruction.trim());
        this.newInstruction = ''; // Clear the textarea
      }
    },
    removeInstruction(index) {
      console.log('[InstructionsModal] removeInstruction called for index:', index, 'Current instructions:', JSON.stringify(this.instructions));
      this.instructions.splice(index, 1);
      // If the removed instruction was being edited, cancel edit mode
      if (this.editingIndex === index) {
        this.cancelEdit();
      } else if (this.editingIndex !== null && index < this.editingIndex) {
        // If an item before the currently edited item is removed, adjust editingIndex
        this.editingIndex--;
      }
    },
    startEditing(index) {
      this.editingIndex = index;
      this.editableInstructionText = this.instructions[index];
    },
    saveEdit() {
      if (this.editingIndex !== null && this.editableInstructionText.trim() !== '') {
        this.instructions.splice(this.editingIndex, 1, this.editableInstructionText.trim());
      }
      this.cancelEdit(); // Reset editing state
    },
    cancelEdit() {
      this.editingIndex = null;
      this.editableInstructionText = '';
    },
    close() {
      console.log('[InstructionsModal] Close method called. Emitting update:showModal false.');
      this.$emit('update:showModal', false);
    },
  },
  mounted() {
    // If the modal is shown by default (e.g. prop initially true), fetch instructions.
    // Watcher will also handle this if showModal changes after mount.
    if (this.showModal) {
      this.fetchInstructions();
    }
  }
};
</script>

