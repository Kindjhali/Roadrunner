const fs = require('fs');
const path = require('path');

/**
 * Roadrunner Internal Arbitration Engine
 * Collects agent proposals and selects the highest confidence response.
 */

const DEFAULT_TIMEOUT_MS = 5000;

// { inputID: { actualInputText: string, responses: Array<{agent, proposal, confidence, flags}> } }
const agentResponses = {};
// Track pending evaluation timers
const activeTimers = {};

const logDirectory = path.join(process.cwd(), 'logs', 'roadrunner');

function ensureLogDirectoryExists() {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
}

function generateBaseTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function logEvaluationToJSON(inputID, responses, evaluation, timestamp) {
  ensureLogDirectoryExists();
  const file = path.join(logDirectory, `${timestamp}.json`);
  const data = {
    input: inputID,
    responses,
    selected_agent_proposal: evaluation.selected
      ? { agent: evaluation.agent, proposal: evaluation.selected, confidence: evaluation.confidence }
      : null,
    justification: evaluation.justification
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function logEvaluationToMarkdown(inputID, responses, evaluation, timestamp) {
  ensureLogDirectoryExists();
  const file = path.join(logDirectory, `${timestamp}.md`);
  let md = `# Roadrunner Decision Log\n\n`;
  md += `**Input:** \`${inputID}\`\n\n---\n\n## Agent Responses:\n\n`;
  if (responses.length > 0) {
    for (const r of responses) {
      md += `### Agent: ${r.agent}\n`;
      md += `- **Proposal:** ${r.proposal}\n`;
      md += `- **Confidence:** ${r.confidence}\n`;
      md += `- **Flags:** ${r.flags && r.flags.length ? r.flags.join(', ') : 'None'}\n\n`;
    }
  } else {
    md += `No responses received for this input.\n\n`;
  }
  md += `---\n\n`;
  if (evaluation.selected) {
    md += `**Selected Proposal:** ${evaluation.selected}\n`;
    md += `**Selected Agent:** ${evaluation.agent}\n`;
    md += `**Confidence:** ${evaluation.confidence}\n`;
  } else {
    md += `**Selected Proposal:** None\n`;
  }
  md += `**Justification:** ${evaluation.justification}\n`;
  fs.writeFileSync(file, md);
}

function initiateInput(inputID, actualInputText) {
  agentResponses[inputID] = { actualInputText, responses: [] };
}

function registerAgentResponse(inputID, agentID, proposal, confidence, flags = []) {
  if (!agentResponses[inputID]) {
    console.warn(`Response registered for uninitiated inputID: ${inputID}`);
    initiateInput(inputID, `Input ${inputID} received response(s) without formal initiation.`);
  }
  agentResponses[inputID].responses.push({ agent: agentID, proposal, confidence, flags });
}

function performEvaluation(inputID) {
  const entry = agentResponses[inputID];
  if (!entry || entry.responses.length === 0) {
    return {
      evaluationResult: {
        selected: null,
        agent: null,
        confidence: null,
        justification: 'No responses received for this input.'
      },
      allResponsesForInput: []
    };
  }

  let highest = entry.responses[0];
  for (const resp of entry.responses.slice(1)) {
    if (resp.confidence > highest.confidence) highest = resp;
  }

  return {
    evaluationResult: {
      selected: highest.proposal,
      agent: highest.agent,
      confidence: highest.confidence,
      justification: 'Highest confidence score.'
    },
    allResponsesForInput: entry.responses
  };
}

function evaluateResponses(inputID) {
  const evaluation = performEvaluation(inputID);
  const ts = generateBaseTimestamp();
  logEvaluationToJSON(inputID, evaluation.allResponsesForInput, evaluation.evaluationResult, ts);
  logEvaluationToMarkdown(inputID, evaluation.allResponsesForInput, evaluation.evaluationResult, ts);

  const entry = agentResponses[inputID];
  const actualInputText = entry ? entry.actualInputText : `Input text not available for ${inputID}`;
  return {
    inputID,
    responses: evaluation.allResponsesForInput,
    selectedProposal: evaluation.evaluationResult.selected,
    justification: evaluation.evaluationResult.justification,
    error: evaluation.evaluationResult.selected ? undefined : 'No responses found for this input ID',
    actualInputText
  };
}

function processInputAndLog(inputID, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (activeTimers[inputID]) {
      console.log(`Evaluation for ${inputID} is already pending.`);
      resolve(null);
      return;
    }

    const timerId = setTimeout(() => {
      const result = evaluateResponses(inputID);
      delete activeTimers[inputID];
      resolve(result);
    }, timeoutMs);

    activeTimers[inputID] = timerId;
  });
}

module.exports = {
  registerAgentResponse,
  initiateInput,
  evaluateResponses,
  processInputAndLog,
  DEFAULT_TIMEOUT_MS
};
