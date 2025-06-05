// roadrunner/backend/tests/server.test.js
const httpMocks = require('node-mocks-http');
// IMPORTANT: The line below assumes that server.js is modified to export handleExecuteAutonomousTask and generateFromLocal
// e.g., module.exports = { handleExecuteAutonomousTask, generateFromLocal, backendSettings, ... };
const server = require('../server'); // Import the whole module
// IMPORTANT: Ensure resolveTemplates is imported from server module
// Update this line to include executeStepsInternal:
const { handleExecuteAutonomousTask, generateFromLocal, backendSettings, resolveTemplates, executeStepsInternal } = server;
const gitAgent = require('../gitAgent');
const fsAgent = require('../fsAgent');
const fetch = require('node-fetch'); // Import actual fetch for types, but we'll mock it
// generateFromLocal is defined within server.js. We are testing it directly.

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

// Mock gitAgent
jest.mock('../gitAgent', () => ({
  gitRevertLastCommit: jest.fn().mockResolvedValue({ success: true, message: 'Mocked revert' }),
  gitAdd: jest.fn().mockResolvedValue({ success: true, message: 'Mocked add' }),
  gitCommit: jest.fn().mockResolvedValue({ success: true, message: 'Mocked commit' }),
  gitPull: jest.fn().mockResolvedValue({ success: true, message: 'Mocked pull' }),
  gitPush: jest.fn().mockResolvedValue({ success: true, message: 'Mocked push' }),
  getGitLog: jest.fn().mockResolvedValue({ success: true, log: [] }),
  getGitStatus: jest.fn().mockResolvedValue({ success: true, status: '' }),
}));

// Mock fsAgent
jest.mock('../fsAgent', () => ({
  writeFile: jest.fn().mockResolvedValue({ success: true, path: 'mock/path' }),
  readFile: jest.fn().mockResolvedValue({ success: true, content: 'mock content' }),
  listFiles: jest.fn().mockResolvedValue({ success: true, files: [] }),
  resolvePathInWorkspace: jest.fn((p) => ({ success: true, fullPath: `/mock/workspace/${p}`, relativePath: p })), // Ensure this mock is compatible if used by generateFromLocal indirectly
  generateDirectoryTree: jest.fn().mockReturnValue("mock tree"), // Ensure this mock is compatible
  createDirectory: jest.fn().mockResolvedValue({ success: true, fullPath: 'mock/dir' }), // Ensure this mock is compatible
  updateFile: jest.fn().mockResolvedValue({ success: true, fullPath: 'mock/file' }),
  deleteFile: jest.fn().mockResolvedValue({ success: true, fullPath: 'mock/file' }),
  deleteDirectory: jest.fn().mockResolvedValue({ success: true, fullPath: 'mock/dir' }),
}));

// No need to mock '../llm' for generateFromLocal as it's part of server.js
// If generateFromLocal was called, we'd need a different strategy (e.g. spy or refactor server.js)

describe('Server - Git Operations via handleExecuteAutonomousTask for revert_last_commit', () => {
  let mockReq;
  let mockResWriteSpy; // To check what's written to SSE

  beforeEach(() => {
    jest.clearAllMocks();

    mockResWriteSpy = jest.fn(); // This will be our spy

    // Mock Express response object
    mockRes = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: (data) => { // Simulate res.write and call our spy
        mockResWriteSpy(data);
        return true;
      },
      end: jest.fn(),
      status: jest.fn().mockReturnThis(), // For chained calls like res.status(400).json(...)
      json: jest.fn(),
      writable: true, // Assume stream is writable
    };
  });

  test('should call gitRevertLastCommit with requireConfirmation: true when safetyMode is true', async () => {
    const taskSteps = [{ type: 'git_operation', details: { command: 'revert_last_commit' } }];
    mockReq = httpMocks.createRequest({
      method: 'GET',
      url: '/execute-autonomous-task',
      query: {
        task_description: 'Test revert last commit with safetyMode true',
        steps: JSON.stringify(taskSteps),
        safetyMode: 'true',
        isAutonomousMode: 'false',
      },
    });

    // This relies on handleExecuteAutonomousTask being exported from server.js
    await handleExecuteAutonomousTask(mockReq, mockRes);

    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledTimes(1);
    // Check the arguments passed to the mock
    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledWith(expect.objectContaining({ // Use objectContaining for flexibility
      requireConfirmation: true,
      isConfirmedAction: false,
    }));

    // Verify some SSE messages were sent via the spy
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"log_entry"'));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Processing Step 1: Type: git_operation'));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"execution_complete"'));
  });

  test('should call gitRevertLastCommit with requireConfirmation: false when safetyMode is false', async () => {
    const taskSteps = [{ type: 'git_operation', details: { command: 'revert_last_commit' } }];
    mockReq = httpMocks.createRequest({
      method: 'GET',
      url: '/execute-autonomous-task',
      query: {
        task_description: 'Test revert last commit with safetyMode false',
        steps: JSON.stringify(taskSteps),
        safetyMode: 'false',
        isAutonomousMode: 'false',
      },
    });

    await handleExecuteAutonomousTask(mockReq, mockRes);

    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledTimes(1);
    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledWith(expect.objectContaining({
      requireConfirmation: false,
      isConfirmedAction: false,
    }));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"execution_complete"'));
  });

  // Test for when gitRevertLastCommit itself indicates it needs confirmation (safetyMode=true path)
  test('should send confirmation_required if gitRevertLastCommit needs it (safetyMode=true)', async () => {
    gitAgent.gitRevertLastCommit.mockResolvedValueOnce({
      success: false, // Typically false if confirmation is needed before action
      confirmationNeeded: true,
      message: 'Are you sure you want to revert?',
      details: { someDetail: 'detail' }
    });

    const taskSteps = [{ type: 'git_operation', details: { command: 'revert_last_commit' } }];
    mockReq = httpMocks.createRequest({
      method: 'GET',
      url: '/execute-autonomous-task',
      query: {
        task_description: 'Test revert needs confirmation',
        steps: JSON.stringify(taskSteps),
        safetyMode: 'true', // safetyMode is true, so gitAgent options will have requireConfirmation: true
        isAutonomousMode: 'false',
      },
    });

    await handleExecuteAutonomousTask(mockReq, mockRes);

    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledTimes(1);
    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledWith(expect.objectContaining({
      requireConfirmation: true, // This is key from safetyMode=true
      isConfirmedAction: false,
    }));

    // Check that a confirmation_required SSE message was sent
    const confirmationCall = mockResWriteSpy.mock.calls.find(call => call[0].includes('"type":"confirmation_required"'));
    expect(confirmationCall).toBeDefined();
    const sseData = JSON.parse(confirmationCall[0].substring(5)); // Remove "data: " prefix
    expect(sseData.message).toBe('Are you sure you want to revert?');
    expect(sseData.details.type).toBe('git_confirmation'); // Check the nested type
    expect(sseData.details.command).toBe('revert_last_commit');
    expect(sseData.details.gitAgentDetails.someDetail).toBe('detail');
    // Ensure execution_complete is NOT called yet
    expect(mockResWriteSpy).not.toHaveBeenCalledWith(expect.stringContaining('"type":"execution_complete"'));
  });
});

// --- Tests for handleExecuteAutonomousTask - Output Chaining ---
describe('handleExecuteAutonomousTask - Output Chaining', () => {
  let mockReq;
  let mockRes;
  let mockResWriteSpy;
  let originalFsAgentCreateFile; // To mock fsAgent.createFile

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks, including fetch

    mockResWriteSpy = jest.fn();
    mockRes = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: (data) => {
        mockResWriteSpy(data);
        return true;
      },
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      writable: true,
    };

    // Mock fsAgent.createFile specifically for this test suite
    originalFsAgentCreateFile = fsAgent.createFile;
    fsAgent.createFile = jest.fn().mockReturnValue({ success: true, fullPath: '/mock/workspace/output.txt' });

    // Reset fetch mock before each test
    fetch.mockReset();
  });

  afterEach(() => {
    // Restore original fsAgent.createFile
    fsAgent.createFile = originalFsAgentCreateFile;
  });

  // Helper to create a mock ReadableStream for fetch
  async function* createMockFetchStream(lines) {
    for (const line of lines) {
      yield Buffer.from(line);
    }
  }

  test('should correctly chain output from an LLM step to a subsequent step using templating', async () => {
    const llmOutputForStep1 = "Dynamic Content From LLM";
    const steps = [
      {
        type: 'generic_step',
        details: {
          prompt: 'Generate some dynamic content',
          output_id: 'dynamic_data',
        },
      },
      {
        type: 'createFile', // Using createFile to consume the output
        details: {
          filePath: 'output.txt',
          content: 'Static prefix: {{outputs.dynamic_data}}',
        },
      },
    ];

    mockReq = httpMocks.createRequest({
      method: 'POST', // Or GET, depending on how you want to test
      url: '/execute-autonomous-task',
      body: { // Assuming POST
        task_description: 'Test output chaining with LLM',
        steps: JSON.stringify(steps),
        safetyMode: 'false', // Keep it simple, no safety prompts
        isAutonomousMode: 'false',
      },
    });

    // Mock the fetch call that generateFromLocal will make for the generic_step
    // This simulates Ollama response for simplicity
    const mockOllamaStream = [
      `{"response":"${llmOutputForStep1}","done":true}
`,
    ];
    fetch.mockResolvedValueOnce({
      ok: true,
      body: createMockFetchStream(mockOllamaStream),
      headers: new Map([['content-type', 'application/x-ndjson']]),
    });

    await handleExecuteAutonomousTask(mockReq, mockRes);

    // Verify fetch was called for the LLM step
    expect(fetch).toHaveBeenCalledTimes(1);
    const fetchCallBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(fetchCallBody.prompt).toBe('Generate some dynamic content');

    // Verify fsAgent.createFile was called for the second step
    expect(fsAgent.createFile).toHaveBeenCalledTimes(1);
    const createFileArgs = fsAgent.createFile.mock.calls[0];
    expect(createFileArgs[0]).toBe('output.txt'); // filePath
    expect(createFileArgs[1]).toBe(`Static prefix: ${llmOutputForStep1}`); // content with template resolved
    expect(createFileArgs[2]).toEqual(expect.objectContaining({
      requireConfirmation: false, // Because safetyMode is false
      isConfirmedAction: false
    }));

    // Verify relevant SSE messages
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining("Stored LLM response in context as output_id: 'dynamic_data'"));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining('File created: /mock/workspace/output.txt'));
    expect(mockResWriteSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"execution_complete"'));
    expect(mockRes.end).toHaveBeenCalled();
  });
});

// Mock generateFromLocal for executeStepsInternal tests specifically if needed,
// or ensure existing mocks for it (if any global ones) are suitable.
// For these tests, we want to control its behavior directly.
const mockGenerateFromLocal = jest.fn();

// --- Tests for executeStepsInternal (LLM-related steps) ---
describe('executeStepsInternal - LLM Steps', () => {
  let mockExpressHttpRes;
  let mockSendSseMessage;
  let overallExecutionLog;
  let taskContext;
  let originalGenerateFromLocal;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks

    // Store original generateFromLocal and spy on the server's generateFromLocal
    // This assumes 'server' is the module object from require('../server')
    // and generateFromLocal is a function on that module.
    // If generateFromLocal is not directly on 'server' but is a local function,
    // this approach needs adjustment (e.g. mocking node-fetch used by actual generateFromLocal).
    // However, generateFromLocal *is* exported, so we can spy on it.
    originalGenerateFromLocal = server.generateFromLocal; // Save original
    server.generateFromLocal = mockGenerateFromLocal; // Replace with mock

    mockExpressHttpRes = {
      write: jest.fn(),
      writable: true,
      end: jest.fn(), // Added for completeness
      // Add other methods like setHeader, flushHeaders if executeStepsInternal uses them directly
    };
    mockSendSseMessage = jest.fn();
    overallExecutionLog = [];
    taskContext = { outputs: {} };
  });

  afterEach(() => {
    server.generateFromLocal = originalGenerateFromLocal; // Restore original
  });

  test('should process generic_step and store LLM output if output_id is provided', async () => {
    const steps = [
      {
        type: 'generic_step',
        details: { prompt: 'Test prompt for generic step', output_id: 'generic_output' },
      },
    ];
    const expectedLLMResponse = 'LLM response for generic step';
    mockGenerateFromLocal.mockResolvedValue(expectedLLMResponse);

    await executeStepsInternal(
      mockExpressHttpRes,
      'Test Task',
      steps,
      taskContext,
      overallExecutionLog,
      0,
      mockSendSseMessage,
      false, // safetyMode
      0
    );

    expect(mockGenerateFromLocal).toHaveBeenCalledTimes(1);
    expect(mockGenerateFromLocal).toHaveBeenCalledWith(
      'Test prompt for generic step', // prompt
      backendSettings.defaultOllamaModel || 'codellama', // modelName (uses default)
      mockExpressHttpRes // expressHttpRes
    );
    expect(taskContext.outputs.generic_output).toBe(expectedLLMResponse);
    expect(mockSendSseMessage).toHaveBeenCalledWith('log_entry', { message: expect.stringContaining("Stored LLM response in context as output_id: 'generic_output'") });
    expect(mockSendSseMessage).toHaveBeenCalledWith('execution_complete', expect.any(Object));
  });

  test('should process create_file_with_llm_content, call LLM, and store output if output_id is provided (mocking fsAgent)', async () => {
    const steps = [
      {
        type: 'create_file_with_llm_content',
        details: {
          filePath: 'test.txt',
          prompt: 'LLM prompt for file content',
          output_id: 'file_content_output',
        },
      },
    ];
    const expectedLLMContent = 'Generated file content by LLM.';
    mockGenerateFromLocal.mockResolvedValue(expectedLLMContent);

    // Mock fsAgent.createFile for this test
    const originalFsAgentCreateFile = fsAgent.createFile;
    fsAgent.createFile = jest.fn().mockReturnValue({ success: true, fullPath: '/mock/workspace/test.txt' });

    await executeStepsInternal(
      mockExpressHttpRes,
      'Test Task File LLM',
      steps,
      taskContext,
      overallExecutionLog,
      0,
      mockSendSseMessage,
      false, // safetyMode
      0
    );

    expect(mockGenerateFromLocal).toHaveBeenCalledTimes(1);
    expect(mockGenerateFromLocal).toHaveBeenCalledWith(
      'LLM prompt for file content',
      backendSettings.defaultOllamaModel || 'codellama',
      mockExpressHttpRes
    );
    expect(fsAgent.createFile).toHaveBeenCalledTimes(1);
    expect(fsAgent.createFile).toHaveBeenCalledWith(
      'test.txt',
      expectedLLMContent,
      expect.objectContaining({ requireConfirmation: false, isConfirmedAction: false })
    );
    expect(taskContext.outputs.file_content_output).toBe(expectedLLMContent);
    expect(mockSendSseMessage).toHaveBeenCalledWith('log_entry', { message: expect.stringContaining("Stored content (from llm_prompt) in context as output_id: 'file_content_output'") });
    expect(mockSendSseMessage).toHaveBeenCalledWith('file_written', { path: '/mock/workspace/test.txt', message: expect.stringContaining('File created successfully') });
    expect(mockSendSseMessage).toHaveBeenCalledWith('execution_complete', expect.any(Object));

    fsAgent.createFile = originalFsAgentCreateFile; // Restore fsAgent.createFile
  });

  test('should handle LLM error in generic_step gracefully', async () => {
    const steps = [
      { type: 'generic_step', details: { prompt: 'Prompt that will cause error' } },
    ];
    const llmErrorMessage = '// LLM_ERROR: Simulated LLM error';
    mockGenerateFromLocal.mockResolvedValue(llmErrorMessage);

    await executeStepsInternal(
      mockExpressHttpRes,
      'Test Task LLM Error',
      steps,
      taskContext,
      overallExecutionLog,
      0,
      mockSendSseMessage,
      false, // safetyMode
      0
    );
    expect(mockGenerateFromLocal).toHaveBeenCalledTimes(1);
    // Check for step_failed_options SSE message
    const stepFailedCall = mockSendSseMessage.mock.calls.find(call => call[0] === 'step_failed_options');
    expect(stepFailedCall).toBeDefined();
    expect(stepFailedCall[1].errorDetails.message).toContain('LLM generation failed.');
    expect(stepFailedCall[1].errorDetails.details.originalError).toBe(llmErrorMessage);
    // execution_complete should NOT be called if a step fails and pauses
    expect(mockSendSseMessage).not.toHaveBeenCalledWith('execution_complete', expect.any(Object));
  });

  test('execute_generic_task_with_llm should behave like generic_step for LLM interaction', async () => {
    const steps = [
      {
        type: 'execute_generic_task_with_llm', // Different type name, same expected behavior
        details: { description: 'Test prompt for generic task', output_id: 'generic_task_output' },
      },
    ];
    const expectedLLMResponse = 'LLM response for generic task';
    mockGenerateFromLocal.mockResolvedValue(expectedLLMResponse);

    await executeStepsInternal(
      mockExpressHttpRes,
      'Test Task Generic LLM',
      steps,
      taskContext,
      overallExecutionLog,
      0,
      mockSendSseMessage,
      false, // safetyMode
      0
    );

    expect(mockGenerateFromLocal).toHaveBeenCalledTimes(1);
    expect(mockGenerateFromLocal).toHaveBeenCalledWith(
      'Test prompt for generic task',
      backendSettings.defaultOllamaModel || 'codellama',
      mockExpressHttpRes
    );
    expect(taskContext.outputs.generic_task_output).toBe(expectedLLMResponse);
    expect(mockSendSseMessage).toHaveBeenCalledWith('log_entry', { message: expect.stringContaining("Stored LLM response in context as output_id: 'generic_task_output'") });
    expect(mockSendSseMessage).toHaveBeenCalledWith('execution_complete', expect.any(Object));
  });
});

// --- Tests for generateFromLocal ---
describe('generateFromLocal - OpenAI Integration', () => {
  let mockExpressRes;
  let originalBackendSettings;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks including node-fetch

    // Store original backendSettings and restore them after each test
    // This is a shallow copy. If backendSettings becomes more complex, a deep clone might be needed.
    originalBackendSettings = { ...backendSettings };

    mockExpressRes = {
      write: jest.fn(),
      writable: true,
      // Add other methods like setHeader, flushHeaders, end if generateFromLocal uses them directly
    };

    // Reset fetch mock for each test
    fetch.mockReset();
  });

  afterEach(() => {
    // Restore original backendSettings
    // This ensures tests don't interfere with each other's backendSettings state
    Object.keys(originalBackendSettings).forEach(key => {
      backendSettings[key] = originalBackendSettings[key];
    });
     // Also reset any specific properties that might have been set to null/undefined
    if (!originalBackendSettings.hasOwnProperty('llmProvider')) backendSettings.llmProvider = null;
    if (!originalBackendSettings.hasOwnProperty('apiKey')) backendSettings.apiKey = null;

  });

  // Helper to create a mock ReadableStream from an array of strings (SSE events)
  async function* createMockStream(chunks) {
    for (const chunk of chunks) {
      yield Buffer.from(chunk);
    }
  }

  test('should handle successful streaming response from OpenAI', async () => {
    backendSettings.llmProvider = 'openai';
    backendSettings.apiKey = 'test-api-key';

    const mockOpenAIStream = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      body: createMockStream(mockOpenAIStream),
      headers: new Map([['content-type', 'text/event-stream']]), // OpenAI uses event-stream
    });

    const prompt = 'Test prompt';
    const modelName = 'gpt-3.5-turbo';
    const result = await generateFromLocal(prompt, modelName, mockExpressRes);

    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.any(Object));
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-api-key');
    expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe(modelName);
    expect(JSON.parse(fetch.mock.calls[0][1].body).messages[0].content).toBe(prompt);


    expect(result).toBe('Hello world');
    expect(mockExpressRes.write).toHaveBeenCalledTimes(2); // For "Hello" and " world"
    expect(mockExpressRes.write).toHaveBeenCalledWith('data: {"type":"llm_chunk","content":"Hello"}\n\n');
    expect(mockExpressRes.write).toHaveBeenCalledWith('data: {"type":"llm_chunk","content":" world"}\n\n');
  });

  test('should handle OpenAI API error (e.g., 401 Unauthorized)', async () => {
    backendSettings.llmProvider = 'openai';
    backendSettings.apiKey = 'test-api-key'; // API key is present

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API key' } }), // OpenAI error format
      headers: new Map([['content-type', 'application/json']]),
    });

    const result = await generateFromLocal('Test prompt', 'gpt-3.5-turbo', mockExpressRes);

    expect(result).toMatch(/LLM_ERROR: OpenAI API request failed: 401 Unauthorized - Invalid API key/);
    expect(mockExpressRes.write).toHaveBeenCalledTimes(1);
    expect(mockExpressRes.write).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
    expect(mockExpressRes.write).toHaveBeenCalledWith(expect.stringContaining('OpenAI API request failed: 401 Unauthorized - Invalid API key'));
  });

  test('should return error if OpenAI API key is missing', async () => {
    backendSettings.llmProvider = 'openai';
    backendSettings.apiKey = ''; // API key is missing

    const result = await generateFromLocal('Test prompt', 'gpt-3.5-turbo', mockExpressRes);

    expect(fetch).not.toHaveBeenCalled(); // Should not attempt API call
    expect(result).toBe('// LLM_ERROR: OpenAI API key is missing in backend settings. //');
    expect(mockExpressRes.write).toHaveBeenCalledTimes(1);
    expect(mockExpressRes.write).toHaveBeenCalledWith('data: {"type":"error","content":"OpenAI API key is missing in backend settings."}\n\n');
  });

  test('should handle network error during OpenAI fetch', async () => {
    backendSettings.llmProvider = 'openai';
    backendSettings.apiKey = 'test-api-key';

    fetch.mockRejectedValueOnce(new Error('Network connection failed'));

    const result = await generateFromLocal('Test prompt', 'gpt-3.5-turbo', mockExpressRes);

    expect(result).toMatch(/LLM_ERROR: Error communicating with OpenAI: Network connection failed/);
    expect(mockExpressRes.write).toHaveBeenCalledTimes(1);
    expect(mockExpressRes.write).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
    expect(mockExpressRes.write).toHaveBeenCalledWith(expect.stringContaining('Error communicating with OpenAI: Network connection failed'));
  });

  test('should fallback to Ollama if provider is "ollama"', async () => {
    backendSettings.llmProvider = 'ollama';
    // No API key needed for Ollama usually

    const mockOllamaStream = [
      '{"response":"This is ","done":false}\n',
      '{"response":"Ollama","done":false}\n',
      '{"response":"!","done":true}\n',
    ];
    fetch.mockResolvedValueOnce({
      ok: true,
      body: createMockStream(mockOllamaStream),
      headers: new Map([['content-type', 'application/x-ndjson']]), // Ollama uses ndjson
    });

    const result = await generateFromLocal('Test prompt for Ollama', 'codellama', mockExpressRes);

    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.any(Object));
    expect(result).toBe('This is Ollama!');
    expect(mockExpressRes.write).toHaveBeenCalledWith('data: {"type":"llm_chunk","content":"This is "}\n\n');
    expect(mockExpressRes.write).toHaveBeenCalledWith('data: {"type":"llm_chunk","content":"Ollama"}\n\n');
    expect(mockExpressRes.write).toHaveBeenCalledWith('data: {"type":"llm_chunk","content":"!"}\n\n');
  });

   test('should fallback to Ollama if provider is null/undefined', async () => {
    backendSettings.llmProvider = null; // Or undefined

    const mockOllamaStream = ['{"response":"Defaulting to Ollama.","done":true}\n'];
    fetch.mockResolvedValueOnce({
      ok: true,
      body: createMockStream(mockOllamaStream),
      headers: new Map([['content-type', 'application/x-ndjson']]),
    });

    const result = await generateFromLocal('Test prompt', 'codellama', mockExpressRes);
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.any(Object));
    expect(result).toBe('Defaulting to Ollama.');
    expect(mockExpressRes.write).toHaveBeenCalledWith('data: {"type":"llm_chunk","content":"Defaulting to Ollama."}\n\n');
  });

  // Test for OpenAI error response that is not JSON
  test('should handle OpenAI API error with non-JSON response', async () => {
    backendSettings.llmProvider = 'openai';
    backendSettings.apiKey = 'test-api-key';

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error text, not JSON', // Simulate non-JSON error body
      json: async () => { throw new Error("Cannot parse as JSON")}, // Mock .json() to fail
      headers: new Map([['content-type', 'text/plain']]),
    });

    const result = await generateFromLocal('Test prompt', 'gpt-3.5-turbo', mockExpressRes);
    expect(result).toMatch(/LLM_ERROR: OpenAI API request failed: 500 Internal Server Error - Server error text, not JSON/);
    expect(mockExpressRes.write).toHaveBeenCalledTimes(1);
    expect(mockExpressRes.write).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
    expect(mockExpressRes.write).toHaveBeenCalledWith(expect.stringContaining('OpenAI API request failed: 500 Internal Server Error - Server error text, not JSON'));
  });

});

// --- Tests for resolveTemplates ---
describe('resolveTemplates', () => {
  let mockSendSseMessage;

  beforeEach(() => {
    mockSendSseMessage = jest.fn();
    // Clear console spy if you use one for console.warn, or ensure it doesn't interfere
    // jest.spyOn(console, 'warn').mockImplementation(() => {}); // Optional: if you want to suppress console.warn during tests
  });

  afterEach(() => {
    // jest.restoreAllMocks(); // Optional: if you spied on console.warn
  });

  test('should return non-string input as is', () => {
    expect(resolveTemplates(null, {}, mockSendSseMessage)).toBeNull();
    expect(resolveTemplates(undefined, {}, mockSendSseMessage)).toBeUndefined();
    expect(resolveTemplates(123, {}, mockSendSseMessage)).toBe(123);
    const obj = { a: 1 };
    expect(resolveTemplates(obj, {}, mockSendSseMessage)).toBe(obj);
  });

  test('should return string without templates as is', () => {
    const text = 'This is a plain string.';
    expect(resolveTemplates(text, { var1: 'value1' }, mockSendSseMessage)).toBe(text);
  });

  test('should replace single valid template', () => {
    const text = 'Hello {{outputs.name}}!';
    const context = { name: 'World' };
    expect(resolveTemplates(text, context, mockSendSseMessage)).toBe('Hello World!');
  });

  test('should replace multiple valid templates', () => {
    const text = '{{outputs.greeting}}, {{outputs.name}}! Age: {{outputs.age}}.';
    const context = { greeting: 'Hi', name: 'Alice', age: 30 };
    expect(resolveTemplates(text, context, mockSendSseMessage)).toBe('Hi, Alice! Age: 30.');
  });

  test('should handle template for undefined value in context by leaving template as is and warning', () => {
    const text = 'Value: {{outputs.missing_var}}';
    const context = { present_var: 'exists' };
    const originalConsoleWarn = console.warn; // Store original console.warn
    console.warn = jest.fn(); // Mock console.warn

    expect(resolveTemplates(text, context, mockSendSseMessage)).toBe('Value: {{outputs.missing_var}}');
    expect(console.warn).toHaveBeenCalledWith("[Templating] Warning: Output variable 'missing_var' not found in context. Leaving template as is.");
    expect(mockSendSseMessage).toHaveBeenCalledWith('log_entry', { message: "[Templating] Warning: Output variable 'missing_var' not found in context. Leaving template as is." });

    console.warn = originalConsoleWarn; // Restore original console.warn
  });

  test('should handle template for null value in context by replacing with empty string (current behavior of contextOutputs[variableName])', () => {
    // If contextOutputs.hasOwnProperty is true but value is null, it should replace with 'null' or empty string depending on how it's stringified.
    // Current implementation: `contextOutputs[variableName]` will result in `null` if the value is `null`.
    const text = 'Value: {{outputs.null_var}}';
    const context = { null_var: null };
    // In JavaScript, `null` in string concatenation becomes "null".
    expect(resolveTemplates(text, context, mockSendSseMessage)).toBe('Value: null');
  });

  test('should handle template for number value in context', () => {
    const text = 'Count: {{outputs.count_var}}';
    const context = { count_var: 123 };
    expect(resolveTemplates(text, context, mockSendSseMessage)).toBe('Count: 123');
  });

  test('should handle empty context', () => {
    const text = 'Test {{outputs.var}}';
    const originalConsoleWarn = console.warn;
    console.warn = jest.fn();
    expect(resolveTemplates(text, {}, mockSendSseMessage)).toBe('Test {{outputs.var}}');
    expect(console.warn).toHaveBeenCalled();
    expect(mockSendSseMessage).toHaveBeenCalled();
    console.warn = originalConsoleWarn;
  });

  test('should not replace malformed templates', () => {
    const text = 'Malformed: {{outputs.var_name }}. Correct: {{outputs.name}}. Another: {{outputs.var name}}.';
    const context = { name: 'CorrectlyReplaced', var_name: 'ShouldNotMatter' };
     const originalConsoleWarn = console.warn;
    console.warn = jest.fn();

    const result = resolveTemplates(text, context, mockSendSseMessage);
    expect(result).toContain('Malformed: {{outputs.var_name }}.'); // Space makes it invalid by current regex
    expect(result).toContain('Correct: CorrectlyReplaced.');
    expect(result).toContain('Another: {{outputs.var name}}.'); // Space makes it invalid

    // It should warn for 'var_name ' and 'var name' if the regex were more lenient or if they were attempted
    // With the current strict regex `{{outputs\.([a-zA-Z0-9_]+)}}`, these malformed ones are not even matched as potential variables.
    // So, no warning for them.
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('var_name '));
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('var name'));
    expect(mockSendSseMessage).not.toHaveBeenCalledWith('log_entry', { message: expect.stringContaining('var_name ') });
    expect(mockSendSseMessage).not.toHaveBeenCalledWith('log_entry', { message: expect.stringContaining('var name') });
    console.warn = originalConsoleWarn;
  });

  test('should handle templates with underscores and numbers in names', () => {
    const text = 'Var1: {{outputs.var_1}}, Var2: {{outputs.var2_test}}';
    const context = { var_1: 'value1', var2_test: 'value2' };
    expect(resolveTemplates(text, context, mockSendSseMessage)).toBe('Var1: value1, Var2: value2');
  });
});
