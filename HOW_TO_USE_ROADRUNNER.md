# How to Use Roadrunner

## Introduction

Welcome to Roadrunner! This application is designed to act as an autonomous AI agent, helping you automate complex tasks, especially in software development and other digital domains. It uses Large Language Models (LLMs) to understand your goals and execute sequences of steps to achieve them.

For a full list of features, technical details, and API specifications, please refer to the main [README.md](./README.md). This guide focuses on how to operate the Roadrunner application.

## Getting Started

This guide assumes you have already set up Roadrunner according to the instructions in [ROADRUNNER_SETUP_AND_FEATURES.md](./ROADRUNNER_SETUP_AND_FEATURES.md).

To launch the application:
1.  Ensure the backend server is running (usually by navigating to `roadrunner/backend` and running `npm start`).
2.  Launch the Electron application (usually by navigating to the `roadrunner` root directory and running `npm start`).

## Understanding the UI

The Roadrunner application interface is primarily organized into three tabs:

*   **Coder Tab:** This is the main operational tab. Here you will define tasks, manage sessions, select active tasks, and initiate their execution. You'll also monitor the output in the executor panel.
*   **Brainstorming Tab:** The Brainstorming Tab provides an interactive chat interface for direct conversations with selected Language Models. You can select an available Ollama model, type your questions or prompts, and receive answers. It's useful for quick Q&A, idea generation, or exploring a model's capabilities. Basic file upload functionality is present (it logs the uploaded file's name and notes it in the chat), but full contextual understanding of uploaded files, conversation management (saving/loading chats), and integration with remote models for chat are planned for future enhancements.
*   **Configuration Tab:** The Configuration Tab is intended for managing application settings. This will include configurations for LLM connections (like API keys for remote models), defining default paths, and other application-level preferences. Currently, most of these configuration options are planned for future development. Please refer to [roadrunner.steps.md](./roadrunner.steps.md) for updates on feature implementation.

## Working with Tasks and Sessions

Roadrunner organizes work into "tasks" which are part of a "session." A task typically consists of an overall goal and a sequence of steps to achieve that goal.

**1. How to Define a Task (Uploading a Task File):**
   - In the "Coder" tab, locate the "Custom Task File" section.
   - Click the "Choose File" button and select a JSON or text file that defines your task (overall goal and steps).
   - Once uploaded, the task(s) from the file will be added to your current session and appear in the "Session Tasks" list.

**2. How to Save the Current Session:**
   - In the "Coder" tab, you can optionally provide a name for your current session in the "Session Name" input field.
   - Click the "Save Session" button. This will save all tasks currently in your "Session Tasks" list to a session file (usually in `roadrunner/output/sessions/`). If no name is provided, a timestamped name will be used.

**3. How to List and Load Saved Sessions:**
   - In the "Coder" tab, find the "Load Session" dropdown menu.
   - This menu lists all previously saved sessions.
   - Select a session from the list. Its tasks will be loaded into the "Session Tasks" list, replacing the current ones.

**4. How to Select an Active Task:**
   - The "Session Tasks" list on the "Coder" tab displays all tasks in your current session.
   - Click on any task in this list to select it. It will usually be highlighted to indicate it's the "active task."

**5. How to Run the Active Task:**
   - Once you have an active task selected, click the **"Run Active Task"** button (usually prominently displayed on the "Coder" tab).
   - The task execution will begin.

## Monitoring Task Execution

When a task is running, its progress, logs, LLM interactions, and any errors are displayed in real-time in the **executor output panel**. This panel is typically the largest part of the "Coder" tab. Pay close attention to this panel to understand what Roadrunner is doing at each step.

## Understanding Safety Mode and Confirmations

Roadrunner includes a "Safety Mode." When enabled (usually by default), it may require your confirmation before performing potentially destructive operations (e.g., deleting files, overwriting files).
- The backend supports robust confirmation handling.
- Confirmation prompts may appear in the executor output panel or via a UI dialog.
- You will typically be given options to confirm, deny, or sometimes skip an operation.
- When Safety Mode is active (it is ON by default), Roadrunner will require your explicit approval before executing potentially destructive operations, such as modifying or deleting files, or making Git commits and pushes. This is handled through confirmation dialogs that appear in the UI (currently, these are standard browser confirmation pop-ups). You will be presented with the action to be performed and given the option to approve or deny it. Task execution pauses until you respond. For some operations, there's also a batch confirmation feature that might ask for approval after a certain number of operations.

## Using Autonomous Mode

Roadrunner has an "Autonomous Mode."
- If this mode is selected (e.g., via a checkbox or option when starting a task), instead of executing a predefined sequence of steps from a file, you provide an "Overall Task Goal."
- Roadrunner will then use the LLM to autonomously generate a sequence of steps it believes will achieve that goal and execute them.
- This mode is more experimental and relies heavily on the LLM's planning capabilities.
- Autonomous Mode is typically initiated by providing an 'Overall Task Goal' in the Coder tab and using a dedicated 'Execute Autonomous Task' button or a similar UI option. Instead of following a predefined script, Roadrunner uses the selected LLM to interpret your goal, break it down into a sequence of executable steps, and then carries them out. This mode relies heavily on the LLM's planning capabilities and is best used for tasks where the path to the solution is not clearly defined beforehand. You should monitor the execution closely, as the generated steps might sometimes require adjustments or clarification. Future enhancements may include a plan validation step where the agent presents its proposed steps for your approval before execution.

---
This guide provides a basic overview. For more advanced usage or troubleshooting, please refer to the [README.md](./README.md) and other documentation files.
