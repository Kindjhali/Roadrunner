const simpleGit = require('simple-git');
const path = require('path');

// Default working directory for Git operations, assuming script is in roadrunner/backend/
const DEFAULT_GIT_WORK_DIR = path.resolve(__dirname, '../../');

class ModularGitAgent {
  constructor(options = {}) {
    const funcName = 'ModularGitAgent.constructor';
    if (options.workDir) {
      if (typeof options.workDir === 'string' && options.workDir.trim() !== '') {
        this.workDir = path.resolve(options.workDir.trim());
      } else {
        this.logger = options.logger || console; // Logger might not be set if workDir is invalid
        const errMsg = "Invalid workDir provided to GitAgent constructor: must be a non-empty string.";
        this.logger.error(`[${funcName}] ${errMsg}`);
        throw new Error(errMsg); // Constructor failure
      }
    } else {
      this.workDir = DEFAULT_GIT_WORK_DIR;
      this.logger = options.logger || console;
      this.logger.log(`[${funcName}] workDir not provided, using default: ${this.workDir}`);
    }
    this.logger = options.logger || console; // Ensure logger is set if not set before due to early return/throw
    this.logger.log(`[${funcName}] Initialized with working directory: ${this.workDir}`);
  }

  /**
   * Initializes simple-git instance.
   * @returns {import('simple-git').SimpleGit}
   */
  _getGit() {
    const gitOptions = {
      baseDir: this.workDir,
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: false,
    };
    return simpleGit(gitOptions);
  }

  /**
   * Stages a specific file or all files.
   * @param {string} [filePath="."] File path to stage.
   * @returns {Promise<{success: boolean, message: string, stagedFiles?: string[], error?: any}>}
   */
  async _executeGitCommand(actionName, commandRunner, options = {}, commandArgs = {}) {
    const funcName = `_executeGitCommand[${actionName}]`;
    this.logger.log(`[ModularGitAgent::${funcName}] Attempting action. Options: ${JSON.stringify(options)}, Args: ${JSON.stringify(commandArgs)}`);

    if (options.requireConfirmation && !options.isConfirmedAction) {
      const message = `Confirmation required to perform git ${actionName}.`;
      this.logger.log(`[ModularGitAgent::${funcName}] ${message}`);
      return {
        success: false,
        confirmationNeeded: true,
        message,
        action: actionName, // For frontend to identify the action
        details: { command: actionName, args: commandArgs }, // Keep original args for context
        error: { code: 'GIT_CONFIRMATION_REQUIRED', message, details: { command: actionName, args: commandArgs } }
      };
    }

    try {
      const result = await commandRunner();
      const successMessage = `Git ${actionName} successful.`;
      this.logger.log(`[ModularGitAgent::${funcName}] ${successMessage}`, result || '');
      return { success: true, message: successMessage, data: result }; // Include raw result in data field
    } catch (error) {
      const errorMessage = `Git ${actionName} failed: ${error.message || error}`;
      this.logger.error(`[ModularGitAgent::${funcName}] ${errorMessage}`, error);
      return {
        success: false,
        message: errorMessage,
        error: {
          code: `GIT_${actionName.toUpperCase()}_ERROR`,
          originalError: { message: error.message, details: error } // simple-git errors often have more in fields
        }
      };
    }
  }

  /**
   * Stages a specific file or all files.
   * @param {string | string[]} filePaths File path(s) to stage. Defaults to "." (all files).
   * @param {object} [options={}] Options for the operation.
   * @returns {Promise<{success: boolean, message: string, stagedFiles?: string[], error?: any}>}
   */
  async gitAdd(filePaths = '.', options = {}) {
    const funcName = 'gitAdd';
    this.logger.log(`[ModularGitAgent::${funcName}] Attempting. FilePaths: "${Array.isArray(filePaths) ? filePaths.join(' ') : filePaths}", Options: ${JSON.stringify(options)}`);

    if (typeof filePaths === 'string') {
      if (filePaths.trim() === '') {
        return Promise.resolve({ success: false, message: "Invalid 'filePaths': cannot be an empty string.", error: { code: "INVALID_INPUT_EMPTY_STRING" } });
      }
    } else if (Array.isArray(filePaths)) {
      if (filePaths.length === 0) {
        return Promise.resolve({ success: false, message: "Invalid 'filePaths': array cannot be empty. Use '.' for all files.", error: { code: "INVALID_INPUT_EMPTY_ARRAY" } });
      }
      for (const fp of filePaths) {
        if (typeof fp !== 'string' || fp.trim() === '') {
          return Promise.resolve({ success: false, message: `Invalid 'filePaths' array: contains non-string or empty string elements. Element: "${fp}"`, error: { code: "INVALID_INPUT_ARRAY_ELEMENT" } });
        }
      }
    } else {
      return Promise.resolve({ success: false, message: "Invalid 'filePaths': must be a string or an array of strings.", error: { code: "INVALID_INPUT_TYPE" } });
    }

    const result = await this._executeGitCommand('add', async () => {
      const git = this._getGit();
      await git.add(filePaths);
      const status = await git.status(); // Get status to confirm staged files
      return { stagedFiles: status.staged }; // Return specific data for gitAdd
    }, options, { filePaths });

    if (result.success && result.data) {
      result.stagedFiles = result.data.stagedFiles;
      result.message = `Successfully staged. Staged files: ${result.stagedFiles.join(', ') || 'None'}`;
      delete result.data; // Clean up raw data field
    }
    return result;
  }

  /**
   * Commits staged changes.
   * @param {string} commitMessage The commit message.
   * @param {object} [options={}] Options for the operation, including gitOptions for simple-git.
   * @returns {Promise<{success: boolean, message: string, commitSummary?: any, error?: any, confirmationNeeded?: boolean, details?: any}>}
   */
  async gitCommit(commitMessage, options = {}) {
    const funcName = 'gitCommit';
    this.logger.log(`[ModularGitAgent::${funcName}] Attempting. Message: "${commitMessage}", Options: ${JSON.stringify(options)}`);

    if (!commitMessage || typeof commitMessage !== 'string' || commitMessage.trim() === '') {
      const msg = "Invalid 'commitMessage': must be a non-empty string.";
      this.logger.warn(`[ModularGitAgent::${funcName}] ${msg}`);
      return Promise.resolve({ success: false, message: msg, error: { code: "INVALID_INPUT" } });
    }

    const gitOptionsArr = options.gitOptions || []; // e.g., ['--allow-empty']

    const result = await this._executeGitCommand('commit', async () => {
      const git = this._getGit();
      // Pass options directly to simple-git's commit method if they are meant for it (e.g. --allow-empty)
      // simple-git commit method signature is (message, [files], [options], [callback])
      // or (message, [options], [callback])
      // or ([options], [callback])
      // We will pass commitMessage and then gitOptionsArr as the options object for simple-git
      return git.commit(commitMessage, gitOptionsArr);
    }, options, { commitMessage, gitOptions: gitOptionsArr });

    if (result.success && result.data) {
      result.commitSummary = result.data; // simple-git commit returns a CommitSummary
      result.message = `Successfully committed: ${result.commitSummary.commit} [${result.commitSummary.summary.changes} changes]`;
      delete result.data;
    }
    return result;
  }

  /**
   * Pushes commits to a remote repository.
   * @param {string} [remote="origin"] Optional remote name.
   * @param {string} [branch="main"] Optional branch name.
   * @param {object} [options={}] Options for the operation, including gitOptions for simple-git.
   * @returns {Promise<{success: boolean, message: string, error?: any, confirmationNeeded?: boolean, details?: any}>}
   */
  async gitPush(remote, branch, options = {}) {
    const funcName = 'gitPush';
    // Use provided remote/branch or let simple-git use defaults.
    const effectiveRemote = (typeof remote === 'string' && remote.trim() !== '') ? remote.trim() : undefined;
    const effectiveBranch = (typeof branch === 'string' && branch.trim() !== '') ? branch.trim() : undefined;

    this.logger.log(`[ModularGitAgent::${funcName}] Attempting. Remote: "${effectiveRemote || 'default'}", Branch: "${effectiveBranch || 'default'}", Options: ${JSON.stringify(options)}`);

    if (remote !== undefined && (typeof remote !== 'string' || remote.trim() === '')) {
        const msg = "Invalid 'remote': must be a non-empty string if provided.";
         this.logger.warn(`[ModularGitAgent::${funcName}] ${msg}`);
        return Promise.resolve({ success: false, message: msg, error: { code: "INVALID_INPUT" } });
    }
    if (branch !== undefined && (typeof branch !== 'string' || branch.trim() === '')) {
         const msg = "Invalid 'branch': must be a non-empty string if provided.";
         this.logger.warn(`[ModularGitAgent::${funcName}] ${msg}`);
        return Promise.resolve({ success: false, message: msg, error: { code: "INVALID_INPUT" } });
    }

    const gitOptionsArr = options.gitOptions || [];

    const result = await this._executeGitCommand('push', async () => {
      const git = this._getGit();
      // simple-git push signature: ([remote], [branch], [options], [callback])
      // If remote/branch are undefined, simple-git uses defaults.
      return git.push(effectiveRemote, effectiveBranch, gitOptionsArr);
    }, options, { remote: effectiveRemote, branch: effectiveBranch, gitOptions: gitOptionsArr });

    if (result.success) {
      result.message = `Successfully pushed to ${effectiveRemote || 'default remote'}/${effectiveBranch || 'default branch'}.`;
      // result.data from push is usually undefined or basic status, no need to specifically process unless simple-git changes.
    }
    return result;
  }

  /**
   * Pulls changes from a remote repository.
   * @param {string} [remote="origin"] Optional remote name.
   * @param {string} [branch="main"] Optional branch name.
   * @param {object} [options={}] Options for the operation, including gitOptions for simple-git.
   * @returns {Promise<{success: boolean, message: string, pullSummary?: any, error?: any}>}
   */
  async gitPull(remote, branch, options = {}) {
    const funcName = 'gitPull';
    const effectiveRemote = (typeof remote === 'string' && remote.trim() !== '') ? remote.trim() : undefined;
    const effectiveBranch = (typeof branch === 'string' && branch.trim() !== '') ? branch.trim() : undefined;

    this.logger.log(`[ModularGitAgent::${funcName}] Attempting. Remote: "${effectiveRemote || 'default'}", Branch: "${effectiveBranch || 'default'}", Options: ${JSON.stringify(options)}`);

    if (remote !== undefined && (typeof remote !== 'string' || remote.trim() === '')) {
        const msg = "Invalid 'remote': must be a non-empty string if provided.";
        this.logger.warn(`[ModularGitAgent::${funcName}] ${msg}`);
        return Promise.resolve({ success: false, message: msg, error: { code: "INVALID_INPUT" } });
    }
    if (branch !== undefined && (typeof branch !== 'string' || branch.trim() === '')) {
        const msg = "Invalid 'branch': must be a non-empty string if provided.";
        this.logger.warn(`[ModularGitAgent::${funcName}] ${msg}`);
        return Promise.resolve({ success: false, message: msg, error: { code: "INVALID_INPUT" } });
    }

    const gitOptionsArr = options.gitOptions || [];

    // Note: gitPull does not typically require confirmation in the same way as push/commit/revert.
    // If confirmation were needed, it would be added to _executeGitCommand options.
    const result = await this._executeGitCommand('pull', async () => {
      const git = this._getGit();
      return git.pull(effectiveRemote, effectiveBranch, gitOptionsArr);
    }, options, { remote: effectiveRemote, branch: effectiveBranch, gitOptions: gitOptionsArr });

    if (result.success && result.data) {
      result.pullSummary = result.data; // simple-git pull returns a PullResult
      result.message = `Successfully pulled from ${effectiveRemote || 'default remote'}/${effectiveBranch || 'default branch'}. Changes: ${result.pullSummary.summary.changes}, Insertions: ${result.pullSummary.summary.insertions}, Deletions: ${result.pullSummary.summary.deletions}.`;
      if (result.pullSummary.files && result.pullSummary.files.length > 0) {
        this.logger.log(`[ModularGitAgent::${funcName}] Files affected: ${result.pullSummary.files.join(', ')}`);
      }
      delete result.data;
    }
    return result;
  }

  /**
   * Reverts the last commit (HEAD) without opening an editor.
   * @param {object} [options={}] Options for the operation, including gitOptions for simple-git.
   * @returns {Promise<{success: boolean, message: string, revertSummary?: any, error?: any, confirmationNeeded?: boolean, details?: any}>}
   */
  async gitRevertLastCommit(options = {}) {
    const funcName = 'gitRevertLastCommit';
    // gitOptionsArr allows passing additional flags like '--no-commit' if needed, though '--no-edit' is hardcoded for now.
    const gitOptionsObj = { '--no-edit': null, ...(options.gitOptions || {}) };
    this.logger.log(`[ModularGitAgent::${funcName}] Attempting. Options: ${JSON.stringify(options)}, Effective Git Revert Opts: ${JSON.stringify(gitOptionsObj)}`);

    const result = await this._executeGitCommand('revertLastCommit', async () => {
      const git = this._getGit();
      // simple-git revert signature is revert(commitOrRange, [options], [callback])
      // HEAD is the commit. gitOptionsObj are the simple-git options.
      await git.revert('HEAD', gitOptionsObj);

      // If revert was successful and created a new commit (i.e., --no-commit was not used)
      // We might want to fetch the new commit details.
      // This depends on whether simple-git's revert itself returns useful info or if a subsequent log is needed.
      // For now, assume revert itself doesn't return detailed summary; get it from log.
      if (!gitOptionsObj['--no-commit']) { // Only if a commit was made
        const log = await git.log(['-1']); // Get the very latest commit
        return {
          newCommitSha: log.latest ? log.latest.hash : 'Unknown',
          newCommitMessage: log.latest ? log.latest.message : 'Unknown (Possibly --no-commit was used or log failed)'
        };
      }
      return { newCommitSha: 'N/A (--no-commit used)', newCommitMessage: 'N/A (--no-commit used)'}; // Or indicate no new commit
    }, options, { gitOptions: gitOptionsObj });

    if (result.success && result.data) {
      result.revertSummary = result.data;
      result.message = `Successfully reverted HEAD. New commit (if any): ${result.revertSummary.newCommitSha} ("${result.revertSummary.newCommitMessage}")`;
      delete result.data;
    }
    return result;
  }
}

// For backward compatibility:
// Create a default instance configured with the original GIT_WORK_DIR
const defaultGitAgentInstance = new ModularGitAgent({
  workDir: DEFAULT_GIT_WORK_DIR, // Uses the path.resolve(__dirname, '../../')
  logger: console, // Standard console logger for the default instance
});

module.exports = {
  ModularGitAgent, // Export the class
  // Export methods from the default instance for backward compatibility
  gitAdd: defaultGitAgentInstance.gitAdd.bind(defaultGitAgentInstance),
  gitCommit: defaultGitAgentInstance.gitCommit.bind(defaultGitAgentInstance),
  gitPush: defaultGitAgentInstance.gitPush.bind(defaultGitAgentInstance),
  gitPull: defaultGitAgentInstance.gitPull.bind(defaultGitAgentInstance),
  gitRevertLastCommit: defaultGitAgentInstance.gitRevertLastCommit.bind(defaultGitAgentInstance),
  // defaultInstance: defaultGitAgentInstance, // Alternative for server.js if it can be updated
};
