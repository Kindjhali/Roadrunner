// roadrunner/backend/tests/server.test.js
const httpMocks = require('node-mocks-http');
// IMPORTANT: The line below assumes that server.js is modified to export handleExecuteAutonomousTask and generateFromLocal
// e.g., module.exports = { handleExecuteAutonomousTask, generateFromLocal, backendSettings, ... };
const server = require('../server'); // Import the whole module
const { handleExecuteAutonomousTask, generateFromLocal, backendSettings } = server;
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
