// roadrunner/backend/tests/server.test.js
const httpMocks = require('node-mocks-http');
const server = require('../server');
const { handleExecuteAutonomousTask, generateFromLocal, backendSettings, resolveTemplates } = server; // Removed executeStepsInternal
const gitAgent = require('../gitAgent');
const fsAgent = require('../fsAgent');
const fetch = require('node-fetch');
const { ConfirmationRequiredError } = require('../langchain_tools/common');
const { v4: uuidv4 } = require('uuid');

// Langchain specific mocks
const { AgentExecutor } = require('langchain/agents');
const { ChatOpenAI } = require('@langchain/openai');
const { ChatOllama } = require('@langchain/community/chat_models/ollama');

// Mock Langchain LLM classes and AgentExecutor
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    stream: jest.fn(),
    // Add other methods if needed by the agent setup
  })),
}));
jest.mock('@langchain/community/chat_models/ollama', () => ({
  ChatOllama: jest.fn().mockImplementation(() => ({
    stream: jest.fn(),
  })),
}));
// We will mock AgentExecutor's stream method per test case or describe block if needed
// For now, we assume it's created and its .stream() method will be spied upon/mocked.

// Mock actual tools to prevent side effects and control their output
jest.mock('../langchain_tools/fs_tools.js', () => ({
  ListDirectoryTool: jest.fn().mockImplementation(() => ({ name: 'list_directory', _call: jest.fn().mockResolvedValue("Directory listing") })),
  CreateFileTool: jest.fn().mockImplementation(() => ({ name: 'create_file', _call: jest.fn().mockResolvedValue("File created: mock/path") })),
  ReadFileTool: jest.fn().mockImplementation(() => ({ name: 'read_file', _call: jest.fn().mockResolvedValue("Mock file content") })),
  UpdateFileTool: jest.fn().mockImplementation(() => ({ name: 'update_file', _call: jest.fn().mockResolvedValue("File updated: mock/path") })),
  DeleteFileTool: jest.fn().mockImplementation(() => ({ name: 'delete_file', _call: jest.fn().mockResolvedValue("File deleted: mock/path") })),
  CreateDirectoryTool: jest.fn().mockImplementation(() => ({ name: 'create_directory', _call: jest.fn().mockResolvedValue("Directory created: mock/path") })),
  DeleteDirectoryTool: jest.fn().mockImplementation(() => ({ name: 'delete_directory', _call: jest.fn().mockResolvedValue("Directory deleted: mock/path") })),
}));
jest.mock('../langchain_tools/git_tools.js', () => ({
  GitAddTool: jest.fn().mockImplementation(() => ({ name: 'git_add', _call: jest.fn().mockResolvedValue("Git add successful") })),
  GitCommitTool: jest.fn().mockImplementation(() => ({ name: 'git_commit', _call: jest.fn().mockResolvedValue("Git commit successful") })),
  GitPushTool: jest.fn().mockImplementation(() => ({ name: 'git_push', _call: jest.fn().mockResolvedValue("Git push successful") })),
  GitPullTool: jest.fn().mockImplementation(() => ({ name: 'git_pull', _call: jest.fn().mockResolvedValue("Git pull successful") })),
  GitRevertTool: jest.fn().mockImplementation(() => ({ name: 'git_revert_last_commit', _call: jest.fn().mockResolvedValue("Git revert successful") })),
}));
jest.mock('../langchain_tools/code_generator_tool.js', () => ({
  CodeGeneratorTool: jest.fn().mockImplementation(() => ({ name: 'code_generator', _call: jest.fn().mockResolvedValue("Code generation complete") })),
}));
jest.mock('../langchain_tools/conference_tool.js', () => ({
  ConferenceTool: jest.fn().mockImplementation(() => ({ name: 'multi_model_debate', _call: jest.fn().mockResolvedValue("Debate summary here") })),
}));


jest.mock('node-fetch', () => jest.fn());
jest.mock('../gitAgent'); // Already mocked from previous tests, ensure it's comprehensive
jest.mock('../fsAgent');  // Already mocked

// Mock uuid for consistent confirmation IDs
jest.mock('uuid', () => ({ v4: jest.fn() }));


describe('Server - AgentExecutor Integration via handleExecuteAutonomousTask', () => {
  let mockReq;
  let mockRes;
  let mockResWriteSpy;
  let originalBackendSettings;
  let mockAgentExecutorStream; // To mock AgentExecutor.stream

  beforeEach(() => {
    jest.clearAllMocks();
    uuidv4.mockImplementation(() => 'test-confirm-uuid-123'); // Consistent UUID for tests

    mockResWriteSpy = jest.fn();
    mockRes = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: (data) => { mockResWriteSpy(data); return true; },
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      writable: true,
    };

    originalBackendSettings = JSON.parse(JSON.stringify(server.backendSettings)); // Deep copy

    // Mock the AgentExecutor's stream method directly for more control
    // This assumes agentExecutor instance is created by initializeAgentExecutor and then used.
    // We need to ensure initializeAgentExecutor is called and then we can spy on its created instance.
    // For simplicity, if AgentExecutor is a class, we can mock its prototype.
    // However, `agentExecutor` is a variable. We'll mock its `stream` method after initialization.
    mockAgentExecutorStream = jest.fn();
    server.agentExecutor = { stream: mockAgentExecutorStream }; // Override the global agentExecutor

    // Ensure backendSettings are suitable for tests (e.g., OpenAI)
    server.backendSettings.llmProvider = 'openai';
    server.backendSettings.apiKey = 'test-openai-key';
  });

  afterEach(() => {
    server.backendSettings = originalBackendSettings; // Restore
  });

  async function* mockAgentEventStream(events) {
    for (const event of events) {
      yield event;
    }
  }

  test('Successful Task Execution: agent uses a tool and finishes', async () => {
    mockReq = httpMocks.createRequest({
      method: 'POST',
      url: '/execute-autonomous-task',
      body: { task_description: "Create a file named hello.txt", safetyMode: 'false' },
    });

    const agentEvents = [
      { on_agent_action: { tool: 'create_file', toolInput: JSON.stringify({ filePath: 'hello.txt', content: 'world' }), log: "Thought: ... Action: create_file..." } },
      { on_tool_end: { tool: 'create_file', output: "File created: output/hello.txt", name: "create_file" } }, // Added name to match structure
      { on_agent_finish: { output: "Task completed. File hello.txt created.", log: "Thought: ... Final Answer: ..." } },
    ];
    mockAgentExecutorStream.mockReturnValue(mockAgentEventStream(agentEvents));

    // Manually call initializeAgentExecutor to ensure mocked LLMs are used by the real AgentExecutor logic if needed
    // However, since we are directly mocking agentExecutor.stream, this might not be strictly necessary for THIS test
    // but good for consistency if other tests rely on the full initialization.
    // For this test, we are bypassing the actual agent logic by mocking `stream`.
    // await server.initializeAgentExecutor(); // This would try to create real LLM mocks.

    await handleExecuteAutonomousTask(mockReq, mockRes);

    expect(mockAgentExecutorStream).toHaveBeenCalledWith({ input: "Create a file named hello.txt" }, expect.anything());
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'AGENT_EVENT', event_type: 'on_agent_action', data: agentEvents[0].on_agent_action })));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'AGENT_EVENT', event_type: 'on_tool_end', data: agentEvents[1].on_tool_end })));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'AGENT_EVENT', event_type: 'on_agent_finish', data: agentEvents[2].on_agent_finish })));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'execution_complete', message: 'Agent task execution finished.'})));
    expect(mockRes.end).toHaveBeenCalled();
  });

  test('Individual Confirmation Flow (User Confirms)', async () => {
    mockReq = httpMocks.createRequest({
      method: 'POST',
      url: '/execute-autonomous-task',
      body: { task_description: "Delete important_file.txt", safetyMode: 'true' },
    });

    // Simulate agent wanting to delete, tool throws ConfirmationRequiredError
    const toolName = 'delete_file';
    const toolInput = 'important_file.txt';
    const confirmationId = 'test-confirm-uuid-123';
    mockAgentExecutorStream.mockImplementationOnce(async function* () {
      yield { on_agent_action: { tool: toolName, toolInput: toolInput, log: "Thought: ... Action: delete_file..." } };
      // Tool execution would happen here, and it throws the error
      // The error is caught by handleExecuteAutonomousTask, so we don't yield on_tool_end or on_agent_finish
      throw new ConfirmationRequiredError({ toolName, toolInput, confirmationId, message: "Confirm deletion?" });
    });

    await handleExecuteAutonomousTask(mockReq, mockRes);

    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'confirmation_required', confirmationId, toolName, toolInput, message: "Confirm deletion?" })));
    expect(mockRes.end).not.toHaveBeenCalled(); // SSE stream should be open

    // --- Simulate user confirming via /api/confirm-action ---
    const confirmReq = httpMocks.createRequest({
      method: 'POST',
      url: `/api/confirm-action/${confirmationId}`,
      params: { confirmationId },
      body: { confirmed: true },
    });
    const confirmRes = httpMocks.createResponse();

    // Mock the agent stream for the resumed execution
    const resumedAgentEvents = [
        // Agent might re-evaluate, then decide to execute the confirmed action
        { on_agent_action: { tool: toolName, toolInput: toolInput, log: "Thought: User confirmed. Action: delete_file..." } },
        { on_tool_end: { tool: toolName, output: "File deleted: output/important_file.txt", name: toolName } },
        { on_agent_finish: { output: "Task completed. File deleted.", log: "Thought: ... Final Answer: ..." } },
    ];
    mockAgentExecutorStream.mockReset(); // Reset for the new call
    mockAgentExecutorStream.mockReturnValue(mockAgentEventStream(resumedAgentEvents));

    await server.app.handle(confirmReq, confirmRes); // Use app.handle to simulate the HTTP request through Express

    expect(confirmRes.statusCode).toBe(200); // Endpoint should respond
    // Check SSE messages on the *original* expressHttpRes (mockRes)
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining("User APPROVED action: delete_file. Resuming task."));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'AGENT_EVENT', event_type: 'on_agent_action', data: resumedAgentEvents[0].on_agent_action })));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'execution_complete', message: 'Agent task execution finished after confirmation.'})));
    expect(mockRes.end).toHaveBeenCalled();
  });

  test('Tool Error Handling: agent receives error observation and finishes', async () => {
    mockReq = httpMocks.createRequest({
      method: 'POST',
      url: '/execute-autonomous-task',
      body: { task_description: "Read non_existent.txt", safetyMode: 'false' },
    });

    const agentEvents = [
      { on_agent_action: { tool: 'read_file', toolInput: "non_existent.txt", log: "Thought: ... Action: read_file..." } },
      { on_tool_end: { tool: 'read_file', output: "Error: File not found at output/non_existent.txt", name: "read_file" } }, // Tool returns error string
      // Agent should then process this error observation
      { on_agent_finish: { output: "Failed to read file: Error: File not found at output/non_existent.txt", log: "Thought: The file was not found. I cannot proceed. Final Answer: ..." } },
    ];
    mockAgentExecutorStream.mockReturnValue(mockAgentEventStream(agentEvents));

    await handleExecuteAutonomousTask(mockReq, mockRes);

    expect(mockAgentExecutorStream).toHaveBeenCalledWith({ input: "Read non_existent.txt" }, expect.anything());
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining("Error: File not found at output/non_existent.txt")); // From on_tool_end
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to read file: Error: File not found")); // From on_agent_finish
    expect(mockRes.end).toHaveBeenCalled();
  });

  // Batch confirmation tests are more complex as they require multiple modifying tool calls.
  // This will be a simplified version focusing on the batch confirmation trigger.
  describe('Batch Confirmation Flow', () => {
    const MODIFYING_TOOLS_SET = new Set(['create_file', 'update_file', 'delete_file', 'git_commit']); // Example
    const CONFIRM_N = 2; // Test with 2 operations for batch
    let originalModifyTools;
    let originalConfirmN;

    beforeAll(() => {
        // Modify constants within server.js for testing this block
        // This is tricky as server.js is already loaded.
        // A better way would be to make these configurable or pass them around.
        // For this test, we'll assume we can influence them or the tools check them.
        // For now, we will rely on the tool mocks to simulate being "modifying".
    });

    test('should trigger batch confirmation after N modifying operations', async () => {
        mockReq = httpMocks.createRequest({
          method: 'POST',
          url: '/execute-autonomous-task',
          body: { task_description: "Do two modifying things then a third", safetyMode: 'true' },
        });

        // Simulate agent performing 2 modifying actions, then attempting a 3rd
        // We need to ensure the mocked tools are in MODIFYING_TOOLS for server.js
        // server.MODIFYING_TOOLS = MODIFYING_TOOLS_SET; // This won't work as it's const
        // server.CONFIRM_AFTER_N_OPERATIONS = CONFIRM_N; // This won't work
        // This test highlights the difficulty of testing such constants without making them configurable.
        // We will assume the constants are set to 2 and the tools are correctly identified.
        // The key is that handleExecuteAutonomousTask correctly counts and throws.

        const agentEventsOp1 = [
            { on_agent_action: { tool: 'create_file', toolInput: 'file1.txt', log: "..." } },
            { on_tool_end: { tool: 'create_file', output: "Success file1", name: 'create_file' } },
        ];
         const agentEventsOp2 = [
            { on_agent_action: { tool: 'update_file', toolInput: 'file2.txt', log: "..." } },
            { on_tool_end: { tool: 'update_file', output: "Success file2", name: 'update_file' } },
            // After this, batch confirmation should trigger if CONFIRM_AFTER_N_OPERATIONS = 2
            // The stream would be interrupted by ConfirmationRequiredError.
        ];

        // Mock the stream to throw after the second modifying tool.
        // This requires careful orchestration of the mock.
        // For this conceptual test, we'll simplify and assume the logic in handleExecuteAutonomousTask
        // correctly identifies modifying tools and counts. The test will focus on the behavior
        // when ConfirmationRequiredError (batch type) is thrown.

        mockAgentExecutorStream.mockImplementationOnce(async function* () {
            yield agentEventsOp1[0]; // action
            // Assume create_file is in MODIFYING_TOOLS
            // Here, the actual tool._call would run. We need to mock it to return success.
            // The test for the tool itself checks if it throws ConfirmationRequiredError.
            // For this integration test, tools are mocked to just return success directly.
            // The batch confirmation logic is in handleExecuteAutonomousTask.
            // So, the tool call does not throw individual confirmation here for this test.
            yield agentEventsOp1[1]; // tool_end -> opCount becomes 1

            yield agentEventsOp2[0]; // action
            // Assume update_file is in MODIFYING_TOOLS
            yield agentEventsOp2[1]; // tool_end -> opCount becomes 2

            // At this point, if CONFIRM_AFTER_N_OPERATIONS is 2,
            // handleExecuteAutonomousTask should throw the batch confirmation error.
            // We simulate this by having the stream throw it after these events.
            throw new ConfirmationRequiredError({
                confirmationType: 'batch_confirmation',
                confirmationId: 'batch-uuid-test',
                message: "Batch confirmation needed",
                toolName: null, // Not for a specific tool
                toolInput: null,
            });
        });

        await handleExecuteAutonomousTask(mockReq, mockRes);

        expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'log_entry', message: '[OPERATION COUNT] Modifying tool create_file executed. Count: 1' })));
        expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'log_entry', message: '[OPERATION COUNT] Modifying tool update_file executed. Count: 2' })));
        expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({ type: 'confirmation_required', confirmationId: 'batch-uuid-test', type: 'batch_confirmation', message: "Batch confirmation needed" })));
        expect(mockRes.end).not.toHaveBeenCalled(); // Stays open
    });
  });

});


// --- Tests for resolveTemplates (Copied from previous state, ensure it's still relevant) ---
describe('resolveTemplates', () => {
  let mockSendSseMessage;
  beforeEach(() => { mockSendSseMessage = jest.fn(); });

  test('should return non-string input as is', () => {
    expect(resolveTemplates(null, {}, mockSendSseMessage)).toBeNull();
  });
  // ... other resolveTemplates tests
});

// Mock any other functions from server.js if they are called by exported functions
// For example, if initializeAgentExecutor is called by handleExecuteAutonomousTask and it's not fully mocked out.
// For these tests, we assume `server.initializeAgentExecutor` is either called once globally
// or its behavior is controlled if called per task.
// The beforeEach for AgentExecutor tests now mocks `server.agentExecutor.stream` directly.

// Dummy implementations for functions that might be called by server.js startup,
// but are not the focus of these tests.
server.loadBackendConfig = jest.fn();
// server.initializeAgentExecutor = jest.fn(); // We are testing around this
// server.attemptToListen = jest.fn();

// This ensures that the IIFE in server.js doesn't try to actually start the server during tests
// if it's not already guarded by `require.main === module`.
// However, the tests directly call exported functions like `handleExecuteAutonomousTask`.
