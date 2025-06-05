const fs = require('fs');
const path = require('path');

class ModularFsAgent {
  constructor(options) {
    if (!options || !options.workspaceDir) {
      throw new Error('ModularFsAgent requires workspaceDir in options.');
    }
    this.workspaceDir = path.resolve(options.workspaceDir);
    this.allowedExternalPaths = (options.allowedExternalPaths || []).map((p) =>
      path.resolve(p)
    );
    this.logger = options.logger || console;

    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
      this.logger.log(
        `[ModularFsAgent] Initialized workspace directory at: ${this.workspaceDir}`
      );
    } else {
      this.logger.log(
        `[ModularFsAgent] Workspace directory configured at: ${this.workspaceDir}`
      );
    }
  }

  _isWindows() {
    return process.platform === 'win32';
  }

  _isRestrictedBase(candidate) {
    const normalized = path.resolve(candidate);
    if (this._isWindows()) {
      const upper = normalized.toUpperCase();
      if (upper.startsWith('C:\\') || upper.startsWith('C:/')) {
        return true; // never allow C drive
      }
    } else {
      const restricted = ['/bin', '/usr', '/etc', '/System', '/Library'];
      if (restricted.some((dir) => normalized.startsWith(dir))) {
        return true;
      }
    }
    return false;
  }

  _logOperation(funcName, resolvedPath, success, message, error) {
    const status = success ? 'SUCCESS' : 'FAILURE';
    this.logger.log(
      `[ModularFsAgent::${funcName}] ${status} - Path: ${resolvedPath} - Message: ${message}`
    );
    if (error && this.logger.error) {
      this.logger.error(
        `[ModularFsAgent::${funcName}] Error details:`,
        error
      );
    } else if (error) {
      this.logger.log(
        `[ModularFsAgent::${funcName}] Error details:`,
        error
      );
    }
  }

  resolvePathInWorkspace(relativePath) {
    if (typeof relativePath !== 'string') {
      return {
        success: false,
        error: {
          code: 'FS_RESOLVE_PATH_INVALID_TYPE',
          message: 'Error: Invalid path type. Path must be a string.',
          details: { relativePathType: typeof relativePath }
        }
      };
    }

    if (/\{\{[^}]+\}\}/.test(relativePath)) {
      return {
        success: false,
        error: {
          code: 'FS_UNRESOLVED_TEMPLATE',
          message: 'Error: Path contains unresolved template placeholders.',
          details: { relativePath }
        }
      };
    }
    const normalizedPath = path.normalize(relativePath);
    let fullPath = path.isAbsolute(normalizedPath)
      ? path.resolve(normalizedPath)
      : path.resolve(this.workspaceDir, normalizedPath);

    const allowedRoots = [this.workspaceDir, ...this.allowedExternalPaths];

    const root = allowedRoots.find((r) => {
      const base = path.resolve(r);
      return fullPath === base || fullPath.startsWith(base + path.sep);
    });

    if (!root) {
      return {
        success: false,
        error: {
          code: 'FS_RESOLVE_PATH_OUTSIDE_ROOTS',
          message: `Error: Resolved path '${fullPath}' is outside allowed roots.`,
          details: {
            resolvedPath: fullPath,
            workspaceDir: this.workspaceDir,
            allowedExternalPaths: this.allowedExternalPaths
          }
        }
      };
    }

    const relativeToRoot = path.relative(root, fullPath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      return {
        success: false,
        error: {
          code: 'FS_RESOLVE_PATH_TRAVERSAL_ATTEMPT',
          message: 'Error: Path traversal attempt detected (relative path navigates above its root).',
          details: { resolvedPath: fullPath, root }
        }
      };
    }
    return { success: true, fullPath };
  }

  checkFileExists(relativePath, options = {}) { // Added options
    this.logger.log(
      `[ModularFsAgent::checkFileExists] ENTERED with relativePath: "${relativePath}"`
    );
    const resolved = this.resolvePathInWorkspace(relativePath);

    if (!resolved.success) {
      // Pass through the structured error from resolvePathInWorkspace
      return { success: false, error: resolved.error };
    }

    this.logger.log(
      `[ModularFsAgent::checkFileExists] Path resolved: success=${resolved.success}, fullPath="${resolved.fullPath}", message="${resolved.message || ''}"`
    );
    // options.dryRun doesn't change behavior of checkFileExists, but acknowledge if passed
    if (options.dryRun) {
      this.logger.log(`[ModularFsAgent::checkFileExists] Dry run mode active, but operation is read-only.`);
    }

    try {
      const exists = fs.existsSync(resolved.fullPath);
      const message = exists
        ? `File exists at ${resolved.fullPath}`
        : `File does not exist at ${resolved.fullPath}`;
      return { success: true, exists, message, fullPath: resolved.fullPath };
    } catch (error) {
      this._logOperation(
        'checkFileExists',
        resolved.fullPath,
        false,
        `Error checking file existence.`,
        error
      );
      return {
        success: false,
        exists: false,
        error: {
          code: 'FS_CHECK_EXISTS_FAILED',
          message: `Error checking file existence for ${resolved.fullPath}: ${error.message}`,
          details: { path: resolved.fullPath, originalError: error.message }
        }
      };
    }
  }

  createFile(relativePath, content, options = {}) {
    this.logger.log(`[ModularFsAgent.createFile] Attempting to create file. Raw path: '${relativePath}', Content length: ${content?.length || 'N/A'}`);
    this.logger.log(`[ModularFsAgent.createFile] Options received: ${JSON.stringify(options)}`);

    const resolved = this.resolvePathInWorkspace(relativePath);
    this.logger.log(`[ModularFsAgent.createFile] Path resolution attempt for '${relativePath}'. Result: success=${resolved.success}, fullPath='${resolved.fullPath || ''}', error='${resolved.error?.message || ''}'`);

    if (!resolved.success) {
      return { success: false, error: resolved.error, message: resolved.error?.message || 'Path resolution failed', warnings: [] };
    }
    const { fullPath } = resolved; // fullPath is the absolute path to the target file
    const baseDir = path.dirname(fullPath); // baseDir is the parent directory of the target file

    this.logger.log(`[ModularFsAgent.createFile] Resolved path: '${fullPath}', Base directory: '${baseDir}'`);
    let warnings = [];

    if (options.dryRun) {
      this._logOperation('createFile', fullPath, true, `DRY RUN: File would have been created/overwritten.`);
      warnings.push('Operation performed in dry run mode.');
      return {
        success: true,
        message: `DRY RUN: File would have been created/overwritten at ${fullPath}`,
        fullPath,
        warnings,
        dryRunExecuted: true,
      };
    }

    // Ensure parent directories exist if ensureParents is true or by default
    // The original code implicitly created parent directories with fs.mkdirSync(dirname, { recursive: true });
    // Let's make it more explicit and tied to an option if necessary, or keep default behavior.
    // For now, maintaining original behavior of ensuring parents.
    if (options.ensureParents !== false) { // Default to true unless explicitly false
        if (!fs.existsSync(baseDir)) {
            this.logger.log(`[ModularFsAgent.createFile] Base directory ${baseDir} does not exist. Attempting to create.`);
            try {
                fs.mkdirSync(baseDir, { recursive: true });
                this.logger.log(`[ModularFsAgent.createFile] Successfully created parent directory: ${baseDir}`);
                warnings.push(`Parent directory ${baseDir} created.`);
            } catch (mkdirError) {
                this.logger.error(`[ModularFsAgent.createFile] Error creating parent directory ${baseDir}:`, mkdirError);
                return {
                    success: false,
                    message: `Failed to create parent directories for ${fullPath}: ${mkdirError.message}`,
                    error: { code: 'FS_MKDIR_FAILED', originalError: mkdirError, message: mkdirError.message },
                    fullPath: baseDir, // Path that failed to be created
                    warnings
                };
            }
        }
    } else if (!fs.existsSync(baseDir)) {
        // If ensureParents is false and directory doesn't exist, this is an error.
        const message = `Parent directory ${baseDir} does not exist and ensureParents is false.`;
        this.logger.warn(`[ModularFsAgent.createFile] ${message}`);
        return {
            success: false,
            message,
            error: { code: 'FS_PARENT_DIR_MISSING', message, details: { path: fullPath } },
            fullPath,
            warnings
        };
    }


    const existsCheck = this.checkFileExists(relativePath); // Uses relativePath

    if (existsCheck.success && existsCheck.exists) {
      this.logger.log(`[ModularFsAgent.createFile] File already exists at ${fullPath}. Checking confirmation requirements.`);
      if (options.requireConfirmation && !options.isConfirmedAction) {
        const message = `Confirmation required to overwrite file at ${fullPath}.`;
        this.logger.warn(`[ModularFsAgent.createFile] ${message}`);
        return {
          success: false,
          message,
          confirmationNeeded: true,
          fullPath,
          action: 'createFile',
          error: { code: 'FS_CONFIRMATION_REQUIRED', message, details: { path: fullPath, operation: 'createFile' } },
          warnings: ['File will be overwritten if confirmed.'],
        };
      }
      const overwriteWarning = `WARNING: File at ${fullPath} already exists and will be overwritten (isConfirmedAction: ${options.isConfirmedAction}, requireConfirmation: ${options.requireConfirmation}).`;
      warnings.push(overwriteWarning);
      this.logger.log(`[ModularFsAgent.createFile] ${overwriteWarning}`);
      try {
        fs.copyFileSync(fullPath, fullPath + '.bak');
        const backupMsg = `File backed up to ${fullPath}.bak`;
        warnings.push(backupMsg);
        this.logger.log(`[ModularFsAgent.createFile] ${backupMsg}`);
      } catch (backupError) {
        const backupFailureWarning = `Failed to create backup for ${fullPath}: ${backupError.message}`;
        warnings.push(backupFailureWarning);
        this.logger.error(`[ModularFsAgent.createFile] ${backupFailureWarning}`, backupError);
      }
    }

    try {
      this.logger.log(`[ModularFsAgent.createFile] Writing file to: ${fullPath}`);
      fs.writeFileSync(fullPath, content, 'utf-8'); // Explicitly use utf-8
      const successMsg = `File created/overwritten successfully at ${fullPath}`;
      this.logger.log(`[ModularFsAgent.createFile] ${successMsg}`);
      return {
        success: true,
        message: successMsg,
        fullPath,
        warnings,
      };
    } catch (writeError) {
      this.logger.error(`[ModularFsAgent.createFile] Error writing file ${fullPath}:`, writeError);
      return {
        success: false,
        message: `Error writing file to ${fullPath}: ${writeError.message}`,
        error: { code: 'FS_WRITE_FILE_FAILED', originalError: writeError, message: writeError.message },
        fullPath,
        warnings,
      };
    }
  }

  readFile(relativePath, options = {}) { // Added options
    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      return { success: false, error: resolved.error };
    }
    const { fullPath } = resolved;

    // options.dryRun doesn't change behavior of readFile, but acknowledge if passed
    if (options.dryRun) {
      this.logger.log(`[ModularFsAgent::readFile] Dry run mode active, but operation is read-only.`);
    }

    try {
      const existsCheck = this.checkFileExists(relativePath); // Use class method
      if (!existsCheck.success || !existsCheck.exists) {
        return {
          success: false,
          error: {
            code: 'FS_READ_FILE_NOT_FOUND',
            message: existsCheck.message || `File not found at ${fullPath}`,
            details: { path: fullPath }
          }
        };
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      this._logOperation('readFile', fullPath, true, `File read successfully.`);
      return {
        success: true,
        content,
        message: `File read successfully from ${fullPath}`,
        fullPath,
      };
    } catch (error) {
      this._logOperation(
        'readFile',
        fullPath,
        false,
        `Error reading file.`,
        error
      );
      return {
        success: false,
        error: {
          code: 'FS_READ_FILE_FAILED',
          message: `Error reading file at ${fullPath}: ${error.message}`,
          details: { path: fullPath, originalError: error.message }
        }
      };
    }
  }

  updateFile(
    relativePath,
    newContent,
    // Ensure options has default values if not provided, especially for dryRun
    options = { append: false, requireConfirmation: false, isConfirmedAction: false, dryRun: false, ...options }
  ) {
    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      return { success: false, error: resolved.error, warnings: [] };
    }
    const { fullPath } = resolved;
    let warnings = []; // Ensure warnings is always an array

    if (options.dryRun) {
      this._logOperation('updateFile', fullPath, true, `DRY RUN: File would have been updated/appended.`);
      warnings.push('Operation performed in dry run mode.');
      return {
        success: true,
        message: `DRY RUN: File would have been updated/appended at ${fullPath}`,
        fullPath,
        warnings,
        dryRunExecuted: true,
      };
    }

    try {
      const existsCheck = this.checkFileExists(relativePath); // Use class method
      if (!existsCheck.success) {
        // Pass through the structured error from checkFileExists if it failed beyond simple existence
        return { success: false, error: existsCheck.error || { code: 'FS_UPDATE_PRE_CHECK_FAILED', message: existsCheck.message }, warnings };
      }

      if (!existsCheck.exists) {
        if (options.append) {
          const message = `File does not exist at ${fullPath}, cannot append. Create the file first.`;
          this._logOperation('updateFile', fullPath, false, message);
          return {
            success: false,
            error: { code: 'FS_UPDATE_APPEND_NON_EXISTENT', message, details: { path: fullPath } },
            warnings
          };
        } else {
          this._logOperation('updateFile', fullPath, true, `File did not exist. Creating it.`);
          // Attempt to create the file; this will return a structured error if it fails
          const createResult = this.createFile(relativePath, newContent, {
            requireConfirmation: options.requireConfirmation,
            isConfirmedAction: options.isConfirmedAction,
            // Pass dryRun status if it were to be used by createFile in this specific path, though dryRun is checked above.
          });
          return { ...createResult, warnings: [...warnings, ...(createResult.warnings || [])] };
        }
      }

      if (options.append) {
        fs.appendFileSync(fullPath, newContent);
        this._logOperation('updateFile', fullPath, true, `Content appended successfully.`);
        return { success: true, message: `Content appended successfully to ${fullPath}`, fullPath, warnings };
      } else {
        if (options.requireConfirmation && !options.isConfirmedAction) {
          return {
            success: false,
            message: 'Confirmation required to overwrite existing file.',
            confirmationNeeded: true,
            fullPath: fullPath,
            action: 'updateFile',
            error: { // Adding an error object for consistency
                code: 'FS_CONFIRMATION_REQUIRED',
                message: 'Confirmation required to overwrite existing file.',
                details: { path: fullPath, operation: 'updateFile' }
            },
            warnings: ['File will be overwritten if confirmed.'],
          };
        }
        const overwriteWarning = `WARNING: Preparing to overwrite file at ${fullPath} (isConfirmedAction: ${options.isConfirmedAction})`;
        warnings.push(overwriteWarning);
        this._logOperation('updateFile', fullPath, true, overwriteWarning);
        try {
          fs.copyFileSync(fullPath, fullPath + '.bak');
          warnings.push(`File backed up to ${fullPath}.bak`);
          this._logOperation(
            'updateFile',
            fullPath,
            true,
            `Backup created at ${fullPath}.bak`
          );
        } catch (backupError) {
          warnings.push(
            `Failed to create backup for ${fullPath}: ${backupError.message}`
          );
          this._logOperation(
            'updateFile',
            fullPath,
            false,
            `Failed to create backup for ${fullPath}: ${backupError.message}`,
            backupError
          );
        }
        fs.writeFileSync(fullPath, newContent);
        this._logOperation(
          'updateFile',
          fullPath,
          true,
          `File overwritten successfully.`
        );
        return {
          success: true,
          message: `File overwritten successfully at ${fullPath}`,
          fullPath,
          warnings,
        };
      }
    } catch (error) {
      this._logOperation(
        'updateFile',
        fullPath,
        false,
        `Error updating file.`,
        error
      );
      return {
        success: false,
        error: {
          code: 'FS_UPDATE_FILE_FAILED',
          message: `Error updating file at ${fullPath}: ${error.message}`,
          details: { path: fullPath, originalError: error.message }
        },
        warnings,
      };
    }
  }

  deleteFile(relativePath, options = {isConfirmedAction: false, dryRun: false}) {
    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      return { success: false, error: resolved.error, warnings: [] };
    }
    const { fullPath } = resolved;
    let warnings = []; // Ensure warnings is always an array

    if (options.dryRun) {
      this._logOperation('deleteFile', fullPath, true, `DRY RUN: File would have been deleted.`);
      warnings.push('Operation performed in dry run mode.');
      // In a dry run, we might want to check if the file "would have existed" based on prior dry run creates.
      // For now, assume it would exist if the path resolves.
      const existsCheck = this.checkFileExists(relativePath); // Actual check, could be mocked in a more complex dry run state
      if (!existsCheck.exists && !options.isConfirmedAction) { // If it doesn't actually exist, reflect that in dry run message if not forced
          warnings.push('Note: File does not currently exist at this path.');
          return {
              success: true, // Still success from dry run perspective
              message: `DRY RUN: File would have been deleted from ${fullPath}, but it does not currently exist.`,
              fullPath,
              warnings,
              dryRunExecuted: true,
            };
      }
      return {
        success: true,
        message: `DRY RUN: File would have been deleted from ${fullPath}`,
        fullPath,
        warnings,
        dryRunExecuted: true,
      };
    }

    try {
      const existsCheck = this.checkFileExists(relativePath); // Use class method
      if (!existsCheck.success) {
        // Pass through structured error
        return { success: false, error: existsCheck.error || { code: 'FS_DELETE_PRE_CHECK_FAILED', message: existsCheck.message }, warnings };
      }

      if (!existsCheck.exists) {
        return {
          success: false,
          error: {
            code: 'FS_DELETE_FILE_NOT_FOUND',
            message: existsCheck.message || `File not found at ${fullPath}, cannot delete.`,
            details: { path: fullPath }
          },
          warnings,
        };
      }

      if (options.requireConfirmation && !options.isConfirmedAction) {
        return {
          success: false,
          message: 'Confirmation required to delete file.',
          confirmationNeeded: true,
          fullPath: fullPath,
          action: 'deleteFile',
          error: { // Adding an error object for consistency
              code: 'FS_CONFIRMATION_REQUIRED',
              message: 'Confirmation required to delete file.',
              details: { path: fullPath, operation: 'deleteFile' }
          },
          warnings: ['File will be deleted if confirmed.'],
        };
      }
      warnings.push(`WARNING: Preparing to delete file at ${fullPath} (isConfirmedAction: ${options.isConfirmedAction})`);
      this._logOperation('deleteFile', fullPath, true, `Preparing to delete file.`);

      try {
        fs.copyFileSync(fullPath, fullPath + '.bak');
        warnings.push(`File backed up to ${fullPath}.bak`);
        this._logOperation(
          'deleteFile',
          fullPath,
          true,
          `Backup created at ${fullPath}.bak`
        );
      } catch (backupError) {
        warnings.push(
          `Failed to create backup for ${fullPath}: ${backupError.message}`
        );
        this._logOperation(
          'deleteFile',
          fullPath,
          false,
          `Failed to create backup: ${backupError.message}`,
          backupError
        );
      }
      fs.unlinkSync(fullPath);
      this._logOperation('deleteFile', fullPath, true, `File deleted successfully.`);
      return {
        success: true,
        message: `File deleted successfully from ${fullPath}`,
        fullPath,
        warnings,
      };
    } catch (error) {
      this._logOperation(
        'deleteFile',
        fullPath,
        false,
        `Error deleting file.`,
        error
      );
      return {
        success: false,
        error: {
          code: 'FS_DELETE_FILE_FAILED',
          message: `Error deleting file at ${fullPath}: ${error.message}`,
          details: { path: fullPath, originalError: error.message }
        },
        warnings,
      };
    }
  }

  createDirectory(relativePath, options = { requireConfirmation: false, isConfirmedAction: false, dryRun: false }) {
    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      return { success: false, error: resolved.error, warnings: [] };
    }
    const { fullPath } = resolved;
    let warnings = [];

    if (options.dryRun) {
      this._logOperation('createDirectory', fullPath, true, `DRY RUN: Directory would have been created.`);
      warnings.push('Operation performed in dry run mode.');
      if (fs.existsSync(fullPath)) {
         warnings.push('Note: Directory already exists at this path.');
      }
      return {
        success: true,
        message: `DRY RUN: Directory would have been created at ${fullPath}`,
        fullPath,
        warnings,
        dryRunExecuted: true,
      };
    }

    try {
      if (fs.existsSync(fullPath)) {
        this._logOperation('createDirectory', fullPath, true, `Directory already exists.`);
        return { success: true, message: `Directory already exists at ${fullPath}`, fullPath, warnings };
      }

      if (options.requireConfirmation && !options.isConfirmedAction) {
        // This case is less common for create if not exists, but handle for consistency
        return {
            success: false,
            message: 'Confirmation required to create directory.',
            confirmationNeeded: true,
            fullPath: fullPath,
            action: 'createDirectory',
             error: { code: 'FS_CONFIRMATION_REQUIRED', message: 'Confirmation required to create directory.', details: {path: fullPath, operation: 'createDirectory'}},
            warnings: ['Directory will be created if confirmed.'],
        };
      }

      fs.mkdirSync(fullPath, { recursive: true });
      this._logOperation('createDirectory', fullPath, true, `Directory created successfully.`);
      return { success: true, message: `Directory created successfully at ${fullPath}`, fullPath, warnings };
    } catch (error) {
      this._logOperation('createDirectory', fullPath, false, `Error creating directory.`, error);
      return {
        success: false,
        error: {
          code: 'FS_CREATE_DIR_FAILED',
          message: `Error creating directory at ${fullPath}: ${error.message}`,
          details: { path: fullPath, originalError: error.message }
        },
        warnings
      };
    }
  }

  deleteDirectory(relativePath, options = { requireConfirmation: false, isConfirmedAction: false, dryRun: false }) {
    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      return { success: false, error: resolved.error, warnings: [] };
    }
    const { fullPath } = resolved;
    let warnings = [];

    if (options.dryRun) {
      this._logOperation('deleteDirectory', fullPath, true, `DRY RUN: Directory would have been deleted recursively.`);
      warnings.push('Operation performed in dry run mode.');
      if (!fs.existsSync(fullPath)) {
         warnings.push('Note: Directory does not currently exist at this path.');
      }
      return {
        success: true,
        message: `DRY RUN: Directory would have been deleted recursively at ${fullPath}`,
        fullPath,
        warnings,
        dryRunExecuted: true,
      };
    }

    try {
      if (!fs.existsSync(fullPath)) {
        this._logOperation('deleteDirectory', fullPath, false, `Directory not found.`);
        return {
          success: false,
          error: {
            code: 'FS_DELETE_DIR_NOT_FOUND',
            message: `Directory not found at ${fullPath}, cannot delete.`,
            details: { path: fullPath }
          },
          warnings,
        };
      }

      if (options.requireConfirmation && !options.isConfirmedAction) {
        return {
          success: false,
          message: 'Confirmation required to delete directory and its contents.',
          confirmationNeeded: true,
          fullPath: fullPath,
          action: 'deleteDirectory',
          error: { // Adding an error object for consistency
              code: 'FS_CONFIRMATION_REQUIRED',
              message: 'Confirmation required to delete directory.',
              details: { path: fullPath, operation: 'deleteDirectory' }
          },
          warnings: ['Directory and its contents will be recursively deleted if confirmed.'],
        };
      }
      warnings.push(
        `WARNING: Preparing to recursively delete directory at ${fullPath} (isConfirmedAction: ${options.isConfirmedAction})`
      );
      this._logOperation(
        'deleteDirectory',
        fullPath,
        true,
        `Preparing to delete directory.`
      );

      fs.rmSync(fullPath, { recursive: true, force: true }); // force option added for robustness
      this._logOperation(
        'deleteDirectory',
        fullPath,
        true,
        `Directory deleted successfully.`
      );
      return {
        success: true,
        message: `Directory deleted successfully from ${fullPath}`,
        fullPath,
        warnings,
      };
    } catch (error) {
      this._logOperation(
        'deleteDirectory',
        fullPath,
        false,
        `Error deleting directory.`,
        error
      );
      return {
        success: false,
        error: {
          code: 'FS_DELETE_DIR_FAILED',
          message: `Error deleting directory at ${fullPath}: ${error.message}`,
          details: { path: fullPath, originalError: error.message }
        },
        warnings,
      };
    }
  }

  generateDirectoryTree(startDirRelativePath, prefix = '', rootName = null, options = {}) { // Added options
    const resolved = this.resolvePathInWorkspace(startDirRelativePath);
    if (!resolved.success) {
      // generateDirectoryTree is expected to return a string (tree or error message)
      // So, we adapt its error reporting to match that, not the structured object.
      // The RoadrunnerCoreFsAgent wrapper will handle converting this to a structured error.
      return resolved.error?.message ? `Error: ${resolved.error.message}` : "Error: Path resolution failed for generateDirectoryTree.";
    }
    const startPath = resolved.fullPath; // Absolute path

    if (options.dryRun) {
      this.logger.log(`[ModularFsAgent::generateDirectoryTree] Dry run mode active, but operation is read-only.`);
      // Potentially, one could log that the tree "would have been generated".
      // For now, it proceeds as normal since it's a read operation.
    }

    try {
      const stats = fs.statSync(startPath);
      if (!stats.isDirectory()) {
        return `Error: Path '${startPath}' is not a directory.`;
      }
    } catch (e) {
      return `Error: Path '${startPath}' not found or inaccessible. ${e.message}`;
    }

    let treeString = '';
    if (rootName) {
      treeString += rootName + '\n';
    } else {
      // Use the directory name if rootName is not provided
      treeString += path.basename(startPath) + '\n';
    }

    const entries = fs
      .readdirSync(startPath, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort for consistent output

    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const entryPath = path.join(startPath, entry.name); // For recursion, keep it absolute
      treeString += prefix + connector + entry.name + '\n';
      if (entry.isDirectory()) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        // Recursively call with the absolute path of the subdirectory
        // Pass entry.name as the rootName for the subtree if needed, or modify generateDirectoryTree
        // For now, passing the newPrefix and the absolute path
        // Pass options down to recursive calls if generateDirectoryTree itself uses them further
        treeString += this._generateDirectoryTreeRecursive(entryPath, newPrefix, options); // private helper for recursion
      }
    });
    return treeString;
  }

  // Helper for recursive part of generateDirectoryTree to avoid re-resolving base path
  _generateDirectoryTreeRecursive(absoluteDirPath, prefix = '', options = {}) { // Added options
    let treeString = '';
    const entries = fs
      .readdirSync(absoluteDirPath, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const entryPath = path.join(absoluteDirPath, entry.name);
      treeString += prefix + connector + entry.name + '\n';
      if (entry.isDirectory()) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
  _generateDirectoryTreeRecursive(entryPath, newPrefix, options); // Pass options
      }
    });
    return treeString;
  }
}

// For backward compatibility:
// Load configuration for allowed external paths for the default instance
const CONFIG_PATH = path.resolve(__dirname, 'fsAgent.config.json');
let defaultAllowedExternalPaths = [];
try {
  const cfgRaw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const cfg = JSON.parse(cfgRaw);
  if (Array.isArray(cfg.allowedExternalPaths)) {
    defaultAllowedExternalPaths = cfg.allowedExternalPaths.map((p) =>
      path.resolve(p)
    ); // Ensure paths are resolved for consistency
  }
  console.log(
    `[fsAgent-default] Loaded config from ${CONFIG_PATH}. Allowed external paths: ${defaultAllowedExternalPaths.join(', ')}`
  );
} catch (e) {
  console.log(
    `[fsAgent-default] No config found at ${CONFIG_PATH}. Using default workspace only.`
  );
}

const DEFAULT_WORKSPACE_DIR_CONST = path.resolve(__dirname, '../output'); // Renamed to avoid conflict

function isWindowsLegacy() {
  return process.platform === 'win32';
}

function isRestrictedBaseLegacy(candidate) {
  const normalized = path.resolve(candidate);
  if (isWindowsLegacy()) {
    const upper = normalized.toUpperCase();
    if (upper.startsWith('C:\\') || upper.startsWith('C:/')) {
      return true;
    }
  } else {
    const restricted = ['/bin', '/usr', '/etc', '/System', '/Library'];
    if (restricted.some((dir) => normalized.startsWith(dir))) {
      return true;
    }
  }
  return false;
}

let resolvedDefaultWorkspaceDir = DEFAULT_WORKSPACE_DIR_CONST;
const envWorkspace = process.env.ROADRUNNER_WORKSPACE_DIR;
if (envWorkspace) {
  if (isRestrictedBaseLegacy(envWorkspace)) {
    console.warn(
      `[fsAgent-default] Refusing to use restricted workspace path '${envWorkspace}'. Using default '${DEFAULT_WORKSPACE_DIR_CONST}'.`
    );
  } else {
    resolvedDefaultWorkspaceDir = path.resolve(envWorkspace);
  }
}

// Create a default instance for backward compatibility
const defaultFsAgentInstance = new ModularFsAgent({
  workspaceDir: resolvedDefaultWorkspaceDir,
  allowedExternalPaths: defaultAllowedExternalPaths,
  logger: console, // Default logger for the standalone instance
});

module.exports = {
  ModularFsAgent, // Export the class
  // Export methods from the default instance for backward compatibility
  checkFileExists: defaultFsAgentInstance.checkFileExists.bind(defaultFsAgentInstance),
  createFile: defaultFsAgentInstance.createFile.bind(defaultFsAgentInstance),
  readFile: defaultFsAgentInstance.readFile.bind(defaultFsAgentInstance),
  updateFile: defaultFsAgentInstance.updateFile.bind(defaultFsAgentInstance),
  deleteFile: defaultFsAgentInstance.deleteFile.bind(defaultFsAgentInstance),
  createDirectory: defaultFsAgentInstance.createDirectory.bind(defaultFsAgentInstance),
  deleteDirectory: defaultFsAgentInstance.deleteDirectory.bind(defaultFsAgentInstance),
  generateDirectoryTree: defaultFsAgentInstance.generateDirectoryTree.bind(defaultFsAgentInstance),
  resolvePathInWorkspace: defaultFsAgentInstance.resolvePathInWorkspace.bind(defaultFsAgentInstance),
  // It might be cleaner to export the instance itself if server.js can be updated slightly:
  // defaultInstance: defaultFsAgentInstance,
};
