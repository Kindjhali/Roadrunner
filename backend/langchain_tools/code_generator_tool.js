const { Tool } = require('@langchain/core/tools');
const { scaffoldDirectories, createFilesFromPlan } = require('../codeGenerator'); // Assuming codeGenerator.js is in the parent directory
const { generateFromLocal } = require('../server'); // Assuming server.js is in the parent directory and exports generateFromLocal

class CodeGeneratorTool extends Tool {
  name = "code_generator";
  description = "Generates code, components, or services based on a specification. Input should be a JSON string representing a 'codeGenPlan' containing 'moduleName', 'targetBaseDir', 'modelPreference', 'scaffolding' items (for directories and files), and 'specs' (like componentSpec, serviceSpec). This tool will create directories and then files, using LLM for content generation where specified.";

  async _call(inputJsonString) {
    try {
      const codeGenPlan = JSON.parse(inputJsonString);
      const { moduleName, targetBaseDir, modelPreference, scaffolding, specs } = codeGenPlan;

      if (!moduleName || !targetBaseDir || !scaffolding || !specs) {
        return "Error: Missing one or more required fields in codeGenPlan: 'moduleName', 'targetBaseDir', 'scaffolding', 'specs'.";
      }

      // Mock or simplified SSE for internal logging if needed, or pass null.
      // For this tool, the agent's final response should summarize actions.
      // We'll use console.log for detailed internal logging.
      const mockSendSseMessage = (type, data) => {
        console.log(`[CodeGeneratorTool SSE Mock] Type: ${type}, Data: ${JSON.stringify(data)}`);
      };

      console.log(`[CodeGeneratorTool] Starting code generation for module: ${moduleName} in ${targetBaseDir}`);

      // 1. Scaffold Directories
      if (scaffolding.directories && scaffolding.directories.length > 0) {
        console.log(`[CodeGeneratorTool] Scaffolding ${scaffolding.directories.length} directories...`);
        try {
          // scaffoldDirectories(basePath, directories, sendSseMessage)
          // basePath here should be targetBaseDir combined with moduleName
          const fullBasePathForScaffold = `${targetBaseDir}/${moduleName}`;
          await scaffoldDirectories(fullBasePathForScaffold, scaffolding.directories, mockSendSseMessage);
          console.log(`[CodeGeneratorTool] Directory scaffolding completed for ${fullBasePathForScaffold}.`);
        } catch (scaffoldError) {
          console.error(`[CodeGeneratorTool] Error during directory scaffolding: ${scaffoldError.message}`);
          return `Error scaffolding directories: ${scaffoldError.message}`;
        }
      } else {
        console.log("[CodeGeneratorTool] No directories specified for scaffolding.");
      }

      // 2. Create Files
      // createFilesFromPlan = async (plan, llmGenerator, sendSseMessage, agentTypeForLLM = 'coder_agent')
      // The 'plan' for createFilesFromPlan is slightly different from codeGenPlan.
      // It expects: moduleName, targetBaseDir, files (from scaffolding.files), specs, modelPreference.
      const filesToCreate = scaffolding.files || [];
      if (filesToCreate.length > 0) {
        console.log(`[CodeGeneratorTool] Creating ${filesToCreate.length} files...`);
        const fileCreationSubPlan = {
          moduleName,
          targetBaseDir,
          files: filesToCreate,
          specs,
          modelPreference // modelPreference can be 'ollama', 'openai', or a specific model name string
        };

        try {
          // The llmGenerator function needs to match the expected signature for createFilesFromPlan
          // generateFromLocal(originalPrompt, modelName, expressRes, options = {})
          // For createFilesFromPlan, it expects llmGenerator(prompt, modelName)
          // We need to adapt generateFromLocal or create a wrapper.
          const llmGeneratorWrapper = async (prompt, modelNameToUse) => {
            // Determine provider from modelPreference or backendSettings if modelNameToUse is generic
            let provider = null; // Default to ollama if not specified or if model is generic
            if (modelPreference === 'openai' || (modelNameToUse && modelNameToUse.startsWith('gpt-'))) {
                provider = 'openai';
            } else if (modelPreference === 'ollama') {
                provider = 'ollama';
            }
            // else, provider remains null, and generateFromLocal will use its default (ollama)

            // Call the actual generateFromLocal, passing null for expressRes as we don't stream to client from tool
            // The agentType might need to be 'coder_agent' or similar
            return generateFromLocal(prompt, modelNameToUse, null, { agentType: 'coder_agent', llmProvider: provider });
          };

          // createFilesFromPlan(plan, llmGenerator, sendSseMessage, agentTypeForLLM = 'coder_agent')
          // The createFilesFromPlan function itself uses the agentType 'coder_agent' when it calls the llmGenerator.
          // So, the llmGeneratorWrapper doesn't need to specify agentType again, but it's good it matches.
          await createFilesFromPlan(fileCreationSubPlan, llmGeneratorWrapper, mockSendSseMessage);
          console.log('[CodeGeneratorTool] File creation process completed.');
        } catch (fileCreationError) {
          console.error(`[CodeGeneratorTool] Error during file creation: ${fileCreationError.message}`);
          return `Error creating files: ${fileCreationError.message}`;
        }
      } else {
        console.log("[CodeGeneratorTool] No files specified for creation.");
      }

      const summary = `Code generation completed for module '${moduleName}'. Directories and files were processed according to the plan. Check console logs for details.`;
      console.log(`[CodeGeneratorTool] ${summary}`);
      return summary;

    } catch (error) {
      console.error(`[CodeGeneratorTool] Error processing code_generator_tool: ${error.message}`, error.stack);
      return `Error in CodeGeneratorTool: ${error.message}`;
    }
  }
}

module.exports = {
  CodeGeneratorTool,
};
