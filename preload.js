const { contextBridge, ipcRenderer } = require('electron');

// Send a message to main process immediately to confirm preload is loaded
ipcRenderer.send('console-log', '--- PRELOAD SCRIPT LOADED ---');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    on: (channel, func) => {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
  console: { // This is for window.electron.console.log, not global console
    log: (...args) => {
      ipcRenderer.send('console-log', ...args);
    },
    warn: (...args) => {
      ipcRenderer.send('console-warn', ...args);
    },
    error: (...args) => {
      ipcRenderer.send('console-error', ...args);
    }
  }
});

// Alias API for legacy code expecting `window.electronAPI`
contextBridge.exposeInMainWorld('electronAPI', {
  sendBrainstormingChat: (payload) => ipcRenderer.send('send-brainstorming-chat', payload),
  onBrainstormingChatStreamChunk: (callback) => ipcRenderer.on('brainstorming-chat-stream-chunk', callback),
  onBrainstormingChatStreamError: (callback) => ipcRenderer.on('brainstorming-chat-stream-error', callback),
  onBrainstormingChatStreamEnd: (callback) => ipcRenderer.on('brainstorming-chat-stream-end', callback),
  startConferenceStream: (payload) => ipcRenderer.send('start-conference-stream', payload),
  onConferenceStreamChunk: (callback) => ipcRenderer.on('conference-stream-chunk', callback),
  onConferenceStreamError: (callback) => ipcRenderer.on('conference-stream-error', callback),
  onConferenceStreamEnd: (callback) => ipcRenderer.on('conference-stream-end', callback),
  removeAllConferenceListeners: () => ipcRenderer.send('remove-conference-listeners'),
  executeTaskWithEvents: (payload) => ipcRenderer.send('execute-task-with-events', payload),
  onCoderTaskLog: (cb) => ipcRenderer.on('coder-task-log', cb),
  onCoderTaskError: (cb) => ipcRenderer.on('coder-task-error', cb),
  onCoderTaskComplete: (cb) => ipcRenderer.on('coder-task-complete', cb),
  onCoderTaskConfirmationRequired: (cb) => ipcRenderer.on('coder-task-confirmation-required', cb),
  onCoderTaskProposedPlan: (cb) => ipcRenderer.on('coder-task-proposed-plan', cb),
  removeAllCoderTaskListeners: () => ipcRenderer.send('remove-coder-task-listeners'),
  sendTaskConfirmationResponse: (payload) => ipcRenderer.send('task-confirmation-response', payload),
  closeApp: () => ipcRenderer.send('close-window'),
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  onBackendPortUpdated: (callback) => ipcRenderer.on('backend-port-updated', callback),
});

// Override global console methods
const _log = console.log;
const _warn = console.warn;
const _error = console.error;

console.log = (...args) => {
  _log.apply(console, args); // Keep original behavior in devtools
  ipcRenderer.send('console-log', ...args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg));
};
console.warn = (...args) => {
  _warn.apply(console, args);
  ipcRenderer.send('console-warn', ...args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg));
};
console.error = (...args) => {
  _error.apply(console, args);
  ipcRenderer.send('console-error', ...args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg));
};

ipcRenderer.send('console-log', '--- PRELOAD SCRIPT FINISHED ---');
