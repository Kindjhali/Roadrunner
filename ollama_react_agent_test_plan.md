# Ollama ReAct Agent - Conceptual Test Plan

This document outlines conceptual test cases for evaluating the ability of various Ollama models (configured as ReAct agents) to use the available tools within the Roadrunner backend.

## Target Ollama Models:

*   `llama3:8b-instruct` (or latest Llama 3 instruct variant)
*   `mistral:7b-instruct` (or latest Mistral instruct variant)
*   `phi3:medium-instruct` (or latest Phi-3 instruct variant)

## Test Case Structure:

For each model and each tool, the following will be detailed:

*   **Tool:** Name of the tool.
*   **Simple Prompt:** A natural language prompt to trigger the tool.
*   **Expected Agent Action (Thought/Action/Action Input):**
    *   **Thought:** A brief "thought" process for the ReAct agent.
    *   **Action:** The tool name the agent should choose.
    *   **Action Input:** The JSON string or simple string input for the tool.
*   **Expected Tool Output (Observation):** The successful string output from the tool.
*   **Anticipated Failure Modes:** Potential ways the agent or tool interaction might fail.

---

## I. Model: `llama3:8b-instruct` (Conceptual Tests)

### 1. Tool: `ListDirectoryTool`
*   **Simple Prompt:** "What files are in the main workspace directory?"
*   **Expected Agent Action:**
    *   **Thought:** I need to list the contents of a directory. The user specified the main workspace, which means the root. The `list_directory` tool seems appropriate for this. The input should be an empty string for the root.
    *   **Action:** `list_directory`
    *   **Action Input:** `""`
*   **Expected Tool Output (Observation):** A string representing the directory tree structure, e.g., "Workspace Root/\n  file1.txt\n  folder1/\n    file2.js".
*   **Anticipated Failure Modes:**
    *   May attempt to use `read_file` with an empty string or "/" as input.
    *   May misunderstand "main workspace directory" and ask for clarification or try to list a subdirectory if one was mentioned previously.
    *   May generate an action input like `"{}"` or `{"relativePath": ""}` if it over-generalizes JSON input for all tools.

### 2. Tool: `CreateFileTool`
*   **Simple Prompt:** "Make a new file called 'recipes.txt' and put '1. Mix ingredients\n2. Bake' inside it."
*   **Expected Agent Action:**
    *   **Thought:** The user wants to create a new file with specific content. The `create_file` tool is suitable. I need to provide the file path and the content.
    *   **Action:** `create_file`
    *   **Action Input:** `"{\"filePath\": \"recipes.txt\", \"content\": \"1. Mix ingredients\\n2. Bake\"}"`
*   **Expected Tool Output (Observation):** "File created successfully at output/recipes.txt" (or similar, path depends on `WORKSPACE_DIR`).
*   **Anticipated Failure Modes:**
    *   Generating malformed JSON (e.g., missing quotes, incorrect escaping of newlines in the content string).
    *   Using incorrect JSON keys (e.g., `fileName` instead of `filePath`, `text` instead of `content`).
    *   May try to create parent directories if they don't exist, which this tool doesn't do explicitly (fsAgent might, depending on its implementation).

### 3. Tool: `ReadFileTool`
*   **Simple Prompt:** "Show me the content of 'recipes.txt'."
*   **Expected Agent Action:**
    *   **Thought:** The user wants to see the content of a specific file. The `read_file` tool is appropriate. I need to provide the file path.
    *   **Action:** `read_file`
    *   **Action Input:** `"recipes.txt"`
*   **Expected Tool Output (Observation):** "1. Mix ingredients\n2. Bake"
*   **Anticipated Failure Modes:**
    *   Attempting to use `list_directory` for a file.
    *   Providing the path in an overly complex format if it expects a simple string.
    *   If the file doesn't exist, the tool will return an error string, which the agent then needs to interpret.

### 4. Tool: `UpdateFileTool`
*   **Simple Prompt:** "Add '3. Enjoy!' to the end of 'recipes.txt'."
*   **Expected Agent Action:**
    *   **Thought:** The user wants to add content to an existing file. The `update_file` tool is suitable. I need to specify the file path, the new content, and ensure it appends.
    *   **Action:** `update_file`
    *   **Action Input:** `"{\"filePath\": \"recipes.txt\", \"content\": \"\\n3. Enjoy!\", \"append\": true}"`
*   **Expected Tool Output (Observation):** "File updated successfully at output/recipes.txt".
*   **Anticipated Failure Modes:**
    *   Forgetting `\"append\": true` and overwriting the file.
    *   Malformed JSON.
    *   Incorrectly escaping the newline for the content.

### 5. Tool: `DeleteFileTool`
*   **Simple Prompt:** "Get rid of the 'recipes.txt' file."
*   **Expected Agent Action:**
    *   **Thought:** The user wants to delete a file. The `delete_file` tool is appropriate. I need to provide the file path.
    *   **Action:** `delete_file`
    *   **Action Input:** `"recipes.txt"`
*   **Expected Tool Output (Observation):** "File deleted successfully: output/recipes.txt".
*   **Anticipated Failure Modes:**
    *   Trying to use `update_file` with empty content.
    *   Providing the path in a JSON format if the tool expects a raw string.

### 6. Tool: `CreateDirectoryTool`
*   **Simple Prompt:** "Create a new folder called 'my_project'."
*   **Expected Agent Action:**
    *   **Thought:** The user wants to create a new directory. The `create_directory` tool is suitable. I need to provide the directory path.
    *   **Action:** `create_directory`
    *   **Action Input:** `"my_project"`
*   **Expected Tool Output (Observation):** "Directory created successfully at output/my_project".
*   **Anticipated Failure Modes:**
    *   Attempting to use `create_file` for a directory path.
    *   Trying to create nested directories (e.g., "parent/my_project") if the tool/underlying agent doesn't support recursive creation by default.

### 7. Tool: `DeleteDirectoryTool`
*   **Simple Prompt:** "Delete the 'my_project' folder."
*   **Expected Agent Action:**
    *   **Thought:** The user wants to delete a directory. The `delete_directory` tool is appropriate. I need to provide the directory path.
    *   **Action:** `delete_directory`
    *   **Action Input:** `"my_project"`
*   **Expected Tool Output (Observation):** "Directory deleted successfully: output/my_project".
*   **Anticipated Failure Modes:**
    *   Trying to delete a non-empty directory if the tool requires it to be empty (though this one is recursive).
    *   Using `delete_file` for a directory.

### 8. Tools: `GitAddTool` & `GitCommitTool` (Chained)
*   **Simple Prompt:** "Stage the 'README.md' file and then commit it with the message 'Add initial README'."
*   **Expected Agent Actions (Sequence):**
    1.  **Thought:** First, I need to stage the specified file. The `git_add` tool is appropriate.
        **Action:** `git_add`
        **Action Input:** `"{\"filePath\": \"README.md\"}"`
        **Observation (from tool):** "Successfully added README.md." (or similar)
    2.  **Thought:** Now that the file is staged, I need to commit it with the user's message. The `git_commit` tool is correct.
        **Action:** `git_commit`
        **Action Input:** `"{\"message\": \"Add initial README\"}"`
        **Observation (from tool):** "Commit successful." (or similar with commit hash)
*   **Anticipated Failure Modes:**
    *   Attempting to commit before adding.
    *   Incorrect JSON structure for `filePath` or `message`.
    *   Model might try to find a single tool "git_add_and_commit".
    *   May forget to use the observation from `git_add` before proceeding to commit.

### 9. Tools: `GitPushTool` / `GitPullTool` / `GitRevertTool`
*   **Prompts:** "Push my changes.", "Pull the latest changes.", "Revert the last commit."
*   **Expected Actions:**
    *   `action: "git_push"`, `action_input: "{}"` (or with optional remote/branch if specified)
    *   `action: "git_pull"`, `action_input: "{}"` (or with optional remote/branch)
    *   `action: "git_revert_last_commit"`, `action_input: "{}"`
*   **Expected Observations:** Success messages from the respective gitAgent functions.
*   **Anticipated Failure Modes:**
    *   Confusion between push/pull.
    *   Attempting to provide parameters like a commit message to `git_pull` or `git_revert_last_commit`.
    *   Forgetting that `git_revert_last_commit` takes an empty JSON string as input.

### 10. Tool: `CodeGeneratorTool`
*   **Simple Prompt:** "Generate a Vue component named 'UserProfile' that displays a user's name and email. Put it in 'components/UserProfile.vue'."
*   **Expected Agent Action:**
    *   **Thought:** The user wants to generate a code component. The `code_generator` tool is designed for this. I need to construct a `codeGenPlan` JSON object. This will involve defining the moduleName, targetBaseDir, and a spec for the component including its name, suggested path, and a prompt for its content.
    *   **Action:** `code_generator`
    *   **Action Input:** (A complex JSON string, simplified here)
        `"{\"moduleName\": \"UserProfile\", \"targetBaseDir\": \"components\", \"scaffolding\": {\"files\": [{\"filePath\": \"UserProfile.vue\", \"generationPrompt\": \"Create a Vue single-file component named UserProfile that takes name and email as props and displays them in a simple template.\"}]}, \"specs\": { \"componentSpec\": { \"name\": \"UserProfile\", \"props\": [\"name:String\", \"email:String\"]} } }"`
        *(Note: This is a conceptual simplification of a `codeGenPlan`. The actual plan might be more detailed as per the tool's description, including separate scaffolding for directories and more detailed specs. The agent's ability to create this complex JSON correctly is a key test.)*
*   **Expected Tool Output (Observation):** "Code generation completed for module 'UserProfile'. Files created: components/UserProfile.vue." (or similar summary).
*   **Anticipated Failure Modes:**
    *   Generating syntactically incorrect JSON for the `codeGenPlan`. This is highly probable due to the complexity.
    *   Missing required fields in the `codeGenPlan` (e.g., `moduleName`, `targetBaseDir`).
    *   The prompts within the `codeGenPlan` might be too vague for the sub-LLM calls made by the tool.
    *   The agent might try to use `create_file` directly with an LLM-generated code string, bypassing the structured `CodeGeneratorTool`.

### 11. Tool: `ConferenceTool`
*   **Simple Prompt:** "Hold a debate between a 'Pro-AI' advocate and an 'AI-Skeptic' about the future of AI in creative arts, then summarize."
*   **Expected Agent Action:**
    *   **Thought:** The user wants a debate between multiple AI personas and a summary. The `multi_model_debate` tool is designed for this. I need to provide the main prompt and can specify roles.
    *   **Action:** `multi_model_debate`
    *   **Action Input:** `"{\"prompt\": \"The future of AI in creative arts\", \"model_a_role\": \"Pro-AI Advocate\", \"model_b_role\": \"AI-Skeptic\", \"arbiter_model_role\": \"Summarizer\"}"`
*   **Expected Tool Output (Observation):** A string containing the arbiter's summary of the debate.
*   **Anticipated Failure Modes:**
    *   Malformed JSON for the input.
    *   Not correctly extracting the core prompt from the user's request.
    *   Misinterpreting or not correctly assigning the roles if the prompt is less explicit.
    *   The tool itself might have errors if `generateFromLocal` or logging fails internally.

---

## II. Model: `mistral:7b-instruct` (Conceptual Tests)

*(The test cases for Mistral would follow the same structure as Llama 3, with prompts and expected actions/outputs being identical. The primary difference would be in the "Anticipated Failure Modes," which might be subtly different based on Mistral's common behaviors. For brevity, only a few examples highlighting potential model-specific nuances are shown here. Assume other tools follow similar patterns to Llama 3.)*

### 1. Tool: `CreateFileTool`
*   **Simple Prompt:** "Make a new file called 'mistral_notes.txt' and put 'Mistral is an LLM.' inside it."
*   **Expected Agent Action:**
    *   **Thought:** Create a file. Use `create_file`. Need `filePath` and `content`.
    *   **Action:** `create_file`
    *   **Action Input:** `"{\"filePath\": \"mistral_notes.txt\", \"content\": \"Mistral is an LLM.\"}"`
*   **Expected Tool Output (Observation):** "File created successfully at output/mistral_notes.txt".
*   **Anticipated Failure Modes (Mistral-Specific):**
    *   Mistral models are generally good at following formats but might occasionally add extra conversational text around the JSON output if not strictly prompted for JSON only. The ReAct output parser would need to strip this.
    *   May be more prone to simpler JSON structures if the prompt is not very explicit about complex nested objects.

### 2. Tool: `CodeGeneratorTool`
*   **Simple Prompt:** "Generate a simple Python function that adds two numbers, in a file 'utils/math.py'."
*   **Expected Agent Action:**
    *   **Thought:** Need to generate code into a file. `code_generator` tool is best. I need to formulate the `codeGenPlan`.
    *   **Action:** `code_generator`
    *   **Action Input:** (Conceptual JSON for `codeGenPlan`)
        `"{\"moduleName\": \"math_utils\", \"targetBaseDir\": \"utils\", \"scaffolding\": {\"files\": [{\"filePath\": \"math.py\", \"generationPrompt\": \"Create a Python function named add that takes two arguments (a, b) and returns their sum.\"}]}, \"specs\": {} }"`
*   **Expected Tool Output (Observation):** "Code generation completed for module 'math_utils'. Files created: utils/math.py."
*   **Anticipated Failure Modes (Mistral-Specific):**
    *   Generating the complex `codeGenPlan` JSON might be challenging. Mistral might simplify the plan or miss parts of the structure if the example in the prompt is not very clear or if the request is complex.
    *   It might be more likely to try and generate the Python code directly as a string and use `create_file` instead of the more structured `code_generator` tool, if it deems the task simple enough.

---

## III. Model: `phi3:medium-instruct` (Conceptual Tests)

*(Similar to Mistral, Phi-3 test cases would largely mirror Llama 3's. Phi-3 models are known for being surprisingly capable for their size, especially with structured outputs if prompted well. Potential differences in failure modes are highlighted.)*

### 1. Tool: `UpdateFileTool`
*   **Simple Prompt:** "Append 'Phi-3 was here.' to 'phi_log.txt'."
*   **Expected Agent Action:**
    *   **Thought:** Add to end of file. Use `update_file` with `append: true`.
    *   **Action:** `update_file`
    *   **Action Input:** `"{\"filePath\": \"phi_log.txt\", \"content\": \"Phi-3 was here.\", \"append\": true}"`
*   **Expected Tool Output (Observation):** "File updated successfully at output/phi_log.txt".
*   **Anticipated Failure Modes (Phi-3-Specific):**
    *   Phi-3 is generally good with JSON but might be sensitive to prompt nuances regarding the `append` flag if the instruction isn't perfectly clear (e.g., "add to file" vs "append to file").
    *   For very simple content, it might hallucinate success without actually forming a perfect tool call if the ReAct loop isn't strictly enforced by the agent framework for every thought.

### 2. Tool: `GitAddTool` & `GitCommitTool` (Chained)
*   **Simple Prompt:** "Track changes to 'main.py' and commit with 'Update main script'."
*   **Expected Agent Actions (Sequence):**
    1.  **Thought:** Stage 'main.py'. Use `git_add`.
        **Action:** `git_add`
        **Action Input:** `"{\"filePath\": \"main.py\"}"`
        **Observation:** "Successfully added main.py."
    2.  **Thought:** Commit staged changes. Use `git_commit`.
        **Action:** `git_commit`
        **Action Input:** `"{\"message\": \"Update main script\"}"`
        **Observation:** "Commit successful."
*   **Anticipated Failure Modes (Phi-3-Specific):**
    *   May attempt to combine steps if the prompt isn't very clear about sequence ("Track and commit main.py...").
    *   Could be very good at generating the JSON if the examples in the system prompt for ReAct are clear and simple. Its smaller size might make it less prone to overly complex or verbose JSON attempts than larger models.

---

This document provides a conceptual framework for testing. Actual performance will vary based on the specific model revisions, the clarity of the ReAct system prompt, and the robustness of the agent's ReAct loop (parsing of Thought/Action/Observation).I have created the conceptual test plan in `ollama_react_agent_test_plan.md`.
This document outlines:
1.  Target Ollama Models: `llama3:8b-instruct`, `mistral:7b-instruct`, `phi3:medium-instruct`.
2.  Test cases for each tool, including:
    *   Tool name
    *   A simple natural language prompt.
    *   Expected ReAct agent "Thought", "Action" (tool name), and "Action Input" (JSON or string).
    *   Expected successful tool output ("Observation").
    *   Anticipated failure modes, with some model-specific considerations.

The tools covered are: `ListDirectoryTool`, `CreateFileTool`, `ReadFileTool`, `UpdateFileTool`, `DeleteFileTool`, `CreateDirectoryTool`, `DeleteDirectoryTool`, chained `GitAddTool` & `GitCommitTool`, other Git tools (`GitPushTool`, `GitPullTool`, `GitRevertTool`), `CodeGeneratorTool`, and `ConferenceTool`.

This plan is for conceptual validation and documentation; no live execution was performed.
