class Executor {
  constructor(options = {}) {
    // Store the full options object
    this.options = {
      dryRun: true,
      ...options,
    };
    this.logs = [];
    this.createFileRegex = /^Create file: (.*)/i;
    this.createFolderRegex = /^Create folder: (.*)/i;
    this.registerRouteRegex = /^Register route: (.*) to (.*)/i;
    this.importCssRegex = /^Import CSS: (.*) into (.*)/i;
    this.writeStubComponentRegex = /^Write stub component: (.*)/i;
  }

  log(message, type = 'info') {
    const timestamp = new Date();
    this.logs.push({ message, type, timestamp });
    // Also log to browser console for debugging, with type
    const formattedMessage = `[${timestamp.toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`;
    if (type === 'error') {
      console.error(formattedMessage);
    } else if (type === 'success') {
      console.log(`%c${formattedMessage}`, 'color: green');
    } else {
      console.log(formattedMessage);
    }
  }

  async executeTasks(tasks, moduleName = 'general') {
    // Added moduleName parameter
    this.logs = []; // Clear previous logs for this execution run

    if (!moduleName || typeof moduleName !== 'string') {
      this.log('Module name is missing or invalid for execution.', 'error');
      // Potentially return early or use a default moduleName if appropriate
      // For now, we'll proceed but logging to .completed.md might fail or use 'general'.
      moduleName = 'unknown_module';
    }

    if (!tasks || tasks.length === 0) {
      this.log('No tasks to execute.', 'warn'); // Using 'warn' type
      return this.logs;
    }

    this.log(
      `Starting task execution... (Dry Run: ${this.options.dryRun})`,
      'info'
    );

    let criticalErrorOccurred = false;

    for (const task of tasks) {
      if (criticalErrorOccurred) {
        this.log(
          `Skipping task due to previous critical error: ${task.description}`,
          'warn'
        );
        continue;
      }

      if (task.completed) {
        this.log(`Skipping completed task: ${task.description}`, 'debug');
        continue;
      }

      const createFileMatch = task.description.match(this.createFileRegex);
      const createFolderMatch = task.description.match(this.createFolderRegex);
      const registerRouteMatch = task.description.match(
        this.registerRouteRegex
      );
      const importCssMatch = task.description.match(this.importCssRegex);
      const writeStubComponentMatch = task.description.match(
        this.writeStubComponentRegex
      );

      if (createFileMatch) {
        const filename = createFileMatch[1].trim();
        if (this.options.dryRun) {
          this.log(`[Dry Run] Would create file: ${filename}`, 'info');
        } else {
          this.log(`Attempting to create file: ${filename}`, 'info');
          try {
            if (window.electron && window.electron.ipcRenderer) {
              const result = await window.electron.ipcRenderer.invoke(
                'create-file',
                filename
              );
              if (result.success) {
                this.log(`File created: ${result.path}`, 'success');
                // Log to .completed.md
                try {
                  const appendResult = await window.electron.ipcRenderer.invoke(
                    'append-to-completed-md',
                    { moduleName, taskDescription: task.description }
                  );
                  if (appendResult.success) {
                    this.log(
                      `Logged to ${moduleName}.completed.md: ${task.description}`,
                      'debug'
                    );
                    // Attempt Git commit and tag (ONCE)
                    try {
                      const gitResult =
                        await window.electron.ipcRenderer.invoke(
                          'git-commit-and-tag',
                          {
                            moduleName,
                            taskDescription: task.description,
                            gitProjectRoot: 'process.cwd()', // Main process will interpret this
                          }
                        );
                      if (gitResult.success) {
                        this.log(
                          `Git commit and tag successful: ${gitResult.tagName}`,
                          'success'
                        );
                      } else {
                        this.log(
                          `Git operation failed: ${gitResult.message}`,
                          'error'
                        );
                      }
                    } catch (gitError) {
                      this.log(
                        `Error invoking git-commit-and-tag IPC: ${gitError.message}`,
                        'error'
                      );
                    }
                  } else {
                    this.log(
                      `Failed to log to .completed.md: ${appendResult.message}`,
                      'warn'
                    );
                  }
                } catch (e) {
                  this.log(
                    `Error invoking append-to-completed-md IPC: ${e.message}`,
                    'warn'
                  );
                }
              } else {
                this.log(
                  `Failed to create file ${filename}: ${result.message}`,
                  'error'
                );
                if (!this.options.dryRun) {
                  criticalErrorOccurred = true;
                  this.log(
                    `Execution halted due to critical error on task ID ${task.id}: ${task.description}`,
                    'error'
                  );
                }
              }
            } else {
              this.log(
                'Electron IPC not available. Cannot create file. Task not logged as completed.',
                'error'
              );
              if (!this.options.dryRun) {
                criticalErrorOccurred = true;
                this.log(
                  `Execution halted due to IPC unavailability for task ID ${task.id}: ${task.description}`,
                  'error'
                );
              }
            }
          } catch (error) {
            this.log(
              `Error invoking create-file IPC for ${filename}: ${error.message}`,
              'error'
            );
            if (!this.options.dryRun) {
              criticalErrorOccurred = true;
              this.log(
                `Execution halted due to exception on task ID ${task.id}: ${task.description}`,
                'error'
              );
            }
          }
        }
      } else if (createFolderMatch) {
        const foldername = createFolderMatch[1].trim();
        if (this.options.dryRun) {
          this.log(`[Dry Run] Would create folder: ${foldername}`, 'info');
        } else {
          this.log(`Attempting to create folder: ${foldername}`, 'info');
          try {
            if (window.electron && window.electron.ipcRenderer) {
              const result = await window.electron.ipcRenderer.invoke(
                'create-folder',
                foldername
              );
              if (result.success) {
                this.log(`Folder created: ${result.path}`, 'success');
                // Log to .completed.md
                try {
                  const appendResult = await window.electron.ipcRenderer.invoke(
                    'append-to-completed-md',
                    { moduleName, taskDescription: task.description }
                  );
                  if (appendResult.success) {
                    this.log(
                      `Logged to ${moduleName}.completed.md: ${task.description}`,
                      'debug'
                    );
                  } else {
                    this.log(
                      `Failed to log to .completed.md: ${appendResult.message}`,
                      'warn'
                    );
                  }
                } catch (e) {
                  this.log(
                    `Error invoking append-to-completed-md IPC: ${e.message}`,
                    'warn'
                  );
                }
              } else {
                this.log(
                  `Failed to create folder ${foldername}: ${result.message}`,
                  'error'
                );
                if (!this.options.dryRun) {
                  criticalErrorOccurred = true;
                  this.log(
                    `Execution halted due to critical error on task ID ${task.id}: ${task.description}`,
                    'error'
                  );
                }
              }
            } else {
              this.log(
                'Electron IPC not available. Cannot create folder. Task not logged as completed.',
                'error'
              );
              if (!this.options.dryRun) {
                criticalErrorOccurred = true;
                this.log(
                  `Execution halted due to IPC unavailability for task ID ${task.id}: ${task.description}`,
                  'error'
                );
              }
            }
          } catch (error) {
            this.log(
              `Error invoking create-folder IPC for ${foldername}: ${error.message}`,
              'error'
            );
            if (!this.options.dryRun) {
              criticalErrorOccurred = true;
              this.log(
                `Execution halted due to exception on task ID ${task.id}: ${task.description}`,
                'error'
              );
            }
          }
        }
      } else if (registerRouteMatch) {
        const routePath = registerRouteMatch[1].trim();
        const componentTarget = registerRouteMatch[2].trim();
        if (this.options.dryRun) {
          this.log(
            `[Dry Run] Would register route: ${routePath} to ${componentTarget}`,
            'info'
          );
        } else {
          this.log(
            `[Action Needed] Register route: ${routePath} to ${componentTarget}. (Real implementation pending)`,
            'warn'
          );
        }
      } else if (importCssMatch) {
        const cssFile = importCssMatch[1].trim();
        const targetComponent = importCssMatch[2].trim();
        if (this.options.dryRun) {
          this.log(
            `[Dry Run] Would import CSS: ${cssFile} into ${targetComponent}`,
            'info'
          );
        } else {
          this.log(
            `[Action Needed] Import CSS: ${cssFile} into ${targetComponent}. (Real implementation pending)`,
            'warn'
          );
        }
      } else if (writeStubComponentMatch) {
        const componentName = writeStubComponentMatch[1].trim();
        if (this.options.dryRun) {
          this.log(
            `[Dry Run] Would write stub component: ${componentName}`,
            'info'
          );
        } else {
          this.log(
            `[Action Needed] Write stub component: ${componentName}. (Real implementation pending)`,
            'warn'
          );
        }
      } else if (task.description.toLowerCase().startsWith('run command:')) {
        // Keep this as a fallback if no other specific regex matches
        this.log(
          `${this.options.dryRun ? '[Dry Run] ' : ''}Would run command: ${task.description.substring('run command:'.length).trim()}`,
          'info'
        );
      } else {
        // Default catch-all for unrecognized tasks
        this.log(
          `${this.options.dryRun ? '[Dry Run] ' : ''}Executing (simulated general task): ${task.description}`,
          'info'
        );
      }
    }

    if (criticalErrorOccurred) {
      this.log('Task execution HALTED due to critical errors.', 'error');
    } else {
      this.log('Task execution finished successfully.', 'info');
    }
    return this.logs;
  }
}

export default Executor;
