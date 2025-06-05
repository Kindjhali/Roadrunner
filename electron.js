const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs'); // fs.promises will be used via fs.promises
const fsPromises = fs.promises;
const EventSource = require('eventsource');

let currentBackendPort = 3030; // Default port
let backendProcess = null;

function startBackendServer() {
  const backendPath = path.join(__dirname, 'backend', 'server.js');
  if (!fs.existsSync(backendPath)) {
    console.error('[Backend] server.js not found at:', backendPath);
    dialog.showErrorBox('Backend Error', 'Could not find server.js. The backend cannot be started.');
    return;
  }

  console.log('[Backend] Starting backend server from:', backendPath);
  backendProcess = spawn('node', [backendPath], {
    cwd: path.join(__dirname, 'backend'), // Set working directory for the backend
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'] // Keep ipc for potential future use
  });

  backendProcess.on('message', (message) => {
    if (message && message.type === 'backend-port') {
      currentBackendPort = message.port;
      console.log(`[Electron] Backend server started and listening on port: ${currentBackendPort}`);
      // Notify frontend about the new port.
      sendToAllWindows('backend-port-updated', { port: currentBackendPort });
    } else if (message && message.type === 'backend-error') {
      console.error(`[Electron] Received error from backend process: ${message.message}`);
      dialog.showErrorBox('Backend Process Error', `The backend process reported an error: ${message.message}`);
      // Optionally, decide if app should quit or try to restart backend
    }
  });

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

  backendProcess.on('exit', (code, signal) => {
    console.log(`[Backend] Process exited with code: ${code}, signal: ${signal}`);
    backendProcess = null; // Clear the reference
    // Optionally, notify the renderer or try to restart
    sendToAllWindows('backend-status', { status: 'stopped', code, signal });
  });

  backendProcess.on('error', (err) => {
    console.error('[Backend] Failed to start process:', err);
    dialog.showErrorBox('Backend Error', `Failed to start backend server: ${err.message}`);
    backendProcess = null;
  });

  // Add a small delay or a more robust check for backend readiness
  // For now, just log that it's been started.
  console.log('[Backend] Backend server process initiated.');
  sendToAllWindows('backend-status', { status: 'started' });
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

  mainWindow.webContents.on('console-message', (event, messageInfo) => {
    const { level, message, line, sourceId } = messageInfo;
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

app.whenReady().then(() => {
  app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,AutofillCreditCard,AutofillProfile');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://127.0.0.1:3030; img-src 'self' data:;"]
      }
    });
  });

  startBackendServer(); // Add this call
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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

});

ipcMain.handle('get-ollama-models', async () => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      console.error(`Ollama API request failed with status: ${response.status}`);
      return { success: false, error: `Failed to fetch models from Ollama. Status: ${response.status}`, models: [] };
    }
    const data = await response.json();
    const formattedModels = data.models.map(model => ({
      value: `ollama:${model.name}`,
      label: `Ollama: ${model.name}`
    }));
    return { success: true, models: formattedModels };
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      return { success: false, error: 'Failed to connect to Ollama. Ensure Ollama is running.', models: [] };
    }
    return { success: false, error: 'Failed to fetch models from Ollama. Check console for details.', models: [] };
  }
});

ipcMain.handle('get-backend-port', async () => {
  return currentBackendPort;
});

app.on('quit', () => {
  if (backendProcess) {
    console.log('[Backend] Terminating backend server process...');
    backendProcess.kill();
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

ipcMain.on('send-brainstorming-chat', async (event, { modelId, prompt }) => {
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
          messages: [{ role: 'user', content: prompt }],
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

ipcMain.on('start-conference-stream', async (event, payload) => {
  const { prompt, model_a_id, model_b_id, arbiter_model_id } = payload || {};
  if (!prompt) {
    event.sender.send('conference-stream-error', { error: 'Prompt cannot be empty.' });
    return;
  }

  const postBody = {
    prompt,
    modelName: model_a_id || model_b_id || arbiter_model_id,
    modelARole: 'Model A',
    modelBRole: 'Model B',
    arbiterModelRole: 'Arbiter'
  };

  try {
    const response = await fetch(`http://127.0.0.1:${currentBackendPort}/execute-conference-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      event.sender.send('conference-stream-error', { error: `HTTP ${response.status}`, details: errorText });
      return;
    }

    const result = await response.json();
    event.sender.send('conference-stream-end', result);
  } catch (err) {
    console.error('[Main] Conference stream error:', err);
    event.sender.send('conference-stream-error', { error: err.message });
  }
});

ipcMain.on('remove-conference-listeners', (event) => {
  event.sender.removeAllListeners('conference-stream-chunk');
  event.sender.removeAllListeners('conference-stream-error');
  event.sender.removeAllListeners('conference-stream-end');
});

// Execute coder tasks with SSE event forwarding
ipcMain.on('execute-task-with-events', (event, payload) => {
  const params = new URLSearchParams();
  if (payload.task_description) params.append('task_description', payload.task_description);
  if (payload.steps) {
    if (typeof payload.steps === 'string') {
      params.append('steps', payload.steps); // Already a string, pass as is
    } else {
      params.append('steps', JSON.stringify(payload.steps)); // Stringify if object/array
    }
  }
  if (payload.modelId) params.append('modelId', payload.modelId);
  if (payload.modelType) params.append('modelType', payload.modelType);
  params.append('safetyMode', payload.safetyMode);
  params.append('isAutonomousMode', payload.isAutonomousMode);
  if (payload.sessionId) params.append('sessionId', payload.sessionId);
  if (payload.sessionTaskId) params.append('sessionTaskId', payload.sessionTaskId);
  params.append('useOpenAIFromStorage', payload.useOpenAIFromStorage);

  const es = new (require('eventsource'))(`http://127.0.0.1:${currentBackendPort}/execute-autonomous-task?${params.toString()}`);

  const forward = (channel, data) => event.sender.send(channel, data);

  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'log_entry':
        case 'llm_chunk':
        case 'file_written':
          forward('coder-task-log', msg);
          break;
        case 'error':
          forward('coder-task-error', msg);
          break;
        case 'execution_complete':
          forward('coder-task-complete', msg);
          es.close();
          break;
        case 'confirmation_required':
          forward('coder-task-confirmation-required', msg);
          break;
        case 'proposed_plan':
          forward('coder-task-proposed-plan', msg);
          break;
        default:
          forward('coder-task-log', msg);
      }
    } catch (err) {
      console.error('[Main] Failed to parse coder task SSE:', e.data, err);
      forward('coder-task-error', { error: err.message, details: e.data });
    }
  };

  es.onerror = (err) => {
    console.error('[Main] Coder task EventSource error:', err);
    forward('coder-task-error', { error: 'EventSource error', details: err });
    es.close();
  };

  ipcMain.once('remove-coder-task-listeners', () => {
    es.close();
  });
});

// Confirmation response handler from renderer
ipcMain.on('task-confirmation-response', async (event, { confirmationId, confirmed }) => {
  try {
    const response = await fetch(`http://127.0.0.1:${currentBackendPort}/api/confirm-action/${confirmationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      event.sender.send('coder-task-error', { error: `HTTP ${response.status}`, details: result });
    } else {
      event.sender.send('coder-task-log', { type: 'log_entry', message: result.message || 'Confirmation processed' });
    }
  } catch (err) {
    console.error('[Main] Error sending confirmation:', err);
    event.sender.send('coder-task-error', { error: err.message });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
