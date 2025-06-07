const { Tool } = require('@langchain/core/tools');
const { scaffoldDirectories, createFilesFromPlan } = require('../codeGenerator');
const { generateFromLocal } = require('../server');
const { ConfirmationRequiredError } = require('./common');
const { v4: uuidv4 } = require('uuid');

class CodeGeneratorTool extends Tool {
  name = "code_generator";
  description = `Generates code, components, or services based on a detailed specification.
Input MUST be a JSON string representing a 'codeGenPlan'.
This plan MUST include:
- 'moduleName': (string) The primary name for the collection of generated files (e.g., 'UserProfile').
- 'targetBaseDir': (string) The base directory relative to the workspace where files will be created (e.g., 'src/components').
- 'scaffolding': (object) Contains:
    - 'directories': (array of strings) Relative paths for directories to create under 'targetBaseDir/moduleName'. Example: ["services", "utils"].
    - 'files': (array of objects) Each object defines a file to create:
        - 'filePath': (string) Relative path of the file under 'targetBaseDir/moduleName'. Example: "UserProfile.vue" or "services/userService.js".
        - 'generationPrompt': (string) Detailed prompt for an LLM to generate the content of this file.
        - 'specType': (string, optional) e.g., 'componentSpec', 'serviceSpec', 'utilSpec'. Used to find detailed specs.
        - 'specName': (string, optional) Name of the spec to use from the main 'specs' object.
- 'specs': (object) Contains detailed specifications for different parts of the code. Keys are spec types (e.g., 'componentSpec', 'serviceSpec'), and values are objects where keys are spec names. Example: { "componentSpec": { "UserProfile": { "details": "..." } } }.
- 'modelPreference': (string, optional) Preferred LLM provider ('ollama', 'openai') or specific model name for generation. Defaults to system default.

Example (simplified):
{"moduleName": "MyModule", "targetBaseDir": "src/modules", "scaffolding": {"directories": ["helpers"], "files": [{"filePath": "MyModule.js", "generationPrompt": "Create main JS file for MyModule."}]}, "specs": {}, "modelPreference": "ollama"}

This tool will create directories and then generate files using an LLM based on the provided prompts and specifications. It's a complex tool; ensure the plan is well-formed.`;

  async _call(inputJsonString, runManager) {
    try {
      const codeGenPlan = JSON.parse(inputJsonString);
      const { moduleName, targetBaseDir, modelPreference, scaffolding, specs } = codeGenPlan;

      if (!moduleName || !targetBaseDir || !scaffolding || !specs) {
        return "Error: Input JSON 'codeGenPlan' MUST include 'moduleName', 'targetBaseDir', 'scaffolding', and 'specs' keys.";
      }
      if (!scaffolding.files || !Array.isArray(scaffolding.files)) {
        return "Error: 'codeGenPlan.scaffolding' MUST include a 'files' array.";
      }


      const safetyMode = runManager?.config?.safetyMode ?? true;
      const isConfirmedAction = runManager?.config?.isConfirmedActionForTool?.[this.name]?.[inputJsonString] || false;

      if (safetyMode && !isConfirmedAction) {
        const confirmationId = uuidv4();
        // Summarize the plan for the confirmation message
        const filePathsToCreate = (scaffolding.files || []).map(f => `${targetBaseDir}/${moduleName}/${f.filePath}`).join(", ");
        const dirsToCreate = (scaffolding.directories || []).map(d => `${targetBaseDir}/${moduleName}/${d}`).join(", ");
        let confMsg = `Proceed with code generation for module '${moduleName}'?`;
        if (dirsToCreate) confMsg += ` This will create directories: ${dirsToCreate}.`;
        if (filePathsToCreate) confMsg += ` This will create/overwrite files: ${filePathsToCreate}.`;

        throw new ConfirmationRequiredError({
            toolName: this.name,
            toolInput: inputJsonString,
            confirmationId,
            message: confMsg
        });
      }

      const sendSseMessage = runManager?.config?.sendSseMessage || ((type, data) => {
        console.log(`[CodeGeneratorTool SSE Mock/Log] Type: ${type}, Data: ${JSON.stringify(data)}`);
      });
      const originalExpressHttpRes = runManager?.config?.originalExpressHttpRes;


      sendSseMessage('log_entry', { message: `[CodeGeneratorTool] Starting code generation for module: ${moduleName} in ${targetBaseDir}` });

      if (scaffolding.directories && scaffolding.directories.length > 0) {
        sendSseMessage('log_entry', { message: `[CodeGeneratorTool] Scaffolding ${scaffolding.directories.length} directories...` });
        try {
          const fullBasePathForScaffold = path.join(targetBaseDir, moduleName); // Use path.join for cross-platform compatibility
          await scaffoldDirectories(fullBasePathForScaffold, scaffolding.directories, sendSseMessage);
           sendSseMessage('log_entry', { message: `[CodeGeneratorTool] Directory scaffolding completed for ${fullBasePathForScaffold}.` });
        } catch (scaffoldError) {
          console.error(`[CodeGeneratorTool] Error during directory scaffolding: ${scaffoldError.message}`);
          return `Error scaffolding directories: ${scaffoldError.message}`;
        }
      }

      const filesToCreate = scaffolding.files || [];
      if (filesToCreate.length > 0) {
        sendSseMessage('log_entry', { message: `[CodeGeneratorTool] Creating/generating ${filesToCreate.length} files...` });
        const fileCreationSubPlan = { moduleName, targetBaseDir, files: filesToCreate, specs, modelPreference };

        try {
          const llmGeneratorWrapper = async (prompt, modelNameToUse) => {
            let provider = null;
            if (modelPreference === 'openai' || (modelNameToUse && modelNameToUse.startsWith('gpt-'))) {
                provider = 'openai';
            } else if (modelPreference === 'ollama') {
                provider = 'ollama';
            }
            // Pass originalExpressHttpRes for streaming if available from runManager.config
            return generateFromLocal(prompt, modelNameToUse, originalExpressHttpRes, { agentType: 'coder_agent', llmProvider: provider });
          };

          // Pass isConfirmedAction: true because the tool itself has handled the confirmation gate.
          await createFilesFromPlan(fileCreationSubPlan, llmGeneratorWrapper, sendSseMessage, 'coder_agent', true);
          sendSseMessage('log_entry', { message: '[CodeGeneratorTool] File creation process completed.' });
        } catch (fileCreationError) {
          console.error(`[CodeGeneratorTool] Error during file creation: ${fileCreationError.message}`);
          return `Error creating files: ${fileCreationError.message}`;
        }
      }

      const createdFilePaths = (scaffolding.files || []).map(f => `${targetBaseDir}/${moduleName}/${f.filePath}`).join(", ");
      const summary = `Code generation for module '${moduleName}' completed. Processed directories and files. Files targeted: ${createdFilePaths || 'None'}.`;
      sendSseMessage('log_entry', { message: `[CodeGeneratorTool] ${summary}` });
      return summary;

    } catch (error) {
      if (error instanceof ConfirmationRequiredError) throw error;
      if (error instanceof SyntaxError) return `Error: Invalid JSON string for Action Input. Details: ${error.message}. Input received: ${inputJsonString}`;
      console.error(`[CodeGeneratorTool] Error: ${error.message}`, error.stack);
      return `Error in CodeGeneratorTool: ${error.message}`;
    }
  }
}

module.exports = {
  CodeGeneratorTool,
};
