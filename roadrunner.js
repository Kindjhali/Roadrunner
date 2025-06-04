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

/**
 * Stores agent responses grouped by inputID.
 * This is a module-scoped variable and is not exported.
 * @type {Object<string, Array<Object>>}
 */
let agentResponsesByInputID = {};

/**
 * Registers an agent's response for a given input ID.
 *
 * @param {string} inputID - A unique identifier for the input that triggered these agent responses.
 * @param {string} agentID - The unique name of the agent submitting the response.
 * @param {string} proposal - The proposed action or content from the agent.
 * @param {number} confidence - A confidence score for the proposal, ranging from 0.0 to 1.0.
 * @param {Array<string>} [flags] - Optional array of tags or conditions (e.g., "veto", "urgent").
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
  }

  agentResponsesByInputID[inputID].push(response);
}

/**
 * Evaluates agent responses for a given input ID and selects the best one based on flags and confidence scores.
 * Logs the evaluation process and outcome.
 *
 * @param {string} inputID - The unique identifier for the input whose agent responses are to be evaluated.
 * @returns {Object|null} The selected agent response object, or null if no suitable response is found.
 */
function evaluateResponses(inputID) {
  const originalResponses = agentResponsesByInputID[inputID] ? JSON.parse(JSON.stringify(agentResponsesByInputID[inputID])) : [];

  if (!originalResponses || originalResponses.length === 0) {
    // Log attempt to evaluate non-existent or empty inputID if desired, though problem implies logging only on selection.
    return null; // No responses for this inputID
  }

  // Filter out responses with a 'discard' flag
  const activeResponses = originalResponses.filter(response =>
    !response.flags || !response.flags.includes('discard')
  );

  if (activeResponses.length === 0) {
    return null; // No responses remain after discarding
  }

  let selectedResponse = null;

  // Check for responses with a 'veto' flag
  const vetoResponses = activeResponses.filter(response =>
    response.flags && response.flags.includes('veto')
  );

  if (vetoResponses.length > 0) {
    // If veto responses exist, the one with the highest confidence among them is selected
    selectedResponse = vetoResponses.reduce((maxConfidenceResponse, currentResponse) =>
      currentResponse.confidence > maxConfidenceResponse.confidence ? currentResponse : maxConfidenceResponse
    , vetoResponses[0]);
  } else if (activeResponses.length > 0) {
    // If no 'veto' flags, the response with the highest confidence among the remaining ones is selected
    selectedResponse = activeResponses.reduce((maxConfidenceResponse, currentResponse) =>
      currentResponse.confidence > maxConfidenceResponse.confidence ? currentResponse : maxConfidenceResponse
    , activeResponses[0]);
  }

  // If a response is selected, log it (logging content to be updated in a subsequent step)
  if (selectedResponse) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const logsDir = path.join('.', 'logs', 'roadrunner');
    fs.mkdirSync(logsDir, { recursive: true });

    const logFilePath = path.join(logsDir, `${timestamp}.json`);

    let justification = "";
    if (selectedResponse.flags && selectedResponse.flags.includes('veto')) {
      justification = "Selected due to veto flag from agent '" + selectedResponse.agent + "' with highest confidence.";
    } else {
      justification = "Selected due to highest confidence from agent '" + selectedResponse.agent + "'.";
    }

    const logObject = {
      inputID: inputID,
      // Ensure a deep copy of original responses for logging, if not already handled by originalResponses
      responses: agentResponsesByInputID[inputID] ? JSON.parse(JSON.stringify(agentResponsesByInputID[inputID])) : [],
      selectedResponse: selectedResponse,
      justification: justification
    };

    try {
      fs.writeFileSync(logFilePath, JSON.stringify(logObject, null, 2));
    } catch (err) {
      console.error("Failed to write Roadrunner log:", err);
      // Decide if this error should affect the return or be handled otherwise
    }
  }

  return selectedResponse;
}

// For potential future use and testing, we can export the functions.
module.exports = {
  registerAgentResponse,
  evaluateResponses

};
