import { Tool } from '@langchain/core/tools';
import * as fsAgent from '../fsAgent.js'; // Changed to named import namespace
import { ConfirmationRequiredError } from './common.js'; // Added .js extension
import { v4 as uuidv4 } from 'uuid'; // For generating confirmation IDs

export class ListDirectoryTool extends Tool {
  name = "list_directory";
  description = "Lists files and sub-directories in a specified directory relative to the workspace. Input should be a single string representing the relative path to the directory, or an empty string for the workspace root. Example: \"src/components\" or \"\".";

  async _call(relativePath, runManager) {
    try {
      const treeString = fsAgent.generateDirectoryTree(relativePath || '', '', relativePath || 'Workspace Root');
      return `Directory listing for '${relativePath || "workspace root"}':\n${treeString}`;
    } catch (error) {
      return `Error listing directory: ${error.message}`;
    }
  }
}

export class CreateFileTool extends Tool {
  name = "create_file";
  description = "Creates a new file with specified content at a given relative path. Input MUST be a JSON string with 'filePath' (string) and 'content' (string) keys. Example: {\"filePath\": \"path/to/new_file.txt\", \"content\": \"This is the file content.\\nWith newlines if needed.\"}.";

  async _call(inputJsonString, runManager) {
    try {
      const { filePath, content } = JSON.parse(inputJsonString);
      if (filePath === undefined || content === undefined) { // Allow empty string for content
        return "Error: Input JSON string MUST include 'filePath' and 'content' keys.";
      }

      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const fileExistsResult = fsAgent.checkFileExists(filePath);
        if (fileExistsResult.exists) {
            const confirmationId = uuidv4();
            throw new ConfirmationRequiredError({
              toolName: this.name,
              toolInput: inputJsonString,
              confirmationId,
              message: `File '${filePath}' already exists. Overwrite?`
            });
        }
      }

      const result = fsAgent.createFile(filePath, content, { isConfirmedAction: true });
      if (result.success) {
        return `File '${filePath}' created successfully at ${result.fullPath}.`;
      } else {
        return `Error creating file '${filePath}': ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      if (error instanceof SyntaxError) return `Error: Invalid JSON string for Action Input. Details: ${error.message}. Input received: ${inputJsonString}`;
      return `Error creating file: ${error.message}`;
    }
  }
}

export class ReadFileTool extends Tool {
  name = "read_file";
  description = "Reads the content of a file at a given relative path. Input should be a single string representing the relative path to the file. Example: \"src/utils/helpers.js\".";

  async _call(relativePath, runManager) {
    try {
      if (typeof relativePath !== 'string' || !relativePath) { // Ensure it's a non-empty string
        return "Error: Input MUST be a non-empty string representing the relative file path.";
      }
      const result = fsAgent.readFile(relativePath);
      if (result.success) {
        return result.content;
      } else {
        return `Error reading file '${relativePath}': ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      return `Error reading file '${relativePath}': ${error.message}`;
    }
  }
}

export class UpdateFileTool extends Tool {
  name = "update_file";
  description = "Updates an existing file with new content, or creates the file if it doesn't exist (unless 'append' is true and file doesn't exist, then it also creates). Input MUST be a JSON string with 'filePath' (string), 'content' (string), and optional 'append' (boolean, defaults to false) keys. Example for overwrite: {\"filePath\": \"path/to/file.txt\", \"content\": \"New full content\"}. Example for append: {\"filePath\": \"path/to/file.txt\", \"content\": \"Additional line.\", \"append\": true}.";

  async _call(inputJsonString, runManager) {
    try {
      const { filePath, content, append } = JSON.parse(inputJsonString);
      if (filePath === undefined || content === undefined) { // Allow empty string for content
        return "Error: Input JSON string MUST include 'filePath' and 'content' keys.";
      }

      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Update file '${filePath}'? Action: ${append ? 'Append' : 'Overwrite'}.`
        });
      }

      const result = fsAgent.updateFile(filePath, content, { append: !!append, isConfirmedAction: true });
      if (result.success) {
        return `File '${filePath}' updated successfully at ${result.fullPath}.`;
      } else {
        return `Error updating file '${filePath}': ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      if (error instanceof SyntaxError) return `Error: Invalid JSON string for Action Input. Details: ${error.message}. Input received: ${inputJsonString}`;
      return `Error updating file: ${error.message}`;
    }
  }
}

export class DeleteFileTool extends Tool {
  name = "delete_file";
  description = "Deletes a file at a given relative path. Input should be a single string representing the relative path to the file. Example: \"path/to/obsolete_file.txt\".";

  async _call(relativePath, runManager) {
    try {
      if (typeof relativePath !== 'string' || !relativePath) {
        return "Error: Input MUST be a non-empty string representing the relative file path.";
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
        return `File '${relativePath}' deleted successfully: ${result.fullPath}.`;
      } else {
        return `Error deleting file '${relativePath}': ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error deleting file '${relativePath}': ${error.message}`;
    }
  }
}

export class CreateDirectoryTool extends Tool {
  name = "create_directory";
  description = "Creates a new directory (and any necessary parent directories) at a given relative path. Input should be a single string representing the relative path. Example: \"new_folder/sub_folder\".";

  async _call(relativePath, runManager) {
    try {
      if (typeof relativePath !== 'string' || !relativePath) {
        return "Error: Input MUST be a non-empty string representing the relative directory path.";
      }
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[relativePath] || false;

      if (safetyMode && !isConfirmedAction) {
        // Only ask for confirmation if directory doesn't exist, as fsAgent.createDirectory handles existing ones gracefully (no error, no change).
        // However, the act of *intending* to create could be confirmed.
        // For this iteration, let's confirm all create_directory actions in safety mode if not pre-confirmed.
         const confirmationId = uuidv4();
         throw new ConfirmationRequiredError({
             toolName: this.name,
             toolInput: relativePath,
             confirmationId,
             message: `Create directory '${relativePath}'?`
         });
      }

      const result = fsAgent.createDirectory(relativePath, { isConfirmedAction: true }); // fsAgent handles recursive creation
      if (result.success) {
        return `Directory '${relativePath}' created successfully at ${result.fullPath}.`;
      } else {
        return `Error creating directory '${relativePath}': ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error creating directory '${relativePath}': ${error.message}`;
    }
  }
}

export class DeleteDirectoryTool extends Tool {
  name = "delete_directory";
  description = "Deletes a directory and all its contents recursively at a given relative path. Input should be a single string representing the relative path. Example: \"folder_to_remove\".";

  async _call(relativePath, runManager) {
    try {
      if (typeof relativePath !== 'string' || !relativePath) {
        return "Error: Input MUST be a non-empty string representing the relative directory path.";
      }
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[relativePath] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: relativePath,
            confirmationId,
            message: `Delete directory '${relativePath}' and all its contents? This is a recursive operation.`
        });
      }

      const result = fsAgent.deleteDirectory(relativePath, { isConfirmedAction: true });
      if (result.success) {
        return `Directory '${relativePath}' deleted successfully: ${result.fullPath}.`;
      } else {
        return `Error deleting directory '${relativePath}': ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error deleting directory '${relativePath}': ${error.message}`;
    }
  }
}

// No longer using module.exports for ESM
// Individual classes are exported with `export class ...`
// If you needed to group exports, you might do:
// export { ListDirectoryTool, CreateFileTool, ... };
// But `export class` is sufficient and common.
