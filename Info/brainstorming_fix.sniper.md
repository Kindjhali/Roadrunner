# Brainstorming IPC Fix

## Goal
Expose IPC helpers in `preload.js` so Vue components can access brainstorming chat features via `window.electronAPI`.

Also expose backend port update notifications so the frontend can adjust API calls when the port changes.
