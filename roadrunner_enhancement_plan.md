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
    *   **Two-Tab Interface:** Roadrunner now features a primary two-tab layout:
        *   **"Coder" Tab:** Dedicated to autonomous code generation, task execution from uploaded files, and interaction with coding-focused models.
        *   **"Brainstorming" Tab:** Designed for interactive chat with language models, idea generation, and quick Q&A.
    *   **Header Bar:** The application retains its distinct orange header bar with black text and a functional close button, consistent across both tabs.

### 2. Model Management
    *   **Unified Model Loading:** A centralized system loads both dynamic local Ollama models (via API query) and predefined static remote AI models (e.g., OpenAI/ChatGPT).
    *   **Independent Tab Model Selection:** Both the "Coder" and "Brainstorming" tabs feature their own model selection dropdowns. These are populated from the unified model list, allowing each tab to maintain its own selected model state (`selectedModel` for Coder, `selectedBrainstormingModel` for Brainstorming).
    *   **Model List Refresh:** A refresh button (currently in the Coder tab) updates the model list for both tabs.

### 3. "Coder" Tab Functionality
    *   **Task Execution Engine:** Successfully integrates previous functionalities for loading tasks from:
        *   Selected predefined task sets (legacy 'modules').
        *   User-uploaded task definition files (e.g., `.md` "sniper" files).
    *   **Execution Control:** Users can execute these tasks, with logs displayed within this tab.
    *   **Dedicated Model Selection:** Utilizes its own model dropdown for tasks that might involve AI interaction.

### 4. "Brainstorming" Tab Functionality
    *   **Interactive Chat Interface:**
        *   Features a dedicated chat history panel to display conversations.
        *   Includes a text input area for user prompts and a "Send" button.
    *   **Ollama Model Integration:** Users can select a local Ollama model from the tab's dropdown and engage in chat conversations. Responses are currently handled as a full response from the model (non-streaming).
    *   **Basic File Upload:** A file upload button is present, currently logging the selected file name and adding a system message to the chat history. Full contextual use of files is a future enhancement.
    *   **Remote Model Placeholder:** Interaction with remote models (e.g., "OpenAI/ChatGPT") is currently via a placeholder response, indicating future integration.

## II. Future Development Plan

The detailed future development plans, including enhancements for Model Management, the "Coder" Tab (Autonomous Coding Agent), and the "Brainstorming" Tab, have been integrated into the [roadrunner.steps.md](./roadrunner.steps.md) document. Please refer to it for the most up-to-date and granular development tasks and their statuses.

**`taskAgent` Integration Note:** A significant new integration is with the `taskAgent` feature from `tokomakaicore`. Roadrunner will serve as the core inference engine to help `taskAgent` decide on the best sequence of actions to fulfill user commands. This involves:
*   Receiving structured requests from `taskAgent` (via `tokomakaicore`'s `roadrunnerProxy.js`).
*   Analyzing the request and using its model/plugin knowledge to propose an optimal execution pathway (sequence of module calls, parameters, etc.).
*   Returning this proposed pathway to `taskAgent`.
Specific tasks related to implementing and refining this interaction will also be detailed in `roadrunner.steps.md`. (Refer to `Info/taskAgent.sniper.md` for overall `taskAgent` design).

General UI/UX refinements will be addressed on an ongoing basis as part of the items listed in `roadrunner.steps.md`.
