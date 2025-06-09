# How to Use Roadrunner

## Introduction

Welcome to Roadrunner! This application is designed to act as an autonomous AI agent, helping you automate complex tasks, especially in software development and other digital domains. It uses Large Language Models (LLMs) to understand your goals and execute sequences of steps to achieve them.

For a full list of features, technical details, and API specifications, please refer to the main [README.md](./README.md). This guide focuses on how to operate the Roadrunner application.

## Getting Started

This guide assumes you have already set up Roadrunner according to the instructions in the main [README.md](./README.md).

To launch the application:
1.  Ensure the backend server is running: navigate to the `roadrunner/backend` directory in your terminal and run `npm start`.
2.  Launch the Electron application: navigate to the `roadrunner` root directory in another terminal and run `npm start`.

## Understanding the UI

The Roadrunner application interface is primarily organized into tabs:

*   **Coder Tab:** This is the main operational tab for running tasks.
    *   **Default Task Model:** Select the primary LLM to be used for interpreting and executing your task.
    *   **Custom Task File:** Upload a `.md` or `.txt` file. Its content will populate the "Task Description" field.
    *   **Enable Safety Mode:** A checkbox (usually enabled by default). When active, Roadrunner will ask for your confirmation before performing potentially destructive operations.
    *   **Task Description:** A textarea where you describe the goal for the AI agent. This can be typed directly or populated by uploading a task file.
    *   **Run Task Button:** Initiates the execution of the task described in the "Task Description" field using the selected model and safety mode setting.
    *   **Agent Output:** A panel that displays real-time logs, agent actions, tool results, and any errors during task execution.
    *   **Edit Coder Instructions:** A button to open a modal for editing the base instructions for the Coder agent.

*   **Brainstorming Tab:** This tab is currently a placeholder. The planned feature is an interactive chat interface for direct conversations with selected Language Models, useful for exploring ideas or getting quick answers.

*   **Conference Tab:** This tab allows you to set up and run a "conference" between multiple AI personas (driven by different models or instruction sets) to debate or collaborate on a given topic. You can edit instructions for each participating agent role.

*   **Configuration Tab:** This tab allows you to manage application settings:
    *   **LLM Configuration:**
        *   Select the primary LLM Provider (e.g., Ollama, OpenAI, Anthropic, Google).
        *   Enter an API Key (required for providers like OpenAI, Anthropic, Google; optional for local Ollama).
        *   Specify up to three Default Ollama Models to be used if Ollama is the selected provider.
    *   **OpenAI Configuration:**
        *   Enter a specific OpenAI API Key.
        *   Toggle whether to use this stored OpenAI Key for tasks.
        *   Save the OpenAI Key.
    *   **General Settings:**
        *   Set the Output Directory where the application may save files or logs.

## Customizing Agent Behavior

The core behavior of the AI agent is defined by prompts and configurations within the backend system.

*   **Coder Agent Instructions:** You can customize the base instructions for the main Coder agent directly via the "Edit Coder Instructions" button on the Coder tab.
*   **Conference Agent Instructions:** Similarly, instructions for different roles in the Conference tab (e.g., "Model A," "Model B," "Arbiter") can be edited within that tab.
*   **Advanced Customization:** Some tools or specific agent functionalities might have their own instruction templates within the `backend/config/` directory (e.g., for specific tool behaviors or fixed personas in the Conference tool). Modifying these requires direct changes to the backend configuration files and is intended for advanced users.

## Working with Tasks

Roadrunner focuses on executing single, well-defined tasks described by the user.

**1. How to Define a Task:**
   *   **Direct Input:** On the "Coder" tab, type your task goal directly into the "Task Description" textarea. Be as clear and specific as possible.
   *   **File Upload:** Click the "Custom Task File (.md, .txt)" button. Select a Markdown or text file. The content of this file will be loaded into the "Task Description" textarea, prefixed with a message indicating the file was processed.

**2. How to Use Safety Mode:**
   *   Before running a task, you can toggle the "Enable Safety Mode" checkbox on the "Coder" tab.
   *   If Safety Mode is enabled, the agent will pause and request your approval via a modal dialog before executing potentially harmful actions (e.g., writing or deleting files, running git commands).

**3. How to Run the Task:**
   *   Once your task description is ready and you've set your preferred model and safety mode, click the **"Run Task"** button on the "Coder" tab.
   *   The agent will begin processing the task.

## Monitoring Task Execution

When a task is running, its progress, logs, LLM interactions, tool outputs, and any errors are displayed in real-time in the **Agent Output** panel on the "Coder" tab. Pay close attention to this panel to understand what Roadrunner is doing at each step and to respond to any confirmation requests.

## Understanding Safety Mode and Confirmations

Roadrunner includes a "Safety Mode" to prevent unintended actions.
*   When enabled, the backend agent identifies potentially destructive operations (e.g., deleting files, overwriting files, making Git commits).
*   Before such an operation is performed, a **Confirmation Modal** will appear in the UI.
*   This modal displays:
    *   **Type:** The general category of action (e.g., "Individual Action").
    *   **Tool:** The specific tool the agent is trying to use (e.g., `delete_file`).
    *   **Input:** The parameters for the tool (e.g., the filepath to be deleted).
    *   **Message:** A prompt asking for your approval.
*   You will have options to **"Deny"** or **"Approve"** the action.
*   Task execution pauses until you respond to the confirmation request.

## Using Autonomous Mode (Task Execution)

The primary way to use Roadrunner via the "Coder" tab is in an autonomous mode.
*   You provide the task description (overall goal).
*   When you click "Run Task," the AI agent autonomously interprets your goal, breaks it down into a sequence of steps using available tools (like file system operations, code generation, Git commands), and executes them.
*   You monitor the process via the "Agent Output" panel and interact with Safety Mode confirmations as needed.
*   **Future Enhancements:** A planned feature includes the agent proposing a multi-step plan for complex tasks, which you would then approve or modify before full execution begins. This will offer more fine-grained control over intricate operations.

---
This guide provides a basic overview. For more advanced usage or troubleshooting, please refer to the [README.md](./README.md) and other documentation files.
