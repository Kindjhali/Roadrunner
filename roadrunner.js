const fs = require('fs');
const path = require('path');

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
