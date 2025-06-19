import { Tool } from '@langchain/core/tools';
import { generateFromLocal } from '../server.js'; // Adjust path as necessary, added .js
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ESM equivalent for __dirname
import { fileURLToPath } from 'url';
const __filename2 = typeof __filename !== 'undefined' ? __filename : fileURLToPath(eval('import.meta.url'));
const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : path.dirname(__filename2);

// Define CONFERENCES_LOG_DIR and CONFERENCES_LOG_FILE
let CONFERENCE_LOGS_BASE_DIR;
try {
    // Attempt to resolve path relative to this file's location
    // Expected structure: project_root/backend/langchain_tools/conference_tool.js
    // So, ../../logs would be project_root/logs
    CONFERENCE_LOGS_BASE_DIR = path.resolve(__dirname2, '../../logs/roadrunner_workspace');

    // Check if the resolved path seems plausible, e.g. by checking if 'backend' is in the path segments
    // This is a heuristic. A more robust way might involve environment variables or a config setting.
    if (!__dirname2.includes(path.join('backend', 'langchain_tools'))) {
        if (!process.env.JEST_WORKER_ID) {
            console.warn(`[ConferenceTool] __dirname (${__dirname2}) does not match expected structure. Log path might be incorrect. Forcing CWD-relative path.`);
        }
        CONFERENCE_LOGS_BASE_DIR = path.resolve(process.cwd(), 'logs/roadrunner_workspace');
    }
} catch (e) {
    CONFERENCE_LOGS_BASE_DIR = path.resolve(process.cwd(), 'logs/roadrunner_workspace');
    if (!process.env.JEST_WORKER_ID) {
        console.warn(`[ConferenceTool] Error determining logs path using __dirname. Defaulting to CWD-relative: ${CONFERENCE_LOGS_BASE_DIR}. Error: ${e.message}`);
    }
}

const CONFERENCES_LOG_FILE = path.join(CONFERENCE_LOGS_BASE_DIR, 'conferences.json');

try {
    if (!fs.existsSync(CONFERENCE_LOGS_BASE_DIR)) {
        fs.mkdirSync(CONFERENCE_LOGS_BASE_DIR, { recursive: true });
        console.log(`[ConferenceTool] Created conference log directory: ${CONFERENCES_LOGS_BASE_DIR}`);
    }
} catch (dirError) {
    console.error(`[ConferenceTool] CRITICAL: Could not create conference log directory at ${CONFERENCE_LOGS_BASE_DIR}. Error: ${dirError.message}`);
}


export class ConferenceTool extends Tool {
  name = "multi_model_debate";
  description = `Facilitates a structured debate between AI personas on a given prompt, followed by a synthesized summary from an arbiter.
Input MUST be a JSON string with a required 'prompt' key (string, the topic for discussion).
Optional keys:
- 'model_a_role': (string) Role for the first debater. Default: "Proponent".
- 'model_b_role': (string) Role for the second debater. Default: "Skeptic".
- 'arbiter_model_role': (string) Role for the summarizer. Default: "Synthesizer".
- 'num_rounds': (integer) Number of rounds for the debate. Default: 1.
- 'model_name': (string) Specific LLM model for all participants. Defaults to the system's configured LLM.
Example: {"prompt": "Should AI be used in art?", "model_a_role": "For AI Art", "model_b_role": "Against AI Art", "num_rounds": 2}`;

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
      // Prefer model from input, then agent's LLM config, then a fallback.
      modelNameForConference = parsedInput.model_name || runManager?.config?.llm?.modelName || runManager?.config?.llm?.model || 'default_conference_model';
      if (!userPrompt) throw new Error("Input JSON MUST include a 'prompt' key.");
    } catch (parseError) {
      console.error("[ConferenceTool] Error parsing input JSON:", parseError);
      return `Error parsing input: ${parseError.message}. Input must be a valid JSON string as described. Input received: ${inputJsonString}`;
    }

    const conferenceId = uuidv4();
    const debate_history = [];
    let responseA = '', responseB = '', arbiterResponse = '';

    const originalExpressHttpRes = runManager?.config?.originalExpressHttpRes;
    const sendSseMessage = runManager?.config?.sendSseMessage;

    const logSse = (message, details) => {
        const logMessage = `[ConferenceTool ${conferenceId}] ${message}${details ? `: ${JSON.stringify(details)}` : ''}`;
        if (sendSseMessage && originalExpressHttpRes) {
            sendSseMessage('log_entry', { message: logMessage });
        }
        console.log(logMessage);
    };

    logSse(`Starting debate. Prompt: "${userPrompt.substring(0,50)}...", Rounds: ${numRounds}, Model: ${modelNameForConference}`);

    try {
      for (let round = 1; round <= numRounds; round++) {
        logSse(`Starting Round ${round}/${numRounds}`);

        const promptAContext = round > 1 ? `Your opponent (${modelBRole}) previously said: "${responseB}"` : "";
        const promptA = `You are ${modelARole}. The discussion topic is: "${userPrompt}". ${promptAContext} Provide your argument or response.`;
        logSse(`Model A (${modelARole}) turn. Prompt (start): ${promptA.substring(0,100)}...`);
        responseA = await generateFromLocal(promptA, modelNameForConference, originalExpressHttpRes, { agentType: 'conference_agent', agentRole: modelARole, speakerContext: modelARole, llmProvider: runManager?.config?.llmProvider });
        if (responseA.startsWith('// LLM_ERROR:')) throw new Error(`Model A (${modelARole}) failed: ${responseA}`);
        logSse(`Model A (${modelARole}) response (summary): ${responseA.substring(0,100)}...`);

        const promptBContext = `Your opponent (${modelARole}) just said: "${responseA}"`;
        const promptB = `You are ${modelBRole}. The discussion topic is: "${userPrompt}". ${promptBContext} Provide your counter-argument or response.`;
        logSse(`Model B (${modelBRole}) turn. Prompt (start): ${promptB.substring(0,100)}...`);
        responseB = await generateFromLocal(promptB, modelNameForConference, originalExpressHttpRes, { agentType: 'conference_agent', agentRole: modelBRole, speakerContext: modelBRole, llmProvider: runManager?.config?.llmProvider });
        if (responseB.startsWith('// LLM_ERROR:')) throw new Error(`Model B (${modelBRole}) failed: ${responseB}`);
        logSse(`Model B (${modelBRole}) response (summary): ${responseB.substring(0,100)}...`);

        debate_history.push({ round, model_a_response: responseA, model_b_response: responseB });
      }

      const formattedDebateHistory = debate_history.map(r => `Round ${r.round}:\n  ${modelARole}: ${r.model_a_response}\n  ${modelBRole}: ${r.model_b_response}`).join('\n\n');
      const arbiterPrompt = `You are ${arbiterModelRole}. The original topic was: "${userPrompt}".\n\nFull Debate History:\n${formattedDebateHistory}\n\nBased on the entire debate, provide a comprehensive synthesized answer.`;
      logSse(`Arbiter (${arbiterModelRole}) turn. Prompt (start): ${arbiterPrompt.substring(0,100)}...`);
      arbiterResponse = await generateFromLocal(arbiterPrompt, modelNameForConference, originalExpressHttpRes, { agentType: 'conference_agent', agentRole: arbiterModelRole, speakerContext: arbiterModelRole, llmProvider: runManager?.config?.llmProvider });
      if (arbiterResponse.startsWith('// LLM_ERROR:')) throw new Error(`Arbiter (${arbiterModelRole}) failed: ${arbiterResponse}`);
      logSse(`Arbiter (${arbiterModelRole}) response (summary): ${arbiterResponse.substring(0,100)}...`);

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
      }

      logSse("Debate finished successfully.");
      return `Debate completed. Arbiter's final synthesized response: ${arbiterResponse}`;

    } catch (error) {
      console.error(`[ConferenceTool ${conferenceId}] Error during debate: ${error.message}`);
      logSse(`Error during debate: ${error.message}`);
      return `Error during multi_model_debate: ${error.message}`;
    }
  }
}

// module.exports = {
//   ConferenceTool,
// };
