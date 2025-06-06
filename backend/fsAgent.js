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
    const funcName = 'resolvePathInWorkspace';
    this.logger.log(`[ModularFsAgent::${funcName}] Attempting to resolve relativePath: "${relativePath}" (Type: ${typeof relativePath})`);

    if (typeof relativePath !== 'string') {
      const message = 'Invalid path type. Path must be a string.';
      this._logOperation(funcName, String(relativePath), false, message, { type: typeof relativePath });
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message, details: { relativePathType: typeof relativePath } }
      };
    }
    // Allow empty string to resolve to workspaceDir, or handle as error if preferred.
    // Current behavior: empty string resolves to workspaceDir, which is acceptable.
    // if (relativePath.trim() === '') {
    //   const message = 'Path cannot be an empty string.';
    //   this._logOperation(funcName, relativePath, false, message);
    //   return { success: false, error: { code: 'INVALID_INPUT', message } };
    // }


    if (/\{\{[^}]+\}\}/.test(relativePath)) {
      const message = 'Path contains unresolved template placeholders.';
      this._logOperation(funcName, relativePath, false, message, { rawPath: relativePath });
      return {
        success: false,
        error: { code: 'FS_UNRESOLVED_TEMPLATE', message, details: { relativePath } }
      };
    }
    const normalizedPath = path.normalize(relativePath);
    let fullPath = path.isAbsolute(normalizedPath)
      ? path.resolve(normalizedPath) // Resolve even absolute paths to guard against weird inputs like '/../'
      : path.resolve(this.workspaceDir, normalizedPath);

    this.logger.log(`[ModularFsAgent::${funcName}] Normalized: "${normalizedPath}", Tentative Full Path: "${fullPath}"`);

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
    const funcName = 'createFile';
    const mergedOptions = { requireConfirmation: false, isConfirmedAction: false, dryRun: false, ensureParents: true, ...options };
    this.logger.log(`[ModularFsAgent::${funcName}] Attempting. Path: "${relativePath}", Content length: ${content?.length || 'N/A'}, Options: ${JSON.stringify(mergedOptions)}`);

    if (!relativePath || typeof relativePath !== 'string' || relativePath.trim() === '') {
      const message = "Invalid 'relativePath' parameter: must be a non-empty string.";
      this._logOperation(funcName, String(relativePath), false, message);
      return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { relativePath } }, warnings: [] };
    }
    if (typeof content !== 'string') {
      const message = "Invalid 'content' parameter: must be a string.";
      this._logOperation(funcName, relativePath, false, message, {contentType: typeof content});
      return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { contentType: typeof content } }, warnings: [] };
    }

    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      this._logOperation(funcName, relativePath, false, resolved.error.message, resolved.error);
      return { success: false, error: resolved.error, message: resolved.error.message, warnings: [] };
    }
    const { fullPath } = resolved;
    const baseDir = path.dirname(fullPath);
    let warnings = [];
    this.logger.log(`[ModularFsAgent::${funcName}] Resolved path: '${fullPath}', Base directory: '${baseDir}'`);


    if (mergedOptions.dryRun) {
      this._logOperation(funcName, fullPath, true, `DRY RUN: File would have been created/overwritten.`);
      warnings.push('Operation performed in dry run mode.');
      // Check if parent dirs would need creation in dry run
      try {
        if (mergedOptions.ensureParents && !fs.existsSync(baseDir)) {
            warnings.push(`DRY RUN: Parent directory ${baseDir} would have been created.`);
        }
        if (fs.existsSync(fullPath)) {
            warnings.push(`DRY RUN: File at ${fullPath} already exists and would be overwritten.`);
        }
      } catch(e) { /* ignore fs errors in dry_run for existsSync */ }
      return {
        success: true,
        message: `DRY RUN: File would have been created/overwritten at ${fullPath}`,
        fullPath,
        warnings,
        dryRunExecuted: true,
      };
    }

    if (mergedOptions.ensureParents) {
        if (!fs.existsSync(baseDir)) {
            this.logger.log(`[ModularFsAgent::${funcName}] Base directory ${baseDir} does not exist. Attempting to create.`);
            try {
                fs.mkdirSync(baseDir, { recursive: true });
                this.logger.log(`[ModularFsAgent::${funcName}] Successfully created parent directory: ${baseDir}`);
                warnings.push(`Parent directory ${baseDir} created.`);
            } catch (mkdirError) {
                const message = `Failed to create parent directories for ${fullPath}: ${mkdirError.message}`;
                this._logOperation(funcName, baseDir, false, message, mkdirError);
                return {
                    success: false, message,
                    error: { code: 'FS_MKDIR_FAILED', originalError: { message: mkdirError.message, code: mkdirError.code, stack: mkdirError.stack } },
                    fullPath: baseDir, warnings
                };
            }
        }
    } else if (!fs.existsSync(baseDir)) {
        const message = `Parent directory ${baseDir} does not exist and ensureParents is false.`;
        this._logOperation(funcName, fullPath, false, message);
        return {
            success: false,
            message,
            error: { code: 'FS_PARENT_DIR_MISSING', message, details: { path: fullPath } },
            fullPath,
            warnings
        };
    }


    let fileExists = false;
    try {
        fileExists = fs.existsSync(fullPath);
    } catch (e) {
        // Should not happen if baseDir exists and accessible, but as a precaution
        const message = `Error checking file existence for ${fullPath}: ${e.message}`;
        this._logOperation(funcName, fullPath, false, message, e);
        return { success: false, message, error: { code: 'FS_CHECK_EXISTS_FAILED', originalError: { message: e.message, code: e.code, stack: e.stack } }, fullPath, warnings };
    }

    if (fileExists) {
      this.logger.log(`[ModularFsAgent::${funcName}] File already exists at ${fullPath}. Checking confirmation requirements.`);
      if (mergedOptions.requireConfirmation && !mergedOptions.isConfirmedAction) {
        const message = `Confirmation required to overwrite file at ${fullPath}.`;
        this._logOperation(funcName, fullPath, false, message + " Confirmation pending.");
        return {
          success: false, message, confirmationNeeded: true, fullPath, action: 'createFile',
          error: { code: 'FS_CONFIRMATION_REQUIRED', message, details: { path: fullPath, operation: 'createFile' } },
          warnings: ['File will be overwritten if confirmed.'],
        };
      }
      const overwriteWarning = `WARNING: File at ${fullPath} already exists and will be overwritten (isConfirmedAction: ${mergedOptions.isConfirmedAction}, requireConfirmation: ${mergedOptions.requireConfirmation}).`;
      warnings.push(overwriteWarning);
      this.logger.warn(`[ModularFsAgent::${funcName}] ${overwriteWarning}`); // Use warn for overwrites
      try {
        fs.copyFileSync(fullPath, fullPath + '.bak');
        warnings.push(`File backed up to ${fullPath}.bak`);
        this._logOperation(funcName, fullPath, true, `Backup created at ${fullPath}.bak`);
      } catch (backupError) {
        warnings.push(`Failed to create backup for ${fullPath}: ${backupError.message}`);
        this._logOperation(funcName, fullPath, false, `Failed to create backup: ${backupError.message}`, backupError);
      }
    }

    try {
      this.logger.log(`[ModularFsAgent::${funcName}] Writing file to: ${fullPath}`);
      fs.writeFileSync(fullPath, content, 'utf-8');
      const successMsg = fileExists ? `File overwritten successfully at ${fullPath}` : `File created successfully at ${fullPath}`;
      this._logOperation(funcName, fullPath, true, successMsg);
      return {
        success: true,
        message: successMsg,
        fullPath,
        warnings,
      };
    } catch (writeError) {
      const message = `Error writing file to ${fullPath}: ${writeError.message}`;
      this._logOperation(funcName, fullPath, false, message, writeError);
      return {
        success: false,
        message: `Error writing file to ${fullPath}: ${writeError.message}`,
        error: { code: 'FS_WRITE_FILE_FAILED', originalError: writeError, message: writeError.message, errorCode: writeError.code },
        fullPath,
        warnings,
      };
    }
  }

  readFile(relativePath, options = {}) {
    const funcName = 'readFile';
    const mergedOptions = { dryRun: false, ...options }; // readFile doesn't have many specific options yet
    this.logger.log(`[ModularFsAgent::${funcName}] Attempting. Path: "${relativePath}", Options: ${JSON.stringify(mergedOptions)}`);

    if (!relativePath || typeof relativePath !== 'string' || relativePath.trim() === '') {
      const message = "Invalid 'relativePath' parameter: must be a non-empty string.";
      this._logOperation(funcName, String(relativePath), false, message);
      return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { relativePath } } };
    }

    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      this._logOperation(funcName, relativePath, false, resolved.error.message, resolved.error);
      return { success: false, error: resolved.error, message: resolved.error.message };
    }
    const { fullPath } = resolved;

    if (mergedOptions.dryRun) {
      this.logger.log(`[ModularFsAgent::${funcName}] Dry run mode active, but operation is read-only.`);
      // In a dry run for readFile, we can simulate checking existence.
      try {
        if (!fs.existsSync(fullPath)) {
          const message = `DRY RUN: File not found at ${fullPath}. Read would fail.`;
          this._logOperation(funcName, fullPath, false, message);
          return { success: false, message, error: { code: 'FS_READ_FILE_NOT_FOUND_DRYRUN', message }, dryRunExecuted: true };
        }
      } catch(e) { /* ignore fs errors in dry_run */ }
      const message = `DRY RUN: File exists at ${fullPath}. Read operation would proceed.`;
      this._logOperation(funcName, fullPath, true, message);
      return { success: true, message, fullPath, content: "[Dry Run - No Content Read]", dryRunExecuted: true };
    }

    try {
      // fs.existsSync should be robust enough, but checkFileExists adds logging and structure
      if (!fs.existsSync(fullPath)) { // Direct check before read attempt
        const message = `File not found at ${fullPath}.`;
        this._logOperation(funcName, fullPath, false, message);
        return {
          success: false,
          error: { code: 'FS_READ_FILE_NOT_FOUND', message, details: { path: fullPath } }
        };
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      this._logOperation(funcName, fullPath, true, `File read successfully.`);
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
    // Ensure options has default values
    options = { append: false, requireConfirmation: false, isConfirmedAction: false, dryRun: false, ensureParents: true, ...options }
  ) {
    const funcName = 'updateFile';
    const mergedOptions = { ...options }; // Use mergedOptions for clarity
    this.logger.log(`[ModularFsAgent::${funcName}] Attempting. Path: "${relativePath}", Content length: ${newContent?.length || 'N/A'}, Options: ${JSON.stringify(mergedOptions)}`);

    if (!relativePath || typeof relativePath !== 'string' || relativePath.trim() === '') {
      const message = "Invalid 'relativePath' parameter: must be a non-empty string.";
      this._logOperation(funcName, String(relativePath), false, message);
      return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { relativePath } }, warnings: [] };
    }
    if (typeof newContent !== 'string') {
      const message = "Invalid 'newContent' parameter: must be a string.";
      this._logOperation(funcName, relativePath, false, message, {contentType: typeof newContent});
      return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { contentType: typeof newContent } }, warnings: [] };
    }
    if (mergedOptions.append !== undefined && typeof mergedOptions.append !== 'boolean') {
        const message = "Invalid 'append' option: must be boolean if provided.";
        this._logOperation(funcName, relativePath, false, message, {appendType: typeof mergedOptions.append});
        return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { appendType: typeof mergedOptions.append } }, warnings: [] };
    }


    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      this._logOperation(funcName, relativePath, false, resolved.error.message, resolved.error);
      return { success: false, error: resolved.error, message: resolved.error.message, warnings: [] };
    }
    const { fullPath } = resolved;
    const baseDir = path.dirname(fullPath);
    let warnings = [];

    if (mergedOptions.dryRun) {
      this._logOperation(funcName, fullPath, true, `DRY RUN: File would have been updated/appended.`);
      warnings.push('Operation performed in dry run mode.');
      try {
        if (!fs.existsSync(fullPath)) {
            warnings.push(`DRY RUN: File does not exist at ${fullPath}. Behavior depends on 'append' flag.`);
            if (!mergedOptions.append && mergedOptions.ensureParents && !fs.existsSync(baseDir)) {
                 warnings.push(`DRY RUN: Parent directory ${baseDir} would have been created.`);
            }
        }
      } catch(e) { /* ignore fs errors in dry_run */ }
      return {
        success: true,
        message: `DRY RUN: File would have been updated/appended at ${fullPath}`,
        fullPath,
        warnings,
        dryRunExecuted: true,
      };
    }

    try {
      // Ensure parent directory exists if not appending to an existing file and ensureParents is true
      if (!mergedOptions.append && mergedOptions.ensureParents && !fs.existsSync(baseDir)) {
        this.logger.log(`[ModularFsAgent::${funcName}] Base directory ${baseDir} does not exist. Attempting to create for new file write.`);
        try {
            fs.mkdirSync(baseDir, { recursive: true });
            warnings.push(`Parent directory ${baseDir} created.`);
            this._logOperation(funcName, baseDir, true, "Parent directory created.");
        } catch (mkdirError) {
            const message = `Failed to create parent directories for ${fullPath}: ${mkdirError.message}`;
            this._logOperation(funcName, baseDir, false, message, mkdirError);
            return { success: false, message, error: { code: 'FS_MKDIR_FAILED', originalError: { message: mkdirError.message, code: mkdirError.code, stack: mkdirError.stack } }, fullPath: baseDir, warnings };
        }
      } else if (!mergedOptions.append && !mergedOptions.ensureParents && !fs.existsSync(baseDir)) {
          const message = `Parent directory ${baseDir} does not exist and ensureParents is false. Cannot create new file.`;
          this._logOperation(funcName, fullPath, false, message);
          return { success: false, message, error: { code: 'FS_PARENT_DIR_MISSING', message, details: { path: fullPath } }, fullPath, warnings };
      }


      if (!fs.existsSync(fullPath)) {
        if (mergedOptions.append) {
          const message = `File does not exist at ${fullPath}, cannot append. Create the file first.`;
          this._logOperation(funcName, fullPath, false, message);
          return { success: false, error: { code: 'FS_UPDATE_APPEND_NON_EXISTENT', message, details: { path: fullPath } }, warnings };
        } else { // Creating a new file (overwrite mode, but file doesn't exist)
          this.logger.log(`[ModularFsAgent::${funcName}] File does not exist at ${fullPath}. Creating new file (overwrite mode).`);
          fs.writeFileSync(fullPath, newContent, 'utf-8');
          this._logOperation(funcName, fullPath, true, "New file created successfully (in overwrite mode).");
          return { success: true, message: `New file created successfully at ${fullPath}`, fullPath, warnings };
        }
      }

      // File exists, proceed with append or overwrite logic
      if (mergedOptions.append) {
        fs.appendFileSync(fullPath, newContent, 'utf-8');
        this._logOperation(funcName, fullPath, true, `Content appended successfully.`);
        return { success: true, message: `Content appended successfully to ${fullPath}`, fullPath, warnings };
      } else { // Overwrite existing file
        if (mergedOptions.requireConfirmation && !mergedOptions.isConfirmedAction) {
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
        const overwriteWarning = `WARNING: Preparing to overwrite file at ${fullPath} (isConfirmedAction: ${mergedOptions.isConfirmedAction})`;
        warnings.push(overwriteWarning);
        this._logOperation(funcName, fullPath, true, overwriteWarning); // Log with funcName
        try {
          fs.copyFileSync(fullPath, fullPath + '.bak');
          warnings.push(`File backed up to ${fullPath}.bak`);
          this._logOperation( // Log with funcName
            funcName,
            fullPath,
            true,
            `Backup created at ${fullPath}.bak`
          );
        } catch (backupError) {
          warnings.push(
            `Failed to create backup for ${fullPath}: ${backupError.message}`
          );
          this._logOperation( // Log with funcName
            funcName,
            fullPath,
            false,
            `Failed to create backup for ${fullPath}: ${backupError.message}`,
            backupError
          );
        }
        fs.writeFileSync(fullPath, newContent, 'utf-8'); // Ensure utf-8
        this._logOperation( // Log with funcName
          funcName,
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

  deleteFile(relativePath, options = {}) {
    const funcName = 'deleteFile';
    const mergedOptions = {isConfirmedAction: false, dryRun: false, requireConfirmation: false, ...options };
    this.logger.log(`[ModularFsAgent::${funcName}] Attempting. Path: "${relativePath}", Options: ${JSON.stringify(mergedOptions)}`);

    if (!relativePath || typeof relativePath !== 'string' || relativePath.trim() === '') {
      const message = "Invalid 'relativePath' parameter: must be a non-empty string.";
      this._logOperation(funcName, String(relativePath), false, message);
      return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { relativePath } }, warnings: [] };
    }

    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      this._logOperation(funcName, relativePath, false, resolved.error.message, resolved.error);
      return { success: false, error: resolved.error, message: resolved.error.message, warnings: [] };
    }
    const { fullPath } = resolved;
    let warnings = [];

    if (mergedOptions.dryRun) {
      this._logOperation(funcName, fullPath, true, `DRY RUN: File would have been deleted.`);
      warnings.push('Operation performed in dry run mode.');
      try {
        if (!fs.existsSync(fullPath)) {
            warnings.push('Note: File does not currently exist at this path.');
            return {
              success: true,
              message: `DRY RUN: File would have been deleted from ${fullPath}, but it does not currently exist.`,
              fullPath, warnings, dryRunExecuted: true,
            };
        }
      } catch(e) { /* ignore fs errors in dry_run */ }
      return {
        success: true,
        message: `DRY RUN: File would have been deleted from ${fullPath}`,
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
      if (!fs.existsSync(fullPath)) {
        const message = `File not found at ${fullPath}, cannot delete.`;
        this._logOperation(funcName, fullPath, false, message);
        return {
          success: false,
          error: { code: 'FS_DELETE_FILE_NOT_FOUND', message, details: { path: fullPath } },
          warnings,
        };
      }

      if (mergedOptions.requireConfirmation && !mergedOptions.isConfirmedAction) {
        const message = `Confirmation required to delete file at ${fullPath}.`;
        this._logOperation(funcName, fullPath, false, message + " Confirmation pending.");
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
      warnings.push(`WARNING: Preparing to delete file at ${fullPath} (isConfirmedAction: ${mergedOptions.isConfirmedAction})`);
      this._logOperation(funcName, fullPath, true, `Preparing to delete file.`);

      try {
        fs.copyFileSync(fullPath, fullPath + '.bak'); // Attempt backup
        warnings.push(`File backed up to ${fullPath}.bak`);
        this._logOperation(funcName, fullPath, true, `Backup created at ${fullPath}.bak`);
      } catch (backupError) {
        warnings.push(`Failed to create backup for ${fullPath}: ${backupError.message}`);
        this._logOperation(funcName, fullPath, false, `Failed to create backup: ${backupError.message}`, backupError);
      }
      fs.unlinkSync(fullPath); // Delete the original file
      this._logOperation(funcName, fullPath, true, `File deleted successfully.`);
      return {
        success: true,
        message: `File deleted successfully from ${fullPath}`,
        fullPath,
        warnings,
      };
    } catch (error) {
      const message = `Error deleting file at ${fullPath}: ${error.message}`;
      this._logOperation(funcName, fullPath, false, message, error);
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

  createDirectory(relativePath, options = {}) {
    const funcName = 'createDirectory';
    const mergedOptions = { requireConfirmation: false, isConfirmedAction: false, dryRun: false, ...options };
    this.logger.log(`[ModularFsAgent::${funcName}] Attempting. Path: "${relativePath}", Options: ${JSON.stringify(mergedOptions)}`);

    if (!relativePath || typeof relativePath !== 'string' || relativePath.trim() === '') {
      const message = "Invalid 'relativePath' parameter: must be a non-empty string.";
      this._logOperation(funcName, String(relativePath), false, message);
      return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { relativePath } }, warnings: [] };
    }

    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      this._logOperation(funcName, relativePath, false, resolved.error.message, resolved.error);
      return { success: false, error: resolved.error, message: resolved.error.message, warnings: [] };
    }
    const { fullPath } = resolved;
    let warnings = [];

    if (mergedOptions.dryRun) {
      this._logOperation(funcName, fullPath, true, `DRY RUN: Directory would have been created.`);
      warnings.push('Operation performed in dry run mode.');
      // Note: fs.existsSync might still be useful here to inform if it *already* exists in a dry run.
      try {
        if (fs.existsSync(fullPath)) {
           warnings.push('Note: Directory already exists at this path.');
        }
      } catch(e) { /* ignore fs errors in dry_run for existsSync */ }
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
        const message = `Directory already exists at ${fullPath}. No action taken.`;
        this._logOperation(funcName, fullPath, true, message);
        return { success: true, message, fullPath, warnings, alreadyExists: true };
      }

      if (mergedOptions.requireConfirmation && !mergedOptions.isConfirmedAction) {
        const message = `Confirmation required to create directory at ${fullPath}.`;
        this._logOperation(funcName, fullPath, false, message);
        return {
            success: false,
            message,
            confirmationNeeded: true,
            fullPath,
            action: 'createDirectory',
            error: { code: 'FS_CONFIRMATION_REQUIRED', message, details: {path: fullPath, operation: 'createDirectory'}},
            warnings: ['Directory will be created if confirmed.'],
        };
      }

      fs.mkdirSync(fullPath, { recursive: true });
      this._logOperation(funcName, fullPath, true, `Directory created successfully.`);
      return { success: true, message: `Directory created successfully at ${fullPath}`, fullPath, warnings };
    } catch (error) {
      const message = `Error creating directory at ${fullPath}: ${error.message}`;
      this._logOperation(funcName, fullPath, false, message, error);
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

  deleteDirectory(relativePath, options = {}) {
    const funcName = 'deleteDirectory';
    const mergedOptions = { requireConfirmation: false, isConfirmedAction: false, dryRun: false, ...options };
    this.logger.log(`[ModularFsAgent::${funcName}] Attempting. Path: "${relativePath}", Options: ${JSON.stringify(mergedOptions)}`);

    if (!relativePath || typeof relativePath !== 'string' || relativePath.trim() === '') {
      const message = "Invalid 'relativePath' parameter: must be a non-empty string.";
      this._logOperation(funcName, String(relativePath), false, message);
      return { success: false, message, error: { code: 'INVALID_INPUT', message, details: { relativePath } }, warnings: [] };
    }

    const resolved = this.resolvePathInWorkspace(relativePath);
    if (!resolved.success) {
      this._logOperation(funcName, relativePath, false, resolved.error.message, resolved.error);
      return { success: false, error: resolved.error, message: resolved.error.message, warnings: [] };
    }
    const { fullPath } = resolved;
    let warnings = [];

    if (mergedOptions.dryRun) {
      this._logOperation(funcName, fullPath, true, `DRY RUN: Directory would have been deleted recursively.`);
      warnings.push('Operation performed in dry run mode.');
      try {
        if (!fs.existsSync(fullPath)) {
           warnings.push('Note: Directory does not currently exist at this path.');
        }
      } catch(e) { /* ignore fs errors in dry_run */ }
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
        const message = `Directory not found at ${fullPath}, cannot delete.`;
        this._logOperation(funcName, fullPath, false, message);
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
        `WARNING: Preparing to recursively delete directory at ${fullPath} (isConfirmedAction: ${mergedOptions.isConfirmedAction})`
      );
      this._logOperation( // Use funcName
        funcName,
        fullPath,
        true,
        `Preparing to delete directory.`
      );

      fs.rmSync(fullPath, { recursive: true, force: true });
      this._logOperation( // Use funcName
        funcName,
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
        `Error deleting directory at ${fullPath}: ${error.message}`, // More specific message
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
    const funcName = 'generateDirectoryTree';
    this.logger.log(`[ModularFsAgent::${funcName}] Generating tree for resolved path: "${fullPath}". Prefix: "${prefix}", RootName: "${rootName || path.basename(fullPath)}"`);


    if (options.dryRun) {
      this.logger.log(`[ModularFsAgent::${funcName}] Dry run mode active, but operation is read-only.`);
    }

    try {
      const stats = fs.statSync(fullPath); // Use fullPath here
      if (!stats.isDirectory()) {
        const message = `Path '${fullPath}' is not a directory.`;
        this._logOperation(funcName, fullPath, false, message);
        return `Error: ${message}`;
      }
    } catch (e) {
      const message = `Path '${fullPath}' not found or inaccessible.`;
      this._logOperation(funcName, fullPath, false, message, e);
      return `Error: ${message} ${e.message}`;
    }

    let treeString = '';
    if (rootName) {
      treeString += rootName + '\n';
    } else {
      treeString += path.basename(fullPath) + '\n'; // Use fullPath here
    }

    // Call the recursive helper with the validated absolute startPath
    treeString += this._generateDirectoryTreeRecursive(fullPath, prefix, options);

    this._logOperation(funcName, fullPath, true, "Directory tree generated.");
    return treeString;
  }

  // Helper for recursive part of generateDirectoryTree to avoid re-resolving base path
  _generateDirectoryTreeRecursive(absoluteDirPath, prefix = '', options = {}) {
    let treeString = '';
    try {
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
          treeString += this._generateDirectoryTreeRecursive(entryPath, newPrefix, options); // Pass options
        }
      });
    } catch (e) {
      // Log error for this specific directory but allow tree generation to continue for other parts.
      this.logger.warn(`[ModularFsAgent::_generateDirectoryTreeRecursive] Error reading directory ${absoluteDirPath}: ${e.message}`);
      treeString += prefix + `└── ERROR_READING_DIR: ${e.message}\n`;
    }
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
