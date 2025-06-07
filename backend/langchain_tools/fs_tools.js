const { Tool } = require('@langchain/core/tools');
const fsAgent = require('../fsAgent'); // Assuming fsAgent.js is in the parent directory
const { ConfirmationRequiredError } = require('./common'); // Import the custom error
const { v4: uuidv4 } = require('uuid'); // For generating confirmation IDs

class ListDirectoryTool extends Tool {
  name = "list_directory";
  description = "Lists files and directories in a specified path relative to the workspace. Input should be a relative path string, or empty for workspace root.";

  async _call(relativePath, runManager) { // Added runManager
    try {
      const treeString = fsAgent.generateDirectoryTree(relativePath || '', '', relativePath || 'Workspace Root');
      return treeString;
    } catch (error) {
      return `Error listing directory: ${error.message}`;
    }
  }
}

class CreateFileTool extends Tool {
  name = "create_file";
  description = "Creates a new file with specified content at a given relative path. Input should be a JSON string with 'filePath' and 'content' keys. Example: {\"filePath\": \"path/to/file.txt\", \"content\": \"File content here\"}.";

  async _call(inputJsonString, runManager) { // Added runManager
    try {
      const { filePath, content } = JSON.parse(inputJsonString);
      if (!filePath || content === undefined) {
        return "Error: Missing 'filePath' or 'content' in input JSON.";
      }

      const safetyMode = runManager?.config?.safetyMode ?? true; // Default to safety mode true
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[filePath] || runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;


      if (safetyMode && !isConfirmedAction) {
        // Check if file exists, as creating an existing file is effectively an overwrite.
        const fileExistsResult = fsAgent.checkFileExists(filePath);
        if (fileExistsResult.exists) {
            const confirmationId = uuidv4();
            throw new ConfirmationRequiredError({
              toolName: this.name,
              toolInput: inputJsonString, // Pass the original JSON string
              confirmationId,
              message: `File '${filePath}' already exists. Overwrite?`
            });
        }
        // If file doesn't exist, creating it is generally safe, but could still be gated by a broader safetyMode if desired.
        // For now, only existing file creation triggers confirmation.
      }

      // If safetyMode is off, or it's on and confirmed, or it's a new file (and new file creation doesn't require confirmation by default)
      const result = fsAgent.createFile(filePath, content, { isConfirmedAction: true }); // Pass isConfirmedAction: true to underlying agent as tool handles gating
      if (result.success) {
        return `File created successfully at ${result.fullPath}.`;
      } else {
        return `Error creating file: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error creating file: ${error.message}`;
    }
  }
}

class ReadFileTool extends Tool {
  name = "read_file";
  description = "Reads the content of a file at a given relative path. Input should be the relative path string.";

  async _call(relativePath, runManager) { // Added runManager
    try {
      if (!relativePath) {
        return "Error: Missing relative path for reading file.";
      }
      const result = fsAgent.readFile(relativePath);
      if (result.success) {
        return result.content;
      } else {
        return `Error reading file: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      return `Error reading file: ${error.message}`;
    }
  }
}

class UpdateFileTool extends Tool {
  name = "update_file";
  description = "Updates an existing file or creates it if it doesn't exist (unless append is true and file doesn't exist, then it creates). Input should be a JSON string with 'filePath', 'content', and optional 'append' (boolean) keys. Example: {\"filePath\": \"path/to/file.txt\", \"content\": \"New content\", \"append\": false}.";

  async _call(inputJsonString, runManager) { // Added runManager
    try {
      const { filePath, content, append } = JSON.parse(inputJsonString);
      if (!filePath || content === undefined) {
        return "Error: Missing 'filePath' or 'content' in input JSON.";
      }

      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        // Updating always requires confirmation in safety mode if not pre-confirmed.
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Update file '${filePath}'? Append: ${!!append}`
        });
      }

      const result = fsAgent.updateFile(filePath, content, { append: !!append, isConfirmedAction: true });
      if (result.success) {
        return `File updated successfully at ${result.fullPath}.`;
      } else {
        return `Error updating file: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error updating file: ${error.message}`;
    }
  }
}

class DeleteFileTool extends Tool {
  name = "delete_file";
  description = "Deletes a file at a given relative path. Input should be the relative path string.";

  async _call(relativePath, runManager) { // Added runManager
    try {
      if (!relativePath) {
        return "Error: Missing relative path for deleting file.";
      }
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[relativePath] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: relativePath,
            confirmationId,
            message: `Delete file '${relativePath}'?`
        });
      }

      const result = fsAgent.deleteFile(relativePath, { isConfirmedAction: true });
      if (result.success) {
        return `File deleted successfully: ${result.fullPath}.`;
      } else {
        return `Error deleting file: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error deleting file: ${error.message}`;
    }
  }
}

class CreateDirectoryTool extends Tool {
  name = "create_directory";
  description = "Creates a new directory at a given relative path. Input should be the relative path string.";

  async _call(relativePath, runManager) { // Added runManager
    try {
      if (!relativePath) {
        return "Error: Missing relative path for creating directory.";
      }
      const safetyMode = runManager?.config?.safetyMode ?? true;
      // Confirmation for creating a directory might be less critical than file ops,
      // but for consistency, we can add it. Let's assume it's not needed by default unless file exists.
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[relativePath] || false;

      // fsAgent.createDirectory doesn't typically overwrite. If it errors on existing, that's fine.
      // If safety mode is on and we want to confirm even new directory creation:
      if (safetyMode && !isConfirmedAction) {
         // Optional: Check if directory exists if createDirectory itself doesn't handle it well or if we want custom message.
         // For now, let fsAgent.createDirectory handle existing directory logic.
         // If we wanted to confirm all dir creations in safety mode:
         /*
         const confirmationId = uuidv4();
         throw new ConfirmationRequiredError({
             toolName: this.name,
             toolInput: relativePath,
             confirmationId,
             message: `Create directory '${relativePath}'?`
         });
         */
      }

      const result = fsAgent.createDirectory(relativePath, { isConfirmedAction: true });
      if (result.success) {
        return `Directory created successfully at ${result.fullPath}.`;
      } else {
        // fsAgent.createDirectory has its own check for existence.
        // If it failed for other reasons, report that.
        return `Error creating directory: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error creating directory: ${error.message}`;
    }
  }
}

class DeleteDirectoryTool extends Tool {
  name = "delete_directory";
  description = "Deletes a directory and its contents recursively at a given relative path. Input should be the relative path string.";

  async _call(relativePath, runManager) { // Added runManager
    try {
      if (!relativePath) {
        return "Error: Missing relative path for deleting directory.";
      }
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[relativePath] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: relativePath,
            confirmationId,
            message: `Delete directory '${relativePath}' and all its contents?`
        });
      }

      const result = fsAgent.deleteDirectory(relativePath, { isConfirmedAction: true });
      if (result.success) {
        return `Directory deleted successfully: ${result.fullPath}.`;
      } else {
        return `Error deleting directory: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error deleting directory: ${error.message}`;
    }
  }
}

module.exports = {
  ListDirectoryTool,
  CreateFileTool,
  ReadFileTool,
  UpdateFileTool,
  DeleteFileTool,
  CreateDirectoryTool,
  DeleteDirectoryTool,
};
