const { Tool } = require('@langchain/core/tools');
const gitAgent = require('../gitAgent'); // Assuming gitAgent.js is in the parent directory
const { ConfirmationRequiredError } = require('./common'); // Import the custom error
const { v4: uuidv4 } = require('uuid'); // For generating confirmation IDs

class GitAddTool extends Tool {
  name = "git_add";
  description = "Stages changes in the workspace for a commit. Input should be a JSON string with 'filePath' (a file path or '.' for all changes). Example: {\"filePath\": \"src/myFile.js\"}.";

  async _call(inputJsonString, runManager) { // Added runManager
    try {
      const { filePath } = JSON.parse(inputJsonString);
      if (!filePath) {
        return "Error: Missing 'filePath' in input JSON for git_add.";
      }

      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      // Adding files is generally non-destructive but is a critical precursor to commit.
      // Confirmation here might be optional or depend on the scope (e.g., adding '.' vs a specific file).
      // For now, let's assume 'git add' itself doesn't require confirmation if safetyMode is on,
      // but the subsequent 'git commit' will. If explicit confirmation for 'add' is desired:
      /*
      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Stage files for path '${filePath}'?`
        });
      }
      */

      const result = await gitAgent.gitAdd(filePath, { isConfirmedAction: true }); // Pass isConfirmedAction: true to underlying agent
      if (result.success) {
        return result.message || `Successfully added ${filePath}.`;
      } else {
        return `Error adding files: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error processing git_add: ${error.message}`;
    }
  }
}

class GitCommitTool extends Tool {
  name = "git_commit";
  description = "Creates a new commit with staged changes. Input should be a JSON string with 'message'. Example: {\"message\": \"feat: Add new feature\"}";

  async _call(inputJsonString, runManager) { // Added runManager
    try {
      const { message } = JSON.parse(inputJsonString);
      if (!message) {
        return "Error: Missing 'message' in input JSON for git_commit.";
      }

      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Commit with message "${message}"?`
        });
      }

      const result = await gitAgent.gitCommit(message, { isConfirmedAction: true });
      if (result.success) {
        return result.message || `Successfully committed with message "${message}".`;
      } else {
        return `Error committing: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error processing git_commit: ${error.message}`;
    }
  }
}

class GitPushTool extends Tool {
  name = "git_push";
  description = "Pushes committed changes to a remote repository. Input should be a JSON string with optional 'remote' and 'branch'. Example: {\"remote\": \"origin\", \"branch\": \"main\"}.";

  async _call(inputJsonString, runManager) { // Added runManager
    try {
      const { remote, branch } = JSON.parse(inputJsonString);
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Push to remote '${remote || 'default'}' branch '${branch || 'default'}'?`
        });
      }

      const result = await gitAgent.gitPush(remote, branch, { isConfirmedAction: true });
      if (result.success) {
        return result.message || `Successfully pushed to ${remote || 'default remote'} ${branch || 'default branch'}.`;
      } else {
        return `Error pushing: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error processing git_push: ${error.message}`;
    }
  }
}

class GitPullTool extends Tool {
  name = "git_pull";
  description = "Fetches changes from a remote repository and merges them. Input should be a JSON string with optional 'remote' and 'branch'. Example: {\"remote\": \"origin\", \"branch\": \"main\"}.";

  async _call(inputJsonString, runManager) { // Added runManager
    try {
      const { remote, branch } = JSON.parse(inputJsonString);
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      // Pulling can modify local files, so confirmation is good in safety mode.
      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Pull from remote '${remote || 'default'}' branch '${branch || 'default'}'? This may overwrite local changes.`
        });
      }

      const result = await gitAgent.gitPull(remote, branch, { isConfirmedAction: true });
      if (result.success) {
        return result.message || `Successfully pulled from ${remote || 'default remote'} ${branch || 'default branch'}.`;
      } else {
        return `Error pulling: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error processing git_pull: ${error.message}`;
    }
  }
}

class GitRevertTool extends Tool {
  name = "git_revert_last_commit";
  description = "Reverts the last commit. No input needed, pass an empty JSON string '{}'.";

  async _call(inputJsonString, runManager) { // Added runManager
    try {
      // Consider parsing inputJsonString if it might ever contain parameters, even if currently not.
      // const {} = JSON.parse(inputJsonString);
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString, // Even if empty, pass for consistency
            confirmationId,
            message: `Revert the last commit? This will create a new commit that undoes the changes.`
        });
      }

      const result = await gitAgent.gitRevertLastCommit({ isConfirmedAction: true });
      if (result.success) {
        return result.message || "Successfully reverted the last commit.";
      } else {
        return `Error reverting commit: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      return `Error processing git_revert_last_commit: ${error.message}`;
    }
  }
}

module.exports = {
  GitAddTool,
  GitCommitTool,
  GitPushTool,
  GitPullTool,
  GitRevertTool,
};
