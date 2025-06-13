# Roadrunner Enhancement Plan

This document serves as a framework for proposing, planning, and implementing new features and enhancements for the Roadrunner application. It also maintains a record of significant completed enhancements and outlines the general categories for future development.

## Roadrunner Action Plan Framework

The development of Roadrunner follows a structured approach to ensure clarity and progress:

1.  **Proposal:**
    *   New features, enhancements, or bug fixes are typically proposed via GitHub Issues or team discussions.
    *   Proposals should outline the objective, rationale, and expected impact.

2.  **Planning & Prioritization:**
    *   Approved proposals are broken down into manageable epics or user stories.
    *   These are prioritized based on strategic goals, user needs, and development effort.
    *   High-level strategic direction and major planned features were historically tracked in a `roadrunner.roadmap.md` file, which has since been deprecated (see `roadrunner.steps.md`). Project direction is now managed through other means.

3.  **Detailed Specification & Action Steps:**
    *   For significant new features or substantial changes (like the UI overhaul detailed below), this `roadrunner_enhancement_plan.md` document may be updated to outline the specific action plan and key components of the initiative before granular tasks are created.
    *   All approved and planned work is translated into detailed, actionable development steps. These granular tasks, along with their current status (e.g., complete, in progress, planned), are meticulously tracked in the [roadrunner.steps.md](./roadrunner.steps.md) document. This is the primary reference for active development work.

4.  **Implementation & Review:**
    *   Development work is carried out based on the tasks in `roadrunner.steps.md`.
    *   Code changes are reviewed via pull requests before being merged.

5.  **Documentation & Record Keeping:**
    *   Upon completion of significant features or enhancements, this document (`roadrunner_enhancement_plan.md`) may be updated in the "Completed Enhancements" section to provide a high-level summary of the changes.
    *   Other relevant documentation (e.g., `README.md`, `HOW_TO_USE_ROADRUNNER.md`) is updated as needed.

This framework ensures that development is transparent, traceable, and aligned with the overall project vision. For the most current, detailed list of ongoing and upcoming development tasks, always refer to [roadrunner.steps.md](./roadrunner.steps.md).

## I. Completed Enhancements (Post-Tabbed UI Implementation)

### 1. Core UI Structure
    *   **Multi-Tab Interface:** Roadrunner now features a multi-tab layout defined in `App.vue`:
        *   **"Coder" Tab:** Dedicated to task execution based on user descriptions, interaction with coding-focused models, and viewing agent logs.
        *   **"Brainstorming" Tab:** Currently a UI placeholder in `App.vue`. (The backend IPC `send-brainstorming-chat` in `electron.cjs` supports streaming Ollama responses, intended for this tab's future implementation).
        *   **"Conference" Tab:** For managing and observing multi-model debates/conferences.
        *   **"Configuration" Tab:** Allows users to configure LLM providers, API keys, default models, and other application settings.
    *   **Header Bar:** The application retains its distinct header bar with application title, logo, and a functional close button, consistent across all tabs.

### 2. Model Management
    *   **Unified Model Loading:** A centralized system (via `loadAvailableModels` in `App.vue` calling the backend `/api/ollama-models/categorized` endpoint) loads local Ollama models and static model definitions (like OpenAI models).
    *   **Model Selection:** The 'Coder' tab features a "Default Task Model" selection dropdown. The 'Brainstorming' and 'Conference' tabs will also utilize model selection once their UI and logic are fully integrated. Model lists are populated from a unified source (Vuex store).
    *   **Model List Refresh:** A refresh button in the "Coder" tab updates the available model list.

### 3. "Coder" Tab Functionality
    *   **Task Input:** Allows users to provide a task description directly in a textarea or by uploading a `.md` or `.txt` file, the content of which populates the task description.
    *   **Safety Mode:** Includes a 'Safety Mode' toggle to enable/disable user confirmations for potentially destructive agent actions.
    *   **Execution Control:** Users can initiate tasks using the "Run Task" button.
    *   **Log Display:** Task execution logs, agent actions, tool outputs, and errors are displayed in real-time within this tab.
    *   **Instruction Editing:** Provides a button to edit the base instructions for the Coder agent.

### 4. "Brainstorming" Tab Functionality
    *   **UI Placeholder:** The 'Brainstorming' tab in the current `App.vue` is a UI placeholder (an empty `div`).
    *   **Backend Support:** Backend support via Electron IPC (`send-brainstorming-chat` in `electron.cjs`) is implemented for direct chat with local Ollama models, including streaming responses. Full UI integration of this chat functionality, including a dedicated chat interface, history management, and model selection, is a planned enhancement for this tab.

## II. Future Development Plan

The detailed future development plans, including enhancements for Model Management, the "Coder" Tab (Autonomous Coding Agent), and the "Brainstorming" Tab, have been integrated into the [roadrunner.steps.md](./roadrunner.steps.md) document. Please refer to it for the most up-to-date and granular development tasks and their statuses.

**`taskAgent` Integration Note:** A significant new integration is with the `taskAgent` feature from `tokomakaicore`. Roadrunner will serve as the core inference engine to help `taskAgent` decide on the best sequence of actions to fulfill user commands. This involves:
*   Receiving structured requests from `taskAgent` (via `tokomakaicore`'s `roadrunnerProxy.js`).
*   Analyzing the request and using its model/plugin knowledge to propose an optimal execution pathway (sequence of module calls, parameters, etc.).
*   Returning this proposed pathway to `taskAgent`.
Specific tasks related to implementing and refining this interaction will also be detailed in `roadrunner.steps.md`. (Refer to `Info/taskAgent.sniper.md` for overall `taskAgent` design).

General UI/UX refinements will be addressed on an ongoing basis as part of the items listed in `roadrunner.steps.md`.
