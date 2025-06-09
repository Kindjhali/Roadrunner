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
// const os = require('os'); // Removed unused import
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // Added node-fetch

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Langchain imports
const { ChatOllama } = require('@langchain/community/chat_models/ollama');
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages'); // Added SystemMessage
const { createOpenAIFunctionsAgent, createReactAgent, AgentExecutor } = require('langchain/agents');
// Removed SystemMessagePromptTemplate, PromptTemplate as they are not directly used. HumanMessagePromptTemplate is used.
const { ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
// Removed RunnableSequence and StringOutputParser as they are not directly used.
const { renderTextDescription } = require("@langchain/core/tools"); // renderTextDescription is implicitly used by agent creation
const { ConversationBufferWindowMemory } = require("langchain/memory"); // Memory import

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
                // Store the agentRunConfig's configurable part, which is what's needed for resumption.
                // agentConfig was not defined; agentRunConfig is the correct variable.
                agentRunConfigurable: agentRunConfig.configurable,
                toolName, toolInput, safetyMode, originalExpressHttpRes: expressHttpRes, sendSseMessage, overallExecutionLog,
                chatHistoryMessages: currentChatHistory,
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
    const { originalTaskDescription, agentRunConfigurable: originalAgentRunConfigurable, toolName, toolInput, safetyMode, originalExpressHttpRes, sendSseMessage, overallExecutionLog, chatHistoryMessages } = pendingConfirmation;

    if (!originalExpressHttpRes || !originalExpressHttpRes.writable) {
        delete pendingToolConfirmations[confirmationId];
        return res.status(500).json({ message: 'Original client connection lost.' });
    }
    delete pendingToolConfirmations[confirmationId];

    let agentInputTextForResume;
    const toolInputString = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput);

    // Re-initialize agent and executor to use the *same memory instance* or correctly repopulate it.
    // For simplicity with request-scoped memory, we re-initialize and then could potentially re-populate.
    // However, agentExecutor uses the memory instance it was created with.
    // The key is that the *same agentExecutor instance* that was paused should be used.
    // We currently re-initialize agentExecutor on every /execute-autonomous-task call if it's not set,
    // which means memory is fresh for each new task. For confirmations WITHIN a task,
    // we need to ensure the memory state from the initial part of the task is carried over.
    // The current `initializeAgentExecutor()` creates a NEW memory instance each time.
    // This needs to be addressed for memory to persist across confirmations for the *same* task.

    // For this iteration, we will re-initialize a new executor but pass the history.
    // This is not ideal for perfect context carry-over of the agent's internal state/scratchpad,
    // but will carry over the chat history for the LLM's context.
    try {
        await initializeAgentExecutor(); // This will create a new agentExecutor with fresh memory
        if (chatHistoryMessages && agentExecutor.memory) { // If we have history and new memory exists
            agentExecutor.memory.chatHistory.clear(); // Clear fresh memory
            await agentExecutor.memory.chatHistory.addMessages(chatHistoryMessages); // Add back stored messages
            console.log(`[API /api/confirm-action] Repopulated memory with ${chatHistoryMessages.length} messages.`);
        }
    } catch (initError) {
        console.error("[API /api/confirm-action] CRITICAL: AgentExecutor re-initialization failed:", initError);
        sendSseMessage('error', { content: `AgentExecutor re-initialization failed: ${initError.message}` });
        if (originalExpressHttpRes.writable) originalExpressHttpRes.end();
        if (!res.headersSent) res.status(500).json({ message: 'Agent re-initialization failed.' });
        return;
    }


    let resumedAgentConfig = {
        configurable: {
            ...(originalAgentRunConfigurable || {}), // Spread the original configurable properties
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
        const eventStream = await agentExecutor.stream({ input: agentInputTextForResume, chat_history: chatHistoryMessages /* Pass manually if memory not perfectly resumed */ }, resumedAgentConfig);
        for await (const event of eventStream) {
            // ... (event handling as in handleExecuteAutonomousTask)
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
            const currentChatHistoryForNewConfirmation = await agentExecutor.memory.chatHistory.getMessages();
            pendingToolConfirmations[newConfirmationId] = {
                originalTaskDescription,
                agentRunConfigurable: resumedAgentConfig.configurable, // Store the new configurable part
                toolName: newToolName, toolInput: newToolInput, safetyMode,
                originalExpressHttpRes, sendSseMessage, overallExecutionLog,
                chatHistoryMessages: currentChatHistoryForNewConfirmation,
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

// Routes for explicit plan approval
app.post('/api/approve-plan/:planId', (req, res) => {
  const { planId } = req.params;
  const plan = pendingPlans[planId];

  if (!plan) {
    return res.status(404).json({ message: 'Plan not found or already processed.' });
  }

  console.log(`[API /api/approve-plan] Plan ${planId} approved by user.`);
  // In a real implementation, this would trigger resumption of the agent or further processing.
  // For now, we just log and remove it.
  delete pendingPlans[planId];

  // TODO: Add logic here to inform the agent execution process associated with this planId
  // This could involve finding the correct SSE connection (expressHttpRes) if still active,
  // or interacting with a state machine managing the agent's lifecycle.

  res.json({ message: `Plan ${planId} approved. Agent execution would proceed.` });
});

app.post('/api/decline-plan/:planId', (req, res) => {
  const { planId } = req.params;
  const plan = pendingPlans[planId];

  if (!plan) {
    return res.status(404).json({ message: 'Plan not found or already processed.' });
  }

  console.log(`[API /api/decline-plan] Plan ${planId} declined by user.`);
  // Similar to approval, this would notify the agent.
  delete pendingPlans[planId];

  // TODO: Add logic here to inform the agent that the plan was declined.
  // The agent might then halt, re-plan, or ask for clarification.

  res.json({ message: `Plan ${planId} declined. Agent would be notified.` });
});
// End routes for explicit plan approval

// Routes for step failure recovery options
app.post('/api/retry-step/:failureId', (req, res) => {
  const { failureId } = req.params;
  const failureInfo = pendingFailures[failureId];

  if (!failureInfo) {
    return res.status(404).json({ message: 'Failure ID not found or already processed.' });
  }

  console.log(`[API /api/retry-step] User chose to RETRY step for failure ID: ${failureId}. Details:`, failureInfo);
  // TODO: Implement logic to signal the agent execution process to retry the step.
  // This would involve using the stored failureInfo (e.g., original step details, task context).
  delete pendingFailures[failureId];
  res.json({ message: `Step retry for ${failureId} acknowledged. Agent would attempt to retry.` });
});

app.post('/api/skip-step/:failureId', (req, res) => {
  const { failureId } = req.params;
  const failureInfo = pendingFailures[failureId];

  if (!failureInfo) {
    return res.status(404).json({ message: 'Failure ID not found or already processed.' });
  }

  console.log(`[API /api/skip-step] User chose to SKIP step for failure ID: ${failureId}. Details:`, failureInfo);
  // TODO: Implement logic to signal the agent to skip this step and proceed with the next.
  delete pendingFailures[failureId];
  res.json({ message: `Step skip for ${failureId} acknowledged. Agent would skip and continue.` });
});

app.post('/api/convert-to-manual/:failureId', (req, res) => {
  const { failureId } = req.params;
  const failureInfo = pendingFailures[failureId];

  if (!failureInfo) {
    return res.status(404).json({ message: 'Failure ID not found or already processed.' });
  }

  console.log(`[API /api/convert-to-manual] User chose to CONVERT TO MANUAL for failure ID: ${failureId}. Details:`, failureInfo);
  // TODO: Implement logic to signal the agent to halt autonomous execution.
  // The agent might then provide remaining steps or context to the user for manual completion.
  delete pendingFailures[failureId];
  res.json({ message: `Task conversion to manual for ${failureId} acknowledged. Agent would halt autonomous operations.` });
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

app.get('/api/instructions/:agentType', (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.post('/api/instructions/:agentType', (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.get('/api/instructions/conference_agent/:agentRole', (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
app.post('/api/instructions/conference_agent/:agentRole', (req, res) => { res.status(501).json({message: "Not fully implemented in this refactor pass"}); });
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
