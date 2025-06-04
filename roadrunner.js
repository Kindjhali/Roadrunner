const fs = require('fs');
const path = require('path');



const DEFAULT_TIMEOUT_MS = 5000;
const agentResponses = {};
const activeTimers = {}; // To store active timer IDs or flags

const logDirectory = path.join(process.cwd(), 'logs', 'roadrunner');

/**
 * @file Roadrunner_Internal_Arbitration_Engine
 * @description Standalone module for collecting, ranking, and selecting actions from multiple sources.
 */

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

  const response = {
    agent: agentID,
    proposal: proposal,
    confidence: confidence,
  };

  if (flags) {
    response.flags = flags;
  }

  if (agentResponses[inputID]) {
    agentResponses[inputID].push(response);
  } else {
    agentResponses[inputID] = [response];
  }
  // console.log(`Response registered for ${inputID} from ${agentID}`);
}

// Renamed from evaluateResponses
function performEvaluation(inputID) {
  const responsesForInput = agentResponses[inputID] || [];
  // console.log(`Performing evaluation for ${inputID} with ${responsesForInput.length} responses.`);

  if (responsesForInput.length === 0) {
    return {
      evaluationResult: {
        selected: null,
        agent: null,
        confidence: null,
        justification: "No responses received for this input."
      },
      allResponsesForInput: []
    };
  }

  let highestConfidenceResponse = responsesForInput[0];
  for (let i = 1; i < responsesForInput.length; i++) {
    if (responsesForInput[i].confidence > highestConfidenceResponse.confidence) {
      highestConfidenceResponse = responsesForInput[i];
    }
  }

  return {
    evaluationResult: {
      selected: highestConfidenceResponse.proposal,
      agent: highestConfidenceResponse.agent,
      confidence: highestConfidenceResponse.confidence,
      justification: "Highest confidence score."
    },
    allResponsesForInput: responsesForInput
  };
}

function ensureLogDirectoryExists(directory) {
  try {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  } catch (error) {
    console.error(`Error creating log directory ${directory}:`, error);
  }
}

function generateBaseTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
}

function logEvaluationToJSON(inputID, allResponsesForInput, evaluationResult, baseTimestamp) { // Renamed for clarity
  ensureLogDirectoryExists(logDirectory);
  const logFilePath = path.join(logDirectory, `${baseTimestamp}.json`);

  const logData = {
    input: inputID,
    responses: allResponsesForInput,
    selected_agent_proposal: null,
    selected_proposal_details: evaluationResult.selected,
    justification: evaluationResult.justification
  };

  if (evaluationResult.selected !== null) {
    logData.selected_agent_proposal = {
      agent: evaluationResult.agent,
      proposal: evaluationResult.selected,
      confidence: evaluationResult.confidence
    };
  }

  try {
    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
  } catch (error) {
    console.error(`Error writing JSON log file ${logFilePath}:`, error);
  }
}

function logToMarkdown(inputID, allResponsesForInput, evaluationResult, baseTimestamp) {
  ensureLogDirectoryExists(logDirectory);
  const mdFilePath = path.join(logDirectory, `${baseTimestamp}.md`);

  let mdContent = `# Roadrunner Decision Log\n\n`;
  mdContent += `**Input:** \`${inputID}\`\n\n`;
  mdContent += `---\n\n`;
  mdContent += `## Agent Responses:\n\n`;

  if (allResponsesForInput && allResponsesForInput.length > 0) {
    allResponsesForInput.forEach(response => {
      mdContent += `### Agent: ${response.agent}\n`;
      mdContent += `- **Proposal:** ${response.proposal}\n`;
      mdContent += `- **Confidence:** ${response.confidence}\n`;
      mdContent += `- **Flags:** ${response.flags ? response.flags.join(', ') : 'None'}\n\n`;
    });
  } else {
    mdContent += `No responses received for this input.\n\n`;
  }

  mdContent += `---\n\n`;
  if (evaluationResult.selected) {
    mdContent += `**Selected Proposal:** ${evaluationResult.selected}\n`;
    mdContent += `**Selected Agent:** ${evaluationResult.agent}\n`;
    mdContent += `**Confidence:** ${evaluationResult.confidence}\n`;
  } else {
    mdContent += `**Selected Proposal:** None\n`;
  }
  mdContent += `**Justification:** ${evaluationResult.justification}\n`;

  try {
    fs.writeFileSync(mdFilePath, mdContent);
  } catch (error) {
    console.error(`Error writing Markdown log file ${mdFilePath}:`, error);
  }
}

function processInputAndLog(inputID, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (activeTimers[inputID]) {
      console.log(`Evaluation for ${inputID} is already pending.`);
      resolve(null); // Or reject, or a specific object indicating this state
      return;
    }

    const timerId = setTimeout(() => {
      // console.log(`Timeout reached for ${inputID}. Performing evaluation.`);
      const evaluationData = performEvaluation(inputID); // Contains evaluationResult and allResponsesForInput
      const timestamp = generateBaseTimestamp();

      logEvaluationToJSON(inputID, evaluationData.allResponsesForInput || [], evaluationData.evaluationResult, timestamp);
      logToMarkdown(inputID, evaluationData.allResponsesForInput || [], evaluationData.evaluationResult, timestamp);

      delete activeTimers[inputID];
      resolve(evaluationData); // Resolve with the object containing evaluationResult and allResponsesForInput
    }, timeoutMs);

    activeTimers[inputID] = timerId; // Store the timerId to potentially clear it if needed, or just true
  });
}

module.exports = {
  registerAgentResponse,
  processInputAndLog,
  DEFAULT_TIMEOUT_MS // Exporting for testability or if users want to reference it

    flags: flags || [] // Default to an empty array if flags are not provided
  };

  if (!agentResponsesByInputID[inputID]) {
    agentResponsesByInputID[inputID] = [];

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


// For potential future use and testing, we can export the functions.
module.exports = {
  registerAgentResponse,
  evaluateResponses

};

module.exports = { registerAgentResponse, evaluateResponses, initiateInput };

