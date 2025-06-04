# Roadrunner Backend (`roadrunner/backend/server.js`)

This document describes the `server.js` within the `roadrunner/backend/` directory, its role in the standalone Roadrunner application, and its configuration.

> **Architectural Note:**
> The `roadrunner/` directory, including this backend, constitutes a standalone Electron application. This server shares logic with the **`TokomakAI.Desktop/`** application via the **`TokomakCore/roadrunnercoremodule/`**. Both projects are actively maintained and evolve together.

The `roadrunnercore` module in `TokomakCore/` reuses much of this backend logic to provide identical capabilities inside TokomakAI Desktop. When users open the Roadrunner panel from the Toko32 module, it loads a modal with its own copy of the Roadrunner UI but communicates with `roadrunnercore` instead of this standalone server. The two applications remain independent projects even though they share code.

## Overview

`server.js` is an Express.js application that serves as the backend for the Roadrunner standalone application. Its primary responsibilities include:

*   Handling task execution requests initiated by the Electron frontend (`roadrunner/frontend/`).
*   Interacting with Large Language Models (LLMs) via Ollama or OpenAI.
*   Performing filesystem operations using `fsAgent.js`.
*   Executing Git commands using `gitAgent.js`.
*   Streaming logs and task progress back to the frontend via Server-Sent Events (SSE).

Key agents utilized:
*   **`fsAgent.js`**: Manages all filesystem interactions, such as creating, reading, updating, and deleting files and directories. It operates primarily within the configured Workspace Directory.
*   **`gitAgent.js`**: Handles Git-related commands like add, commit, push, and pull, as instructed by task steps.

## Configuration Methods

The backend uses a hierarchical system to determine the paths for various critical directories. The order of precedence is as follows:

1.  **Environment Variables**: Highest priority. If set, they override other configurations.
2.  **JSON Configuration File (`config/backend_config.json`)**: If environment variables are not set, the system looks for this file within `roadrunner/backend/config/`. An example is provided in `config/backend_config.example.json`.
3.  **Default Values**: If a path is not defined by the above methods, a sensible default value is used, typically relative to the `roadrunner/backend/` directory.

## Configurable Paths

The following paths can be configured:

*   **Generated Components Directory**:
    *   **Description**: Directory for generated components (an earlier approach; current tasks primarily use the Workspace Directory).
    *   **Environment Variable**: `RR_COMPONENT_DIR`
    *   **JSON Key**: `componentDir`
    *   **Default**: `../tokomakAI/src/components` (relative to `roadrunner/backend/`)

*   **Log Directory**:
    *   **Description**: Directory where Roadrunner backend execution logs (e.g., task summaries) are stored. This is a critical path; if it cannot be established, the server will not start.
    *   **Environment Variable**: `RR_LOG_DIR`
    *   **JSON Key**: `logDir`
    *   **Default**: `../logs` (relative to `roadrunner/backend/`)

*   **Workspace Directory**:
    *   **Description**: The primary output directory for tasks, generated files, and git operations. This is where `fsAgent.js` and `gitAgent.js` primarily operate. This is a critical path; if it cannot be established, the server will not start.
    *   **Environment Variable**: `RR_WORKSPACE_DIR`
    *   **JSON Key**: `workspaceDir`
    *   **Default**: `../output` (relative to `roadrunner/backend/`)

## Setting up Environment Variables

To configure paths using environment variables, set them in your shell or system before running the backend. For example:

```bash
export RR_WORKSPACE_DIR="/abs/path/to/my/workspace"
export RR_LOG_DIR="../my_roadrunner_logs" # Relative to current working directory when backend starts
# Optional: override the server port (defaults to 3030)
export RR_BACKEND_PORT=3035
# or for Windows
set RR_WORKSPACE_DIR="C:\\Users\\YourUser\\MyWorkspace"
```
**Note on Relative Paths in Environment Variables**: Paths set via environment variables are typically resolved by the operating system. If relative, they are often relative to the current working directory where the Node.js process is started, *not* necessarily relative to the `roadrunner/backend` directory. For clarity and consistency, using absolute paths for environment variables is recommended.

## Using `config/backend_config.json`

1.  **Create the File**:
    Copy the example configuration file `roadrunner/backend/config/backend_config.example.json` to `roadrunner/backend/config/backend_config.json`.

2.  **Edit the File**:
    Modify the values in `backend_config.json` to your desired paths.

    ```json
    {
      "componentDir": "../tokomakAI/src/components",
      "logDir": "../logs",
      "workspaceDir": "../output"
    }
    ```

    *   **Absolute Paths**: You can use absolute paths (e.g., `/opt/roadrunner/data/logs` or `D:\\projects\\roadrunner_ws`).
    *   **Relative Paths**: Relative paths in `backend_config.json` are resolved relative to the `roadrunner/backend/` directory. For example, if `logDir` is set to `"../custom_logs"`, it will resolve to `roadrunner/custom_logs`.

## Path Resolution and Directory Creation

*   **Resolution**:
    *   Environment variables: Resolved by the OS (absolute recommended).
    *   `config/backend_config.json`: Relative paths are resolved from `roadrunner/backend/`. Absolute paths are used as-is.
    *   Defaults: Relative paths are resolved from `roadrunner/backend/`.
*   **Directory Creation**:
    *   When a path is specified (via environment variable, JSON config, or default), the backend will attempt to create the directory if it does not exist.
    *   For critical directories like `LOG_DIR` and `WORKSPACE_DIR`, if the specified or default path cannot be created (e.g., due to permissions), the server will log a fatal error and exit, as these directories are essential for its operation.

## Logging

Upon startup, the backend server will log the source (environment variable, JSON config, or default) and the final resolved path for each configured directory. This helps in verifying your setup. Example:

```
[Config] Resolved logDir: Final path is '/app/roadrunner/logs' (Source: default ('../logs')).
[Config] Directory for logDir already exists at '/app/roadrunner/logs' (Source: default ('../logs'))
[Config] Resolved workspaceDir: Final path is '/app/roadrunner/output' (Source: environment variable (RR_WORKSPACE_DIR)).
[Config] Created directory for workspaceDir at: '/app/roadrunner/output' (Source: environment variable (RR_WORKSPACE_DIR))
```

This information is crucial for debugging path-related issues.
