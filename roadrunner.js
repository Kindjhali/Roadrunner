const fs = require('fs');
const path = require('path');

// In-memory store for agent responses
// Each inputID maps to an object: { actualInputText: null, responses: [] }
let agentResponses = {};

const LOG_DIR = path.join(__dirname, 'logs', 'roadrunner');

/**
 * Initiates a new input session or overwrites an existing one.
 * @param {string} inputID - The unique ID for this input.
 * @param {string} actualInputText - The actual text of the input/query.
 */
function initiateInput(inputID, actualInputText) {
  agentResponses[inputID] = {
    actualInputText: actualInputText,
    responses: []
  };
}

/**
 * Registers a response from an agent.
 * @param {string} inputID - The ID of the input this response is for.
 * @param {string} agentID - The unique ID of the agent.
 * @param {string} proposal - The action proposed by the agent.
 * @param {number} confidence - The agent's confidence in the proposal (0.0-1.0).
 * @param {string[]} [flags] - Optional list of string markers.
 */
function registerAgentResponse(inputID, agentID, proposal, confidence, flags) {
  if (!agentResponses[inputID]) {
    console.warn(`Warning: Response registered for uninitiated inputID: ${inputID}`);
    agentResponses[inputID] = {
      actualInputText: `Input ${inputID} received response(s) without formal initiation.`,
      responses: []
    };
  }
  agentResponses[inputID].responses.push({ agentID, proposal, confidence, flags });
}

/**
 * Evaluates agent responses for a given input ID and selects the best one.
 * It also logs the evaluation details to a timestamped JSON file.
 * @param {string} inputID - The ID of the input to evaluate responses for.
 * @returns {{inputID: string, responses: Array<object>, selectedProposal: object|null, justification: string, error?: string, actualInputText?: string}}
 *          An object containing the evaluation results, including the selected proposal, justification, and actual input text,
 *          or an error message if no responses are found.
 */
function evaluateResponses(inputID) {
  const inputEntry = agentResponses[inputID];
  const currentActualInputText = inputEntry?.actualInputText || `Input text not available for ${inputID}`;
  const currentResponses = inputEntry?.responses;

  const result = (() => {
    if (!inputEntry || !currentResponses || currentResponses.length === 0) {
      return {
        inputID,
        responses: [],
        selectedProposal: null,
        justification: 'No responses available.',
        error: 'No responses found for this input ID',
        actualInputText: currentActualInputText,
      };
    }

    let selectedProposal = currentResponses[0];
    for (let i = 1; i < currentResponses.length; i++) {
      if (currentResponses[i].confidence > selectedProposal.confidence) {
        selectedProposal = currentResponses[i];
      }
    }

    return {
      inputID,
      responses: currentResponses,
      selectedProposal,
      justification: 'Highest confidence score.',
      actualInputText: currentActualInputText,
    };
  })();

  // Logging
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
    const logFileName = `${dateStr}_${timeStr}.json`;
    const logFilePath = path.join(LOG_DIR, logFileName);

    const logData = {
      input: result.actualInputText, // Use actualInputText for the log
      responses: result.responses,
      selected: result.selectedProposal,
      justification: result.justification,
    };

    if (result.error) {
      logData.error = result.error;
    }

    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
  } catch (error) {
    console.error('Failed to write log file:', error);
  }

  return result;
}

module.exports = { registerAgentResponse, evaluateResponses, initiateInput };
