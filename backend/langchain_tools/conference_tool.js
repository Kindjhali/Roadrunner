const { Tool } = require('@langchain/core/tools');
const { generateFromLocal } = require('../server'); // Adjust path as necessary
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Define CONFERENCES_LOG_DIR and CONFERENCES_LOG_FILE
// This assumes the 'backend' directory is the parent of 'langchain_tools' and 'logs' is a sibling to 'backend'
// Adjust if your directory structure is different.
// A more robust way would be to pass these paths via runManager.config or ensure they are globally configured.
let CONFERENCE_LOGS_BASE_DIR;
try {
    // Try to determine if running in a way that __dirname is 'langchain_tools'
    if (__dirname.endsWith(path.join('backend', 'langchain_tools'))) {
        CONFERENCE_LOGS_BASE_DIR = path.resolve(__dirname, '../../logs/roadrunner_workspace');
    } else if (__dirname.endsWith('backend')) { // Running from 'backend'
        CONFERENCE_LOGS_BASE_DIR = path.resolve(__dirname, '../logs/roadrunner_workspace');
    } else { // Fallback or if structure is unexpected
        CONFERENCE_LOGS_BASE_DIR = path.resolve(process.cwd(), 'logs/roadrunner_workspace');
        console.warn(`[ConferenceTool] Could not reliably determine logs path relative to __dirname (${__dirname}). Defaulting to CWD-relative: ${CONFERENCE_LOGS_BASE_DIR}. Consider passing via config.`);
    }
} catch (e) { // Handle cases where __dirname might not be defined (e.g. certain bundling scenarios)
    CONFERENCE_LOGS_BASE_DIR = path.resolve(process.cwd(), 'logs/roadrunner_workspace');
    console.warn(`[ConferenceTool] Error determining logs path using __dirname. Defaulting to CWD-relative: ${CONFERENCE_LOGS_BASE_DIR}. Error: ${e.message}`);
}

const CONFERENCES_LOG_FILE = path.join(CONFERENCE_LOGS_BASE_DIR, 'conferences.json');

// Ensure the log directory exists
try {
    if (!fs.existsSync(CONFERENCE_LOGS_BASE_DIR)) {
        fs.mkdirSync(CONFERENCE_LOGS_BASE_DIR, { recursive: true });
        console.log(`[ConferenceTool] Created conference log directory: ${CONFERENCE_LOGS_BASE_DIR}`);
    }
} catch (dirError) {
    console.error(`[ConferenceTool] CRITICAL: Could not create conference log directory at ${CONFERENCE_LOGS_BASE_DIR}. Error: ${dirError.message}`);
    // Tool will likely fail to log if this directory cannot be created.
}


class ConferenceTool extends Tool {
  name = "multi_model_debate";
  description = "Facilitates a structured debate or discussion between multiple AI personas on a given prompt, followed by a synthesized summary from an arbiter. Input must be a JSON string with a 'prompt' key (the topic for discussion). Optional keys: 'model_a_role' (e.g., 'Proponent'), 'model_b_role' (e.g., 'Skeptic'), 'arbiter_model_role' (e.g., 'Synthesizer'), 'num_rounds' (integer, default 1), 'model_name' (specific LLM model for all participants, defaults to system default).";

  async _call(inputJsonString, runManager) {
    console.log("[ConferenceTool] _call invoked with input:", inputJsonString);
    let userPrompt, modelARole, modelBRole, arbiterModelRole, numRounds, modelNameForConference;

    try {
      const parsedInput = JSON.parse(inputJsonString);
      userPrompt = parsedInput.prompt;
      modelARole = parsedInput.model_a_role || "Proponent";
      modelBRole = parsedInput.model_b_role || "Skeptic";
      arbiterModelRole = parsedInput.arbiter_model_role || "Synthesizer";
      numRounds = parseInt(parsedInput.num_rounds, 10) || 1;
      modelNameForConference = parsedInput.model_name || runManager?.config?.llm?.modelName || 'default_model_from_tool'; // Access model from runManager or use a default
      if (!userPrompt) throw new Error("Missing 'prompt' in input JSON.");
    } catch (parseError) {
      console.error("[ConferenceTool] Error parsing input JSON:", parseError);
      return `Error parsing input: ${parseError.message}. Input must be a JSON string.`;
    }

    const conferenceId = uuidv4();
    const debate_history = [];
    let responseA = '', responseB = '', arbiterResponse = '';

    // Access SSE utilities from runManager.config if passed by AgentExecutor
    const originalExpressHttpRes = runManager?.config?.originalExpressHttpRes;
    const sendSseMessage = runManager?.config?.sendSseMessage;

    const logSse = (message) => {
        if (sendSseMessage && originalExpressHttpRes) {
            sendSseMessage('log_entry', { message: `[ConferenceTool ${conferenceId}] ${message}` }, originalExpressHttpRes);
        }
        console.log(`[ConferenceTool ${conferenceId}] ${message}`);
    };

    logSse(`Starting debate. Prompt: "${userPrompt.substring(0,50)}...", Rounds: ${numRounds}, Model: ${modelNameForConference}`);

    try {
      for (let round = 1; round <= numRounds; round++) {
        logSse(`Starting Round ${round}/${numRounds}`);

        // Model A
        const promptAContext = round > 1 ? `Your opponent (${modelBRole}) previously said: "${responseB}"` : "";
        const promptA = `You are ${modelARole}. The discussion topic is: "${userPrompt}". ${promptAContext} Provide your argument or response.`;
        logSse(`Model A (${modelARole}) turn. Prompt: ${promptA.substring(0,100)}...`);
        responseA = await generateFromLocal(promptA, modelNameForConference, originalExpressHttpRes, { agentType: 'conference_agent', agentRole: modelARole, speakerContext: modelARole });
        if (responseA.startsWith('// LLM_ERROR:')) throw new Error(`Model A (${modelARole}) failed: ${responseA}`);
        logSse(`Model A (${modelARole}) response (summary): ${responseA.substring(0,100)}...`);

        // Model B
        const promptBContext = `Your opponent (${modelARole}) just said: "${responseA}"`;
        const promptB = `You are ${modelBRole}. The discussion topic is: "${userPrompt}". ${promptBContext} Provide your counter-argument or response.`;
        logSse(`Model B (${modelBRole}) turn. Prompt: ${promptB.substring(0,100)}...`);
        responseB = await generateFromLocal(promptB, modelNameForConference, originalExpressHttpRes, { agentType: 'conference_agent', agentRole: modelBRole, speakerContext: modelBRole });
        if (responseB.startsWith('// LLM_ERROR:')) throw new Error(`Model B (${modelBRole}) failed: ${responseB}`);
        logSse(`Model B (${modelBRole}) response (summary): ${responseB.substring(0,100)}...`);

        debate_history.push({ round, model_a_response: responseA, model_b_response: responseB });
      }

      // Arbiter
      const formattedDebateHistory = debate_history.map(r => `Round ${r.round}:\n  ${modelARole}: ${r.model_a_response}\n  ${modelBRole}: ${r.model_b_response}`).join('\n\n');
      const arbiterPrompt = `You are ${arbiterModelRole}. The original topic was: "${userPrompt}".\n\nFull Debate History:\n${formattedDebateHistory}\n\nBased on the entire debate, provide a comprehensive synthesized answer.`;
      logSse(`Arbiter (${arbiterModelRole}) turn. Prompt: ${arbiterPrompt.substring(0,100)}...`);
      arbiterResponse = await generateFromLocal(arbiterPrompt, modelNameForConference, originalExpressHttpRes, { agentType: 'conference_agent', agentRole: arbiterModelRole, speakerContext: arbiterModelRole });
      if (arbiterResponse.startsWith('// LLM_ERROR:')) throw new Error(`Arbiter (${arbiterModelRole}) failed: ${arbiterResponse}`);
      logSse(`Arbiter (${arbiterModelRole}) response (summary): ${arbiterResponse.substring(0,100)}...`);

      // Log to CONFERENCES_LOG_FILE
      const logEntry = {
        conference_id: conferenceId, timestamp: new Date().toISOString(), user_prompt: userPrompt, num_rounds: numRounds,
        model_name: modelNameForConference, model_a_role: modelARole, model_b_role: modelBRole, arbiter_model_role: arbiterModelRole,
        debate_history, arbiter_response: arbiterResponse,
      };
      try {
        let conferences = [];
        if (fs.existsSync(CONFERENCES_LOG_FILE)) {
          const fileContent = fs.readFileSync(CONFERENCES_LOG_FILE, 'utf-8');
          if (fileContent.trim()) conferences = JSON.parse(fileContent);
        }
        conferences.push(logEntry);
        fs.writeFileSync(CONFERENCES_LOG_FILE, JSON.stringify(conferences, null, 2));
        logSse(`Conference log saved to ${CONFERENCES_LOG_FILE}`);
      } catch (logError) {
        console.error(`[ConferenceTool ${conferenceId}] Error logging conference to file: ${logError.message}`);
        // Do not fail the tool for logging error, but log it to console.
      }

      logSse("Debate finished successfully.");
      return `Debate completed. Arbiter response: ${arbiterResponse}`;

    } catch (error) {
      console.error(`[ConferenceTool ${conferenceId}] Error during debate: ${error.message}`);
      logSse(`Error during debate: ${error.message}`);
      return `Error during multi_model_debate: ${error.message}`;
    }
  }
}

module.exports = {
  ConferenceTool,
};
