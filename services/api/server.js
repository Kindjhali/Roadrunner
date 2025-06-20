import path from 'path';
import { fileURLToPath } from 'url';

const __filename2 = typeof __filename !== 'undefined' ? __filename : fileURLToPath(eval('import.meta.url'));
const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : path.dirname(__filename2);

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
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { parseLogFile } from '../../viewlog.js';
// Reuse the existing ReACT parser from the frontend to avoid duplicate logic
import { parseReactPrompt } from '../../apps/renderer/composables/parseReactPrompt.js';

let OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'; // Changed to let

// Langchain imports
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { AgentExecutor, createOpenAIFunctionsAgent, createReactAgent } from "langchain/agents"; // Reverting to specific path
import { ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from '@langchain/core/prompts';
// renderTextDescription is not directly used, but as part of agent creation - assuming it's pulled in by agents if needed.
// import { renderTextDescription } from "@langchain/core/tools";



// LangChain conversational memory
import { BufferWindowMemory } from "langchain/memory";


import { ListDirectoryTool, CreateFileTool, ReadFileTool, UpdateFileTool, DeleteFileTool, CreateDirectoryTool, DeleteDirectoryTool } from './langchain_tools/fs_tools.js';
import { GitAddTool, GitCommitTool, GitPushTool, GitPullTool, GitRevertTool } from './langchain_tools/git_tools.js';
import { CodeGeneratorTool } from './langchain_tools/code_generator_tool.js';
import { ConferenceTool } from './langchain_tools/conference_tool.js';
import { ProposePlanTool, RequestUserActionOnFailureTool } from './langchain_tools/planning_tools.js';
import { reloadDefaultConfig } from './fsAgent.js';
import { ConfirmationRequiredError } from './langchain_tools/common.js';
import './registerAgents.js';
import { getAgent } from './AgentRegistry.js';

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
Assistant has access to the following tools: {tool_names}

Use these tools when necessary. Each tool description provides information on how to use it, including the expected input format (e.g., direct string or JSON string) and an example:

{tools}

The tool names are: {tool_names}

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


async function initializeAgentExecutor(customModel = null) {
  console.log("[Agent Init] Initializing AgentExecutor...");
  const llmProvider = backendSettings.llmProvider;
  let llm;

  // Use configuration settings for memory
  const memoryWindowSize = backendSettings.langchain?.enableMemory ? 
    (backendSettings.langchain?.memoryWindowSize || 5) : 0;
  
  const memory = new BufferWindowMemory({
    k: memoryWindowSize,
    memoryKey: "chat_history",
    inputKey: "input",
    returnMessages: true
  });
  console.log(`[Agent Init] BufferWindowMemory initialized with window size: ${memoryWindowSize}`);

  // Get model parameters from configuration
  const temperature = backendSettings.modelParams?.temperature !== undefined ? 
    backendSettings.modelParams.temperature : 0.7;
  const maxTokens = backendSettings.modelParams?.maxTokens || 2048;
  const topP = backendSettings.modelParams?.topP !== undefined ? 
    backendSettings.modelParams.topP : 0.9;

  console.log(`[Agent Init] Using model parameters - Temperature: ${temperature}, MaxTokens: ${maxTokens}, TopP: ${topP}`);

  if (llmProvider === 'openai') {
    const effectiveOpenAIApiKey = backendSettings.apiKey || backendSettings.openaiApiKey;
    const openAIModelName = customModel || backendSettings.defaultOpenAIModel || 'gpt-4-turbo';
    if (!effectiveOpenAIApiKey) {
      console.error("[Agent Init] OpenAI API key is missing. OpenAI agent will not be functional.");
      llm = new ChatOpenAI({ 
        apiKey: effectiveOpenAIApiKey, 
        modelName: openAIModelName, 
        streaming: true, 
        temperature: temperature,
        maxTokens: maxTokens,
        topP: topP
      });
    } else {
       llm = new ChatOpenAI({ 
         apiKey: effectiveOpenAIApiKey, 
         modelName: openAIModelName, 
         streaming: true, 
         temperature: temperature,
         maxTokens: maxTokens,
         topP: topP
       });
       console.log(`[Agent Init] OpenAI LLM created with model ${openAIModelName}.`);
    }
    
    // Use custom system prompt if configured
    const systemPrompt = backendSettings.prompts?.systemPrompt || 
      "You are a helpful assistant. Use the provided tools to answer the user's questions. Respond with a tool call if appropriate, otherwise respond to the user directly.";
    
    const customPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"],
    ]);
    
    agent = await createOpenAIFunctionsAgent({ llm, tools, prompt: customPrompt });
    console.log("[Agent Init] OpenAI Functions Agent created successfully with custom configuration.");
  } else {
    const ollamaModelName = customModel || backendSettings.defaultOllamaModel || 'llama3';
    console.log(`[Agent Init] Ollama provider selected. Model: ${ollamaModelName}${customModel ? ' (custom)' : ' (default)'}`);
    llm = new ChatOllama({ 
      baseUrl: OLLAMA_BASE_URL, 
      model: ollamaModelName, 
      temperature: temperature,
      // Note: Ollama doesn't support maxTokens and topP in the same way as OpenAI
      // but we can pass them and let the model handle what it supports
    });
    console.log(`[Agent Init] ChatOllama LLM created with model ${ollamaModelName}.`);

    // Use custom system prompt if configured
    const systemPrompt = backendSettings.prompts?.systemPrompt || 
      "Assistant is a large language model designed to be able to assist with a wide range of tasks.";
    
    // Construct the prompt template for ReAct agent with custom system prompt
    const customReactPromptText = `${systemPrompt}

TOOLS:
------
Assistant has access to the following tools: {tool_names}

Use these tools when necessary. Each tool description provides information on how to use it, including the expected input format (e.g., direct string or JSON string) and an example:

{tools}

The tool names are: {tool_names}

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

    const reactPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          customReactPromptText.substring(0, customReactPromptText.indexOf("NOW BEGIN!"))
        ),
        new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate(
          customReactPromptText.substring(
            customReactPromptText.indexOf("NEW USER INPUT:")
          )
        ),
    ]);
    console.log('[DEBUG] reactPrompt inputVariables:', JSON.stringify(reactPrompt.inputVariables));
    agent = await createReactAgent({ llm, tools, prompt: reactPrompt });
    console.log("[Agent Init] Ollama ReAct Agent created successfully with custom configuration.");
  }

  // Use configuration settings for agent executor
  const maxIterations = backendSettings.agent?.maxIterations || 15;
  const verbose = backendSettings.agent?.enableVerbose !== undefined ? 
    backendSettings.agent.enableVerbose : true;

  console.log(`[Agent Init] Using agent settings - MaxIterations: ${maxIterations}, Verbose: ${verbose}`);

  agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
    returnIntermediateSteps: true,
    maxIterations: maxIterations,
    verbose: verbose,
    // handleParsingErrors: true,
  });
  console.log("[Agent Init] AgentExecutor created with custom configuration and memory.");
}

const BACKEND_CONFIG_FILE_PATH = path.join(__dirname2, 'config', 'backend_config.json');
let backendSettings = {
  llmProvider: process.env.RR_LLM_PROVIDER || 'ollama',
  apiKey: process.env.RR_API_KEY || '',
  defaultOllamaModel: process.env.RR_DEFAULT_OLLAMA_MODEL || 'codellama',
  defaultOpenAIModel: process.env.RR_DEFAULT_OPENAI_MODEL || 'gpt-4',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  componentDir: process.env.RR_COMPONENT_DIR || path.resolve(__dirname2, '../../tokomakAI/src/components'),
  logDir: process.env.RR_LOG_DIR || path.resolve(__dirname2, '../../logs'),
  workspaceDir: process.env.RR_WORKSPACE_DIR || path.resolve(__dirname2, '../../output')
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
        const examplePath = path.join(__dirname2, 'config', 'backend_config.example.json');
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

const CONFERENCE_INSTRUCTIONS_FILE_PATH = process.env.TEST_CONFERENCE_INSTRUCTIONS_PATH || path.join(__dirname2, 'config', 'conference_agent_instructions.json');
const AGENT_INSTRUCTIONS_FILE_PATH = path.join(__dirname2, 'config', 'agent_instructions_template.json');

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

    let { task_description, safetyMode, model } = payload;
    console.log(`[Agent Handling] Received task. Goal: "${task_description.substring(0, 100)}...", Safety Mode from payload: ${safetyMode}, Model: ${model || 'default'}`);

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
        await initializeAgentExecutor(model);
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
        llm: { model: model || backendSettings.defaultOllamaModel }, // Pass the model to tools
        llmProvider: backendSettings.llmProvider, // Pass the LLM provider to tools
      }
    };

    let errorOccurred = false;
    let lastError = null;
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
        lastError = error;
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
            if (errorOccurred && ! (lastError instanceof ConfirmationRequiredError) ) {
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

const LOG_DIR_DEFAULT = path.resolve(__dirname2, '../../logs');
const WORKSPACE_DIR_DEFAULT = path.resolve(__dirname2, '../../output');
const LOG_DIR = fs.existsSync(path.join(__dirname2, 'config/backend_config.json')) ? (JSON.parse(fs.readFileSync(path.join(__dirname2, 'config/backend_config.json'), 'utf-8')).logDir || LOG_DIR_DEFAULT) : LOG_DIR_DEFAULT;
const WORKSPACE_DIR = fs.existsSync(path.join(__dirname2, 'config/backend_config.json')) ? (JSON.parse(fs.readFileSync(path.join(__dirname2, 'config/backend_config.json'), 'utf-8')).workspaceDir || WORKSPACE_DIR_DEFAULT) : WORKSPACE_DIR_DEFAULT;

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

    // Get model parameters from configuration
    const temperature = backendSettings.modelParams?.temperature !== undefined ? 
      backendSettings.modelParams.temperature : 0.7;
    const maxTokens = backendSettings.modelParams?.maxTokens || 2048;
    const topP = backendSettings.modelParams?.topP !== undefined ? 
      backendSettings.modelParams.topP : 0.9;

    console.log(`\n=== LLM GENERATION START ===`);
    console.log(`[LLM Generation] Provider: ${provider || 'ollama (default)'}`);
    console.log(`[LLM Generation] Model: ${modelName}`);
    console.log(`[LLM Generation] Ollama URL: ${OLLAMA_BASE_URL}`);
    console.log(`[LLM Generation] Model Parameters - Temperature: ${temperature}, MaxTokens: ${maxTokens}, TopP: ${topP}`);
    console.log(`[LLM Generation] Prompt length: ${finalPrompt.length} characters`);
    console.log(`[LLM Generation] Full prompt:\n"${finalPrompt}"`);
    console.log(`[LLM Generation] Initializing LLM connection...`);

    let llm;
    if (provider === 'openai') {
      const effectiveOpenAIApiKey = backendSettings.apiKey || backendSettings.openaiApiKey;
      const openAIModelToUse = modelName || backendSettings.defaultOpenAIModel || 'gpt-3.5-turbo';
      if (!effectiveOpenAIApiKey) {
        const errorMessage = 'OpenAI API key is missing.';
        console.log(`[LLM Generation] ERROR: ${errorMessage}`);
        if (expressRes && expressRes.writable) expressRes.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
        return `// LLM_ERROR: ${errorMessage} //`;
      }
      llm = new ChatOpenAI({ 
        apiKey: effectiveOpenAIApiKey, 
        modelName: openAIModelToUse, 
        streaming: true,
        temperature: temperature,
        maxTokens: maxTokens,
        topP: topP
      });
      console.log(`[LLM Generation] OpenAI LLM initialized with model: ${openAIModelToUse} and custom parameters`);
    } else {
      const ollamaModelToUse = modelName || backendSettings.defaultOllamaModel || 'codellama';
      console.log(`[LLM Generation] Creating ChatOllama instance...`);
      console.log(`[LLM Generation] - Base URL: ${OLLAMA_BASE_URL}`);
      console.log(`[LLM Generation] - Model: ${ollamaModelToUse}`);
      llm = new ChatOllama({ 
        baseUrl: OLLAMA_BASE_URL, 
        model: ollamaModelToUse,
        temperature: temperature
        // Note: Ollama doesn't support maxTokens and topP in the same way as OpenAI
      });
      console.log(`[LLM Generation] Ollama LLM initialized successfully with custom parameters`);
    }

    try {
      console.log(`[LLM Generation] Starting streaming request to model...`);
      const stream = await llm.stream([new HumanMessage(finalPrompt)]);
      console.log(`[LLM Generation] Stream established, processing chunks...`);
      
      let chunkCount = 0;
      for await (const chunk of stream) {
        chunkCount++;
        if (chunk && chunk.content) {
          const contentChunk = chunk.content;
          accumulatedResponse += contentChunk;
          console.log(`[LLM Generation] Chunk ${chunkCount}: "${contentChunk}"`);
          
          if (expressRes && expressRes.writable) {
            const ssePayload = { type: 'llm_chunk', content: contentChunk };
            if (options.speakerContext) ssePayload.speaker = options.speakerContext;
            expressRes.write(`data: ${JSON.stringify(ssePayload)}\n\n`);
          }
        }
      }
      
      console.log(`[LLM Generation] Stream completed. Total chunks: ${chunkCount}`);
      console.log(`[LLM Generation] Final response length: ${accumulatedResponse.length} characters`);
      console.log(`[LLM Generation] Final response:\n"${accumulatedResponse}"`);
      console.log(`=== LLM GENERATION END ===\n`);
      
      return accumulatedResponse;
    } catch (error) {
      const errorMessage = `Error with ${provider} via Langchain: ${error.message}`;
      console.log(`[LLM Generation] ERROR: ${errorMessage}`);
      console.log(`[LLM Generation] Error stack: ${error.stack}`);
      console.log(`=== LLM GENERATION FAILED ===\n`);
      
      if (expressRes && expressRes.writable) expressRes.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
      return `// LLM_ERROR: ${errorMessage} //`;
    }
}

function parseTaskPayload(req) {
    let task_description, safetyModeString, model;
    if (req.method === 'POST') {
      ({ task_description, safetyMode: safetyModeString, model } = req.body);
    } else if (req.method === 'GET') {
      ({ task_description, safetyMode: safetyModeString, model } = req.query);
    } else {
      return { error: 'Unsupported request method.' };
    }
    if (!task_description) return { error: 'Missing task_description in parameters.' };
    // safetyMode defaults to true if not 'false'. If undefined, it's true.
    const safetyMode = safetyModeString !== 'false';
    return { task_description, safetyMode, model };
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
    let lastResumeError = null;
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
        lastResumeError = error;
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
             if (errorOccurredInResume && ! (lastResumeError instanceof ConfirmationRequiredError) ) {
                 sendSseMessage('execution_complete', { message: 'Task terminated due to agent execution error after confirmation.' });
            }
            originalExpressHttpRes.end();
        }
    }
});

// ===== COMPREHENSIVE API ENDPOINTS FOR ALL MODULES =====

// Basic health and status endpoints
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/status', async (req, res) => {
  try {
    // Check Ollama connection and get model count
    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    const modelCount = ollamaResponse.ok ? (await ollamaResponse.json()).models?.length || 0 : 0;
    
    res.json({ 
      status: 'ok', 
      ollama: OLLAMA_BASE_URL,
      models: modelCount,
      version: '1.0.0',
      backend: 'connected'
    });
  } catch (error) {
    res.json({ 
      status: 'ok', 
      ollama: OLLAMA_BASE_URL,
      models: 0,
      version: '1.0.0',
      backend: 'connected',
      ollamaError: error.message
    });
  }
});

// ===== BRAINSTORMING MODULE API =====
app.post('/api/brainstorming/start', async (req, res) => {
  const { topic, model, agents, maxIdeas } = req.body;
  
  console.log(`[API /api/brainstorming/start] Starting brainstorming session: ${topic}`);
  
  try {
    const brainstormingPrompt = `Generate ${maxIdeas || 3} creative and practical ideas for: "${topic}". 
    
    For each idea, provide:
    1. A clear, actionable description
    2. A feasibility score (1-100)
    3. A category (e.g., "Technical", "Creative", "Business", "User Experience")
    
    Format your response as a JSON array of objects with properties: content, score, category.`;
    
    const selectedModel = model || backendSettings.defaultOllamaModel || 'codellama';
    
    // Generate ideas using the LLM
    const ideaResponse = await generateFromLocal(brainstormingPrompt, selectedModel, null, {
      llmProvider: backendSettings.llmProvider
    });
    
    console.log('[API /api/brainstorming/start] Raw LLM response:', ideaResponse);
    
    // Use the raw response directly from your Ollama model
    const ideas = [{
      content: ideaResponse.trim(),
      score: 100,
      category: "Real AI Response",
      model: selectedModel,
      timestamp: new Date().toISOString()
    }];
    
    res.json({
      success: true,
      ideas: ideas,
      topic: topic,
      model: selectedModel,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API /api/brainstorming/start] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      ideas: []
    });
  }
});

// Add the missing agent-response endpoint that BrainstormingService needs
app.post('/api/brainstorming/agent-response', async (req, res) => {
  const { prompt, modelId } = req.body;
  
  console.log(`[API /api/brainstorming/agent-response] Getting agent response for model: ${modelId}`);
  
  try {
    const selectedModel = modelId || backendSettings.defaultOllamaModel || 'codellama';
    
    // Generate response using the LLM
    const agentResponse = await generateFromLocal(prompt, selectedModel, null, {
      llmProvider: backendSettings.llmProvider
    });
    
    res.json({
      content: agentResponse.trim(),
      tokensUsed: agentResponse.length, // Approximate
      responseTime: 1000 // Placeholder
    });
    
  } catch (error) {
    console.error('[API /api/brainstorming/agent-response] Error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ===== PLANNING MODULE API =====
app.post('/api/planning/create', async (req, res) => {
  const { name, description, steps, model } = req.body;
  
  console.log(`[API /api/planning/create] Creating plan: ${name}`);
  
  try {
    const planningPrompt = `Create a detailed execution plan for: "${description}".
    
    Break this down into specific, actionable steps. For each step, provide:
    1. A clear title
    2. Detailed description of what needs to be done
    3. Estimated time (in minutes)
    4. Dependencies (if any)
    5. Required tools or resources
    
    Format as JSON array of step objects with properties: title, description, estimatedTime, dependencies, tools.`;
    
    const selectedModel = model || backendSettings.defaultOllamaModel || 'codellama';
    const planResponse = await generateFromLocal(planningPrompt, selectedModel, null, {
      llmProvider: backendSettings.llmProvider
    });
    
    // Use raw response directly - NO FALLBACK DATA
    const planSteps = [{
      title: "AI Generated Plan",
      description: planResponse.trim(),
      estimatedTime: 0,
      dependencies: [],
      tools: []
    }];
    
    const plan = {
      id: Date.now().toString(),
      name: name,
      description: description,
      steps: planSteps,
      model: selectedModel,
      created: new Date().toISOString(),
      status: 'draft'
    };
    
    res.json({
      success: true,
      plan: plan
    });
    
  } catch (error) {
    console.error('[API /api/planning/create] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/planning/execute', async (req, res) => {
  const { planId, plan } = req.body;
  
  console.log(`[API /api/planning/execute] Executing plan: ${planId}`);
  
  try {
    // Simulate plan execution with progress updates
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const steps = plan.steps || [];
    let completedSteps = 0;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Send step start event
      res.write(`data: ${JSON.stringify({
        type: 'step_start',
        step: step,
        progress: Math.round((i / steps.length) * 100)
      })}\n\n`);
      
      // Simulate step execution time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      completedSteps++;
      
      // Send step complete event
      res.write(`data: ${JSON.stringify({
        type: 'step_complete',
        step: step,
        progress: Math.round((completedSteps / steps.length) * 100)
      })}\n\n`);
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'execution_complete',
      planId: planId,
      completedSteps: completedSteps,
      totalSteps: steps.length
    })}\n\n`);
    
    res.end();
    
  } catch (error) {
    console.error('[API /api/planning/execute] Error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

// Additional Planning APIs
const savedPlans = new Map();

app.get('/api/planning/templates', (req, res) => {
  console.log(`[API /api/planning/templates] Getting step templates`);
  
  const templates = [
    {
      id: 'generate_code',
      name: 'Generate Code',
      description: 'Generate code using AI',
      parameters: ['prompt', 'language', 'framework'],
      estimatedTime: 30000
    },
    {
      id: 'write_file',
      name: 'Write File',
      description: 'Write content to a file',
      parameters: ['path', 'content'],
      estimatedTime: 5000
    },
    {
      id: 'run_command',
      name: 'Run Command',
      description: 'Execute a shell command',
      parameters: ['command', 'workingDir'],
      estimatedTime: 10000
    },
    {
      id: 'api_call',
      name: 'API Call',
      description: 'Make an HTTP API call',
      parameters: ['url', 'method', 'data'],
      estimatedTime: 15000
    }
  ];
  
  res.json({
    success: true,
    templates: templates
  });
});

app.post('/api/planning/validate', async (req, res) => {
  const { plan } = req.body;
  
  console.log(`[API /api/planning/validate] Validating plan: ${plan.name}`);
  
  try {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    // Basic validation
    if (!plan.name) {
      validation.errors.push('Plan name is required');
      validation.isValid = false;
    }
    
    if (!plan.steps || plan.steps.length === 0) {
      validation.errors.push('Plan must have at least one step');
      validation.isValid = false;
    }
    
    // Validate steps
    plan.steps?.forEach((step, index) => {
      if (!step.title) {
        validation.errors.push(`Step ${index + 1} is missing a title`);
        validation.isValid = false;
      }
      
      if (!step.type) {
        validation.warnings.push(`Step ${index + 1} has no type specified`);
      }
      
      if (step.estimatedTime && step.estimatedTime > 300000) {
        validation.warnings.push(`Step ${index + 1} has a very long estimated time`);
      }
    });
    
    // Add suggestions
    if (plan.steps?.length > 10) {
      validation.suggestions.push('Consider breaking this plan into smaller sub-plans');
    }
    
    res.json({
      success: true,
      validation: validation
    });
    
  } catch (error) {
    console.error('[API /api/planning/validate] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/planning/save', async (req, res) => {
  const { plan } = req.body;
  
  console.log(`[API /api/planning/save] Saving plan: ${plan.name}`);
  
  try {
    const planId = plan.id || uuidv4();
    const savedPlan = {
      ...plan,
      id: planId,
      saved: new Date().toISOString(),
      version: (plan.version || 0) + 1
    };
    
    savedPlans.set(planId, savedPlan);
    
    res.json({
      success: true,
      plan: savedPlan
    });
    
  } catch (error) {
    console.error('[API /api/planning/save] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/planning/plans', (req, res) => {
  console.log(`[API /api/planning/plans] Getting all saved plans`);
  
  const plans = Array.from(savedPlans.values());
  
  res.json({
    success: true,
    plans: plans
  });
});

app.delete('/api/planning/plan/:id', (req, res) => {
  const { id } = req.params;
  
  console.log(`[API /api/planning/plan] Deleting plan: ${id}`);
  
  const deleted = savedPlans.delete(id);
  
  res.json({
    success: deleted,
    message: deleted ? 'Plan deleted' : 'Plan not found'
  });
});

app.post('/api/planning/export', async (req, res) => {
  const { planId, format } = req.body;
  
  console.log(`[API /api/planning/export] Exporting plan ${planId} as ${format}`);
  
  try {
    const plan = savedPlans.get(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }
    
    let exportData;
    
    switch (format) {
      case 'json':
        exportData = {
          format: 'json',
          content: JSON.stringify(plan, null, 2),
          filename: `plan-${plan.name.replace(/\s+/g, '-')}.json`
        };
        break;
        
      case 'markdown':
        let markdown = `# ${plan.name}\n\n`;
        markdown += `**Description:** ${plan.description}\n\n`;
        markdown += `**Created:** ${plan.created}\n\n`;
        markdown += `## Steps\n\n`;
        
        plan.steps.forEach((step, index) => {
          markdown += `### ${index + 1}. ${step.title}\n`;
          markdown += `${step.description}\n\n`;
          if (step.estimatedTime) {
            markdown += `**Estimated Time:** ${Math.round(step.estimatedTime / 1000)}s\n\n`;
          }
        });
        
        exportData = {
          format: 'markdown',
          content: markdown,
          filename: `plan-${plan.name.replace(/\s+/g, '-')}.md`
        };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported export format'
        });
    }
    
    res.json({
      success: true,
      export: exportData
    });
    
  } catch (error) {
    console.error('[API /api/planning/export] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== EXECUTION MODULE API =====
app.post('/api/execution/generate-code', async (req, res) => {
  const { prompt, language, model } = req.body;
  
  console.log(`[API /api/execution/generate-code] Generating ${language} code for: ${prompt}`);
  
  try {
    const codePrompt = `Generate ${language} code for: "${prompt}".
    
    Requirements:
    1. Write clean, well-commented code
    2. Follow best practices for ${language}
    3. Include error handling where appropriate
    4. Make the code production-ready
    
    Return only the code without explanations.`;
    
    const selectedModel = model || backendSettings.defaultOllamaModel || 'codellama';
    const codeResponse = await generateFromLocal(codePrompt, selectedModel, null, {
      llmProvider: backendSettings.llmProvider
    });
    
    res.json({
      success: true,
      code: codeResponse,
      language: language,
      model: selectedModel,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API /api/execution/generate-code] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: `// Error generating code: ${error.message}`
    });
  }
});

app.post('/api/execution/process-file', async (req, res) => {
  const { filename, content, preInstructions, fileType } = req.body;
  
  console.log(`[API /api/execution/process-file] Processing file: ${filename}`);
  
  try {
    const processingPrompt = `${preInstructions || 'Process and analyze the following file:'}\n\nFile: ${filename}\nType: ${fileType}\nContent:\n${content}\n\nProvide your analysis and any improvements or suggestions.`;
    
    const selectedModel = backendSettings.defaultOllamaModel || 'codellama';
    const processedResponse = await generateFromLocal(processingPrompt, selectedModel, null, {
      llmProvider: backendSettings.llmProvider
    });
    
    res.json({
      success: true,
      processedContent: processedResponse,
      filename: filename,
      fileType: fileType,
      tokensUsed: Math.ceil(processedResponse.length / 4), // Rough token estimate
      model: selectedModel,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API /api/execution/process-file] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      processedContent: `Error processing file ${filename}: ${error.message}`
    });
  }
});

app.post('/api/execution/run-code', async (req, res) => {
  const { code, language } = req.body;
  
  console.log(`[API /api/execution/run-code] Running ${language} code`);
  
  try {
    // For security, we'll simulate code execution rather than actually running it
    const simulatedOutput = `Code execution simulated for ${language}:\n\n${code.substring(0, 200)}...\n\nExecution completed successfully.`;
    
    res.json({
      success: true,
      output: simulatedOutput,
      language: language,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API /api/execution/run-code] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      output: `Error: ${error.message}`
    });
  }
});

app.post('/api/execution/write-file', async (req, res) => {
  const { path: filePath, content, encoding } = req.body;
  
  console.log(`[API /api/execution/write-file] Writing file: ${filePath}`);
  
  try {
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    const dir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content || '', encoding || 'utf-8');
    
    res.json({
      success: true,
      path: filePath,
      fullPath: fullPath,
      size: Buffer.byteLength(content || '', encoding || 'utf-8'),
      message: 'File written successfully'
    });
    
  } catch (error) {
    console.error('[API /api/execution/write-file] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/execution/read-file', async (req, res) => {
  const { path: filePath, encoding } = req.body;
  
  console.log(`[API /api/execution/read-file] Reading file: ${filePath}`);
  
  try {
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    const content = fs.readFileSync(fullPath, encoding || 'utf-8');
    const stats = fs.statSync(fullPath);
    
    res.json({
      success: true,
      path: filePath,
      content: content,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      message: 'File read successfully'
    });
    
  } catch (error) {
    console.error('[API /api/execution/read-file] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/execution/run-plan', async (req, res) => {
  const { plan, options } = req.body;
  
  console.log(`[API /api/execution/run-plan] Running plan: ${plan.name}`);
  
  try {
    // Set up SSE for real-time updates
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const steps = plan.steps || [];
    let completedSteps = 0;
    const results = [];
    
    // Send start event
    res.write(`data: ${JSON.stringify({
      type: 'plan_start',
      plan: plan,
      totalSteps: steps.length
    })}\n\n`);
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Send step start event
      res.write(`data: ${JSON.stringify({
        type: 'step_start',
        step: step,
        stepIndex: i,
        progress: Math.round((i / steps.length) * 100)
      })}\n\n`);
      
      try {
        // Execute step based on type
        let stepResult;
        switch (step.type) {
          case 'generate_code':
            stepResult = await executeCodeGeneration(step);
            break;
          case 'write_file':
            stepResult = await executeFileWrite(step);
            break;
          case 'run_command':
            stepResult = await executeCommand(step);
            break;
          default:
            stepResult = { success: true, message: `Step ${step.title} completed (simulated)` };
        }
        
        results.push(stepResult);
        completedSteps++;
        
        // Send step complete event
        res.write(`data: ${JSON.stringify({
          type: 'step_complete',
          step: step,
          stepIndex: i,
          result: stepResult,
          progress: Math.round((completedSteps / steps.length) * 100)
        })}\n\n`);
        
      } catch (stepError) {
        const errorResult = { success: false, error: stepError.message };
        results.push(errorResult);
        
        // Send step error event
        res.write(`data: ${JSON.stringify({
          type: 'step_error',
          step: step,
          stepIndex: i,
          error: stepError.message,
          progress: Math.round((completedSteps / steps.length) * 100)
        })}\n\n`);
        
        if (options?.stopOnError) {
          break;
        }
      }
      
      // Add delay between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'plan_complete',
      plan: plan,
      completedSteps: completedSteps,
      totalSteps: steps.length,
      results: results,
      success: completedSteps === steps.length
    })}\n\n`);
    
    res.end();
    
  } catch (error) {
    console.error('[API /api/execution/run-plan] Error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

app.get('/api/execution/status', (req, res) => {
  console.log(`[API /api/execution/status] Getting execution status`);
  
  // Return current execution status
  res.json({
    success: true,
    status: {
      isRunning: false, // Would track actual execution state
      currentPlan: null,
      currentStep: null,
      progress: 0,
      startTime: null,
      estimatedCompletion: null
    },
    workspace: WORKSPACE_DIR,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/execution/batch-process', async (req, res) => {
  const { tasks, options } = req.body;
  
  console.log(`[API /api/execution/batch-process] Processing ${tasks.length} tasks`);
  
  try {
    // Set up SSE for real-time updates
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const results = [];
    let completedTasks = 0;
    
    // Send start event
    res.write(`data: ${JSON.stringify({
      type: 'batch_start',
      totalTasks: tasks.length,
      options: options
    })}\n\n`);
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Send task start event
      res.write(`data: ${JSON.stringify({
        type: 'task_start',
        task: task,
        taskIndex: i,
        progress: Math.round((i / tasks.length) * 100)
      })}\n\n`);
      
      try {
        // Process task based on type
        let taskResult;
        switch (task.type) {
          case 'generate_code':
            taskResult = await processBatchCodeGeneration(task);
            break;
          case 'write_file':
            taskResult = await processBatchFileWrite(task);
            break;
          case 'analyze':
            taskResult = await processBatchAnalysis(task);
            break;
          default:
            taskResult = { success: true, message: `Task ${task.name} completed` };
        }
        
        results.push(taskResult);
        completedTasks++;
        
        // Send task complete event
        res.write(`data: ${JSON.stringify({
          type: 'task_complete',
          task: task,
          taskIndex: i,
          result: taskResult,
          progress: Math.round((completedTasks / tasks.length) * 100)
        })}\n\n`);
        
      } catch (taskError) {
        const errorResult = { success: false, error: taskError.message };
        results.push(errorResult);
        
        // Send task error event
        res.write(`data: ${JSON.stringify({
          type: 'task_error',
          task: task,
          taskIndex: i,
          error: taskError.message,
          progress: Math.round((completedTasks / tasks.length) * 100)
        })}\n\n`);
        
        if (options?.stopOnError) {
          break;
        }
      }
      
      // Add delay between tasks if specified
      if (options?.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'batch_complete',
      completedTasks: completedTasks,
      totalTasks: tasks.length,
      results: results,
      success: completedTasks === tasks.length
    })}\n\n`);
    
    res.end();
    
  } catch (error) {
    console.error('[API /api/execution/batch-process] Error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

// Helper functions for execution
async function executeCodeGeneration(step) {
  const { prompt, language, model } = step.parameters || {};
  
  const codePrompt = `Generate ${language || 'JavaScript'} code for: "${prompt}".
  
  Requirements:
  1. Write clean, well-commented code
  2. Follow best practices
  3. Include error handling
  4. Make the code production-ready
  
  Return only the code.`;
  
  const selectedModel = model || backendSettings.defaultOllamaModel || 'codellama';
  const code = await generateFromLocal(codePrompt, selectedModel, null, {
    llmProvider: backendSettings.llmProvider
  });
  
  return {
    success: true,
    code: code,
    language: language || 'JavaScript',
    model: selectedModel
  };
}

async function executeFileWrite(step) {
  const { path: filePath, content } = step.parameters || {};
  
  if (!filePath) {
    throw new Error('File path is required for write operation');
  }
  
  const fullPath = path.join(WORKSPACE_DIR, filePath);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(fullPath, content || '', 'utf-8');
  
  return {
    success: true,
    path: filePath,
    size: Buffer.byteLength(content || '', 'utf-8')
  };
}

async function executeCommand(step) {
  const { command } = step.parameters || {};
  
  // For security, we simulate command execution
  return {
    success: true,
    command: command,
    output: `Simulated execution of: ${command}`,
    exitCode: 0
  };
}

async function processBatchCodeGeneration(task) {
  return await executeCodeGeneration(task);
}

async function processBatchFileWrite(task) {
  return await executeFileWrite(task);
}

async function processBatchAnalysis(task) {
  const { content, type } = task.parameters || {};
  
  const analysisPrompt = `Analyze the following ${type || 'content'}:
  
  ${content}
  
  Provide insights, suggestions, and recommendations.`;
  
  const selectedModel = backendSettings.defaultOllamaModel || 'codellama';
  const analysis = await generateFromLocal(analysisPrompt, selectedModel, null, {
    llmProvider: backendSettings.llmProvider
  });
  
  return {
    success: true,
    analysis: analysis,
    type: type || 'general'
  };
}

// ===== MULTIMODAL API =====
app.post('/api/multimodal/process', async (req, res) => {
  const { text, images, model } = req.body;
  
  console.log(`[API /api/multimodal/process] Processing multimodal input`);
  
  try {
    const multimodalPrompt = `Analyze the following input:
    Text: "${text}"
    ${images ? `Images: ${images.length} image(s) provided` : 'No images provided'}
    
    Provide a comprehensive analysis and suggestions.`;
    
    const selectedModel = model || backendSettings.defaultOllamaModel || 'codellama';
    const analysisResponse = await generateFromLocal(multimodalPrompt, selectedModel, null, {
      llmProvider: backendSettings.llmProvider
    });
    
    res.json({
      success: true,
      analysis: analysisResponse,
      model: selectedModel,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API /api/multimodal/process] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      analysis: `Error processing multimodal input: ${error.message}`
    });
  }
});

// ===== CONFERENCE TAB APIs =====
const conferenceSessions = new Map();

app.post('/api/conference/start-session', async (req, res) => {
  const { topic, agents, model } = req.body;
  
  console.log(`[API /api/conference/start-session] Starting conference: ${topic}`);
  
  try {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      topic: topic || 'General Discussion',
      agents: agents || ['creative', 'analytical', 'practical'],
      model: model || backendSettings.defaultOllamaModel,
      messages: [],
      status: 'active',
      created: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    
    conferenceSessions.set(sessionId, session);
    
    res.json({
      success: true,
      session: session
    });
    
  } catch (error) {
    console.error('[API /api/conference/start-session] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/conference/add-agent', async (req, res) => {
  const { sessionId, agentType, agentName } = req.body;
  
  console.log(`[API /api/conference/add-agent] Adding agent ${agentName} to session ${sessionId}`);
  
  try {
    const session = conferenceSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const newAgent = {
      id: uuidv4(),
      type: agentType,
      name: agentName,
      added: new Date().toISOString()
    };
    
    session.agents.push(newAgent);
    session.lastActivity = new Date().toISOString();
    
    res.json({
      success: true,
      agent: newAgent,
      session: session
    });
    
  } catch (error) {
    console.error('[API /api/conference/add-agent] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/conference/send-message', async (req, res) => {
  const { sessionId, agentId, message, generateResponse } = req.body;
  
  console.log(`[API /api/conference/send-message] Message in session ${sessionId}`);
  
  try {
    const session = conferenceSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const messageObj = {
      id: uuidv4(),
      sessionId,
      agentId,
      content: message,
      timestamp: new Date().toISOString()
    };
    
    session.messages.push(messageObj);
    session.lastActivity = new Date().toISOString();
    
    let aiResponse = null;
    if (generateResponse) {
      const prompt = `You are participating in a conference discussion about "${session.topic}". 
      Previous messages: ${session.messages.slice(-3).map(m => m.content).join('\n')}
      
      Respond to: "${message}"
      
      Provide a thoughtful response that contributes to the discussion.`;
      
      const response = await generateFromLocal(prompt, session.model, null, {
        llmProvider: backendSettings.llmProvider
      });
      
      aiResponse = {
        id: uuidv4(),
        sessionId,
        agentId: 'ai_agent',
        content: response.trim(),
        timestamp: new Date().toISOString()
      };
      
      session.messages.push(aiResponse);
    }
    
    res.json({
      success: true,
      message: messageObj,
      aiResponse: aiResponse,
      session: session
    });
    
  } catch (error) {
    console.error('[API /api/conference/send-message] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/conference/session/:id', (req, res) => {
  const { id } = req.params;
  
  console.log(`[API /api/conference/session] Getting session ${id}`);
  
  const session = conferenceSessions.get(id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  
  res.json({
    success: true,
    session: session
  });
});

app.delete('/api/conference/session/:id', (req, res) => {
  const { id } = req.params;
  
  console.log(`[API /api/conference/session] Deleting session ${id}`);
  
  const deleted = conferenceSessions.delete(id);
  
  res.json({
    success: deleted,
    message: deleted ? 'Session deleted' : 'Session not found'
  });
});

// ===== FILE SYSTEM APIs =====
app.post('/api/files/create', async (req, res) => {
  const { path: filePath, content, type } = req.body;
  
  console.log(`[API /api/files/create] Creating file: ${filePath}`);
  
  try {
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    const dir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content || '', 'utf-8');
    
    res.json({
      success: true,
      path: filePath,
      fullPath: fullPath,
      message: 'File created successfully'
    });
    
  } catch (error) {
    console.error('[API /api/files/create] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/files/list', (req, res) => {
  const { directory } = req.query;
  
  console.log(`[API /api/files/list] Listing files in: ${directory || 'workspace'}`);
  
  try {
    const targetDir = directory ? path.join(WORKSPACE_DIR, directory) : WORKSPACE_DIR;
    
    if (!fs.existsSync(targetDir)) {
      return res.json({
        success: true,
        files: [],
        directory: directory || ''
      });
    }
    
    const items = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'directory' : 'file',
      path: directory ? path.join(directory, item.name) : item.name
    }));
    
    res.json({
      success: true,
      files: files,
      directory: directory || ''
    });
    
  } catch (error) {
    console.error('[API /api/files/list] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      files: []
    });
  }
});

app.put('/api/files/update', async (req, res) => {
  const { path: filePath, content } = req.body;
  
  console.log(`[API /api/files/update] Updating file: ${filePath}`);
  
  try {
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    fs.writeFileSync(fullPath, content, 'utf-8');
    
    res.json({
      success: true,
      path: filePath,
      message: 'File updated successfully'
    });
    
  } catch (error) {
    console.error('[API /api/files/update] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/files/delete', async (req, res) => {
  const { path: filePath } = req.body;
  
  console.log(`[API /api/files/delete] Deleting file: ${filePath}`);
  
  try {
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    fs.unlinkSync(fullPath);
    
    res.json({
      success: true,
      path: filePath,
      message: 'File deleted successfully'
    });
    
  } catch (error) {
    console.error('[API /api/files/delete] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/files/export', async (req, res) => {
  const { files, format, destination } = req.body;
  
  console.log(`[API /api/files/export] Exporting ${files.length} files as ${format}`);
  
  try {
    const exportData = {
      format: format,
      timestamp: new Date().toISOString(),
      files: []
    };
    
    for (const filePath of files) {
      const fullPath = path.join(WORKSPACE_DIR, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        exportData.files.push({
          path: filePath,
          content: content
        });
      }
    }
    
    if (destination) {
      const exportPath = path.join(WORKSPACE_DIR, destination);
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
    }
    
    res.json({
      success: true,
      exportData: exportData,
      message: `Exported ${exportData.files.length} files`
    });
    
  } catch (error) {
    console.error('[API /api/files/export] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== MODEL MANAGEMENT API =====
app.get('/api/models', (req, res) => {
  try {
    const configPath = path.join(__dirname2, 'config', 'model_categories.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cfg = JSON.parse(raw);
    const models = [];
    const categories = cfg.categories || {};
    Object.keys(categories).forEach(cat => {
      categories[cat].forEach(id => {
        models.push({ name: id, identifier: id, backend: 'ollama' });
      });
    });
    if (Array.isArray(cfg.static_models)) {
      cfg.static_models.forEach(m => {
        models.push({ name: m.name, identifier: m.id, backend: m.type || 'ollama' });
      });
    }
    res.json(models);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load models', details: err.message });
  }
});

// ===== CONFIGURATION TAB APIs =====
app.get('/api/config/settings', (req, res) => {
  console.log(`[API /api/config/settings] Getting configuration settings`);
  
  res.json({
    success: true,
    settings: backendSettings,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/config/settings', (req, res) => {
  console.log(`[API /api/config/settings] Updating configuration settings`);
  
  const {
    llmProvider,
    apiKey,
    defaultOllamaModel,
    defaultOpenAIModel,
    OLLAMA_BASE_URL: newOllamaBaseUrl,
    componentDir,
    logDir,
    workspaceDir
  } = req.body;

  const newSettings = { ...backendSettings };

  if (llmProvider !== undefined) newSettings.llmProvider = llmProvider;
  if (apiKey !== undefined) newSettings.apiKey = apiKey;
  if (defaultOllamaModel !== undefined) newSettings.defaultOllamaModel = defaultOllamaModel;
  if (defaultOpenAIModel !== undefined) newSettings.defaultOpenAIModel = defaultOpenAIModel;
  if (newOllamaBaseUrl !== undefined) newSettings.OLLAMA_BASE_URL = newOllamaBaseUrl;
  if (componentDir !== undefined) newSettings.componentDir = componentDir;
  if (logDir !== undefined) newSettings.logDir = logDir;
  if (workspaceDir !== undefined) newSettings.workspaceDir = workspaceDir;

  try {
    fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(newSettings, null, 2), 'utf-8');
    backendSettings = newSettings;

    if (newOllamaBaseUrl !== undefined && OLLAMA_BASE_URL !== newOllamaBaseUrl) {
      OLLAMA_BASE_URL = newOllamaBaseUrl;
      console.log(`[API /api/config/settings] Global OLLAMA_BASE_URL updated to: ${OLLAMA_BASE_URL}`);
    }

    res.json({ 
      success: true,
      message: 'Settings updated successfully.',
      settings: backendSettings 
    });
  } catch (error) {
    console.error('[API /api/config/settings] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save settings.',
      details: error.message 
    });
  }
});

app.get('/api/config/models', async (req, res) => {
  console.log(`[API /api/config/models] Getting available models`);
  
  try {
    const models = {
      ollama: [],
      openai: [
        { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' }
      ]
    };
    
    // Try to get Ollama models
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        models.ollama = (data.models || []).map(model => ({
          id: model.name,
          name: model.name,
          provider: 'ollama',
          size: model.size,
          modified: model.modified_at
        }));
      }
    } catch (ollamaError) {
      console.warn('[API /api/config/models] Ollama not available:', ollamaError.message);
    }
    
    res.json({
      success: true,
      models: models,
      currentProvider: backendSettings.llmProvider,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API /api/config/models] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      models: { ollama: [], openai: [] }
    });
  }
});

app.post('/api/config/test-connection', async (req, res) => {
  const { provider, apiKey, ollamaUrl, model } = req.body;
  
  console.log(`[API /api/config/test-connection] Testing ${provider} connection`);
  
  try {
    let testResult = {
      success: false,
      provider: provider,
      message: '',
      details: {},
      timestamp: new Date().toISOString()
    };
    
    if (provider === 'ollama') {
      const testUrl = ollamaUrl || OLLAMA_BASE_URL;
      
      try {
        const response = await fetch(`${testUrl}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          testResult.success = true;
          testResult.message = 'Ollama connection successful';
          testResult.details = {
            url: testUrl,
            modelCount: data.models?.length || 0,
            models: data.models?.slice(0, 3).map(m => m.name) || []
          };
        } else {
          testResult.message = `Ollama server responded with status ${response.status}`;
          testResult.details = { url: testUrl, status: response.status };
        }
      } catch (fetchError) {
        testResult.message = 'Failed to connect to Ollama server';
        testResult.details = { url: testUrl, error: fetchError.message };
      }
      
    } else if (provider === 'openai') {
      if (!apiKey) {
        testResult.message = 'OpenAI API key is required';
        testResult.details = { missingApiKey: true };
      } else {
        try {
          // Test with a simple completion request
          const testModel = model || 'gpt-3.5-turbo';
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: testModel,
              messages: [{ role: 'user', content: 'Test connection' }],
              max_tokens: 5
            })
          });
          
          if (response.ok) {
            testResult.success = true;
            testResult.message = 'OpenAI API connection successful';
            testResult.details = { model: testModel, status: response.status };
          } else {
            const errorData = await response.json();
            testResult.message = `OpenAI API error: ${errorData.error?.message || 'Unknown error'}`;
            testResult.details = { status: response.status, error: errorData };
          }
        } catch (fetchError) {
          testResult.message = 'Failed to connect to OpenAI API';
          testResult.details = { error: fetchError.message };
        }
      }
      
    } else {
      testResult.message = 'Unsupported provider';
      testResult.details = { supportedProviders: ['ollama', 'openai'] };
    }
    
    res.json(testResult);
    
  } catch (error) {
    console.error('[API /api/config/test-connection] Error:', error);
    res.status(500).json({
      success: false,
      provider: provider,
      message: 'Internal server error during connection test',
      details: { error: error.message },
      timestamp: new Date().toISOString()
    });
  }
});

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

    const modelCategoriesConfigPath = path.join(__dirname2, 'config', 'model_categories.json');
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
       const modelCategoriesConfigPath = path.join(__dirname2, 'config', 'model_categories.json');
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

// ===== New Configuration File APIs =====
const CONFIG_ALLOWED_FILES = new Set([
  'agent_instructions_template.json',
  'conference_agent_instructions.json',
  'backend_config.json',
  'model_categories.json',
  'fsAgent.config.json'
]);

app.get('/api/config/:filename', (req, res) => {
  const { filename } = req.params;
  if (!CONFIG_ALLOWED_FILES.has(filename)) {
    return res.status(404).json({ message: 'Config file not found.' });
  }
  const baseDir = filename === 'fsAgent.config.json' ? __dirname2 : path.join(__dirname2, 'config');
  const filePath = path.join(baseDir, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.type('application/json').send(content);
  } catch (err) {
    res.status(404).json({ message: 'File not found.' });
  }
});

app.post('/api/config/:filename', (req, res) => {
  const { filename } = req.params;
  if (!CONFIG_ALLOWED_FILES.has(filename)) {
    return res.status(404).json({ message: 'Config file not found.' });
  }
  const baseDir = filename === 'fsAgent.config.json' ? __dirname2 : path.join(__dirname2, 'config');
  const filePath = path.join(baseDir, filename);
  try {
    const data = req.body;
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf-8');
    if (filename === 'fsAgent.config.json') {
      reloadDefaultConfig();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save file.', details: err.message });
  }
});

// ===== Template APIs =====
app.get('/api/templates', (req, res) => {
  const templatesDir = path.join(__dirname2, 'templates');
  try {
    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.template'));
    res.json(files);
  } catch (err) {
    res.status(500).json({ message: 'Unable to read templates.' });
  }
});

app.get('/api/templates/:name', (req, res) => {
  const { name } = req.params;
  const templatesDir = path.join(__dirname2, 'templates');
  const filePath = path.join(templatesDir, name);
  if (!filePath.startsWith(templatesDir)) {
    return res.status(400).json({ message: 'Invalid template name.' });
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(404).json({ message: 'Template not found.' });
  }
});

// ===== Simple Execute Endpoint =====
app.post('/api/execute', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ message: 'Prompt is required.' });
  }
  const parsed = parseReactPrompt(prompt);
  if (!parsed.action) {
    return res.status(400).json({ message: 'No Action found in prompt.' });
  }
  const action = parsed.action.trim();
  const tool = tools.find(t => t.name === action);
  const agent = tool ? null : getAgent(action);
  if (!tool && !agent) {
    return res.status(400).json({ message: 'Unknown tool or agent.' });
  }
  let input = parsed.actionInput ? parsed.actionInput.trim() : '';
  try {
    let output;
    if (tool) {
      output = await (tool._call ? tool._call(input) : tool.call(input));
    } else {
      let parsed = input;
      try {
        parsed = input ? JSON.parse(input) : {};
      } catch {
        // keep as raw string if not JSON
      }
      output = await agent(parsed);
    }
    res.json({ output });
  } catch (err) {
    console.error('[API /api/execute] Tool error:', err);
    res.status(500).json({ message: 'Tool execution failed.', details: err.message });
  }
});

// ===== Retrieve Parsed Log =====
app.get('/api/logs/:id', (req, res) => {
  const logId = req.params.id;
  const baseDir = backendSettings.logDir || path.resolve(__dirname2, '../../logs');
  const candidates = ['', '.json', '.md', '.log', '.log.md'].map(ext => path.join(baseDir, logId + ext));
  const filePath = candidates.find(p => fs.existsSync(p));
  if (!filePath) {
    return res.status(404).json({ message: 'Log not found' });
  }
  try {
    const data = parseLogFile(filePath);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to read log', details: err.message });
  }
});

// ===== Log Streaming via SSE =====
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const watchers = [];

  function tail(file) {
    let position = 0;
    try { position = fs.statSync(file).size; } catch {}
    const watcher = fs.watch(file, () => {
      try {
        const stats = fs.statSync(file);
        if (stats.size > position) {
          const stream = fs.createReadStream(file, { start: position, end: stats.size });
          stream.on('data', chunk => {
            const lines = chunk.toString().split(/\r?\n/).filter(l => l);
            lines.forEach(line => res.write(`event: log_line\ndata: ${JSON.stringify({ file: path.basename(file), line })}\n\n`));
          });
          position = stats.size;
        }
      } catch {}
    });
    watchers.push(() => watcher.close());
  }

  const startupFile = path.join(__dirname2, 'startup_logs.txt');
  if (fs.existsSync(startupFile)) tail(startupFile);

  const workspaceDir = path.join(__dirname2, 'logs', 'roadrunner_workspace');
  if (fs.existsSync(workspaceDir)) {
    fs.readdirSync(workspaceDir).forEach(f => tail(path.join(workspaceDir, f)));
    const dirWatcher = fs.watch(workspaceDir, (event, filename) => {
      if (event === 'rename' && filename) {
        const newPath = path.join(workspaceDir, filename);
        if (fs.existsSync(newPath)) tail(newPath);
      }
    });
    watchers.push(() => dirWatcher.close());
  }

  req.on('close', () => { watchers.forEach(fn => fn()); });
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

// WebSocket setup for backend log streaming
let wss;
const logBuffer = [];
const MAX_LOG_BUFFER = 100;

function broadcastLog(logEntry) {
  // Add to buffer
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift(); // Remove oldest entry
  }
  
  // Broadcast to all connected WebSocket clients
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(JSON.stringify(logEntry));
        } catch (error) {
          console.error('[WebSocket] Error sending log to client:', error);
        }
      }
    });
  }
}

// Override console.log to capture backend logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  originalConsoleLog(...args);
  const message = args.join(' ');
  if (message.includes('[API') || message.includes('[Backend') || message.includes('[Server')) {
    broadcastLog({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: message
    });
  }
};

console.error = (...args) => {
  originalConsoleError(...args);
  const message = args.join(' ');
  broadcastLog({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message: message
  });
};

console.warn = (...args) => {
  originalConsoleWarn(...args);
  const message = args.join(' ');
  broadcastLog({
    timestamp: new Date().toISOString(),
    level: 'WARNING',
    message: message
  });
};

function attemptToListen(port) {
    console.log(`[BACKEND SERVER ATTEMPT] Attempting to listen on port: ${port}`);
    
    // Create HTTP server
    const server = createServer(app);
    
    // Setup WebSocket server
    wss = new WebSocketServer({ 
      server,
      path: '/ws/logs'
    });
    
    wss.on('connection', (ws, req) => {
      console.log(`[WebSocket] Client connected from ${req.socket.remoteAddress}`);
      
      // Send existing log buffer to new client
      logBuffer.forEach(logEntry => {
        try {
          ws.send(JSON.stringify(logEntry));
        } catch (error) {
          console.error('[WebSocket] Error sending buffered log:', error);
        }
      });
      
      // Send welcome message
      ws.send(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: '[WebSocket] Connected to backend log stream'
      }));
      
      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
      });
      
      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error);
      });
    });
    
    server.listen(port, () => {
        console.log(`[BACKEND SERVER SUCCESS] Successfully listening on port: ${port}. PID: ${process.pid}`);
        console.log(`[WebSocket] Log streaming available at ws://localhost:${port}/ws/logs`);
        
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
    const initialPort = parseInt(process.env.PORT || '3333', 10);
    attemptToListen(initialPort);

  } catch (err) {
    console.error('[Server Startup IIFE] Error during server startup:', err);
    process.exit(1); // Exit if main startup fails
  }
}

if (process.env.JEST_WORKER_ID === undefined) {
  main();
}

function resolveTemplates(input, outputs = {}, sendSseMessage) {
  if (typeof input !== 'string') return input;
  return input.replace(/\{\{outputs\.([^}]+)\}\}/g, (_, key) => {
    const val = outputs[key];
    if (val === undefined && sendSseMessage) {
      sendSseMessage('log_entry', { message: `Unresolved template: outputs.${key}` });
    }
    return val !== undefined ? val : `{{outputs.${key}}}`;
  });
}

// Exporting necessary components for potential testing or external use
export {
  app,
  backendSettings,
  loadBackendConfig,
  handleExecuteAutonomousTask,
  generateFromLocal,
  requestPlanApproval,
  requestUserActionOnStepFailure,
  resolveTemplates,
  pendingPlans,
  pendingFailures
};

export default app; // Default export for convenience if primary export is the app
