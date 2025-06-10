import { Tool } from '@langchain/core/tools';
import * as gitAgent from '../gitAgent.js'; // Changed to named import namespace
import { ConfirmationRequiredError } from './common.js'; // Added .js extension
import { v4 as uuidv4 } from 'uuid'; // For generating confirmation IDs

export class GitAddTool extends Tool {
  name = "git_add";
  description = "Stages changes in the workspace for a commit. Input MUST be a JSON string with a 'filePath' key, where 'filePath' is a string representing a file path or '.' for all changes. Example: {\"filePath\": \"src/myFile.js\"} or {\"filePath\": \".\"}.";

  async _call(inputJsonString, runManager) {
    try {
      const { filePath } = JSON.parse(inputJsonString);
      if (filePath === undefined) { // Check for undefined specifically, as empty string might be a valid project root path for some git contexts, though '.' is preferred.
        return "Error: Input JSON string for git_add MUST include a 'filePath' key (e.g., a specific file or '.' for all changes).";
      }

      // Confirmation for 'git add' is currently disabled by default in the tool's logic below.
      // It's considered a non-destructive precursor to 'git commit'.
      // If confirmation were desired, it would be implemented here similar to other tools.
      /*
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;
      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Stage files/path '${filePath}'?`
        });
      }
      */

      const result = await gitAgent.gitAdd(filePath, { isConfirmedAction: true });
      if (result.success) {
        return result.message || `Successfully staged '${filePath}'.`;
      } else {
        return `Error staging '${filePath}': ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      if (error instanceof SyntaxError) return `Error: Invalid JSON string for Action Input. Details: ${error.message}. Input received: ${inputJsonString}`;
      return `Error processing git_add: ${error.message}`;
    }
  }
}

export class GitCommitTool extends Tool {
  name = "git_commit";
  description = "Creates a new commit with staged changes. Input MUST be a JSON string with a 'message' key (string). Example: {\"message\": \"feat: Add new login component\"}.";

  async _call(inputJsonString, runManager) {
    try {
      const { message } = JSON.parse(inputJsonString);
      if (message === undefined || typeof message !== 'string') { // Message can be empty, but must exist.
        return "Error: Input JSON string for git_commit MUST include a 'message' key with a string value.";
      }

      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Create commit with message "${message}"?`
        });
      }

      const result = await gitAgent.gitCommit(message, { isConfirmedAction: true });
      if (result.success) {
        return result.message || `Successfully committed with message "${message}". Commit SHA: ${result.data?.commit || 'N/A'}`;
      } else {
        return `Error committing: ${result.message}${result.error ? ` Details: ${JSON.stringify(result.error)}` : ''}`;
      }
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      if (error instanceof SyntaxError) return `Error: Invalid JSON string for Action Input. Details: ${error.message}. Input received: ${inputJsonString}`;
      return `Error processing git_commit: ${error.message}`;
    }
  }
}

export class GitPushTool extends Tool {
  name = "git_push";
  description = "Pushes committed changes to a remote repository. Input MUST be a JSON string, optionally with 'remote' (string) and 'branch' (string) keys. If keys are absent, defaults will be used. Example: {\"remote\": \"origin\", \"branch\": \"main\"} or {}.";

  async _call(inputJsonString, runManager) {
    try {
      const { remote, branch } = JSON.parse(inputJsonString); // undefined if not present, which is fine for gitAgent
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Push to remote '${remote || 'default remote'}' branch '${branch || 'default branch'}'?`
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
      if (error instanceof SyntaxError) return `Error: Invalid JSON string for Action Input. Details: ${error.message}. Input received: ${inputJsonString}`;
      return `Error processing git_push: ${error.message}`;
    }
  }
}

export class GitPullTool extends Tool {
  name = "git_pull";
  description = "Fetches changes from a remote repository and merges them. Input MUST be a JSON string, optionally with 'remote' (string) and 'branch' (string) keys. If keys are absent, defaults will be used. Example: {\"remote\": \"origin\", \"branch\": \"main\"} or {}. This may overwrite local changes if conflicts occur and are auto-resolved.";

  async _call(inputJsonString, runManager) {
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
            message: `Pull from remote '${remote || 'default remote'}' branch '${branch || 'default branch'}'? This may alter local files.`
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
      if (error instanceof SyntaxError) return `Error: Invalid JSON string for Action Input. Details: ${error.message}. Input received: ${inputJsonString}`;
      return `Error processing git_pull: ${error.message}`;
    }
  }
}

export class GitRevertTool extends Tool {
  name = "git_revert_last_commit";
  description = "Reverts the last commit by creating a new commit that undoes the changes. Input MUST be an empty JSON string. Example: {}.";

  async _call(inputJsonString, runManager) {
    try {
      JSON.parse(inputJsonString); // Validate it's a JSON string, even if empty object
      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: `Revert the last commit? This will create a new commit that undoes the previous commit's changes.`
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
      if (error instanceof SyntaxError) return `Error: Invalid JSON string for Action Input. Details: ${error.message}. Input received: ${inputJsonString}`;
      return `Error processing git_revert_last_commit: ${error.message}`;
    }
  }
}

// No module.exports needed for ESM when using `export class ...`
// export {
//   GitAddTool,
//   GitCommitTool,
//   GitPushTool,
//   GitPullTool,
//   GitRevertTool,
// };
