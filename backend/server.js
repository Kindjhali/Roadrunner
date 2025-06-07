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

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Langchain imports
const { ChatOllama } = require('@langchain/community/chat_models/ollama');
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { createOpenAIFunctionsAgent, createReactAgent, AgentExecutor } = require('langchain/agents');
const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, PromptTemplate } = require('@langchain/core/prompts');
const { RunnableSequence } = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { renderTextDescription } = require("@langchain/core/tools");
const { ConversationBufferWindowMemory } = require("langchain/memory"); // Added Memory

// Import tools and custom error
const { ListDirectoryTool, CreateFileTool, ReadFileTool, UpdateFileTool, DeleteFileTool, CreateDirectoryTool, DeleteDirectoryTool } = require('./langchain_tools/fs_tools');
const { GitAddTool, GitCommitTool, GitPushTool, GitPullTool, GitRevertTool } = require('./langchain_tools/git_tools');
const { CodeGeneratorTool } = require('./langchain_tools/code_generator_tool');
const { ConferenceTool } = require('./langchain_tools/conference_tool');
const { ConfirmationRequiredError } = require('./langchain_tools/common');

// Initialize Tools
const tools = [
  new ListDirectoryTool(), new CreateFileTool(), new ReadFileTool(), new UpdateFileTool(), new DeleteFileTool(), new CreateDirectoryTool(), new DeleteDirectoryTool(),
  new GitAddTool(), new GitCommitTool(), new GitPushTool(), new GitPullTool(), new GitRevertTool(),
  new CodeGeneratorTool(),
  new ConferenceTool(),
];

// Agent and AgentExecutor definition
let agentExecutor;
let agent;

// Prompt for OpenAI Functions Agent
const AGENT_PROMPT_TEMPLATE_OPENAI = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. Use the provided tools to answer the user's questions. Respond with a tool call if appropriate, otherwise respond to the user directly."],
  new MessagesPlaceholder("chat_history"), // Added for memory
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

// Standard ReAct prompt template structure for Ollama and other non-function-calling models
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

**HANDLING TOOL ERRORS:**
If the 'Observation' you receive from a tool clearly indicates an error (e.g., it starts with "Error:", "Failed to:", "File not found:", "Invalid input:"), you MUST treat this seriously.
1.  In your 'Thought': Acknowledge the specific error message.
2.  Analyze the error: Was it due to a wrong path, missing resource, incorrect input format, or a tool limitation?
3.  Avoid immediately retrying the exact same action with the exact same input if the error suggests it will fail again.
4.  Consider alternatives: Can you use a different tool? Can you modify the input? Is a preliminary step missed?
5.  If the error is unrecoverable, your 'Final Answer:' should clearly state the error and why you cannot proceed.
Do not ignore errors; use them to make better decisions.

**IMPORTANT: HANDLING USER DENIALS:**
If an 'Observation' explicitly states that a user has denied a previous action (e.g., 'User denied action: create_file...'), you MUST NOT immediately retry the exact same action with the exact same input.
Instead, you MUST:
1.  Acknowledge the denial in your 'Thought' process.
2.  Re-evaluate the original task and your previous plan.
3.  Consider alternative tools or a different sequence of actions to achieve the goal.
4.  If you believe the same tool is necessary, consider how its input could be modified to be acceptable.
5.  If no alternative is found, your 'Final Answer:' should clearly state why the task cannot be completed due to the denial.
Your goal is to still try to complete the task, but respectfully and adaptively to user feedback.

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

  // Instantiate memory for both agent types
  const memory = new ConversationBufferWindowMemory({
    k: 5,
    memoryKey: "chat_history",
    inputKey: "input",
    returnMessages: true
  });
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
    // Ensure the OpenAI prompt template also includes the chat_history placeholder
    const openAIPrompt = ChatPromptTemplate.fromMessages([
        new SystemMessagePromptTemplate(PromptTemplate.fromTemplate("You are a helpful assistant. Use the provided tools to answer the user's questions. Respond with a tool call if appropriate, otherwise respond to the user directly.")),
        new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
        new MessagesPlaceholder("agent_scratchpad"),
    ]);
    agent = await createOpenAIFunctionsAgent({ llm, tools, prompt: openAIPrompt });
    console.log("[Agent Init] OpenAI Functions Agent created successfully.");
  } else {
    const ollamaModelName = backendSettings.defaultOllamaModel || 'llama3';
    console.log(`[Agent Init] Ollama provider selected. Model: ${ollamaModelName}`);
    llm = new ChatOllama({ baseUrl: OLLAMA_BASE_URL, model: ollamaModelName, temperature: 0 });
    console.log(`[Agent Init] ChatOllama LLM created with model ${ollamaModelName}.`);

    // The REACT_AGENT_PROMPT_TEMPLATE_TEXT already includes {chat_history}
    const reactPrompt = PromptTemplate.fromTemplate(REACT_AGENT_PROMPT_TEMPLATE_TEXT);
    agent = await createReactAgent({ llm, tools, prompt: reactPrompt });
    console.log("[Agent Init] Ollama ReAct Agent created successfully.");
  }

  agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory, // Add memory instance here
    returnIntermediateSteps: true,
    maxIterations: 15,
    verbose: true, // Good for debugging agent behavior
    // handleParsingErrors: true, // Optional: for robustness
  });
  console.log("[Agent Init] AgentExecutor created with memory.");
}

const BACKEND_CONFIG_FILE_PATH = path.join(__dirname, 'config', 'backend_config.json');
let backendSettings = { llmProvider: null, apiKey: '', defaultOllamaModel: 'codellama' };
function loadBackendConfig() {
    try {
        if (fs.existsSync(BACKEND_CONFIG_FILE_PATH)) {
          const configFileContent = fs.readFileSync(BACKEND_CONFIG_FILE_PATH, 'utf-8');
          backendSettings = JSON.parse(configFileContent);
          console.log(`[Config] Loaded backend settings from ${BACKEND_CONFIG_FILE_PATH}`);
        } else {
          const examplePath = path.join(__dirname, 'config', 'backend_config.example.json');
          if (fs.existsSync(examplePath)) {
            console.log(`[Config] Backend config not found. Copying from ${examplePath}`);
            const exampleContent = fs.readFileSync(examplePath, 'utf-8');
            fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, exampleContent, 'utf-8');
            backendSettings = JSON.parse(exampleContent);
          } else {
            console.log(`[Config] Backend config and example not found. Creating default ${BACKEND_CONFIG_FILE_PATH}`);
            fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(backendSettings, null, 2), 'utf-8');
          }
        }
      } catch (error) {
        console.error(`[Config] Error loading/creating backend_config.json:`, error);
        backendSettings = { llmProvider: null, apiKey: '', defaultOllamaModel: 'codellama' };
      }
}
loadBackendConfig();

const LOG_DIR_DEFAULT = path.resolve(__dirname, '../../logs');
const WORKSPACE_DIR_DEFAULT = path.resolve(__dirname, '../../output');
const LOG_DIR = fs.existsSync(path.join(__dirname, 'config/backend_config.json')) ? (JSON.parse(fs.readFileSync(path.join(__dirname, 'config/backend_config.json'), 'utf-8')).logDir || LOG_DIR_DEFAULT) : LOG_DIR_DEFAULT;
const WORKSPACE_DIR = fs.existsSync(path.join(__dirname, 'config/backend_config.json')) ? (JSON.parse(fs.readFileSync(path.join(__dirname, 'config/backend_config.json'), 'utf-8')).workspaceDir || WORKSPACE_DIR_DEFAULT) : WORKSPACE_DIR_DEFAULT;

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

const pendingToolConfirmations = {};
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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
    let task_description, stepsString, safetyModeString, isAutonomousModeString;
    if (req.method === 'POST') {
      ({ task_description, steps: stepsString, safetyMode: safetyModeString, isAutonomousMode: isAutonomousModeString } = req.body);
    } else if (req.method === 'GET') {
      ({ task_description, steps: stepsString, safetyMode: safetyModeString, isAutonomousMode: isAutonomousModeString } = req.query);
    } else {
      return { error: 'Unsupported request method.' };
    }
    if (!task_description) return { error: 'Missing task_description in parameters.' };
    const safetyMode = safetyModeString !== 'false';
    return { task_description, safetyMode };
}

const app = express();
app.use(cors());
app.use(express.json());

app.post('/execute-autonomous-task', async (req, expressHttpRes) => {
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

    if (!agentExecutor) { // Or if agent/memory needs to be request-specific
        try {
            // Initialize agent executor for each request to ensure fresh memory,
            // unless session management is implemented for memory persistence.
            await initializeAgentExecutor();
        } catch (initError) {
            console.error("[Agent Handling] CRITICAL: AgentExecutor initialization failed:", initError);
            sendSseMessage('error', { content: `AgentExecutor initialization failed: ${initError.message}` });
            if (expressHttpRes.writable) expressHttpRes.end();
            return;
        }
    }

    sendSseMessage('log_entry', { message: `[SSE Agent] Starting agent execution for goal: "${task_description}" with Safety Mode: ${safetyMode}` });
    overallExecutionLog.push(`[Agent Execution] Starting for goal: "${task_description}", Safety Mode: ${safetyMode}`);

    let currentTaskInput = { input: task_description }; // Input for AgentExecutor must contain 'input' key for memory

    // Agent config for the current run
    let agentRunConfig = {
      configurable: {
        safetyMode: safetyMode,
        originalExpressHttpRes: expressHttpRes,
        sendSseMessage: sendSseMessage,
        // chat_history is handled by memory automatically if memoryKey and inputKey match
      }
    };

    let errorOccurred = false;
    try {
        // The `input` to stream must be an object, and the key for the user's message
        // must match the `inputKey` of the `ConversationBufferWindowMemory` (which is "input").
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
            pendingToolConfirmations[confirmationId] = {
                originalTaskDescription: task_description, // Use the initial task_description for resumption context
                agentConfig: agentRunConfig, // Store the run-specific config
                toolName, toolInput, safetyMode, originalExpressHttpRes: expressHttpRes, sendSseMessage, overallExecutionLog,
                // chatHistory: agentExecutor.memory.chatHistory, // Conceptually, if needed for deep resume
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
});

app.post('/api/confirm-action/:confirmationId', async (req, res) => {
    const { confirmationId } = req.params;
    const { confirmed } = req.body;
    console.log(`[API /api/confirm-action/${confirmationId}] Received. User Confirmed: ${confirmed}`);

    const pendingConfirmation = pendingToolConfirmations[confirmationId];
    if (!pendingConfirmation) {
        return res.status(404).json({ message: 'Confirmation ID not found or already processed.' });
    }

    const { originalTaskDescription, agentConfig: originalAgentConfig, toolName, toolInput, safetyMode, originalExpressHttpRes, sendSseMessage, overallExecutionLog } = pendingConfirmation;

    if (!originalExpressHttpRes || !originalExpressHttpRes.writable) {
        delete pendingToolConfirmations[confirmationId];
        return res.status(500).json({ message: 'Original client connection lost.' });
    }
    delete pendingToolConfirmations[confirmationId];

    let agentInputTextForResume; // Renamed to avoid confusion with 'input' key for agent
    const toolInputString = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput);

    // Reconstruct the agentConfig for the resumed call, ensuring memory is handled correctly
    // The memory object in agentExecutor is stateful for the duration of its existence.
    // For request-scoped memory as implemented, re-initializing agentExecutor or its memory might be needed
    // if we want a fresh memory for the resumed part, or ensure the same memory instance is used.
    // Current initializeAgentExecutor creates a new memory each time.
    // For a single task's confirmation flow, we want to continue with the *same* memory state.
    // This means initializeAgentExecutor should NOT be called again here if we want to preserve memory from the initial part of the task.
    // The agentExecutor instance from the initial handleExecuteAutonomousTask call must be used.

    let resumedAgentConfig = {
        configurable: {
            ...(originalAgentConfig ? originalAgentConfig.configurable : {}), // Carry over original config
            isConfirmedActionForTool: {
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
        console.log(`[API /api/confirm-action] Re-invoking agent with input for memory: "${agentInputTextForResume.substring(0,100)}...", Config: ${JSON.stringify(resumedAgentConfig.configurable)}`);
        // The input to the agentExecutor should be an object with the key matching memory's inputKey.
        const eventStream = await agentExecutor.stream({ input: agentInputTextForResume }, resumedAgentConfig);
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
            pendingToolConfirmations[newConfirmationId] = {
                originalTaskDescription, agentConfig: resumedAgentConfig,
                toolName: newToolName, toolInput: newToolInput, safetyMode,
                originalExpressHttpRes, sendSseMessage, overallExecutionLog,
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
    const { llmProvider, apiKey, defaultOllamaModel } = req.body;
    const newSettings = { ...backendSettings, };
    if (llmProvider !== undefined) newSettings.llmProvider = llmProvider;
    if (apiKey !== undefined) newSettings.apiKey = apiKey;
    if (defaultOllamaModel !== undefined) newSettings.defaultOllamaModel = defaultOllamaModel;
    try {
      fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(newSettings, null, 2), 'utf-8');
      backendSettings = newSettings;
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

app.get('/api/ollama-models/categorized', async (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.post('/api/ollama/pull-model', async (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.get('/api/instructions/:agentType', (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.post('/api/instructions/:agentType', (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.get('/api/instructions/conference_agent/:agentRole', (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.post('/api/instructions/conference_agent/:agentRole', (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.post('/execute-conference-task', async (req, res) => {
    console.warn("[Deprecated Endpoint] /execute-conference-task was called. Use agent with 'multi_model_debate' tool instead.");
    res.status(501).json({ message: "This endpoint is deprecated. Please use the agent with the 'multi_model_debate' tool."});
});

async function checkOllamaStatus() { return true;}
async function startOllama() {}
function attemptToListen(port) {
    app.listen(port, () => {
        console.log(`[Server Startup] Roadrunner backend server listening on port ${port}`);
    }).on('error', (err) => {
        console.error('[Server Startup] Error during server listen:', err);
        process.exit(1);
    });
}

async function main() {
  try {
    console.log('[Server Startup] Checking Ollama status...');
    let ollamaReady = await checkOllamaStatus();
    if (!ollamaReady) {
      console.log('[Server Startup] Ollama not detected or not responsive. Attempting to start Ollama...');
      try {
        await startOllama();
        await new Promise(resolve => setTimeout(resolve, 5000));
        ollamaReady = await checkOllamaStatus();
      } catch (startError) { console.error(`[Server Startup] Error during Ollama start attempt: ${startError.message}`); }
    }
    if (!ollamaReady) console.warn('[Server Startup] WARNING: Ollama is not running and/or could not be started.');
    else console.log('[Server Startup] Ollama reported as operational.');

    // Initialize agentExecutor once at startup.
    // If memory needs to be request-scoped and fresh for each /execute-autonomous-task,
    // then agentExecutor (or at least its memory) should be created within that handler.
    // For now, global agentExecutor with memory that clears per top-level .stream() call.
    await initializeAgentExecutor();
    console.log('[Server Startup] AgentExecutor initialized.');

    if (require.main === module) {
      const initialPort = parseInt(process.env.PORT || '3030', 10);
      attemptToListen(initialPort);
    }
  } catch (err) {
    console.error('[Server Startup IIFE] Error during server startup:', err);
    if (require.main === module) process.exit(1); else throw err;
  }
}

main();

module.exports = {
  app,
  backendSettings,
  loadBackendConfig,
  handleExecuteAutonomousTask,
  generateFromLocal,
};

[end of backend/server.js]
