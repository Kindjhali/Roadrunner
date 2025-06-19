# Frontend Module

This submodule provides a lightweight Vue 3 interface for interacting with the Roadrunner backend services. It exposes several configuration and execution panels built with Tailwind CSS.

## Setup

```bash
# install dependencies from project root
npm install

# start only this frontend
npm run dev:frontend-only
```

## Structure

```
apps/frontend/
├── components/      # Vue components
├── hooks/           # custom composition hooks
├── composables/     # shared logic utilities
├── pages/           # page-level components
├── styles/          # Tailwind CSS entry
├── App.vue          # root component
├── main.ts          # app entry
└── vite.config.ts   # Vite configuration
```

A simplified flow diagram:

```
User Input → PromptConsole → POST /api/execute → Backend
                          ↘ streamed results ↗
```


## Purpose & Role
This frontend surfaces key backend capabilities and demonstrates minimal integration with logging and configuration APIs.

## Visual Map
```
App.vue
├─ PromptConsole
├─ CodeExecutionPanel
├─ AgentConfigPanel
├─ ConfigEditorPanel
└─ BackendLogViewer
```
