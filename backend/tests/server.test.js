// roadrunner/backend/tests/server.test.js
const httpMocks = require('node-mocks-http');
// IMPORTANT: The line below assumes that server.js is modified to export handleExecuteAutonomousTask
// e.g., module.exports = { handleExecuteAutonomousTask, ... };
const { handleExecuteAutonomousTask } = require('../server');
const gitAgent = require('../gitAgent');
const fsAgent = require('../fsAgent');
// generateFromLocal is defined within server.js, so it cannot be mocked using jest.mock('../llm')
// For these specific tests, it should not be called if isAutonomousMode is false.

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
  resolvePathInWorkspace: jest.fn((p) => ({ success: true, fullPath: `/mock/workspace/${p}`, relativePath: p })),
  generateDirectoryTree: jest.fn().mockReturnValue("mock tree"),
  createDirectory: jest.fn().mockResolvedValue({ success: true, fullPath: 'mock/dir' }),
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
    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledWith({
      requireConfirmation: true,
      isConfirmedAction: false,
    });

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
    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledWith({
      requireConfirmation: false,
      isConfirmedAction: false,
    });
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
    expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledWith({
      requireConfirmation: true, // This is key from safetyMode=true
      isConfirmedAction: false,
    });

    // Check that a confirmation_required SSE message was sent
    const confirmationCall = mockResWriteSpy.mock.calls.find(call => call[0].includes('"type":"confirmation_required"'));
    expect(confirmationCall).toBeDefined();
    const sseData = JSON.parse(confirmationCall[0].substring(5)); // Remove "data: " prefix
    expect(sseData.message).toBe('Are you sure you want to revert?');
    expect(sseData.details.command).toBe('revert_last_commit');
    expect(sseData.details.gitAgentDetails.someDetail).toBe('detail');
    // Ensure execution_complete is NOT called yet
    expect(mockResWriteSpy).not.toHaveBeenCalledWith(expect.stringContaining('"type":"execution_complete"'));
  });
});
