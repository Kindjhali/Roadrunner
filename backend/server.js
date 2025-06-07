// --- Global Error Handlers for Backend Stability ---
process.on('uncaughtException', (error, origin) => {
  console.error(`[Backend CRITICAL] Uncaught Exception at: ${origin}`);
  console.error('[Backend CRITICAL] Error details:', error);
  process.exit(1); // Recommended to exit after an uncaught exception
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

// Import tools and custom error
const { ListDirectoryTool, CreateFileTool, ReadFileTool, UpdateFileTool, DeleteFileTool, CreateDirectoryTool, DeleteDirectoryTool } = require('./langchain_tools/fs_tools');
const { GitAddTool, GitCommitTool, GitPushTool, GitPullTool, GitRevertTool } = require('./langchain_tools/git_tools');
const { CodeGeneratorTool } = require('./langchain_tools/code_generator_tool');
const { ConferenceTool } = require('./langchain_tools/conference_tool'); // Added ConferenceTool
const { ConfirmationRequiredError } = require('./langchain_tools/common');

// Initialize Tools
const tools = [
  new ListDirectoryTool(), new CreateFileTool(), new ReadFileTool(), new UpdateFileTool(), new DeleteFileTool(), new CreateDirectoryTool(), new DeleteDirectoryTool(),
  new GitAddTool(), new GitCommitTool(), new GitPushTool(), new GitPullTool(), new GitRevertTool(),
  new CodeGeneratorTool(),
  new ConferenceTool(), // Added ConferenceTool instance
];

// Agent and AgentExecutor definition
let agentExecutor; // Will be initialized by initializeAgentExecutor()
let agent; // The Langchain agent instance, also initialized by initializeAgentExecutor()

// Prompt for OpenAI Functions Agent
const AGENT_PROMPT_TEMPLATE_OPENAI = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. Use the provided tools to answer the user's questions. Respond with a tool call if appropriate, otherwise respond to the user directly."],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"], // Stores intermediate steps for the agent.
]);

// Standard ReAct prompt template structure for Ollama and other non-function-calling models
const REACT_AGENT_PROMPT_TEMPLATE = `Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format STRICTLY:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action. For tools expecting JSON, this MUST be a valid JSON string. For tools expecting a simple string, this is the string itself.
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

**HANDLING TOOL ERRORS:**
If the 'Observation' you receive from a tool clearly indicates an error (e.g., it starts with "Error:", "Failed to:", "File not found:", "Invalid input:"), you MUST treat this seriously.
1.  In your 'Thought': Acknowledge the specific error message.
2.  Analyze the error: Was it due to a wrong path, missing resource, incorrect input format, or a tool limitation?
3.  Avoid immediately retrying the exact same action with the exact same input if the error suggests it will fail again (e.g., a file definitely does not exist).
4.  Consider alternatives:
    *   Can you use a different tool?
    *   Can you modify the input to the previous tool (e.g., correct a path, change a parameter)?
    *   Is there a preliminary step you missed (e.g., needing to create a directory before a file, or list files to find the correct name)?
5.  If the error is unrecoverable or prevents task completion, your 'Final Answer:' should clearly state the error and why you cannot proceed.
Do not ignore errors; use them to make better decisions.

**IMPORTANT: HANDLING USER DENIALS:**
If an 'Observation' explicitly states that a user has denied a previous action (e.g., 'User denied action: create_file...'), you MUST NOT immediately retry the exact same action with the exact same input.
Instead, you MUST:
1.  Acknowledge the denial in your 'Thought' process.
2.  Re-evaluate the original task and your previous plan.
3.  Consider alternative tools or a different sequence of actions to achieve the goal.
4.  If you believe the same tool is necessary, consider how its input could be modified to be acceptable (though the user's reason for denial may not always be clear to you).
5.  If no alternative is found, your 'Final Answer:' should clearly state why the task cannot be completed due to the denial.
Your goal is to still try to complete the task, but respectfully and adaptively to user feedback.

Example of using a tool that requires JSON input:
Question: Create a file named 'example.txt' with content 'hello'.
Thought: I need to create a file. The 'create_file' tool is appropriate. It requires a JSON string with 'filePath' and 'content'.
Action: create_file
Action Input: {{"filePath": "example.txt", "content": "hello"}}
Observation: File created successfully at output/example.txt

Example of using a tool that requires a simple string input:
Question: What is in the 'docs' folder?
Thought: I need to list directory contents. The 'list_directory' tool is appropriate. It takes a relative path string.
Action: list_directory
Action Input: docs
Observation: docs/\n  guide.md\n  api.md

Begin!

Question: {input}
Thought:{agent_scratchpad}`;

/**
 * Initializes the Langchain agent and executor based on the backend LLM provider settings.
 * For OpenAI, it creates an OpenAI Functions Agent.
 * For Ollama, it creates a ReAct Agent.
 * The agentExecutor is stored globally for use by task handlers.
 */
async function initializeAgentExecutor() {
  console.log("[Agent Init] Initializing AgentExecutor...");
  const llmProvider = backendSettings.llmProvider; // Determined from backend_config.json
  let llm;

  if (llmProvider === 'openai') {
    const effectiveOpenAIApiKey = backendSettings.apiKey || backendSettings.openaiApiKey;
    const openAIModelName = backendSettings.defaultOpenAIModel || 'gpt-4-turbo';
    if (!effectiveOpenAIApiKey) {
      console.error("[Agent Init] OpenAI API key is missing. OpenAI agent will not be functional.");
      // Proceeding, but calls will fail if key is truly needed by the SDK at this stage or during execution.
      llm = new ChatOpenAI({ apiKey: effectiveOpenAIApiKey, modelName: openAIModelName, streaming: true, temperature: 0 });
    } else {
       llm = new ChatOpenAI({ apiKey: effectiveOpenAIApiKey, modelName: openAIModelName, streaming: true, temperature: 0 });
       console.log(`[Agent Init] OpenAI LLM created with model ${openAIModelName}.`);
    }
    agent = await createOpenAIFunctionsAgent({ llm, tools, prompt: AGENT_PROMPT_TEMPLATE_OPENAI });
    console.log("[Agent Init] OpenAI Functions Agent created successfully.");
  } else { // Default to Ollama
    const ollamaModelName = backendSettings.defaultOllamaModel || 'llama3';
    console.log(`[Agent Init] Ollama provider selected. Model: ${ollamaModelName}`);
    llm = new ChatOllama({ baseUrl: OLLAMA_BASE_URL, model: ollamaModelName, temperature: 0 });
    console.log(`[Agent Init] ChatOllama LLM created with model ${ollamaModelName}.`);

    const reactPrompt = PromptTemplate.fromTemplate(REACT_AGENT_PROMPT_TEMPLATE);
    agent = await createReactAgent({
      llm,
      tools,
      prompt: reactPrompt,
      // outputParser: new StringOutputParser(), // createReactAgent may infer this or use its own. Explicitly not needed for standard setup.
      // The following are not standard params for createReactAgent.
      // toolsBuffer: renderTextDescription(tools),
      // toolNames: tools.map((tool) => tool.name).join(", "),
    });
    console.log("[Agent Init] Ollama ReAct Agent created successfully.");
  }

  agentExecutor = new AgentExecutor({
    agent,
    tools,
    returnIntermediateSteps: true, // Essential for streaming intermediate steps via SSE
    maxIterations: 15, // Default value, can be adjusted
    // handleParsingErrors: true, // Consider adding for robustness with ReAct agents
  });
  console.log("[Agent Init] AgentExecutor created.");
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
          // Fallback to example or create default if they don't exist
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

const LOG_DIR_DEFAULT = path.resolve(__dirname, '../../logs'); // Adjusted default
const WORKSPACE_DIR_DEFAULT = path.resolve(__dirname, '../../output'); // Adjusted default
const LOG_DIR = fs.existsSync(path.join(__dirname, 'config/backend_config.json')) ? (JSON.parse(fs.readFileSync(path.join(__dirname, 'config/backend_config.json'), 'utf-8')).logDir || LOG_DIR_DEFAULT) : LOG_DIR_DEFAULT;
const WORKSPACE_DIR = fs.existsSync(path.join(__dirname, 'config/backend_config.json')) ? (JSON.parse(fs.readFileSync(path.join(__dirname, 'config/backend_config.json'), 'utf-8')).workspaceDir || WORKSPACE_DIR_DEFAULT) : WORKSPACE_DIR_DEFAULT;

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

// In-memory store for pending tool confirmations
const pendingToolConfirmations = {};

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function generateFromLocal(originalPrompt, modelName, expressRes, options = {}) {
    const provider = options.llmProvider || backendSettings.llmProvider;
    let accumulatedResponse = '';
    let finalPrompt = originalPrompt;

    // Instruction application can be added here if needed, based on options.agentType, etc.
    // For simplicity, assuming instructions are pre-applied or handled by the agent's main prompt.

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

/**
 * Parses the task payload from the request.
 * Focuses on extracting 'task_description' and 'safetyMode'.
 * 'steps' and 'isAutonomousMode' are no longer primary drivers for agent execution.
 */
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
    const safetyMode = safetyModeString !== 'false'; // Defaults to true
    return { task_description, safetyMode }; // Only return relevant fields
}

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Handles requests to execute autonomous tasks using the Langchain AgentExecutor.
 * Streams agent actions, tool outputs, and errors via SSE.
 * Manages the confirmation flow for tools that require user approval in safety mode.
 */
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

    if (!agentExecutor) {
        try {
            await initializeAgentExecutor();
        } catch (initError) {
            console.error("[Agent Handling] CRITICAL: AgentExecutor initialization failed:", initError);
            sendSseMessage('error', { content: `AgentExecutor initialization failed: ${initError.message}` });
            // Do not call execution_complete here, finally block will handle it.
            if (expressHttpRes.writable) expressHttpRes.end(); // End if init fails
            return;
        }
    }

    sendSseMessage('log_entry', { message: `[SSE Agent] Starting agent execution for goal: "${task_description}" with Safety Mode: ${safetyMode}` });
    overallExecutionLog.push(`[Agent Execution] Starting for goal: "${task_description}", Safety Mode: ${safetyMode}`);

    let currentTaskInput = task_description;
    let agentConfig = {
      configurable: {
        safetyMode: safetyMode,
        originalExpressHttpRes: expressHttpRes,
        sendSseMessage: sendSseMessage,
        // llm: agent.llm, // Pass the agent's LLM if tools need to know the specific instance. generateFromLocal resolves this.
      }
    };

    let errorOccurred = false;
    try {
        const eventStream = await agentExecutor.stream({ input: currentTaskInput }, agentConfig);
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
                originalTaskDescription: currentTaskInput,
                agentConfig,
                toolName, toolInput, safetyMode, originalExpressHttpRes: expressHttpRes, sendSseMessage, overallExecutionLog,
            };
            sendSseMessage('confirmation_required', { confirmationId, toolName, toolInput, message: confirmationMessage });
            // Do NOT end expressHttpRes here for confirmation
            return;
        } else {
            console.error(`[Agent Handling] Error during agent execution for goal "${task_description}":`, error);
            overallExecutionLog.push(`[Agent Execution] ❌ Error: ${error.message}`);
            sendSseMessage('error', { content: `Agent execution error: ${error.message}` });
        }
    } finally {
        // Only end the response if it hasn't been kept alive for confirmation AND an error didn't already end it implicitly
        const isPendingConfirmation = Object.values(pendingToolConfirmations).some(p => p.originalExpressHttpRes === expressHttpRes);
        if (expressHttpRes.writable && !isPendingConfirmation) {
            if (errorOccurred && ! (error instanceof ConfirmationRequiredError) ) { // If an error other than ConfirmationRequiredError occurred
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

/**
 * Handles user confirmation for a tool action that required it due to safetyMode.
 * Resumes agent execution with the user's approval or denial.
 */
app.post('/api/confirm-action/:confirmationId', async (req, res) => {
    const { confirmationId } = req.params;
    const { confirmed } = req.body; // User's decision: true or false
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

    let agentInputText;
    const toolInputString = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput);
    let resumedAgentConfig = {
        configurable: {
            ...originalAgentConfig.configurable,
            isConfirmedActionForTool: {
                [toolName]: { [toolInputString]: confirmed }
            }
        }
    };

    if (confirmed) {
        sendSseMessage('log_entry', { message: `[SSE Agent] User APPROVED action: ${toolName}. Resuming task.` });
        overallExecutionLog.push(`[Agent Confirmation] User APPROVED action: ${toolName}, Input: ${toolInputString}.`);
        agentInputText = `Observation: User has approved your proposed action: Tool='${toolName}' with Input='${toolInputString}'. Your original task was: '${originalTaskDescription}'. Please proceed with the task, using this approval.`;
    } else {
        sendSseMessage('log_entry', { message: `[SSE Agent] User DENIED action: ${toolName}. Informing agent.` });
        overallExecutionLog.push(`[Agent Confirmation] User DENIED action: ${toolName}, Input: ${toolInputString}.`);
        agentInputText = `Observation: User has denied your proposed action: Tool='${toolName}' with Input='${toolInputString}'. Do not retry this exact action. Your original task was: '${originalTaskDescription}'. You must now re-plan. Analyze why this action might have been denied (e.g., safety, incorrect path, unwanted overwrite) and devise an alternative strategy or tool usage to achieve the original task. If you cannot find an alternative, explain why. Proceed with your new thought process.`;
    }

    let errorOccurredInResume = false;
    try {
        console.log(`[API /api/confirm-action] Re-invoking agent. New Input: "${agentInputText.substring(0,100)}...", Config: ${JSON.stringify(resumedAgentConfig.configurable)}`);
        const eventStream = await agentExecutor.stream({ input: agentInputText }, resumedAgentConfig);
        for await (const event of eventStream) {
            const eventType = Object.keys(event)[0];
            const eventData = event[eventType];
            sendSseMessage('agent_event', { event_type: eventType, data: eventData });
            if (eventType === "on_agent_action") { /* ... log ... */ } else if (eventType === "on_tool_end") { /* ... log ... */ }
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
                originalTaskDescription, agentConfig: resumedAgentConfig, // Pass the latest config
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

// --- Existing Endpoints (Settings, Ollama Models, Instructions, etc.) ---
// These should be maintained as they are, unless directly impacted by agent changes.
// For brevity, their full code is not repeated here but assumed to be part of the final file.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/settings', (req, res) => { /* ... */ res.json(backendSettings); });
app.post('/api/settings', (req, res) => { /* ... */ });
app.post('/api/config/openai-key', (req, res) => { /* ... */ });

app.get('/api/ollama-models/categorized', async (req, res) => { /* ... */ });
app.post('/api/ollama/pull-model', async (req, res) => { /* ... */ });

app.get('/api/instructions/:agentType', (req, res) => { /* ... */ });
app.post('/api/instructions/:agentType', (req, res) => { /* ... */ });
app.get('/api/instructions/conference_agent/:agentRole', (req, res) => { /* ... */ });
app.post('/api/instructions/conference_agent/:agentRole', (req, res) => { /* ... */ });

// The old /execute-conference-task is deprecated in favor of ConferenceTool.
app.post('/execute-conference-task', async (req, res) => {
    console.warn("[Deprecated Endpoint] /execute-conference-task was called. Use agent with 'multi_model_debate' tool instead.");
    res.status(501).json({ message: "This endpoint is deprecated. Please use the agent with the 'multi_model_debate' tool."});
});

// Removed LogCore related endpoints as per previous refactoring.
// app.get('/api/logs/search', ...);
// app.get('/api/logs/export', ...);


// --- Server Startup ---
async function main() {
  try {
    console.log('[Server Startup] Checking Ollama status...');
    // Basic Ollama check, actual startOllama might be more complex
    let ollamaReady = false;
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if(response.ok) ollamaReady = true;
    } catch(e) { /* ignore */ }

    if (!ollamaReady) {
      console.warn('[Server Startup] Ollama not detected or not responsive. LLM features relying on local Ollama may fail.');
    } else {
      console.log('[Server Startup] Ollama reported as operational.');
    }

    await initializeAgentExecutor(); // Initialize agent system
    console.log('[Server Startup] AgentExecutor initialized.');

    if (require.main === module) {
      const initialPort = parseInt(process.env.PORT || '3030', 10);
      // attemptToListen(initialPort); // Assuming attemptToListen is defined elsewhere
       app.listen(initialPort, () => {
        console.log(`[Server Startup] Roadrunner backend server listening on port ${initialPort}`);
      }).on('error', (err) => {
        console.error('[Server Startup] Error during server listen:', err);
        process.exit(1);
      });
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
  // resolveTemplates, // Not explicitly exported unless tests need it directly
};
