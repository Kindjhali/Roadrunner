# Renderer Frontend

This directory contains the main Vue 3 frontend application for Roadrunner Autocoder. It runs inside Electron and provides the full interface for planning, configuration, and execution workflows.

## Setup

From the repository root:

```bash
npm install
npm run dev
```

The renderer is served via Vite on port 5733 during development and bundled with Electron for production.

## Structure

```
apps/renderer/
├── App.vue           # root component
├── components/       # UI components
├── composables/      # reusable logic
├── services/         # API wrappers
├── stores/           # pinia stores
├── styles/           # global styles
└── main.js           # entry file
```

## Purpose

The renderer exposes advanced functionality including configuration panels, code generation, and real-time log viewing. It connects to the backend services defined under `services/`.
