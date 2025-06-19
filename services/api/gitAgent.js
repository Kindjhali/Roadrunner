import simpleGit from 'simple-git';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default working directory for Git operations, assuming script is in roadrunner/backend/
const DEFAULT_GIT_WORK_DIR = path.resolve(__dirname, '../../');

export class ModularGitAgent {
  constructor(options = {}) {
    this.workDir = options.workDir || DEFAULT_GIT_WORK_DIR;
    this.logger = options.logger || console;
    this.logger.log(`[ModularGitAgent] Initialized with working directory: ${this.workDir}`);
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
  async gitAdd(filePath = '.') {
    this.logger.log(`[ModularGitAgent] Attempting to stage '${filePath}' in ${this.workDir}`);
    try {
      const git = this._getGit();
      await git.add(filePath);
      const status = await git.status();
      const stagedFiles = status.staged;
      const message = `Successfully staged '${filePath}'. Staged files: ${stagedFiles.join(', ')}`;
      this.logger.log(`[ModularGitAgent] ${message}`);
      return { success: true, message, stagedFiles };
    } catch (error) {
      this.logger.error(`[ModularGitAgent] Error staging '${filePath}' in ${this.workDir}:`, error);
      return {
        success: false,
        // message: `Failed to stage '${filePath}'.`, // Keep original message in error object
        error: {
          code: 'GIT_ADD_FAILED',
          message: `Failed to stage '${filePath}': ${error.message || error}`,
          details: { filePath, workDir: this.workDir, originalError: error }
        }
      };
    }
  }

  /**
   * Commits staged changes.
   * @param {string} commitMessage The commit message.
   * @param {object} [options={}] Options for the operation.
   * @param {boolean} [options.requireConfirmation=false]
   * @param {boolean} [options.isConfirmedAction=false]
   * @returns {Promise<{success: boolean, message: string, commitSummary?: any, error?: any, confirmationNeeded?: boolean, details?: any}>}
   */
  async gitCommit(commitMessage, options = {}) {
    this.logger.log(
      `[ModularGitAgent] Attempting to commit in ${this.workDir} with message: "${commitMessage}", options: ${JSON.stringify(options)}`
    );

    if (options.requireConfirmation && !options.isConfirmedAction) {
      this.logger.log('[ModularGitAgent] Confirmation required for gitCommit.');
      return {
        success: false,
        confirmationNeeded: true,
        message: 'Confirmation required to perform git commit.',
        details: { command: 'commit', args: [commitMessage] },
        error: { // For consistency, even in confirmation
            code: 'GIT_CONFIRMATION_REQUIRED',
            message: 'Confirmation required to perform git commit.',
            details: { command: 'commit', args: [commitMessage] }
        }
      };
    }

    try {
      const git = this._getGit();
      const summary = await git.commit(commitMessage);
      const message = `Successfully committed: ${summary.commit} [${summary.summary.changes} changes]`;
      this.logger.log(`[ModularGitAgent] ${message}`);
      return { success: true, message, commitSummary: summary };
    } catch (error) {
      this.logger.error(`[ModularGitAgent] Error committing in ${this.workDir}:`, error);
      return {
        success: false,
        // message: `Failed to commit.`,
        error: {
          code: 'GIT_COMMIT_FAILED',
          message: `Failed to commit: ${error.message || error}`,
          details: { workDir: this.workDir, originalError: error }
        }
      };
    }
  }

  /**
   * Pushes commits to a remote repository.
   * @param {string} [remote="origin"]
   * @param {string} [branch="main"]
   * @param {object} [options={}]
   * @returns {Promise<{success: boolean, message: string, error?: any, confirmationNeeded?: boolean, details?: any}>}
   */
  async gitPush(remote = 'origin', branch = 'main', options = {}) {
    this.logger.log(
      `[ModularGitAgent] Attempting to push to ${remote}/${branch} from ${this.workDir}, options: ${JSON.stringify(options)}`
    );

    if (options.requireConfirmation && !options.isConfirmedAction) {
      this.logger.log('[ModularGitAgent] Confirmation required for gitPush.');
      return {
        success: false,
        confirmationNeeded: true,
        message: 'Confirmation required to perform git push.',
        details: { command: 'push', args: [remote, branch] },
        error: { // For consistency
            code: 'GIT_CONFIRMATION_REQUIRED',
            message: 'Confirmation required to perform git push.',
            details: { command: 'push', args: [remote, branch] }
        }
      };
    }

    try {
      const git = this._getGit();
      await git.push(remote, branch);
      const message = `Successfully pushed to ${remote}/${branch}.`;
      this.logger.log(`[ModularGitAgent] ${message}`);
      return { success: true, message };
    } catch (error) {
      this.logger.error(
        `[ModularGitAgent] Error pushing to ${remote}/${branch} from ${this.workDir}:`,
        error
      );
      return {
        success: false,
        // message: `Failed to push to ${remote}/${branch}.`,
        error: {
          code: 'GIT_PUSH_FAILED',
          message: `Failed to push to ${remote}/${branch}: ${error.message || error}`,
          details: { remote, branch, workDir: this.workDir, originalError: error }
        }
      };
    }
  }

  /**
   * Pulls changes from a remote repository.
   * @param {string} [remote="origin"]
   * @param {string} [branch="main"]
   * @returns {Promise<{success: boolean, message: string, pullSummary?: any, error?: any}>}
   */
  async gitPull(remote = 'origin', branch = 'main') {
    this.logger.log(
      `[ModularGitAgent] Attempting to pull from ${remote}/${branch} into ${this.workDir}`
    );
    try {
      const git = this._getGit();
      const summary = await git.pull(remote, branch);
      const message = `Successfully pulled from ${remote}/${branch}. Changes: ${summary.summary.changes}, Insertions: ${summary.summary.insertions}, Deletions: ${summary.summary.deletions}.`;
      this.logger.log(`[ModularGitAgent] ${message}`);
      if (summary.files.length > 0) {
        this.logger.log(`[ModularGitAgent] Files affected: ${summary.files.join(', ')}`);
      }
      return { success: true, message, pullSummary: summary };
    } catch (error) {
      this.logger.error(
        `[ModularGitAgent] Error pulling from ${remote}/${branch} into ${this.workDir}:`,
        error
      );
      return {
        success: false,
        // message: `Failed to pull from ${remote}/${branch}.`,
        error: {
          code: 'GIT_PULL_FAILED',
          message: `Failed to pull from ${remote}/${branch}: ${error.message || error}`,
          details: { remote, branch, workDir: this.workDir, originalError: error }
        }
      };
    }
  }

  /**
   * Reverts the last commit (HEAD) without opening an editor.
   * @param {object} [options={}]
   * @returns {Promise<{success: boolean, message: string, revertSummary?: any, error?: any, confirmationNeeded?: boolean, details?: any}>}
   */
  async gitRevertLastCommit(options = {}) {
    this.logger.log(`[ModularGitAgent] Attempting to revert HEAD in ${this.workDir}, options: ${JSON.stringify(options)}`);

    if (options.requireConfirmation && !options.isConfirmedAction) {
      this.logger.log('[ModularGitAgent] Confirmation required for gitRevertLastCommit.');
      return {
        success: false,
        confirmationNeeded: true,
        message: 'Confirmation required to perform git revert last commit.',
        details: { command: 'revert_last_commit', args: [] },
        error: { // For consistency
            code: 'GIT_CONFIRMATION_REQUIRED',
            message: 'Confirmation required to perform git revert last commit.',
            details: { command: 'revert_last_commit', args: [] }
        }
      };
    }

    try {
      const git = this._getGit();
      await git.revert('HEAD', { '--no-edit': null });

      const log = await git.log(['-1']);
      const newCommitSha = log.latest ? log.latest.hash : 'Unknown';
      const newCommitMessage = log.latest ? log.latest.message : 'Unknown';

      const message = `Successfully reverted HEAD. New commit: ${newCommitSha} ("${newCommitMessage}")`;
      this.logger.log(`[ModularGitAgent] ${message}`);
      return {
        success: true,
        message,
        revertSummary: { newCommitSha, newCommitMessage },
      };
    } catch (error) {
      this.logger.error(`[ModularGitAgent] Error reverting HEAD in ${this.workDir}:`, error);
      return {
        success: false,
        // message: `Failed to revert HEAD.`,
        error: {
          code: 'GIT_REVERT_FAILED',
          message: `Failed to revert HEAD: ${error.message || error}`,
          details: { workDir: this.workDir, originalError: error }
        }
      };
    }
  }
}

// For backward compatibility:
// Create a default instance configured with the original GIT_WORK_DIR
const defaultGitAgentInstance = new ModularGitAgent({
  workDir: DEFAULT_GIT_WORK_DIR, // Uses the path.resolve(__dirname, '../../')
  logger: console, // Standard console logger for the default instance
});

const gitAdd = defaultGitAgentInstance.gitAdd.bind(defaultGitAgentInstance);
const gitCommit = defaultGitAgentInstance.gitCommit.bind(defaultGitAgentInstance);
const gitPush = defaultGitAgentInstance.gitPush.bind(defaultGitAgentInstance);
const gitPull = defaultGitAgentInstance.gitPull.bind(defaultGitAgentInstance);
const gitRevertLastCommit = defaultGitAgentInstance.gitRevertLastCommit.bind(defaultGitAgentInstance);

export {
  // ModularGitAgent, // Already exported with `export class ModularGitAgent`
  // Export methods from the default instance for backward compatibility
  gitAdd,
  gitCommit,
  gitPush,
  gitPull,
  gitRevertLastCommit,
  // Default instance for simple usage
};

export default defaultGitAgentInstance;
