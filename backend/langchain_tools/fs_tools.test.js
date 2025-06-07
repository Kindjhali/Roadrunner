const { ListDirectoryTool, CreateFileTool, ReadFileTool, UpdateFileTool, DeleteFileTool, CreateDirectoryTool, DeleteDirectoryTool } = require('./fs_tools');
const fsAgent = require('../fsAgent');
const { ConfirmationRequiredError } = require('./common');
const { v4: uuidv4 } = require('uuid');

jest.mock('../fsAgent.js'); // Mock the entire fsAgent module
jest.mock('uuid', () => ({ v4: jest.fn() })); // Mock uuidv4

describe('FS Tools', () => {
  let mockRunManager;

  beforeEach(() => {
    // Reset all mocks from fsAgent before each test
    jest.clearAllMocks();
    uuidv4.mockImplementation(() => 'test-uuid'); // Consistent UUID for tests

    mockRunManager = {
      config: {
        safetyMode: false, // Default to safetyMode off for basic tests
        isConfirmedActionForTool: {}, // No pre-confirmed actions by default
        // Replicate other properties tools might expect if they were passed from server.js
        originalExpressHttpRes: null,
        sendSseMessage: jest.fn(),
      }
    };
  });

  describe('ListDirectoryTool', () => {
    let tool;
    beforeEach(() => {
      tool = new ListDirectoryTool();
    });

    test('should call fsAgent.generateDirectoryTree and return its result', async () => {
      const mockTree = "dir/\n  file.txt";
      fsAgent.generateDirectoryTree.mockReturnValue(mockTree);
      const result = await tool._call("some/path", mockRunManager);
      expect(fsAgent.generateDirectoryTree).toHaveBeenCalledWith("some/path", "", "some/path");
      expect(result).toBe(`Directory listing for 'some/path':\n${mockTree}`);
    });

    test('should handle empty path for workspace root', async () => {
      const mockTree = "root_dir/\n  file.txt";
      fsAgent.generateDirectoryTree.mockReturnValue(mockTree);
      const result = await tool._call("", mockRunManager);
      expect(fsAgent.generateDirectoryTree).toHaveBeenCalledWith("", "", "Workspace Root");
      expect(result).toBe(`Directory listing for 'workspace root':\n${mockTree}`);
    });

    test('should return error message on fsAgent error', async () => {
      fsAgent.generateDirectoryTree.mockImplementation(() => { throw new Error('FS error'); });
      const result = await tool._call("some/path", mockRunManager);
      expect(result).toBe('Error listing directory: FS error');
    });
  });

  describe('CreateFileTool', () => {
    let tool;
    beforeEach(() => {
      tool = new CreateFileTool();
      fsAgent.checkFileExists.mockReturnValue({ exists: false }); // Default: file does not exist
    });

    test('should call fsAgent.createFile for valid JSON', async () => {
      fsAgent.createFile.mockReturnValue({ success: true, fullPath: 'output/test.txt', message: 'Created' });
      const input = JSON.stringify({ filePath: 'test.txt', content: 'hello' });
      const result = await tool._call(input, mockRunManager);
      expect(fsAgent.createFile).toHaveBeenCalledWith('test.txt', 'hello', { isConfirmedAction: true });
      expect(result).toBe("File 'test.txt' created successfully at output/test.txt.");
    });

    test('should return error for invalid JSON', async () => {
      const result = await tool._call("not json", mockRunManager);
      expect(result).toMatch(/Error: Invalid JSON string/);
      expect(fsAgent.createFile).not.toHaveBeenCalled();
    });

    test('should return error for missing filePath or content', async () => {
      let input = JSON.stringify({ content: 'hello' });
      expect(await tool._call(input, mockRunManager)).toBe("Error: Input JSON string MUST include 'filePath' and 'content' keys.");
      input = JSON.stringify({ filePath: 'test.txt' });
      expect(await tool._call(input, mockRunManager)).toBe("Error: Input JSON string MUST include 'filePath' and 'content' keys.");
      expect(fsAgent.createFile).not.toHaveBeenCalled();
    });

    test('should throw ConfirmationRequiredError in safetyMode if file exists and not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      fsAgent.checkFileExists.mockReturnValue({ exists: true });
      const input = JSON.stringify({ filePath: 'existing.txt', content: 'overwrite' });

      await expect(tool._call(input, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      const error = await tool._call(input, mockRunManager).catch(e => e);
      expect(error.data.toolName).toBe('create_file');
      expect(error.data.toolInput).toBe(input);
      expect(error.data.confirmationId).toBe('test-uuid');
      expect(error.data.message).toBe("File 'existing.txt' already exists. Overwrite?");
      expect(fsAgent.createFile).not.toHaveBeenCalled();
    });

    test('should NOT throw if file exists, safetyMode true, but action IS confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const input = JSON.stringify({ filePath: 'existing.txt', content: 'overwrite' });
      mockRunManager.config.isConfirmedActionForTool = { [tool.name]: { [input]: true } };
      fsAgent.checkFileExists.mockReturnValue({ exists: true });
      fsAgent.createFile.mockReturnValue({ success: true, fullPath: 'output/existing.txt' });

      await tool._call(input, mockRunManager);
      expect(fsAgent.createFile).toHaveBeenCalledWith('existing.txt', 'overwrite', { isConfirmedAction: true });
    });

     test('should proceed if file does NOT exist in safetyMode and not confirmed (new file creation)', async () => {
      mockRunManager.config.safetyMode = true;
      fsAgent.checkFileExists.mockReturnValue({ exists: false }); // File does not exist
      fsAgent.createFile.mockReturnValue({ success: true, fullPath: 'output/new.txt' });
      const input = JSON.stringify({ filePath: 'new.txt', content: 'new content' });

      await tool._call(input, mockRunManager);
      expect(fsAgent.createFile).toHaveBeenCalledWith('new.txt', 'new content', { isConfirmedAction: true });
    });
  });

  // Similar describe blocks for ReadFileTool, UpdateFileTool, DeleteFileTool, CreateDirectoryTool, DeleteDirectoryTool
  // For brevity, only showing key test aspects for UpdateFileTool as an example of another modifying tool.

  describe('UpdateFileTool', () => {
    let tool;
    beforeEach(() => {
      tool = new UpdateFileTool();
    });

    test('should call fsAgent.updateFile for valid JSON', async () => {
      fsAgent.updateFile.mockReturnValue({ success: true, fullPath: 'output/test.txt' });
      const input = JSON.stringify({ filePath: 'test.txt', content: 'updated', append: false });
      await tool._call(input, mockRunManager);
      expect(fsAgent.updateFile).toHaveBeenCalledWith('test.txt', 'updated', { append: false, isConfirmedAction: true });
    });

    test('should throw ConfirmationRequiredError in safetyMode if not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const input = JSON.stringify({ filePath: 'test.txt', content: 'update' });
      await expect(tool._call(input, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      const error = await tool._call(input, mockRunManager).catch(e => e);
      expect(error.data.toolName).toBe('update_file');
      expect(error.data.confirmationId).toBe('test-uuid');
      expect(fsAgent.updateFile).not.toHaveBeenCalled();
    });

    test('should NOT throw if safetyMode true but action IS confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const input = JSON.stringify({ filePath: 'test.txt', content: 'update' });
      mockRunManager.config.isConfirmedActionForTool = { [tool.name]: { [input]: true } };
      fsAgent.updateFile.mockReturnValue({ success: true, fullPath: 'output/test.txt' });

      await tool._call(input, mockRunManager);
      expect(fsAgent.updateFile).toHaveBeenCalled();
    });
  });

  describe('ReadFileTool', () => {
    let tool;
    beforeEach(() => { tool = new ReadFileTool(); });

    test('should call fsAgent.readFile and return content', async () => {
      fsAgent.readFile.mockReturnValue({ success: true, content: "file content" });
      const result = await tool._call("path/to/file.txt", mockRunManager);
      expect(fsAgent.readFile).toHaveBeenCalledWith("path/to/file.txt");
      expect(result).toBe("file content");
    });

    test('should return error if path is missing', async () => {
      const result = await tool._call("", mockRunManager);
      expect(result).toBe("Error: Input MUST be a non-empty string representing the relative file path.");
       expect(fsAgent.readFile).not.toHaveBeenCalled();
    });
  });

  describe('DeleteFileTool', () => {
    let tool;
    beforeEach(() => { tool = new DeleteFileTool(); });

    test('should call fsAgent.deleteFile if not in safety mode or confirmed', async () => {
      fsAgent.deleteFile.mockReturnValue({ success: true, fullPath: "output/path/to/file.txt" });
      await tool._call("path/to/file.txt", mockRunManager);
      expect(fsAgent.deleteFile).toHaveBeenCalledWith("path/to/file.txt", { isConfirmedAction: true });
    });

    test('should throw ConfirmationRequiredError in safetyMode if not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const path = "path/to/file.txt";
      await expect(tool._call(path, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      expect(fsAgent.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('CreateDirectoryTool', () => {
    let tool;
    beforeEach(() => { tool = new CreateDirectoryTool(); });

    test('should call fsAgent.createDirectory', async () => {
      fsAgent.createDirectory.mockReturnValue({ success: true, fullPath: "output/new_dir" });
      await tool._call("new_dir", mockRunManager);
      expect(fsAgent.createDirectory).toHaveBeenCalledWith("new_dir", { isConfirmedAction: true });
    });

    test('should throw ConfirmationRequiredError in safetyMode for new directory if not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const path = "new_dir_confirm";
      // fsAgent.checkFileExists.mockReturnValue({ exists: false }); // Assuming it doesn't exist for create
      await expect(tool._call(path, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      expect(fsAgent.createDirectory).not.toHaveBeenCalled();
    });
  });

  describe('DeleteDirectoryTool', () => {
    let tool;
    beforeEach(() => { tool = new DeleteDirectoryTool(); });

    test('should call fsAgent.deleteDirectory', async () => {
      fsAgent.deleteDirectory.mockReturnValue({ success: true, fullPath: "output/old_dir" });
      await tool._call("old_dir", mockRunManager);
      expect(fsAgent.deleteDirectory).toHaveBeenCalledWith("old_dir", { isConfirmedAction: true });
    });

    test('should throw ConfirmationRequiredError in safetyMode if not confirmed', async () => {
      mockRunManager.config.safetyMode = true;
      const path = "dir_to_delete";
      await expect(tool._call(path, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
      expect(fsAgent.deleteDirectory).not.toHaveBeenCalled();
    });
  });

});
