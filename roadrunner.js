const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 5000;
const agentResponses = {};
const activeTimers = {}; // To store active timer IDs or flags

const logDirectory = path.join(process.cwd(), 'logs', 'roadrunner');

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
};
