# Frontend Module

This module implements a minimal Vue 3 application for interacting with the Roadrunner backend.

## Inputs / Outputs
- **Input**: User prompts, template selections and configuration data.
- **Output**: Streamed backend responses and updated configuration files.

## Decision Flow
```
User Action -> Component -> Hook -> Backend API
                               ↘ response ↗
```

## Known Issues
- Backend endpoints must be available for the UI to work correctly.
