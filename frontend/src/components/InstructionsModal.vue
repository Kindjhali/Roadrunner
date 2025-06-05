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
        <table class="w-full text-sm text-left text-gray-400 dark:text-gray-400" style="table-layout: fixed;">
          <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" class="px-6 py-3" style="width: 70%;">Instruction</th>
              <th scope="col" class="px-6 py-3" style="width: 30%;">Actions</th>
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
      console.warn("Backend port not found in store, using default 3030 for API calls.");
      return 'http://127.0.0.1:3030';
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

<style scoped>
.instructions-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* Ensure it's on top */
}

.instructions-modal-content {
  background-color: #2d3748; /* bg-gray-800 */
  color: #e2e8f0; /* text-gray-200 */
  padding: 20px;
  border-radius: 8px;
  min-width: 600px; /* Changed */
  max-width: 80%;   /* Changed */
  max-height: 75vh;  /* Changed */
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.modal-title {
  font-size: 1.25rem; /* text-xl */
  font-weight: 600; /* font-semibold */
  margin-bottom: 1rem;
  color: #a0aec0; /* text-gray-400 */
}
.role-specifier {
  font-size: 0.9rem;
  font-style: italic;
  color: #718096; /* text-gray-500 */
}

.loading-indicator {
  text-align: center;
  padding: 20px;
  color: #cbd5e0; /* text-gray-300 */
}

.error-message {
  color: #fc8181; /* text-red-400 */
  background-color: #4a5568; /* bg-gray-700 */
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.instructions-editor {
  flex-grow: 1;
  overflow-y: auto; /* Allows instruction list to scroll */
  margin-bottom: 1rem;
}

.instructions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.instruction-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.instruction-input {
  flex-grow: 1;
  padding: 0.5rem;
  background-color: #1a202c; /* bg-gray-900 */
  border: 1px solid #4a5568; /* border-gray-600 */
  color: #e2e8f0; /* text-gray-200 */
  border-radius: 4px;
}
.instruction-input:focus {
  outline: none;
  border-color: #4299e1; /* focus:border-blue-500 */
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.5); /* focus:ring-blue-500 */
}


.button-remove-instruction {
  background-color: #e53e3e; /* bg-red-600 */
  color: white;
  border: none;
  padding: 0.3rem 0.6rem;
  margin-left: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
.button-remove-instruction:hover {
  background-color: #c53030; /* hover:bg-red-700 */
}

.add-instruction-area {
  display: flex;
  margin-top: 1rem;
  margin-bottom: 0.5rem; /* Space before overall actions */
}

.instruction-input-new {
  flex-grow: 1;
  padding: 0.5rem;
  background-color: #1a202c; /* bg-gray-900 */
  border: 1px solid #4a5568; /* border-gray-600 */
  color: #e2e8f0; /* text-gray-200 */
  border-radius: 4px;
}
.instruction-input-new:focus {
   outline: none;
  border-color: #4299e1; /* focus:border-blue-500 */
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.5); /* focus:ring-blue-500 */
}

.button-add-instruction {
  background-color: #38a169; /* bg-green-600 */
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  margin-left: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
}
.button-add-instruction:hover {
  background-color: #2f855a; /* hover:bg-green-700 */
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid #4a5568; /* border-gray-700 */
}

.button-save {
  background-color: #3182ce; /* bg-blue-600 */
  color: white;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
}
.button-save:hover {
  background-color: #2b6cb0; /* hover:bg-blue-700 */
}
.button-save:disabled {
  background-color: #4a5568; /* bg-gray-600 */
  cursor: not-allowed;
}

.button-cancel {
  background-color: #718096; /* bg-gray-500 */
  color: white;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.button-cancel:hover {
  background-color: #4a5568; /* hover:bg-gray-600 */
}

/* Styling for the new textarea */
.instruction-textarea {
  width: 100%;
  min-height: 60px;
  resize: vertical;
  padding: 0.5rem;
  background-color: #1a202c; /* bg-gray-900 */
  border: 1px solid #4a5568; /* border-gray-600 */
  color: #e2e8f0; /* text-gray-200 */
  border-radius: 4px;
  box-sizing: border-box;
}
.instruction-textarea:focus {
  outline: none;
  border-color: #4299e1; /* focus:border-blue-500 */
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.5); /* focus:ring-blue-500 */
}

/* Minimal table styling if not using Tailwind utility classes directly in template */
.w-full { width: 100%; }
.text-sm { font-size: 0.875rem; }
.text-left { text-align: left; }
/* text-gray-400 is already defined in the template on table */
/* dark:text-gray-400 is already defined in the template on table */

.px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
.py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
.py-4 { padding-top: 1rem; padding-bottom: 1rem; } /* Added for td cells */
.px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }


/* text-xs, uppercase, bg-gray-50, dark:bg-gray-700, dark:text-gray-400 are on thead */

.bg-white { background-color: #fff; } /* Used for table rows */
.dark .bg-gray-800 { background-color: #1f2937; } /* Used for table rows in dark */
.border-b { border-bottom-width: 1px; } /* Used for table rows */
.dark .border-gray-700 { border-color: #374151; } /* Used for table rows in dark */

.cursor-pointer { cursor: pointer; }
.hover\:bg-gray-600:hover { background-color: #4b5563; } /* Slightly different from previous for variety */
.dark .hover\:bg-gray-700:hover { background-color: #374151; }
.p-1 { padding: 0.25rem; }
.rounded { border-radius: 0.25rem; }
.min-h-\[30px\] { min-height: 30px; } /* Ensure clickable area for short instructions */
.whitespace-nowrap { white-space: nowrap; } /* For action buttons cell */
.disabled\:opacity-50:disabled { opacity: 0.5; }


.text-blue-500 { color: #3b82f6; }
.hover\:text-blue-700:hover { color: #1d4ed8; }
.text-red-500 { color: #ef4444; }
.hover\:text-red-700:hover { color: #b91c1c; }
.text-xs { font-size: 0.75rem; }
.mr-2 { margin-right: 0.5rem; }
.ml-1 { margin-left: 0.25rem; }


.button-save-edit, .button-cancel-edit {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  color: white;
  font-size: 0.75rem; /* text-xs */
}
.button-save-edit {
  background-color: #2563eb; /* blue-600 */
}
.button-save-edit:hover {
  background-color: #1d4ed8; /* blue-700 */
}
.button-cancel-edit {
  background-color: #6b7280; /* gray-500 */
}
.button-cancel-edit:hover {
  background-color: #4b5563; /* gray-600 */
}

.mt-1 { margin-top: 0.25rem; } /* For spacing edit buttons from textarea */
.text-center { text-align: center; }
.text-gray-500 { color: #6b7280; }


.mt-4 { margin-top: 1rem; }
.ml-2 { margin-left: 0.5rem; }

</style>
