# Development Setup Guide

## Quick Start

To start both frontend and backend servers simultaneously:

```bash
cd Roadrunner
npm run dev
```

This single command will:
- Start the frontend Vite development server
- Start the backend Node.js server
- Display color-coded logs (cyan for frontend, yellow for backend)
- Automatically handle port conflicts

## Available Scripts

### Main Development Commands

- `npm run dev` - Start both frontend and backend concurrently
- `npm run dev:frontend` - Start only the frontend (Vite)
- `npm run dev:backend` - Start only the backend (Node.js)
- `npm run dev:frontend-only` - Alias for frontend-only development

### Other Commands

- `npm run build` - Build the frontend for production
- `npm run start` - Build and start the Electron app
- `npm run test` - Run tests
- `npm run electron` - Start Electron app

## Development Servers

### Frontend (Vite)
- **URL**: http://localhost:5734/ (or next available port)
- **Hot Module Replacement**: Enabled
- **Auto-refresh**: On file changes

### Backend (Node.js + Express)
- **URL**: http://localhost:3333/
- **WebSocket**: ws://localhost:3333/ws/logs
- **Ollama Integration**: http://localhost:11434/
- **Auto-restart**: Manual (restart `npm run dev` if needed)

## Features

### Real-time Logging
The backend provides WebSocket-based real-time logging that the frontend can connect to for live updates.

### Ollama Integration
The backend automatically checks Ollama connectivity on startup and provides model management capabilities.

### File System Agent
Configured workspace directory for safe file operations in the `output/` folder.

### Git Integration
Automatic git operations and version control integration.

## Troubleshooting

### Port Conflicts
- Frontend will automatically find the next available port if 5734 is in use
- Backend uses fixed port 3333 - ensure it's available

### Ollama Connection
- Ensure Ollama is running on http://localhost:11434/
- Check Ollama status in backend logs

### Dependencies
- Run `npm install` in root directory for frontend dependencies
- Backend dependencies are managed separately in `backend/` folder

## Development Workflow

1. **Start Development**: `npm run dev`
2. **Open Browser**: Navigate to the frontend URL shown in terminal
3. **Make Changes**: Edit files and see live updates
4. **Check Logs**: Monitor both frontend and backend logs in the terminal
5. **Debug**: Use browser dev tools and backend WebSocket logs

## Project Structure

```
Roadrunner/
├── src/                 # Frontend Vue.js application
├── backend/            # Backend Node.js server
├── package.json        # Frontend dependencies and scripts
└── backend/package.json # Backend dependencies
```

## Next Steps

- The interface is now fully functional with all improvements implemented
- Backend and frontend communicate seamlessly
- Real-time logging provides excellent debugging capabilities
- Configuration is simplified and user-friendly
