<template>
  <div class="conference-tab">
    <h2>Model Conference</h2>
    <div class="prompt-section">
      <label for="conference-prompt">Enter your prompt:</label>
      <textarea id="conference-prompt" v-model="prompt" rows="5" placeholder="e.g., What is the best strategy to reduce technical debt?"></textarea>
      <button @click="startConference" :disabled="isLoading">
        {{ isLoading ? 'Processing...' : 'Start Conference' }}
      </button>
    </div>
    <div v-if="isLoading" class="loading-section">
      <p><i>Waiting for conference results...</i></p>
    </div>
    <div v-if="result" class="result-section">
      <h3>Conference Result:</h3>
      <pre>{{ formattedResult }}</pre>
    </div>
    <div v-if="error" class="error-section">
      <p>Error: {{ error }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConferenceTab',
  data() {
    return {
      prompt: '',
      result: null,
      error: null,
      isLoading: false, // Added for loading state
    };
  },
  computed: {
    formattedResult() {
      if (typeof this.result === 'string') {
        return this.result;
      }
      if (typeof this.result === 'object' && this.result !== null) {
        if (this.result.arbiter_response) return this.result.arbiter_response;
        if (this.result.response) return this.result.response;
        if (this.result.data) return JSON.stringify(this.result.data, null, 2);
        return JSON.stringify(this.result, null, 2);
      }
      return '';
    }
  },
  methods: {
    async startConference() {
      this.result = null;
      this.error = null;
      this.isLoading = true;

      if (!this.prompt.trim()) {
        this.error = 'Prompt cannot be empty.';
        this.isLoading = false;
        return;
      }

      try {
        const response = await fetch('http://localhost:3030/execute-conference-task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: this.prompt }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            this.result = await response.json();
        } else {
            this.result = await response.text();
        }

      } catch (e) {
        this.error = e.message;
        console.error('Error during conference:', e);
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>
