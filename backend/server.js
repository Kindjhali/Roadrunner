import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Global Error Handlers for Backend Stability ---
process.on('uncaughtException', (error, origin) => {
  console.error(`[Backend CRITICAL] Uncaught Exception at: ${origin}`);
  console.error('[Backend CRITICAL] Error details:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Backend CRITICAL] Unhandled Rejection at Promise:', promise);
  console.error('[Backend CRITICAL] Reason:', reason);
});
// --- End Global Error Handlers ---

import express from 'express';
import fs from 'fs';
// path is already imported at the top for __dirname/__filename
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch'; // Standard ESM import

let OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'; // Changed to let

// Langchain imports
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { AgentExecutor, createOpenAIFunctionsAgent, createReactAgent } from "langchain/agents"; // Reverting to specific path
import { ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
// renderTextDescription is not directly used, but as part of agent creation - assuming it's pulled in by agents if needed.
// import { renderTextDescription } from "@langchain/core/tools";
import { ConversationBufferWindowMemory } from "langchain/memory/buffer_window.js";

// Import tools and custom error - adding .js extension
import { ListDirectoryTool, CreateFileTool, ReadFileTool, UpdateFileTool, DeleteFileTool, CreateDirectoryTool, DeleteDirectoryTool } from './langchain_tools/fs_tools.js';
import { GitAddTool, GitCommitTool, GitPushTool, GitPullTool, GitRevertTool } from './langchain_tools/git_tools.js';
import { CodeGeneratorTool } from './langchain_tools/code_generator_tool.js';
import { ConferenceTool } from './langchain_tools/conference_tool.js';
import { ProposePlanTool, RequestUserActionOnFailureTool } from './langchain_tools/planning_tools.js';
import { ConfirmationRequiredError } from './langchain_tools/common.js';

// Initialize Tools
const tools = [
  new ListDirectoryTool(), new CreateFileTool(), new ReadFileTool(), new UpdateFileTool(), new DeleteFileTool(), new CreateDirectoryTool(), new DeleteDirectoryTool(),
  new GitAddTool(), new GitCommitTool(), new GitPushTool(), new GitPullTool(), new GitRevertTool(),
  new CodeGeneratorTool(),
  new ConferenceTool(),
  new ProposePlanTool(),
  new RequestUserActionOnFailureTool(), // Added RequestUserActionOnFailureTool instance
];

// Agent and AgentExecutor definition
let agentExecutor;
let agent;

// Prompt for OpenAI Functions Agent - now includes chat_history placeholder
const AGENT_PROMPT_TEMPLATE_OPENAI = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. Use the provided tools to answer the user's questions. Respond with a tool call if appropriate, otherwise respond to the user directly."],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

// Standard ReAct prompt template text - now includes {chat_history}
const REACT_AGENT_PROMPT_TEMPLATE_TEXT = `Assistant is a large language model.

Assistant is designed to be able to assist with a wide range of tasks, from answering simple questions to providing in-depth explanations and discussions on a wide range of topics. As a language model, Assistant is able to generate human-like text based on the input it receives, allowing it to engage in natural-sounding conversations and provide responses that are coherent and relevant to the topic at hand.

TOOLS:
------
Assistant has access to the following tools and MUST use them when needed. Each tool description provides information on how to use it, including the expected input format (e.g., direct string or JSON string) and an example.

{tools}

RESPONSE FORMAT INSTRUCTIONS:
----------------------------
When responding to me, please output a response in one of two formats:

**Option 1:**
Use this if you want to use a tool.
Markdown code snippet formatted in the following schema:

Thought: Do I need to use a tool? Yes. Which tool is best for this? [tool_name]. What is the input to this tool?
Action: [tool_name]
Action Input: [the input to the tool, often a JSON string. For tools expecting JSON, ensure the JSON is valid and all string values within it are properly escaped. For tools expecting a simple string, just provide the string directly without JSON wrapping.]
Observation: [the result of the tool call]

**Option 2:**
Use this if you want to respond directly to me.
Markdown code snippet formatted in the following schema:

Thought: Do I need to use a tool? No. I have the answer.
Final Answer: [your response here]

Always begin your response with "Thought:".
If you are using a tool, the "Action" line MUST be followed by an "Action Input" line, then an "Observation" line.

**HANDLING TOOL ERRORS:** If the 'Observation' you receive from a tool clearly indicates an error, acknowledge it in your 'Thought', analyze it, and avoid immediate retries if futile. Consider alternatives or explain if the task is blocked.
**HANDLING USER DENIALS:** If an 'Observation' indicates a user denied an action, DO NOT retry the exact action. Acknowledge, re-evaluate, and find alternatives or explain why the task cannot proceed.

NOW BEGIN!

PREVIOUS CONVERSATION HISTORY (if any):
{chat_history}

NEW USER INPUT:
Question: {input}

Thought:{agent_scratchpad}`;


async function initializeAgentExecutor() {
  console.log("[Agent Init] Initializing AgentExecutor...");
  const llmProvider = backendSettings.llmProvider;
  let llm;

  if (typeof ConversationBufferWindowMemory === 'undefined') {
    console.error("[Agent Init] CRITICAL: ConversationBufferWindowMemory is undefined before instantiation. Check Langchain imports and property access.");
  } else {
    console.log(`[Agent Init] ConversationBufferWindowMemory type before instantiation: ${typeof ConversationBufferWindowMemory}`);
  }

  const memory = new ConversationBufferWindowMemory({
    k: 5,
    memoryKey: "chat_history",
    inputKey: "input",
    returnMessages: true
  });
  console.log('[BACKEND DEBUG] ConversationBufferWindowMemory instance created. Type:', typeof memory, 'Keys:', memory ? Object.keys(memory).join(', ') : 'N/A');
  console.log("[Agent Init] ConversationBufferWindowMemory initialized.");

  if (llmProvider === 'openai') {
    const effectiveOpenAIApiKey = backendSettings.apiKey || backendSettings.openaiApiKey;
    const openAIModelName = backendSettings.defaultOpenAIModel || 'gpt-4-turbo';
    if (!effectiveOpenAIApiKey) {
      console.error("[Agent Init] OpenAI API key is missing. OpenAI agent will not be functional.");
      llm = new ChatOpenAI({ apiKey: effectiveOpenAIApiKey, modelName: openAIModelName, streaming: true, temperature: 0 });
    } else {
       llm = new ChatOpenAI({ apiKey: effectiveOpenAIApiKey, modelName: openAIModelName, streaming: true, temperature: 0 });
       console.log(`[Agent Init] OpenAI LLM created with model ${openAIModelName}.`);
    }
    // Use the existing AGENT_PROMPT_TEMPLATE_OPENAI which now includes MessagesPlaceholder("chat_history")
    agent = await createOpenAIFunctionsAgent({ llm, tools, prompt: AGENT_PROMPT_TEMPLATE_OPENAI });
    console.log("[Agent Init] OpenAI Functions Agent created successfully.");
  } else {
    const ollamaModelName = backendSettings.defaultOllamaModel || 'llama3';
    console.log(`[Agent Init] Ollama provider selected. Model: ${ollamaModelName}`);
    llm = new ChatOllama({ baseUrl: OLLAMA_BASE_URL, model: ollamaModelName, temperature: 0 });
    console.log(`[Agent Init] ChatOllama LLM created with model ${ollamaModelName}.`);

    // Construct the prompt template for ReAct agent, incorporating chat_history
    const reactPrompt = ChatPromptTemplate.fromMessages([
        new SystemMessage(REACT_AGENT_PROMPT_TEMPLATE_TEXT.substring(0, REACT_AGENT_PROMPT_TEMPLATE_TEXT.indexOf("NOW BEGIN!"))), // System message part
        new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate(REACT_AGENT_PROMPT_TEMPLATE_TEXT.substring(REACT_AGENT_PROMPT_TEMPLATE_TEXT.indexOf("NEW USER INPUT:"))),
    ]);

    agent = await createReactAgent({ llm, tools, prompt: reactPrompt });
    console.log("[Agent Init] Ollama ReAct Agent created successfully.");
  }

  agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory, // Added memory instance
    returnIntermediateSteps: true,
    maxIterations: 15,
    verbose: true,
    // handleParsingErrors: true,
  });
  console.log("[Agent Init] AgentExecutor created with memory.");
}

const BACKEND_CONFIG_FILE_PATH = path.join(__dirname, 'config', 'backend_config.json');
let backendSettings = {
  llmProvider: process.env.RR_LLM_PROVIDER || 'ollama',
  apiKey: process.env.RR_API_KEY || '',
  defaultOllamaModel: process.env.RR_DEFAULT_OLLAMA_MODEL || 'mistral',
  defaultOpenAIModel: process.env.RR_DEFAULT_OPENAI_MODEL || 'gpt-4',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  componentDir: process.env.RR_COMPONENT_DIR || path.resolve(__dirname, '../../tokomakAI/src/components'),
  logDir: process.env.RR_LOG_DIR || path.resolve(__dirname, '../../logs'),
  workspaceDir: process.env.RR_WORKSPACE_DIR || path.resolve(__dirname, '../../output')
};

function loadBackendConfig() {
    const initialSettings = { ...backendSettings }; // Keep a copy of env/default based settings

    try {
        if (fs.existsSync(BACKEND_CONFIG_FILE_PATH)) {
            const configFileContent = fs.readFileSync(BACKEND_CONFIG_FILE_PATH, 'utf-8');
            const configFromFile = JSON.parse(configFileContent);
            // Override initial settings with those from the file, but only if they are present in the file
            for (const key in configFromFile) {
                if (configFromFile.hasOwnProperty(key) && configFromFile[key] !== undefined && configFromFile[key] !== null && configFromFile[key] !== '') {
                    initialSettings[key] = configFromFile[key];
                }
            }
            backendSettings = initialSettings;
            console.log(`[Config] Loaded backend settings from ${BACKEND_CONFIG_FILE_PATH}`);
        } else {
            const examplePath = path.join(__dirname, 'config', 'backend_config.example.json');
            if (fs.existsSync(examplePath)) {
                console.log(`[Config] Backend config not found. Copying from ${examplePath} and applying defaults/env vars.`);
                const exampleContent = fs.readFileSync(examplePath, 'utf-8');
                const exampleSettings = JSON.parse(exampleContent);
                // Merge example settings with initial (env/default) settings.
                // Initial settings (especially from env vars) take precedence over example file.
                backendSettings = { ...exampleSettings, ...initialSettings };
                fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(backendSettings, null, 2), 'utf-8');
            } else {
                console.log(`[Config] Backend config and example not found. Creating default ${BACKEND_CONFIG_FILE_PATH} using defaults/env vars.`);
                fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(initialSettings, null, 2), 'utf-8');
                backendSettings = initialSettings; // Already set, but for clarity
            }
        }
    } catch (error) {
        console.error(`[Config] Error loading/creating backend_config.json:`, error);
        // Fallback to initial settings if file operations fail
        backendSettings = initialSettings;
    }

    // Update the global OLLAMA_BASE_URL after loading config
    // Priority: backendSettings.OLLAMA_BASE_URL (from file/env) > process.env.OLLAMA_BASE_URL > default
    if (backendSettings.OLLAMA_BASE_URL) {
        OLLAMA_BASE_URL = backendSettings.OLLAMA_BASE_URL;
    } else if (process.env.OLLAMA_BASE_URL) {
        OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
    } else {
        OLLAMA_BASE_URL = 'http://localhost:11434'; // Default fallback
    }
    console.log(`[Config] OLLAMA_BASE_URL initialized to: ${OLLAMA_BASE_URL}`);
}
loadBackendConfig();

const CONFERENCE_INSTRUCTIONS_FILE_PATH = process.env.TEST_CONFERENCE_INSTRUCTIONS_PATH || path.join(__dirname, 'config', 'conference_agent_instructions.json');
const AGENT_INSTRUCTIONS_FILE_PATH = path.join(__dirname, 'config', 'agent_instructions_template.json');

function initializeConferenceInstructionsFile() {
  if (!fs.existsSync(CONFERENCE_INSTRUCTIONS_FILE_PATH)) {
    try {
      fs.writeFileSync(CONFERENCE_INSTRUCTIONS_FILE_PATH, JSON.stringify({}, null, 2), 'utf-8');
      console.log(`[Config] Created empty conference agent instructions file at ${CONFERENCE_INSTRUCTIONS_FILE_PATH}`);
    } catch (error) {
      console.error(`[Config] Failed to create conference agent instructions file:`, error);
    }
  }
}
initializeConferenceInstructionsFile(); // Call on startup

function loadConferenceInstructions() {
  try {
    if (fs.existsSync(CONFERENCE_INSTRUCTIONS_FILE_PATH)) {
      const fileContent = fs.readFileSync(CONFERENCE_INSTRUCTIONS_FILE_PATH, 'utf-8');
      return JSON.parse(fileContent);
    }
    return {}; // Return empty object if file doesn't exist (should have been created by initialize)
  } catch (error) {
    console.error(`[Config] Error reading or parsing conference agent instructions file:`, error);
    return {}; // Return empty object on error
  }
}

function saveConferenceInstructions(instructions) {
  try {
    fs.writeFileSync(CONFERENCE_INSTRUCTIONS_FILE_PATH, JSON.stringify(instructions, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[Config] Error saving conference agent instructions file:`, error);
    throw error; // Re-throw to be caught by route handler
  }
}


// Moved the logic for handling autonomous task execution into a named function
const handleExecuteAutonomousTask = async (req, expressHttpRes) => {
    console.log(`[POST /execute-autonomous-task] Request received.`);
    const payload = parseTaskPayload(req);

    if (payload.error) {
        console.log(`[POST /execute-autonomous-task] Invalid payload: ${payload.error}`);
        return expressHttpRes.status(400).json({ message: payload.error });
    }

    let { task_description, safetyMode } = payload;
    console.log(`[Agent Handling] Received task. Goal: "${task_description.substring(0, 100)}...", Safety Mode from payload: ${safetyMode}`);

    expressHttpRes.setHeader('Content-Type', 'text/event-stream');
    expressHttpRes.setHeader('Cache-Control', 'no-cache');
    expressHttpRes.setHeader('Connection', 'keep-alive');
    expressHttpRes.flushHeaders();

    const sendSseMessage = (type, data) => {
        if (expressHttpRes.writable) {
            expressHttpRes.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
        }
    };

    const overallExecutionLog = [`Agent Task: "${task_description}", Safety Mode: ${safetyMode}`];

    // Initialize agent executor for each request to ensure fresh memory for the task.
    // This makes memory request-scoped.
    try {
        await initializeAgentExecutor();
    } catch (initError) {
        console.error("[Agent Handling] CRITICAL: AgentExecutor initialization failed:", initError);
        sendSseMessage('error', { content: `AgentExecutor initialization failed: ${initError.message}` });
        if (expressHttpRes.writable) expressHttpRes.end();
        return;
    }


    sendSseMessage('log_entry', { message: `[SSE Agent] Starting agent execution for goal: "${task_description}" with Safety Mode: ${safetyMode}` });
    overallExecutionLog.push(`[Agent Execution] Starting for goal: "${task_description}", Safety Mode: ${safetyMode}`);

    let currentTaskInput = { input: task_description, chat_history: [] }; // Initial input for AgentExecutor and memory

    let agentRunConfig = {
      configurable: {
        safetyMode: safetyMode,
        originalExpressHttpRes: expressHttpRes,
        sendSseMessage: sendSseMessage,
        overallExecutionLog: overallExecutionLog, // Added for ProposePlanTool
        originalTaskDescription: task_description,
        agentExecutor: agentExecutor,
      }
    };

    let errorOccurred = false;
    try {
        const eventStream = await agentExecutor.stream(currentTaskInput, agentRunConfig);
        for await (const event of eventStream) {
            const eventType = Object.keys(event)[0];
            const eventData = event[eventType];
            sendSseMessage('agent_event', { event_type: eventType, data: eventData });

            if (eventType === "on_agent_action") {
                sendSseMessage('log_entry', { message: `[SSE Agent] Action: ${eventData.tool} with input ${JSON.stringify(eventData.toolInput)}` });
                overallExecutionLog.push(`[Agent Action] Tool: ${eventData.tool}, Input: ${JSON.stringify(eventData.toolInput)}`);
            } else if (eventType === "on_tool_end") {
                sendSseMessage('log_entry', { message: `[SSE Agent] Tool ${eventData.tool} finished. Output (summary): ${String(eventData.output).substring(0, 200)}...` });
                overallExecutionLog.push(`[Agent Tool End] Tool: ${eventData.tool}, Output: ${String(eventData.output).substring(0,200)}...`);
            } else if (eventType === "on_chain_end" || eventType === "on_agent_finish") {
                const finalOutput = eventData.output || (eventData.outputs ? eventData.outputs.output : null) || (typeof eventData === 'string' ? eventData : JSON.stringify(eventData));
                sendSseMessage('log_entry', { message: `[SSE Agent] Final Output: ${finalOutput}` });
                overallExecutionLog.push(`[Agent Final Output] ${finalOutput}`);
                sendSseMessage('execution_complete', { message: 'Agent task execution finished.', final_output: finalOutput, logSummary: overallExecutionLog });
                break;
            }
        }
    } catch (error) {
        errorOccurred = true;
        if (error instanceof ConfirmationRequiredError) {
            const { toolName, toolInput, confirmationId, message: confirmationMessage } = error.data;
            console.log(`[Agent Handling] Confirmation required for tool ${toolName}. ID: ${confirmationId}`);
            overallExecutionLog.push(`[Confirmation Required] Tool: ${toolName}, Input: ${JSON.stringify(toolInput)}, Msg: ${confirmationMessage}, ID: ${confirmationId}`);

            // Capture current chat history for resumption
            const currentChatHistory = await agentExecutor.memory.chatHistory.getMessages();

            pendingToolConfirmations[confirmationId] = {
                originalTaskDescription: task_description,
                agentRunConfigurable: agentRunConfig.configurable, // Store the original agentRunConfig.configurable
                toolName,
                toolInput,
                safetyMode,
                originalExpressHttpRes: expressHttpRes,
                sendSseMessage,
                overallExecutionLog,
                chatHistoryMessages: currentChatHistory,
                activeAgentExecutor: agentExecutor, // Store the active agentExecutor instance
            };
            sendSseMessage('confirmation_required', { confirmationId, toolName, toolInput, message: confirmationMessage });
            return;
        } else {
            console.error(`[Agent Handling] Error during agent execution for goal "${task_description}":`, error);
            overallExecutionLog.push(`[Agent Execution] ❌ Error: ${error.message}`);
            sendSseMessage('error', { content: `Agent execution error: ${error.message}` });
        }
    } finally {
        const isPendingConfirmation = Object.values(pendingToolConfirmations).some(p => p.originalExpressHttpRes === expressHttpRes);
        if (expressHttpRes.writable && !isPendingConfirmation) {
            if (errorOccurred && ! (error instanceof ConfirmationRequiredError) ) {
                 sendSseMessage('execution_complete', { message: 'Task terminated due to agent execution error.' });
            }
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const logPath = path.join(LOG_DIR, `agent-task-final-${timestamp}.log.md`);
                fs.writeFileSync(logPath, `# Agent Task: ${task_description}\n\n${overallExecutionLog.join('\n')}`);
                sendSseMessage('log_entry', { message: `[SSE Agent] Full agent execution log saved to ${logPath}` });
            } catch (logErr) { sendSseMessage('error', { content: `[SSE Agent] Failed to save agent execution log: ${logErr.message}` });}
            expressHttpRes.end();
        }
    }
};

const LOG_DIR_DEFAULT = path.resolve(__dirname, '../../logs');
const WORKSPACE_DIR_DEFAULT = path.resolve(__dirname, '../../output');
const LOG_DIR = fs.existsSync(path.join(__dirname, 'config/backend_config.json')) ? (JSON.parse(fs.readFileSync(path.join(__dirname, 'config/backend_config.json'), 'utf-8')).logDir || LOG_DIR_DEFAULT) : LOG_DIR_DEFAULT;
const WORKSPACE_DIR = fs.existsSync(path.join(__dirname, 'config/backend_config.json')) ? (JSON.parse(fs.readFileSync(path.join(__dirname, 'config/backend_config.json'), 'utf-8')).workspaceDir || WORKSPACE_DIR_DEFAULT) : WORKSPACE_DIR_DEFAULT;

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

const pendingToolConfirmations = {};
const pendingPlans = {}; // Added for storing proposed plans
const pendingFailures = {}; // Added for storing step failure information

// Removed unused fetch import: const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function requestUserActionOnStepFailure({
  failureDetails, // An object containing information about the failed step, the error, etc.
  expressHttpRes,
  sendSseMessage,
  overallExecutionLog,
  originalTaskDescription,
  agentExecutor,
}) {
  const failureId = uuidv4();
  console.log(`[Step Failure] Requesting user action for failure ${failureId} during task: "${originalTaskDescription}". Details: ${JSON.stringify(failureDetails)}`);

  return new Promise((resolve, reject) => {
    pendingFailures[failureId] = {
      details: failureDetails,
      expressHttpRes,
      sendSseMessage,
      overallExecutionLog,
      originalTaskDescription,
      agentExecutor,
      resolve,
      reject, // For timeouts or errors in this mechanism itself
      timestamp: new Date().toISOString(),
    };

    try {
      if (sendSseMessage && typeof sendSseMessage === 'function') {
        sendSseMessage('step_failure_requires_action', {
          failureId,
          details: failureDetails,
          available_actions: ['retry', 'skip', 'manual'], // Explicitly list user options
        });
        const logMessage = `[Step Failure] User action requested for failureId: ${failureId}. Waiting for user response. Failure: ${JSON.stringify(failureDetails).substring(0, 200)}...`;
        console.log(logMessage);
        if (overallExecutionLog && Array.isArray(overallExecutionLog)) {
          overallExecutionLog.push(logMessage);
        }
      } else {
        console.error(`[Step Failure] CRITICAL: sendSseMessage function not available for failureId ${failureId}. Cannot notify client for action.`);
        reject(new Error(`Failed to request user action for failure ${failureId}: SSE mechanism unavailable.`));
        delete pendingFailures[failureId]; // Clean up
        return;
      }
    } catch (error) {
      console.error(`[Step Failure] Error sending step_failure_requires_action SSE for failureId ${failureId}:`, error);
      reject(new Error(`Failed to send step failure notification for ${failureId} to client: ${error.message}`));
      delete pendingFailures[failureId]; // Clean up
      return;
    }
    // Promise resolved by API endpoints like /api/retry-step/:failureId
  });
}

async function requestPlanApproval({
  planContent,
  expressHttpRes, // The Express response object for the current agent's SSE stream
  sendSseMessage, // The function to send SSE messages for the current agent
  overallExecutionLog, // The overall execution log array for the current task
  originalTaskDescription, // The original task description
  agentExecutor, // The current agentExecutor instance (not strictly used now, but for future context)
}) {
  const planId = uuidv4();
  console.log(`[Plan Approval] Requesting approval for plan ${planId} for task: "${originalTaskDescription}"`);

  return new Promise((resolve, reject) => {
    pendingPlans[planId] = {
      plan: planContent,
      expressHttpRes,
      sendSseMessage,
      resolve,
      reject,
      overallExecutionLog,
      originalTaskDescription,
      agentExecutor, // Storing for potential future use
      timestamp: new Date().toISOString(),
    };

    try {
      if (sendSseMessage && typeof sendSseMessage === 'function') {
        sendSseMessage('plan_approval_required', { planId, plan: planContent });
        const logMessage = `[Plan Approval] Plan approval requested for planId: ${planId}. Waiting for user response. Plan: ${JSON.stringify(planContent).substring(0, 200)}...`;
        console.log(logMessage);
        if (overallExecutionLog && Array.isArray(overallExecutionLog)) {
          overallExecutionLog.push(logMessage);
        }
      } else {
        // This is a critical issue if SSE is the only way to notify the user.
        console.error(`[Plan Approval] CRITICAL: sendSseMessage function not available for planId ${planId}. Cannot notify client for approval.`);
        // Immediately reject the promise as the user cannot be notified.
        // This prevents the agent from hanging indefinitely.
        reject(new Error(`Failed to request plan approval for ${planId}: SSE mechanism unavailable.`));
        // Clean up the pending plan to prevent orphaned entries
        delete pendingPlans[planId];
        return; // Exit early
      }
    } catch (error) {
        console.error(`[Plan Approval] Error sending plan_approval_required SSE for planId ${planId}:`, error);
        // Reject the promise if sending the SSE message fails, as the user won't get the prompt.
        reject(new Error(`Failed to send plan approval request for ${planId} to client: ${error.message}`));
        // Clean up the pending plan
        delete pendingPlans[planId];
        return; // Exit early
    }
    // Note: The promise returned here will be resolved or rejected by the
    // /api/approve-plan/:planId or /api/decline-plan/:planId endpoints.
  });
}

async function generateFromLocal(originalPrompt, modelName, expressRes, options = {}) {
    const provider = options.llmProvider || backendSettings.llmProvider;
    let accumulatedResponse = '';
    let finalPrompt = originalPrompt;

    console.log(`[LLM Generation] Provider: ${provider || 'ollama (default)'}, Model: ${modelName}`);
    console.log(`[LLM Generation] Final prompt (first 200 chars): "${finalPrompt.substring(0, 200)}..."`);

    let llm;
    if (provider === 'openai') {
      const effectiveOpenAIApiKey = backendSettings.apiKey || backendSettings.openaiApiKey;
      const openAIModelToUse = modelName || backendSettings.defaultOpenAIModel || 'gpt-3.5-turbo';
      if (!effectiveOpenAIApiKey) {
        const errorMessage = 'OpenAI API key is missing.';
        if (expressRes && expressRes.writable) expressRes.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
        return `// LLM_ERROR: ${errorMessage} //`;
      }
      llm = new ChatOpenAI({ apiKey: effectiveOpenAIApiKey, modelName: openAIModelToUse, streaming: true });
    } else {
      const ollamaModelToUse = modelName || backendSettings.defaultOllamaModel || 'codellama';
      llm = new ChatOllama({ baseUrl: OLLAMA_BASE_URL, model: ollamaModelToUse });
    }

    try {
      const stream = await llm.stream([new HumanMessage(finalPrompt)]);
      for await (const chunk of stream) {
        if (chunk && chunk.content) {
          const contentChunk = chunk.content;
          accumulatedResponse += contentChunk;
          if (expressRes && expressRes.writable) {
            const ssePayload = { type: 'llm_chunk', content: contentChunk };
            if (options.speakerContext) ssePayload.speaker = options.speakerContext;
            expressRes.write(`data: ${JSON.stringify(ssePayload)}\n\n`);
          }
        }
      }
      return accumulatedResponse;
    } catch (error) {
      const errorMessage = `Error with ${provider} via Langchain: ${error.message}`;
      if (expressRes && expressRes.writable) expressRes.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
      return `// LLM_ERROR: ${errorMessage} //`;
    }
}

function parseTaskPayload(req) {
    let task_description, safetyModeString;
    if (req.method === 'POST') {
      ({ task_description, safetyMode: safetyModeString } = req.body);
    } else if (req.method === 'GET') {
      ({ task_description, safetyMode: safetyModeString } = req.query);
    } else {
      return { error: 'Unsupported request method.' };
    }
    if (!task_description) return { error: 'Missing task_description in parameters.' };
    // safetyMode defaults to true if not 'false'. If undefined, it's true.
    const safetyMode = safetyModeString !== 'false';
    return { task_description, safetyMode };
}

const app = express();
app.use(cors());
app.use(express.json());

// Assign the named function to the route
app.get('/execute-autonomous-task', handleExecuteAutonomousTask); // Added for EventSource GET requests
app.post('/execute-autonomous-task', handleExecuteAutonomousTask);

app.post('/api/confirm-action/:confirmationId', async (req, res) => {
    const { confirmationId } = req.params;
    const { confirmed } = req.body;
    console.log(`[API /api/confirm-action/${confirmationId}] Received. User Confirmed: ${confirmed}`);

    const pendingConfirmation = pendingToolConfirmations[confirmationId];
    if (!pendingConfirmation) {
        return res.status(404).json({ message: 'Confirmation ID not found or already processed.' });
    }

    // Destructure with the corrected stored property name: agentRunConfigurable
    const {
        originalTaskDescription,
        agentRunConfigurable: originalAgentRunConfigurable,
        toolName,
        toolInput,
        safetyMode, // Retain safetyMode from original config if needed, or decide if it can change
        originalExpressHttpRes,
        sendSseMessage,
        overallExecutionLog,
        chatHistoryMessages, // These are the messages *before* the action that required confirmation
        activeAgentExecutor // This is the agentExecutor instance to reuse
    } = pendingConfirmation;

    if (!activeAgentExecutor) {
        console.error(`[API /api/confirm-action] CRITICAL: activeAgentExecutor not found for confirmationId ${confirmationId}. Cannot resume.`);
        sendSseMessage('error', { content: `Critical server error: Agent context lost for confirmation ${confirmationId}.` });
        if (originalExpressHttpRes.writable) originalExpressHttpRes.end();
        // Do not delete pendingConfirmation here, so it can be investigated.
        if (!res.headersSent) res.status(500).json({ message: 'Critical server error: Agent context lost.' });
        return;
    }

    // Use the retrieved activeAgentExecutor. The global agentExecutor variable is not used here.
    // The `initializeAgentExecutor()` call is removed.

    if (!originalExpressHttpRes || !originalExpressHttpRes.writable) {
        // If the original connection is lost, we can't send SSE updates.
        // The agent's action might proceed, but the client won't see it.
        console.warn(`[API /api/confirm-action] Original client connection lost for confirmationId ${confirmationId}. Proceeding without SSE updates.`);
        // We don't necessarily need to delete pendingToolConfirmations[confirmationId] here,
        // as the primary issue is the client connection, not the confirmation data itself.
        // However, to prevent re-processing if the client somehow retries on a new connection with the same ID,
        // it's safer to remove it.
        delete pendingToolConfirmations[confirmationId];
        // Respond to the current HTTP request, even if SSE is gone.
        // The status of this response depends on whether we want to indicate partial success.
        return res.status(202).json({ message: 'Action processed, but original client connection for SSE updates was lost.' });
    }

    delete pendingToolConfirmations[confirmationId]; // Processed, remove it.

    let agentInputTextForResume;
    const toolInputString = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput);

    // Construct the agent configuration for the resumed call.
    // It's crucial that this config is compatible with the `activeAgentExecutor`.
    // We are primarily adding `isConfirmedActionForTool` to the existing configurable context.
    let resumedAgentConfig = {
        configurable: {
            ...(originalAgentRunConfigurable || {}), // Spread properties from the initial agent run
            // Ensure these are correctly sourced for the resumed context
            safetyMode: safetyMode, // from pendingConfirmation
            originalExpressHttpRes: originalExpressHttpRes, // from pendingConfirmation
            sendSseMessage: sendSseMessage, // from pendingConfirmation
            overallExecutionLog: overallExecutionLog, // from pendingConfirmation
            originalTaskDescription: originalTaskDescription, // from pendingConfirmation
            agentExecutor: activeAgentExecutor, // Pass the active agentExecutor itself
            isConfirmedActionForTool: { // Specific to confirmation resumption
                [toolName]: { [toolInputString]: confirmed }
            }
        }
    };

    if (confirmed) {
        sendSseMessage('log_entry', { message: `[SSE Agent] User APPROVED action: ${toolName}. Resuming task.` });
        overallExecutionLog.push(`[Agent Confirmation] User APPROVED action: ${toolName}, Input: ${toolInputString}.`);
        agentInputTextForResume = `Observation: User has approved your proposed action: Tool='${toolName}' with Input='${toolInputString}'. Your original task was: '${originalTaskDescription}'. Please proceed with the task, using this approval.`;
    } else {
        sendSseMessage('log_entry', { message: `[SSE Agent] User DENIED action: ${toolName}. Informing agent.` });
        overallExecutionLog.push(`[Agent Confirmation] User DENIED action: ${toolName}, Input: ${toolInputString}.`);
        agentInputTextForResume = `Observation: User has denied your proposed action: Tool='${toolName}' with Input='${toolInputString}'. Do not retry this exact action. Your original task was: '${originalTaskDescription}'. You must now re-plan. Analyze why this action might have been denied and devise an alternative strategy. If you cannot find an alternative, explain why. Proceed with your new thought process.`;
    }

    let errorOccurredInResume = false;
    try {
        console.log(`[API /api/confirm-action] Re-invoking agent (ID: ${activeAgentExecutor.agent.constructor.name}) with input for memory: "${agentInputTextForResume.substring(0,100)}...", Config: ${JSON.stringify(resumedAgentConfig.configurable)}`);
        // Use the activeAgentExecutor for the stream call.
        // The `chat_history` is passed to the stream method. The agentExecutor's memory
        // should already contain this history, but explicitly passing it ensures the LLM
        // gets it if the specific agent implementation relies on it being in the call options.
        const eventStream = await activeAgentExecutor.stream({ input: agentInputTextForResume, chat_history: chatHistoryMessages }, resumedAgentConfig);
        for await (const event of eventStream) {
            const eventType = Object.keys(event)[0];
            const eventData = event[eventType];
            sendSseMessage('agent_event', { event_type: eventType, data: eventData });
            if (eventType === "on_agent_action") {
                sendSseMessage('log_entry', { message: `[SSE Agent] Action: ${eventData.tool} with input ${JSON.stringify(eventData.toolInput)}` });
                overallExecutionLog.push(`[Agent Action] Tool: ${eventData.tool}, Input: ${JSON.stringify(eventData.toolInput)}`);
            } else if (eventType === "on_tool_end") {
                sendSseMessage('log_entry', { message: `[SSE Agent] Tool ${eventData.tool} finished. Output (summary): ${String(eventData.output).substring(0, 200)}...` });
                overallExecutionLog.push(`[Agent Tool End] Tool: ${eventData.tool}, Output: ${String(eventData.output).substring(0,200)}...`);
            }
            else if (eventType === "on_chain_end" || eventType === "on_agent_finish") {
                const finalOutput = eventData.output || (eventData.outputs ? eventData.outputs.output : null) || (typeof eventData === 'string' ? eventData : JSON.stringify(eventData));
                sendSseMessage('log_entry', { message: `[SSE Agent] Final Output from resumed execution: ${finalOutput}` });
                overallExecutionLog.push(`[Agent Final Output (Resumed)] ${finalOutput}`);
                sendSseMessage('execution_complete', { message: 'Agent task execution finished after confirmation.', final_output: finalOutput, logSummary: overallExecutionLog });
                break;
            }
        }
        if (!res.headersSent) res.status(200).json({ message: `Action for ${confirmationId} processed. Agent re-invoked.` });
    } catch (error) {
        errorOccurredInResume = true;
        if (error instanceof ConfirmationRequiredError) {
            const { toolName: newToolName, toolInput: newToolInput, confirmationId: newConfirmationId, message: newConfirmationMessage } = error.data;
            // If a new confirmation is required, it's from the activeAgentExecutor
            const currentChatHistoryForNewConfirmation = await activeAgentExecutor.memory.chatHistory.getMessages();
            pendingToolConfirmations[newConfirmationId] = {
                originalTaskDescription, // from the initial task
                agentRunConfigurable: resumedAgentConfig.configurable, // use the latest config
                toolName: newToolName,
                toolInput: newToolInput,
                safetyMode: safetyMode, // from the original pendingConfirmation
                originalExpressHttpRes,
                sendSseMessage,
                overallExecutionLog, // from the original pendingConfirmation, but it has been updated
                chatHistoryMessages: currentChatHistoryForNewConfirmation,
                activeAgentExecutor: activeAgentExecutor, // Persist the same agent executor
            };
            sendSseMessage('confirmation_required', { confirmationId: newConfirmationId, toolName: newToolName, toolInput: newToolInput, message: newConfirmationMessage });
            if(!res.headersSent) res.status(202).json({ message: `Further confirmation required for ${newConfirmationId}.`});
            return;
        } else {
            console.error(`[API /api/confirm-action] Error during agent re-invocation for ${confirmationId}:`, error);
            sendSseMessage('error', { content: `Agent re-invocation error: ${error.message}` });
        }
        if (!res.headersSent) res.status(500).json({ message: 'Error during agent re-invocation.' });
    } finally {
        const isStillPending = Object.values(pendingToolConfirmations).some(p => p.originalExpressHttpRes === originalExpressHttpRes);
        if (originalExpressHttpRes.writable && !isStillPending) {
             if (errorOccurredInResume && ! (error instanceof ConfirmationRequiredError) ) {
                 sendSseMessage('execution_complete', { message: 'Task terminated due to agent execution error after confirmation.' });
            }
            originalExpressHttpRes.end();
        }
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/settings', (req, res) => res.json(backendSettings));
app.post('/api/settings', (req, res) => {
    const {
        llmProvider,
        apiKey,
        defaultOllamaModel,
        defaultOpenAIModel,
        OLLAMA_BASE_URL: newOllamaBaseUrl, // Renamed to avoid conflict with global
        componentDir,
        logDir,
        workspaceDir
    } = req.body;

    const newSettings = { ...backendSettings };

    if (llmProvider !== undefined) newSettings.llmProvider = llmProvider;
    if (apiKey !== undefined) newSettings.apiKey = apiKey; // This will also handle openaiApiKey implicitly if llmProvider is openai
    if (defaultOllamaModel !== undefined) newSettings.defaultOllamaModel = defaultOllamaModel;
    if (defaultOpenAIModel !== undefined) newSettings.defaultOpenAIModel = defaultOpenAIModel;
    if (newOllamaBaseUrl !== undefined) newSettings.OLLAMA_BASE_URL = newOllamaBaseUrl;
    if (componentDir !== undefined) newSettings.componentDir = componentDir;
    if (logDir !== undefined) newSettings.logDir = logDir;
    if (workspaceDir !== undefined) newSettings.workspaceDir = workspaceDir;

    try {
      fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(newSettings, null, 2), 'utf-8');
      backendSettings = newSettings;

      // If OLLAMA_BASE_URL was changed in settings, update the global variable
      if (newOllamaBaseUrl !== undefined && OLLAMA_BASE_URL !== newOllamaBaseUrl) {
        OLLAMA_BASE_URL = newOllamaBaseUrl;
        console.log(`[API /api/settings] Global OLLAMA_BASE_URL updated to: ${OLLAMA_BASE_URL}`);
        // Potentially re-initialize agent or other components that depend on OLLAMA_BASE_URL if needed immediately
        // For now, initializeAgentExecutor is called per task, so it will pick up the new URL.
      }

      res.json({ message: 'Settings updated successfully.', settings: backendSettings });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save settings.', details: error.message });
    }
});
app.post('/api/config/openai-key', (req, res) => {
    const { apiKey } = req.body;
    if (typeof apiKey !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid API key format.' });
    }
    const newSettings = { ...backendSettings, openaiApiKey: apiKey };
    try {
      fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(newSettings, null, 2), 'utf-8');
      backendSettings = newSettings;
      res.json({ success: true, message: 'OpenAI API Key saved successfully.' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to save OpenAI API Key.' });
    }
});

// Routes for explicit plan approval
app.post('/api/approve-plan/:planId', (req, res) => {
  const { planId } = req.params;
  const planContext = pendingPlans[planId];

  if (!planContext) {
    return res.status(404).json({ message: 'Plan not found or already processed.' });
  }

  const { sendSseMessage, resolve, overallExecutionLog, originalTaskDescription } = planContext;

  console.log(`[API /api/approve-plan] Plan ${planId} for task "${originalTaskDescription}" approved by user.`);
  overallExecutionLog.push(`[User Interaction] Plan ${planId} approved by user.`);

  if (sendSseMessage && typeof sendSseMessage === 'function') {
    sendSseMessage('plan_approved', { planId });
  } else {
    console.warn(`[API /api/approve-plan] sendSseMessage function not available for planId ${planId}. Client might not be notified via SSE.`);
  }

  if (resolve && typeof resolve === 'function') {
    resolve({ status: 'approved', planId });
  } else {
    console.error(`[API /api/approve-plan] Resolve function not available for planId ${planId}. Agent execution cannot be resumed.`);
    // Potentially send an error back via SSE if possible, or log this critical failure
    if (sendSseMessage && typeof sendSseMessage === 'function') {
        sendSseMessage('error', { content: `Critical error: Approval for plan ${planId} recorded, but agent resumption mechanism missing.` });
    }
  }

  delete pendingPlans[planId];
  res.json({ message: 'Plan approved and agent notified.' });
});

app.post('/api/decline-plan/:planId', (req, res) => {
  const { planId } = req.params;
  const planContext = pendingPlans[planId];

  if (!planContext) {
    return res.status(404).json({ message: 'Plan not found or already processed.' });
  }

  const { sendSseMessage, reject, overallExecutionLog, originalTaskDescription } = planContext;

  console.log(`[API /api/decline-plan] Plan ${planId} for task "${originalTaskDescription}" declined by user.`);
  overallExecutionLog.push(`[User Interaction] Plan ${planId} declined by user.`);


  if (sendSseMessage && typeof sendSseMessage === 'function') {
    sendSseMessage('plan_declined', { planId });
  } else {
    console.warn(`[API /api/decline-plan] sendSseMessage function not available for planId ${planId}. Client might not be notified via SSE.`);
  }

  if (reject && typeof reject === 'function') {
    reject(new Error(`Plan ${planId} declined by user.`));
    // Or using an object: reject({ status: 'declined', planId, reason: 'User declined' });
  } else {
    console.error(`[API /api/decline-plan] Reject function not available for planId ${planId}. Agent execution cannot be properly terminated or informed of declination.`);
    if (sendSseMessage && typeof sendSseMessage === 'function') {
        sendSseMessage('error', { content: `Critical error: Declination for plan ${planId} recorded, but agent rejection mechanism missing.` });
    }
  }

  delete pendingPlans[planId];
  res.json({ message: 'Plan declined and agent notified.' });
});
// End routes for explicit plan approval

// Routes for step failure recovery options
app.post('/api/retry-step/:failureId', (req, res) => {
  const { failureId } = req.params;
  const failureContext = pendingFailures[failureId];

  if (!failureContext) {
    return res.status(404).json({ message: 'Failure ID not found or already processed.' });
  }

  const { sendSseMessage, resolve, overallExecutionLog, originalTaskDescription, details } = failureContext;

  const logMessage = `[API /api/retry-step] User chose to RETRY step for failure ID: ${failureId}. Task: "${originalTaskDescription}". Failure Details: ${JSON.stringify(details)}`;
  console.log(logMessage);
  if (overallExecutionLog && Array.isArray(overallExecutionLog)) {
    overallExecutionLog.push(logMessage);
  }

  if (sendSseMessage && typeof sendSseMessage === 'function') {
    sendSseMessage('user_chose_retry', { failureId });
  } else {
    console.warn(`[API /api/retry-step] sendSseMessage function not available for failureId ${failureId}.`);
  }

  if (resolve && typeof resolve === 'function') {
    resolve({ action: 'retry', failureId });
  } else {
    console.error(`[API /api/retry-step] Resolve function not available for failureId ${failureId}. Agent cannot be notified to retry.`);
    // This is a server-side issue if resolve is missing, client already acted.
  }

  delete pendingFailures[failureId];
  res.json({ message: 'Retry action acknowledged. Agent notified.' });
});

app.post('/api/skip-step/:failureId', (req, res) => {
  const { failureId } = req.params;
  const failureContext = pendingFailures[failureId];

  if (!failureContext) {
    return res.status(404).json({ message: 'Failure ID not found or already processed.' });
  }

  const { sendSseMessage, resolve, overallExecutionLog, originalTaskDescription, details } = failureContext;

  const logMessage = `[API /api/skip-step] User chose to SKIP step for failure ID: ${failureId}. Task: "${originalTaskDescription}". Failure Details: ${JSON.stringify(details)}`;
  console.log(logMessage);
  if (overallExecutionLog && Array.isArray(overallExecutionLog)) {
    overallExecutionLog.push(logMessage);
  }

  if (sendSseMessage && typeof sendSseMessage === 'function') {
    sendSseMessage('user_chose_skip', { failureId });
  } else {
    console.warn(`[API /api/skip-step] sendSseMessage function not available for failureId ${failureId}.`);
  }

  if (resolve && typeof resolve === 'function') {
    resolve({ action: 'skip', failureId });
  } else {
    console.error(`[API /api/skip-step] Resolve function not available for failureId ${failureId}. Agent cannot be notified to skip.`);
  }

  delete pendingFailures[failureId];
  res.json({ message: 'Skip action acknowledged. Agent notified.' });
});

app.post('/api/convert-to-manual/:failureId', (req, res) => {
  const { failureId } = req.params;
  const failureContext = pendingFailures[failureId];

  if (!failureContext) {
    return res.status(404).json({ message: 'Failure ID not found or already processed.' });
  }

  const { sendSseMessage, resolve, overallExecutionLog, originalTaskDescription, details } = failureContext;

  const logMessage = `[API /api/convert-to-manual] User chose to CONVERT TO MANUAL for failure ID: ${failureId}. Task: "${originalTaskDescription}". Failure Details: ${JSON.stringify(details)}`;
  console.log(logMessage);
  if (overallExecutionLog && Array.isArray(overallExecutionLog)) {
    overallExecutionLog.push(logMessage);
  }

  if (sendSseMessage && typeof sendSseMessage === 'function') {
    sendSseMessage('user_chose_manual', { failureId });
  } else {
    console.warn(`[API /api/convert-to-manual] sendSseMessage function not available for failureId ${failureId}.`);
  }

  if (resolve && typeof resolve === 'function') {
    resolve({ action: 'manual', failureId });
  } else {
    console.error(`[API /api/convert-to-manual] Resolve function not available for failureId ${failureId}. Agent cannot be notified for manual conversion.`);
  }

  delete pendingFailures[failureId];
  res.json({ message: 'Manual conversion acknowledged. Agent notified.' });
});
// End routes for step failure recovery

app.get('/api/ollama-models/categorized', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      if (response.status === 404) { // Common if Ollama is running but /api/tags isn't found (less likely) or no models
         console.warn(`[API /ollama-models/categorized] Ollama API /api/tags not found or no models available. Status: ${response.status}`);
         // Return empty categories instead of 503, as Ollama *is* technically reachable
         return res.json({});
      }
      // For other errors (e.g. 500 from Ollama itself)
      const errorText = await response.text();
      console.error(`[API /ollama-models/categorized] Ollama API error: ${response.status} ${errorText}`);
      return res.status(response.status).json({ message: `Failed to fetch models from Ollama: ${errorText}` });
    }
    const ollamaData = await response.json();
    const localModels = ollamaData.models || [];

    const modelCategoriesConfigPath = path.join(__dirname, 'config', 'model_categories.json');
    let modelCategoriesConfig;
    try {
      const configFileContent = fs.readFileSync(modelCategoriesConfigPath, 'utf-8');
      modelCategoriesConfig = JSON.parse(configFileContent);
    } catch (err) {
      console.error(`[API /ollama-models/categorized] Error reading model_categories.json: ${err.message}`);
      return res.status(500).json({ message: "Error reading model categories configuration." });
    }

    const { categories: categoryKeywords, default_category: defaultCategory, static_models: staticModels } = modelCategoriesConfig;
    const categorized = {};

    // Initialize categories
    Object.keys(categoryKeywords).forEach(cat => categorized[cat] = []);
    if (defaultCategory && !categorized[defaultCategory]) {
        categorized[defaultCategory] = [];
    }
     // Add static models first (e.g. OpenAI models)
    if (staticModels && Array.isArray(staticModels)) {
        staticModels.forEach(model => {
            const category = model.category || defaultCategory;
            if (!categorized[category]) {
                categorized[category] = [];
            }
            categorized[category].push({
                id: model.id, // Ensure 'id' field is used
                name: model.name,
                details: model.details || {},
                type: model.type || 'static' // Add a type to distinguish
            });
        });
    }


    localModels.forEach(model => {
      let assignedCategory = null;
      const modelNameLower = model.name.toLowerCase();

      for (const category in categoryKeywords) {
        if (categoryKeywords[category].some(keyword => modelNameLower.includes(keyword.toLowerCase()))) {
          assignedCategory = category;
          break;
        }
      }
      if (!assignedCategory) {
        assignedCategory = defaultCategory;
      }

      if (!categorized[assignedCategory]) { // Should be initialized, but as a safeguard
        categorized[assignedCategory] = [];
      }
      categorized[assignedCategory].push({
        // Ollama's /api/tags returns 'name' (e.g., "codellama:7b") and 'model' (e.g., "codellama:7b")
        // The frontend expects 'id' and 'name'. We'll use Ollama's 'name' as 'id' for uniqueness
        // and 'name' as 'name' for display.
        id: model.name, // Use the full model name with tag as ID
        name: model.name, // Display name
        details: model.details || {}, // Include other details if needed
        modified_at: model.modified_at,
        size: model.size,
        type: 'ollama_local' // Add a type to distinguish
      });
    });

    // Remove empty categories unless they are 'static' categories that might be empty of local models
    // but contain static ones (like remote_chat)
    Object.keys(categorized).forEach(cat => {
        if (categorized[cat].length === 0 && !(staticModels && staticModels.some(sm => sm.category === cat))) {
            delete categorized[cat];
        }
    });

    res.json(categorized);

  } catch (error) {
    // This catch block handles errors like network issues (Ollama not running at all)
    // or issues within the try block itself (e.g., JSON parsing of config).
    console.error(`[API /ollama-models/categorized] Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      // If Ollama server is not running, return empty categories, as per frontend expectation for graceful degradation.
      // Also include static models if available and config is readable.
      console.warn(`[API /ollama-models/categorized] Ollama connection refused. Returning static models only (if any).`);
       const modelCategoriesConfigPath = path.join(__dirname, 'config', 'model_categories.json');
       const categorized = {};
       try {
           const configFileContent = fs.readFileSync(modelCategoriesConfigPath, 'utf-8');
           const { static_models: staticModelsFromConfig, default_category, categories: categoryKeywordsFromFile } = JSON.parse(configFileContent);

            // Initialize categories from config file to ensure all potential static categories are present
            if (categoryKeywordsFromFile) {
                Object.keys(categoryKeywordsFromFile).forEach(cat => categorized[cat] = []);
            }
            if (default_category && !categorized[default_category]) {
                categorized[default_category] = [];
            }

           if (staticModelsFromConfig && Array.isArray(staticModelsFromConfig)) {
               staticModelsFromConfig.forEach(model => {
                   const category = model.category || default_category;
                   if (!categorized[category]) {
                       categorized[category] = [];
                   }
                   categorized[category].push({
                       id: model.id,
                       name: model.name,
                       details: model.details || {},
                       type: model.type || 'static'
                   });
               });
           }
           // Remove categories that are still empty after adding static models
            Object.keys(categorized).forEach(cat => {
                if (categorized[cat].length === 0) {
                    delete categorized[cat];
                }
            });
       } catch (configError) {
           console.error(`[API /ollama-models/categorized] Error reading model_categories.json during ECONNREFUSED fallback: ${configError.message}`);
           // If config also fails, return truly empty
           return res.json({});
       }
       return res.json(categorized);
    }
    // For other types of errors (not ECONNREFUSED, not an Ollama API error handled above)
    return res.status(500).json({ message: `Internal server error: ${error.message}` });
  }
});

app.post('/api/ollama/pull-model', async (req, res) => {
  const { modelName } = req.body;

  if (!modelName) {
    return res.status(400).json({ message: 'Missing modelName in request body.' });
  }

  console.log(`[API /ollama/pull-model] Attempting to pull model: ${modelName}`);

  try {
    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      console.error(`[API /ollama/pull-model] Ollama API error when starting pull: ${ollamaResponse.status} ${errorText}`);
      // Try to parse errorText if it's JSON, otherwise send as plain text
      try {
        const errorJson = JSON.parse(errorText);
        return res.status(ollamaResponse.status).json(errorJson);
      } catch (e) {
        return res.status(ollamaResponse.status).json({ message: errorText });
      }
    }

    // Stream the response from Ollama back to the client
    // Set appropriate headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson'); // Or text/event-stream if formatting as SSE
    res.setHeader('Transfer-Encoding', 'chunked');

    ollamaResponse.body.pipe(res);

    ollamaResponse.body.on('error', (err) => {
      console.error('[API /ollama/pull-model] Error piping stream from Ollama:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming data from Ollama.' });
      } else if (res.writable) {
        // If headers already sent, try to write an error chunk if possible, then end.
        res.write(JSON.stringify({ error: 'Stream pipe error', details: err.message }) + '\n');
        res.end();
      }
    });

    ollamaResponse.body.on('end', () => {
      console.log(`[API /ollama/pull-model] Stream ended for model: ${modelName}`);
      if (!res.writableEnded) {
        res.end();
      }
    });

  } catch (error) {
    console.error(`[API /ollama/pull-model] General error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'Ollama server is not reachable.' });
    }
    if (!res.headersSent) {
      return res.status(500).json({ message: `Internal server error: ${error.message}` });
    } else if (res.writable) {
      res.write(JSON.stringify({ error: 'General error', details: error.message }) + '\n');
      res.end();
    }
  }
});

// --- Ollama Management API ---
app.get('/api/ollama/ping', async (req, res) => {
  const currentOllamaBaseUrl = OLLAMA_BASE_URL; // Use the global, potentially updated OLLAMA_BASE_URL
  try {
    // Using /api/tags as a lightweight check. Could also be '/' if server responds on base.
    // Set a timeout for the request, e.g., 5 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${currentOllamaBaseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      res.json({
        status: "success",
        message: "Ollama connection successful.",
        url: currentOllamaBaseUrl,
        details: `Responded with status ${response.status}`
      });
    } else {
      res.status(response.status).json({ // Propagate Ollama's error status if possible
        status: "error",
        message: "Ollama server responded with an error.",
        url: currentOllamaBaseUrl,
        details: `Status: ${response.status} - ${response.statusText}`
      });
    }
  } catch (error) {
    if (error.name === 'AbortError') {
        return res.status(504).json({
            status: "error",
            message: "Failed to connect to Ollama: Request timed out.",
            url: currentOllamaBaseUrl,
            details: error.message
        });
    }
    // Handle network errors (e.g., ECONNREFUSED) or other fetch issues
    res.status(500).json({
      status: "error",
      message: "Failed to connect to Ollama. Check URL and ensure Ollama is running.",
      url: currentOllamaBaseUrl,
      details: error.message
    });
  }
});


// --- Agent Instructions API ---
// GET /api/instructions/:agentType or /api/instructions
app.get('/api/instructions/:agentType?', (req, res) => {
  const { agentType } = req.params;
  try {
    if (!fs.existsSync(AGENT_INSTRUCTIONS_FILE_PATH)) {
      // If file doesn't exist, create it with empty JSON
      fs.writeFileSync(AGENT_INSTRUCTIONS_FILE_PATH, JSON.stringify({}, null, 2), 'utf-8');
      console.log(`[API GET /instructions] Created empty agent instructions file at ${AGENT_INSTRUCTIONS_FILE_PATH}`);
      return res.json({}); // Return empty object as it's newly created
    }

    const fileContent = fs.readFileSync(AGENT_INSTRUCTIONS_FILE_PATH, 'utf-8');
    const instructions = JSON.parse(fileContent);

    if (agentType && agentType.toLowerCase() !== 'all') {
      if (instructions.hasOwnProperty(agentType)) {
        res.json({ [agentType]: instructions[agentType] });
      } else {
        res.status(404).json({ message: `Instructions for agent type '${agentType}' not found.` });
      }
    } else {
      // Return all instructions if agentType is 'all' or not provided
      res.json(instructions);
    }
  } catch (error) {
    console.error(`[API GET /instructions] Error:`, error);
    res.status(500).json({ message: 'Error loading agent instructions.', details: error.message });
  }
});

// POST /api/instructions/:agentType
app.post('/api/instructions/:agentType', (req, res) => {
  const { agentType } = req.params;
  const { instructions: newInstructionText } = req.body;

  if (typeof newInstructionText !== 'string') {
    return res.status(400).json({ message: 'Invalid or missing instructions in request body. Expected a string in "instructions" field.' });
  }
  if (!agentType || agentType.toLowerCase() === 'all') {
    return res.status(400).json({ message: 'Agent type must be specified and cannot be "all" for updates.' });
  }

  try {
    let allInstructions = {};
    if (fs.existsSync(AGENT_INSTRUCTIONS_FILE_PATH)) {
      const fileContent = fs.readFileSync(AGENT_INSTRUCTIONS_FILE_PATH, 'utf-8');
      allInstructions = JSON.parse(fileContent);
    } else {
      // If file doesn't exist, we'll create it with this new instruction
      console.log(`[API POST /instructions] Agent instructions file not found at ${AGENT_INSTRUCTIONS_FILE_PATH}. It will be created.`);
    }

    allInstructions[agentType] = newInstructionText; // Add or update the instruction for the agentType

    fs.writeFileSync(AGENT_INSTRUCTIONS_FILE_PATH, JSON.stringify(allInstructions, null, 2), 'utf-8');

    res.json({
      message: `Instructions for agent type '${agentType}' updated successfully.`,
      agentType,
      instructions: newInstructionText,
    });
  } catch (error) {
    console.error(`[API POST /instructions] Error saving for agent type '${agentType}':`, error);
    res.status(500).json({ message: `Error saving instructions for agent type '${agentType}'.`, details: error.message });
  }
});
// --- End Agent Instructions API ---


// GET instructions for a specific conference agent role
app.get('/api/instructions/conference_agent/:agentRole', (req, res) => {
  try {
    const instructions = loadConferenceInstructions();
    const { agentRole } = req.params;

    if (instructions.hasOwnProperty(agentRole)) {
      res.json({ agentRole, instructions: instructions[agentRole] });
    } else {
      res.status(404).json({ message: `Instructions for agent role '${agentRole}' not found.` });
    }
  } catch (error) {
    // This catch is for unexpected errors during the process, though loadConferenceInstructions handles its own file errors.
    console.error(`[API GET /instructions/conference_agent/:agentRole] Error:`, error);
    res.status(500).json({ message: 'Error loading conference agent instructions.' });
  }
});

// POST (update) instructions for a specific conference agent role
app.post('/api/instructions/conference_agent/:agentRole', (req, res) => {
  const { agentRole } = req.params;
  const newInstructionText = req.body.instructions; // Ensure client sends { "instructions": "..." }

  if (typeof newInstructionText !== 'string' ) {
    return res.status(400).json({ message: 'Invalid or missing instructions in request body. Expected a string in "instructions" field.' });
  }

  try {
    const instructions = loadConferenceInstructions();
    instructions[agentRole] = newInstructionText; // Add or update the instruction for the role
    saveConferenceInstructions(instructions); // This will throw on actual write error

    res.json({
      message: `Instructions for agent role '${agentRole}' updated successfully.`,
      agentRole,
      instructions: newInstructionText,
    });
  } catch (error) {
    // Catches errors from saveConferenceInstructions or any other unexpected issue
    console.error(`[API POST /instructions/conference_agent/:agentRole] Error saving for role '${agentRole}':`, error);
    res.status(500).json({ message: `Error saving instructions for agent role '${agentRole}'.`, details: error.message });
  }
});

app.post('/execute-conference-task', async (req, res) => {
    console.warn("[Deprecated Endpoint] /execute-conference-task was called. Use agent with 'multi_model_debate' tool instead.");
    res.status(501).json({ message: "This endpoint is deprecated. Please use the agent with the 'multi_model_debate' tool."});
});

async function checkOllamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`); // Simple check, /api/tags is common
    if (response.ok) {
      console.log('[Ollama Status] Ollama is responsive.');
      return true;
    } else {
      console.warn(`[Ollama Status] Ollama responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.warn('[Ollama Status] Ollama connection refused. Server likely not running.');
    } else {
      console.error(`[Ollama Status] Error checking Ollama status: ${error.message}`);
    }
    return false;
  }
}

// startOllama function is removed as per cleanup plan.

function attemptToListen(port) {
    console.log(`[BACKEND SERVER ATTEMPT] Attempting to listen on port: ${port}`);
    app.listen(port, () => {
        console.log(`[BACKEND SERVER SUCCESS] Successfully listening on port: ${port}. PID: ${process.pid}`);
        // Send the port to the parent process (Electron main) if running as a child process
        if (process.send) {
            process.send({ type: 'backend-port', port: port });
        }
    }).on('error', (err) => {
        console.error(`[BACKEND SERVER ERROR] Failed to listen on port: ${port}. Error: ${err}. PID: ${process.pid}`);
        // If Electron is the parent, it will handle the exit. Otherwise, exit directly.
        if (!process.send) {
             process.exit(1);
        } else {
            // Optionally, send an error message to Electron main process
            process.send({ type: 'backend-error', error: err.message });
            // Electron main process should decide to exit the app
        }
    });
}

async function main() {
  try {
    console.log('[Server Startup] Checking Ollama status...');
    const ollamaReady = await checkOllamaStatus();

    if (!ollamaReady) {
      console.warn('[Server Startup] WARNING: Ollama is not running or not responsive. Backend will start, but Ollama-dependent features will not work.');
    } else {
      console.log('[Server Startup] Ollama reported as operational.');
    }

    // Initialize agentExecutor once at startup.
    // If memory needs to be request-scoped and fresh for each /execute-autonomous-task,
    // then agentExecutor (or at least its memory) should be created within that handler.
    // For now, global agentExecutor with memory that clears per top-level .stream() call.
    // UPDATE: Changed initializeAgentExecutor to be called per task in handleExecuteAutonomousTask
    // await initializeAgentExecutor();
    // console.log('[Server Startup] AgentExecutor initialized.');

    // In ESM, require.main === module check is different.
    // A common way is to check if the script is run directly.
    // For simplicity, we'll assume server.js is always meant to run directly if executed with node.
    // If this script is imported elsewhere, main() would need to be explicitly called by the importer.
    const initialPort = parseInt(process.env.PORT || '3030', 10);
    attemptToListen(initialPort);

  } catch (err) {
    console.error('[Server Startup IIFE] Error during server startup:', err);
    process.exit(1); // Exit if main startup fails
  }
}

main();

// Exporting necessary components for potential testing or external use
export {
  app,
  backendSettings,
  loadBackendConfig,
  handleExecuteAutonomousTask,
  generateFromLocal,
  requestPlanApproval,
  requestUserActionOnStepFailure,
  pendingPlans,
  pendingFailures
};

export default app; // Default export for convenience if primary export is the app
