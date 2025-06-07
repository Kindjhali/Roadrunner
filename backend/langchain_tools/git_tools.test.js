const { GitAddTool, GitCommitTool, GitPushTool, GitPullTool, GitRevertTool } = require('./git_tools');
const gitAgent = require('../gitAgent');
const { ConfirmationRequiredError } = require('./common');
const { v4: uuidv4 } = require('uuid');

jest.mock('../gitAgent.js');
jest.mock('uuid', () => ({ v4: jest.fn() }));

describe('Git Tools', () => {
  let mockRunManager;

  beforeEach(() => {
    jest.clearAllMocks();
    uuidv4.mockImplementation(() => 'test-git-uuid');

    mockRunManager = {
      config: {
        safetyMode: false,
        isConfirmedActionForTool: {},
        originalExpressHttpRes: null,
        sendSseMessage: jest.fn(),
      }
    };
  });

  describe('GitAddTool', () => {
    let tool;
    beforeEach(() => { tool = new GitAddTool(); });

    test('should call gitAgent.gitAdd with correct args', async () => {
      gitAgent.gitAdd.mockResolvedValue({ success: true, message: 'Files added' });
      const input = JSON.stringify({ filePath: '.' });
      const result = await tool._call(input, mockRunManager);
      expect(gitAgent.gitAdd).toHaveBeenCalledWith('.', { isConfirmedAction: true });
      expect(result).toContain('Successfully staged');
    });

    test('should return error for invalid JSON for git_add', async () => {
      const result = await tool._call("not json", mockRunManager);
      expect(result).toMatch(/Error: Invalid JSON string/);
      expect(gitAgent.gitAdd).not.toHaveBeenCalled();
    });

    test('should return error if filePath is missing for git_add', async () => {
      const input = JSON.stringify({ path: '.' }); // wrong key
      const result = await tool._call(input, mockRunManager);
      expect(result).toMatch(/Error: Input JSON string for git_add MUST include a 'filePath' key/);
      expect(gitAgent.gitAdd).not.toHaveBeenCalled();
    });

    // GitAddTool currently does not throw ConfirmationRequiredError by default,
    // but if it were to, tests would be similar to other modifying tools.
  });

  describe('GitCommitTool', () => {
    let tool;
    beforeEach(() => { tool = new GitCommitTool(); });

    test('should call gitAgent.gitCommit with correct args', async () => {
      gitAgent.gitCommit.mockResolvedValue({ success: true, message: 'Committed', data: { commit: 'abcdef123' } });
      const input = JSON.stringify({ message: 'Initial commit' });
      const result = await tool._call(input, mockRunManager);
      expect(gitAgent.gitCommit).toHaveBeenCalledWith('Initial commit', { isConfirmedAction: true });
      expect(result).toContain("Successfully committed with message \"Initial commit\". Commit SHA: abcdef123");
    });

    test('should throw ConfirmationRequiredError in safetyMode if not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const input = JSON.stringify({ message: 'Initial commit' });
      await expect(tool._call(input, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      const error = await tool._call(input, mockRunManager).catch(e => e);
      expect(error.data.toolName).toBe('git_commit');
      expect(error.data.confirmationId).toBe('test-git-uuid');
      expect(gitAgent.gitCommit).not.toHaveBeenCalled();
    });
  });

  describe('GitPushTool', () => {
    let tool;
    beforeEach(() => { tool = new GitPushTool(); });

    test('should call gitAgent.gitPush with remote and branch', async () => {
      gitAgent.gitPush.mockResolvedValue({ success: true });
      const input = JSON.stringify({ remote: 'origin', branch: 'main' });
      await tool._call(input, mockRunManager);
      expect(gitAgent.gitPush).toHaveBeenCalledWith('origin', 'main', { isConfirmedAction: true });
    });

    test('should call gitAgent.gitPush with defaults if not provided', async () => {
      gitAgent.gitPush.mockResolvedValue({ success: true });
      const input = JSON.stringify({});
      await tool._call(input, mockRunManager);
      expect(gitAgent.gitPush).toHaveBeenCalledWith(undefined, undefined, { isConfirmedAction: true });
    });

    test('should throw ConfirmationRequiredError in safetyMode if not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const input = JSON.stringify({});
      await expect(tool._call(input, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      expect(gitAgent.gitPush).not.toHaveBeenCalled();
    });
  });

  describe('GitPullTool', () => {
    let tool;
    beforeEach(() => { tool = new GitPullTool(); });

    test('should call gitAgent.gitPull', async () => {
      gitAgent.gitPull.mockResolvedValue({ success: true });
      const input = JSON.stringify({ remote: 'origin', branch: 'main' });
      await tool._call(input, mockRunManager);
      expect(gitAgent.gitPull).toHaveBeenCalledWith('origin', 'main', { isConfirmedAction: true });
    });

    test('should throw ConfirmationRequiredError in safetyMode if not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const input = JSON.stringify({});
      await expect(tool._call(input, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      expect(gitAgent.gitPull).not.toHaveBeenCalled();
    });
  });

  describe('GitRevertTool', () => {
    let tool;
    beforeEach(() => { tool = new GitRevertTool(); });

    test('should call gitAgent.gitRevertLastCommit', async () => {
      gitAgent.gitRevertLastCommit.mockResolvedValue({ success: true });
      const input = JSON.stringify({});
      await tool._call(input, mockRunManager);
      expect(gitAgent.gitRevertLastCommit).toHaveBeenCalledWith({ isConfirmedAction: true });
    });

    test('should throw ConfirmationRequiredError in safetyMode if not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const input = JSON.stringify({});
      await expect(tool._call(input, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      expect(gitAgent.gitRevertLastCommit).not.toHaveBeenCalled();
    });
  });

});
