const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs'); // fs.promises will be used via fs.promises
const fsPromises = fs.promises;
const EventSource = require('eventsource');

let currentBackendPort = 3030; // Default port
let backendProcess = null;

function startBackendServer() {
  return new Promise((resolve, reject) => {
    const backendPath = path.join(__dirname, 'backend', 'server.js');
    if (!fs.existsSync(backendPath)) {
      const errMessage = 'Could not find server.js. The backend cannot be started.';
      console.error('[Backend] server.js not found at:', backendPath);
      dialog.showErrorBox('Backend Error', errMessage);
      reject(new Error(errMessage));
      return;
    }

    console.log('[Backend] Starting backend server from:', backendPath);
    backendProcess = spawn('node', [backendPath], {
      cwd: path.join(__dirname, 'backend'),
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    let portReceived = false;
    const startupTimeout = 15000; // 15 seconds

    const timeoutId = setTimeout(() => {
      if (!portReceived) {
        console.error('[Backend] Startup timeout. No port message received.');
        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill();
        }
        reject(new Error('Backend server startup timed out.'));
      }
    }, startupTimeout);

    if (backendProcess && backendProcess.pid) {
      console.log(`[Backend] Backend process spawned successfully. PID: ${backendProcess.pid}. Command: node ${backendPath}`);
    } else if (backendProcess) {
      console.log(`[Backend] Backend process spawning initiated. PID not immediately available. Command: node ${backendPath}`);
    } else {
      clearTimeout(timeoutId);
      const errMessage = `Backend process failed to spawn (backendProcess object is null). Command: node ${backendPath}`;
      console.error(`[Backend] ${errMessage}`);
      reject(new Error(errMessage));
      return;
    }

    backendProcess.on('message', (message) => {
      if (message && message.type === 'backend-port') {
        clearTimeout(timeoutId);
        portReceived = true;
        currentBackendPort = message.port;
        // Enhanced logging as per subtask
        console.log(`[ELECTRON MAIN IPC RECV] Received 'backend-port' message. Port: ${message.port}. Setting currentBackendPort.`);
        console.log(`[Electron] Backend server started and listening on port: ${currentBackendPort}`);
        sendToAllWindows('backend-port-updated', { port: currentBackendPort });
        resolve(currentBackendPort);
      } else if (message && message.type === 'backend-error') {
        clearTimeout(timeoutId);
        console.error(`[Electron] Received error from backend process during startup: ${message.error}`);
        if (backendProcess && !backendProcess.killed) backendProcess.kill();
        reject(new Error(`Backend process reported an error during startup: ${message.error}`));
      }
    });

    backendProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      console.error('[Backend] Failed to start process:', err);
      // No need to show dialog.showErrorBox here as reject will handle it
      reject(err); // Reject the promise on spawn error
    });

    backendProcess.on('exit', (code, signal) => {
      clearTimeout(timeoutId);
      if (!portReceived) { // If exited before sending port
        console.error(`[Backend] Process exited prematurely with code: ${code}, signal: ${signal}`);
        reject(new Error(`Backend server process exited prematurely with code ${code}.`));
      } else {
        // Normal exit after port received (though usually it keeps running)
        console.log(`[Backend] Process exited with code: ${code}, signal: ${signal}`);
        sendToAllWindows('backend-status', { status: 'stopped', code, signal });
      }
      backendProcess = null;
    });

    // Standard output and error stream handling (can be moved after resolve if preferred)
    backendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        console.log(`[Backend STDOUT] ${trimmedLine}`);
        sendToAllWindows('backend-log-event', {
          timestamp: new Date().toISOString(),
          stream: 'stdout',
          line: trimmedLine
        });
      }
    });
  });

  backendProcess.stderr.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        console.error(`[Backend STDERR] ${trimmedLine}`);
        sendToAllWindows('backend-log-event', {
          timestamp: new Date().toISOString(),
          stream: 'stderr',
          line: trimmedLine
        });
      }
    });
  });

  // No specific action needed on 'exit' after portReceived for the Promise itself,
  // but logging and status updates are good.
  // backendProcess.on('exit', (code, signal) => { ... }); already handled above
  });
}

function sendToAllWindows(channel, payload) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, payload);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    resizable: true,
    transparent: true,              // ✅ this makes the window background transparent
    frame: false,                   // optional: removes native window chrome
    backgroundColor: '#00000000',  // ✅ fully transparent background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.setIcon(path.join(__dirname, 'frontend', 'src', 'icons', 'Roadrunner.png'));

  // Add these listeners for more detailed renderer logging
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Main-WebContents] Renderer did-fail-load: ${validatedURL}, Code: ${errorCode}, Desc: ${errorDescription}`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] || `LEVEL${level}`;
    console.log(`[Main-WebContents-Console] [${levelStr}] ${message} (source: ${sourceId}:${line})`);
  });

  const indexPath = path.join(__dirname, 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
    // Always open DevTools to capture logs
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('data:text/html,<h2>dist/index.html not found</h2>');
  }
}

app.whenReady().then(async () => {
  app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,AutofillCreditCard,AutofillProfile');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://127.0.0.1:3030; img-src 'self' data:;"]
      }
    });
  });

  try {
    console.log('[Electron] Attempting to start backend server...');
    const port = await startBackendServer();
    currentBackendPort = port; // Ensure global currentBackendPort is set
    // Enhanced logging as per subtask
    console.log(`[ELECTRON MAIN POST-START] Backend server started. currentBackendPort is now: ${currentBackendPort}. Proceeding to create window.`);
    createWindow();
  } catch (error) {
    // Enhanced logging as per subtask
    console.error(`[ELECTRON MAIN POST-START] Backend server failed to start. Error: ${error}. Quitting app.`);
    dialog.showErrorBox('Fatal Error', `Failed to start backend server: ${error.message}\nThe application will now quit.`);
    app.quit();
    return; // Important to return here to stop further execution
  }

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
       // Check if backend is running before creating a new window
       if (backendProcess && !backendProcess.killed && currentBackendPort) {
        createWindow();
      } else {
        console.warn('[Electron] Activate event: Backend not running. Attempting restart or quitting.');
        // Optionally, try to restart backend or inform user and quit
        dialog.showErrorBox('Backend Not Running', 'The backend service is not running. The application cannot continue.');
        app.quit();
      }
    }
  });

  ipcMain.on('close-window', () => {
    const currentWindow = BrowserWindow.getFocusedWindow();
    if (currentWindow) {
      currentWindow.close();
    }
  });

  // --- IPC Handlers for Roadmap Scanning and File Reading ---
  // All roadmap-specific IPC handlers and file watching logic have been removed.
  // --- End of IPC Handlers for Roadmaps ---

  const rendererLogPath = path.join(app.getPath('temp'), 'renderer.log');
  const rendererLogStream = fs.createWriteStream(rendererLogPath, { flags: 'a' });
  ipcMain.on('console-log', (event, ...args) => {
    rendererLogStream.write(`[LOG] ${new Date().toISOString()}: ${args.map(String).join(' ')}\n`);
  });
  ipcMain.on('console-warn', (event, ...args) => {
    rendererLogStream.write(`[WARN] ${new Date().toISOString()}: ${args.map(String).join(' ')}\n`);
  });
  ipcMain.on('console-error', (event, ...args) => {
    rendererLogStream.write(`[ERROR] ${new Date().toISOString()}: ${args.map(String).join(' ')}\n`);
  });

  ipcMain.on('remove-backend-log-event-listener', (event) => {
    console.log('[Electron IPC] Received remove-backend-log-event-listener. Renderer is handling its own listener removal.');
    // No specific main-process action needed if EventSource is managed elsewhere or renderer handles its own .off()
  });
});


ipcMain.handle('get-backend-port', async () => {
  return currentBackendPort;
});

app.on('before-quit', () => {
  // isAppQuitting = true; // Removed unused flag
  // Removed coderTaskEventSource handling as the related IPC is removed
  // if (coderTaskEventSource) {
  //   coderTaskEventSource.close();
  //   coderTaskEventSource = null;
  // }
  if (conferenceEventSource) {
    console.log('[Electron Main] before-quit: Closing conferenceEventSource.');
    conferenceEventSource.close();
    conferenceEventSource = null;
  }
  // Removed extraneous parenthesis and semicolon from the line above
});

app.on('quit', () => {
  console.log(`[Electron Main] 'app.quit' event triggered. Attempting to terminate backend process (PID: ${backendProcess ? backendProcess.pid : 'N/A'}, Exists: ${!!backendProcess})`); // Enhanced log
  if (backendProcess) {
    console.log('[Electron Main] Terminating backend server process explicitly on app quit.'); // Specific log before kill
    backendProcess.kill();
    backendProcess = null; // Ensure it's nulled after killing
  }
});

// Handler for selecting a directory
ipcMain.handle('select-directory', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (!focusedWindow) {
    return { success: false, error: 'No focused window available to show dialog.' };
  }
  try {
    const dialogResult = await dialog.showOpenDialog(focusedWindow, {
      properties: ['openDirectory']
    });

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      console.log('[Main] Directory selection cancelled.');
      return { success: false };
    } else {
      console.log('[Main] Directory selected:', dialogResult.filePaths[0]);
      return { success: true, path: dialogResult.filePaths[0] };
    }
  } catch (error) {
    console.error('[Main] Error showing open directory dialog:', error);
    return { success: false, error: error.message };
  }
});

// The duplicated handlers below have been removed.

let conferenceEventSource = null; // Variable to hold the EventSource for conference streams
// let coderTaskEventSource = null;  // Removed as the related IPC handler 'execute-task-with-events' is removed
// let isAppQuitting = false;        // Removed unused flag

ipcMain.on('send-brainstorming-chat', async (event, { modelId, prompt, history }) => {
  // At the beginning of the handler
  if (!modelId || typeof modelId !== 'string' || modelId.trim() === '') {
    console.warn(`[Main] Brainstorming chat request rejected: modelId is invalid or empty. Received: '${modelId}'`);
    event.sender.send('brainstorming-chat-stream-error', {
      error: "Model ID is missing or invalid. Please select a valid model for brainstorming.",
      details: `Received modelId: ${modelId}`
    });
    return;
  }
  // Original console.log can remain or be adjusted
  console.log(`[Main] Received brainstorming chat (streaming): Model ID - ${modelId}, Prompt - "${prompt ? prompt.substring(0,100) : 'EMPTY' }..."`);
  if (!prompt || prompt.trim() === '') {
    event.sender.send('brainstorming-chat-stream-error', { error: "Prompt cannot be empty." });
    return;
  }
  if (modelId && modelId.startsWith('ollama:')) {
    const ollamaModelName = modelId.substring('ollama:'.length);
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModelName,
          messages: Array.isArray(history) && history.length > 0 ? history : [{ role: 'user', content: prompt }],
          stream: true, // Enable streaming
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Main] Ollama API request failed: ${response.status} - ${errorBody}`);
        event.sender.send('brainstorming-chat-stream-error', { error: `Ollama API error: ${response.status}`, details: errorBody });
        return;
      }

      let accumulatedBuffer = '';
      for await (const chunk of response.body) {
        accumulatedBuffer += new TextDecoder().decode(chunk);
        let newlineIndex;
        while ((newlineIndex = accumulatedBuffer.indexOf('\n')) >= 0) {
          const line = accumulatedBuffer.substring(0, newlineIndex).trim();
          accumulatedBuffer = accumulatedBuffer.substring(newlineIndex + 1);

          if (line === '') continue;

          try {
            const parsedLine = JSON.parse(line);
            if (parsedLine.error) {
              console.error(`[Main] Ollama stream error: ${parsedLine.error}`);
              event.sender.send('brainstorming-chat-stream-error', { error: parsedLine.error });
              // Continue processing other lines in buffer, though an error might mean the stream ends.
            }
            if (parsedLine.message && parsedLine.message.content) {
              event.sender.send('brainstorming-chat-stream-chunk', { text: parsedLine.message.content });
            }
            if (parsedLine.done) {
              console.log('[Main] Ollama stream finished (done=true).');
              event.sender.send('brainstorming-chat-stream-end');
              return; // Stream is fully processed
            }
          } catch (parseError) {
            console.warn(`[Main] Failed to parse JSON line from Ollama stream: "${line}". Error: ${parseError.message}`);
            // Optionally send a specific warning to frontend if needed
          }
        }
      }
      // If loop finishes and buffer has content, it means stream ended without a final newline.
      if (accumulatedBuffer.trim() !== '') {
        try {
            const parsedLine = JSON.parse(accumulatedBuffer.trim());
            if (parsedLine.error) {
              event.sender.send('brainstorming-chat-stream-error', { error: parsedLine.error });
            }
            if (parsedLine.message && parsedLine.message.content) {
              event.sender.send('brainstorming-chat-stream-chunk', { text: parsedLine.message.content });
            }
        } catch (e) {
            console.warn(`[Main] Failed to parse final remaining JSON from Ollama stream: "${accumulatedBuffer}". Error: ${e.message}`);
        }
      }
      console.log('[Main] Ollama stream processing finished from server side.');
      event.sender.send('brainstorming-chat-stream-end');

    } catch (error) {
      console.error('[Main] Error communicating with Ollama model (streaming):', error);
      let errorMessage = `Error communicating with Ollama model: ${error.message}`;
      if (error.cause && error.cause.code === 'ECONNREFUSED') {
        errorMessage = 'Failed to connect to Ollama. Ensure Ollama is running at http://localhost:11434.';
      }
      event.sender.send('brainstorming-chat-stream-error', { error: errorMessage });
    }
  } else if (modelId === 'remote') {
    // Placeholder for remote AI, non-streaming for now
    console.log('[Main] Remote AI interaction (placeholder - non-streaming).');
    // Simulate a slight delay for remote calls
    setTimeout(() => {
        event.sender.send('brainstorming-chat-stream-chunk', { text: `Placeholder: Remote AI interaction for brainstorming is not yet fully implemented. You asked: "${prompt}"` });
        event.sender.send('brainstorming-chat-stream-end');
    }, 500);
  } else {
    console.warn(`[Main] Unknown modelId for brainstorming: ${modelId}`);
    event.sender.send('brainstorming-chat-stream-error', { error: `Unknown model ID: ${modelId}. Cannot process chat request.` });
  }
});

ipcMain.on('start-conference-stream', (event, payload) => {
  const { prompt, model_a_id, model_b_id, arbiter_model_id, history, sessionId, sessionTaskId } = payload || {};

  if (conferenceEventSource) {
    console.warn('[Electron IPC] start-conference-stream: Conference stream already in progress. Closing existing one.');
    conferenceEventSource.close();
    conferenceEventSource = null;
  }

  if (!prompt) {
    event.sender.send('conference-stream-error', { error: 'Prompt cannot be empty.' });
    return;
  }
  if (!model_a_id && !model_b_id && !arbiter_model_id) {
    event.sender.send('conference-stream-error', { error: 'At least one model ID must be provided for the conference.' });
    return;
  }

  const params = new URLSearchParams();
  params.append('task_type', 'conference'); // Assuming backend uses this to differentiate
  params.append('task_description', prompt);
  if (model_a_id) params.append('model_a_id', model_a_id);
  if (model_b_id) params.append('model_b_id', model_b_id);
  if (arbiter_model_id) params.append('arbiter_model_id', arbiter_model_id);
  if (history) params.append('history', JSON.stringify(history)); // History should be stringified if complex

  // Add common parameters, similar to execute-task-with-events
  params.append('isAutonomousMode', 'true'); // Conferences are likely autonomous interactions
  if (sessionId) params.append('sessionId', sessionId);
  if (sessionTaskId) params.append('sessionTaskId', sessionTaskId);
  // Assuming safetyMode and useOpenAIFromStorage are not directly relevant or have defaults for conference
  // params.append('safetyMode', payload.safetyMode);
  // params.append('useOpenAIFromStorage', payload.useOpenAIFromStorage);


  if (!currentBackendPort || currentBackendPort === 0) {
    console.error('[Electron IPC] start-conference-stream: Critical: Backend port is not set or invalid:', currentBackendPort);
    event.sender.send('conference-stream-error', { error: 'Backend connection error', details: 'Backend port not configured.' });
    return;
  }

  const eventSourceUrl = `http://127.0.0.1:${currentBackendPort}/execute-autonomous-task?${params.toString()}`;
  // Log eventSourceUrl (as per subtask)
  console.log('[Electron IPC] start-conference-stream: Attempting to connect to EventSource URL:', eventSourceUrl);

  conferenceEventSource = new EventSource(eventSourceUrl);

  // Modified forwardEvent to include detailed logging AFTER defaults are applied.
  const forwardEvent = (channel, data) => {
    // The data passed here already has defaults applied by the switch statement below.
    // So, 'data' is equivalent to 'augmentedData' from the plan.
    console.log(`[Electron IPC] Forwarding to ConferenceTab - Channel: ${channel}, Payload: ${JSON.stringify(data)}`);
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send(channel, data);
    }
  };

  // Enhance conferenceEventSource.onopen (as per subtask)
  conferenceEventSource.onopen = () => {

    console.log('[Electron IPC] start-conference-stream: EventSource connection successfully opened to URL:', eventSourceUrl);
    const openData = { type: 'log_entry', message: 'Connection to backend for conference established.', speaker: 'System' };

    console.log('[Electron IPC] start-conference-stream: EventSource connection opened.');
    // For onopen, the data is static, so we can log it directly here or ensure forwardEvent handles it.
    // To stick to the plan, ensure forwardEvent is called for all relevant events.
    // Log before sending (as per plan, though forwardEvent will log again)
    // console.log(`[Electron IPC] Forwarding to ConferenceTab - Channel: conference-stream-log-entry, Payload: ${JSON.stringify(openData)}`);


    forwardEvent('conference-stream-log-entry', openData);
  };

  conferenceEventSource.onmessage = (e) => {
    console.log('[Electron IPC] start-conference-stream: EventSource message, data:', e.data);
    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'llm_chunk':
          msg.content = msg.content || '';
          msg.speaker = msg.speaker || 'Unknown Speaker';
          forwardEvent('conference-stream-llm-chunk', msg); // Corrected channel
          break;
        case 'log_entry':
          msg.message = msg.message || '';
          msg.speaker = msg.speaker || 'System';
          forwardEvent('conference-stream-log-entry', msg); // Corrected channel
          break;
        case 'error':
          msg.error = msg.error || 'An unknown error occurred';
          msg.details = msg.details || '';
          console.error('[Electron IPC] start-conference-stream: Received error event:', msg);
          forwardEvent('conference-stream-error', msg); // Stays 'conference-stream-error'
          break;
        case 'step_failed_options':
          // Log for debugging in main process
          console.log('[Electron IPC] start-conference-stream: Received step_failed_options event:', msg);
          forwardEvent('conference-stream-error', msg); // Forward on the error channel
          // Optional: Consider if the EventSource should be closed here,
          // as a step failure might be terminal for the conference.
          // if (conferenceEventSource) conferenceEventSource.close();
          // conferenceEventSource = null;
          break;
        case 'execution_complete':
          console.log('[Electron IPC] start-conference-stream: Execution complete event:', msg);
          forwardEvent('conference-stream-complete', msg || {}); // Corrected channel
          if (conferenceEventSource) conferenceEventSource.close();
          conferenceEventSource = null;
          break;
        default:
          console.log('[Electron IPC] start-conference-stream: Unknown event type received:', msg.type, msg);
          forwardEvent('conference-stream-log-entry', { type: 'log_entry', message: `Received event: ${msg.type || 'unknown'}`, data: msg, speaker: 'System' });
      }
    } catch (err) {
      console.error('[Electron IPC] start-conference-stream: Failed to parse SSE message:', e.data, err);
      const errorData = { error: 'Failed to parse message from backend.', details: e.data };
      forwardEvent('conference-stream-error', errorData);
    }
  };

  // Enhance conferenceEventSource.onerror (as per subtask)
  conferenceEventSource.onerror = (err) => {
    // Log the raw error object structure for inspection
    console.error('[Electron IPC] start-conference-stream: EventSource error occurred. Raw error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));

    let errorDetailsString = 'Unknown EventSource error';
    if (err) {
      if (err.type === 'error' && err.message) { // Standard error event
        errorDetailsString = `EventSource error: ${err.message}`;
      } else if (err.type === 'exception' && err.message && err.description) {
          errorDetailsString = `EventSource exception: ${err.message} - ${err.description}`;
      } else if (typeof err === 'object' && err.target && err.target.readyState === EventSource.CLOSED) {
        errorDetailsString = 'EventSource connection was closed (readyState is CLOSED). This might indicate the server is unavailable or the URL is incorrect.';
      } else if (err.message) { // Generic error object with a message
          errorDetailsString = err.message;
      }
      // For events that might have an HTTP status (like from eventsource polyfill on non-200 responses)
      if (err.status) {
          errorDetailsString += ` (HTTP Status: ${err.status})`;
      }
    }

    console.error('[Electron IPC] start-conference-stream: EventSource error processed details:', errorDetailsString);
    forwardEvent('conference-stream-error', {
      error: 'EventSource connection error or stream failure.',
      details: errorDetailsString
    });

    if (conferenceEventSource) {
      conferenceEventSource.close();
      conferenceEventSource = null;
      console.log('[Electron IPC] start-conference-stream: Closed EventSource due to error.');
    }
  };
});

ipcMain.on('remove-conference-listeners', (event) => {
  const senderId = event.sender.id; // Get sender webContents ID for context
  console.log(`[Electron IPC] Received 'remove-conference-listeners' from sender ID: ${senderId}. Current EventSource readyState: ${conferenceEventSource ? conferenceEventSource.readyState : 'null (no active EventSource)'}`);
  if (conferenceEventSource) {
    conferenceEventSource.close();
    conferenceEventSource = null;
    console.log('[Electron IPC] Closed active conference EventSource due to remove-conference-listeners request.');
  }
  // These remove listeners on the renderer side, which is good practice.
  // The actual event source connection is managed by conferenceEventSource.close()
  // event.sender.removeAllListeners('conference-stream-llm-chunk');
  // event.sender.removeAllListeners('conference-stream-log-entry');
  // event.sender.removeAllListeners('conference-stream-error');
  // event.sender.removeAllListeners('conference-stream-complete');
});

// Removed obsolete ipcMain.on('execute-task-with-events', ...)
// Removed obsolete ipcMain.once('remove-coder-task-listeners', ...)
// Removed obsolete ipcMain.on('task-confirmation-response', ...)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
