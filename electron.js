const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs'); // fs.promises will be used via fs.promises
const fsPromises = fs.promises;

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

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend STDOUT] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend STDERR] ${data.toString().trim()}`);
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
