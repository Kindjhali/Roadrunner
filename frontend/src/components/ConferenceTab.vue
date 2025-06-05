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
      <p><i>Waiting for conference results... Please wait.</i></p>
    </div>

    <div v-if="result && !error" class="result-section">
      <h3>Conference Result (Arbiter's View):</h3>
      <pre>{{ formattedResult }}</pre>
      <div v-if="result.model_a_response">
        <h4>Model A's Response:</h4>
        <pre>{{ result.model_a_response }}</pre>
      </div>
      <div v-if="result.model_b_response">
        <h4>Model B's Response:</h4>
        <pre>{{ result.model_b_response }}</pre>
      </div>
    </div>

    <div v-if="error" class="error-section">
      <h3>Error:</h3>
      <pre>{{ error }}</pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConferenceTab',
  data() {
    return {
      prompt: '',
      result: null, // Will store the full { final_response, model_a_response, model_b_response }
      error: null,
      isLoading: false,
    };
  },
  computed: {
    formattedResult() {
      if (this.result && typeof this.result === 'object' && this.result.final_response) {
        return this.result.final_response;
      }
      // Fallback if result is a direct string (e.g. from an older version or different error)
      if (typeof this.result === 'string') {
        return this.result;
      }
      return 'No final response from arbiter to display.';
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
        // Assuming backend runs on port 3030 as per typical setup.
        // For a more robust solution, this port could come from a Vuex store or config.
        const backendPort = this.$store?.getters?.getBackendPort || 3030;
        const response = await fetch(`http://localhost:${backendPort}/execute-conference-task`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: this.prompt }),
        });

        const responseBody = await response.text(); // Get raw response body for better error diagnosis

        if (!response.ok) {
          let errorDetails = `HTTP error! status: ${response.status}`;
          try {
            const jsonError = JSON.parse(responseBody);
            errorDetails += `, message: ${jsonError.details || jsonError.error || responseBody}`;
          } catch (e) {
            errorDetails += `, message: ${responseBody}`;
          }
          throw new Error(errorDetails);
        }

        // Attempt to parse as JSON, as successful responses should be JSON
        try {
            const jsonData = JSON.parse(responseBody);
            this.result = jsonData; // Store the full object: { final_response, model_a_response, model_b_response, ... }
        } catch (e) {
            // If JSON parsing fails, it might be an unexpected (but ok) string response, or an error
            console.error('Failed to parse response as JSON:', e);
            this.result = responseBody; // Store raw text as a fallback result
            // If it was an error, it should have been caught by !response.ok, but this handles non-JSON success cases
        }

      } catch (e) {
        this.error = e.message || 'An unknown error occurred during the conference.';
        console.error('Error during conference:', e);
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<style scoped>
.conference-tab {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin: 10px;
}

.prompt-section textarea {
  width: 100%;
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.prompt-section button {
  padding: 10px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.prompt-section button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.loading-section, .result-section, .error-section {
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.error-section {
  color: red;
  background-color: #ffe0e0;
  border-color: #ffc0c0;
}

pre {
  white-space: pre-wrap; /* Allows text to wrap */
  word-wrap: break-word; /* Breaks long words */
  background-color: #fff;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

h3, h4 {
  margin-top: 0;
}
</style>
