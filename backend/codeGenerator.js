// backend/codeGenerator.js

const fsAgent = require('./fsAgent'); // fsAgent.createDirectory, fsAgent.createFile
const path = require('path'); // For path.join
const fs = require('fs'); // For readFileSync

// Helper to convert camelCase or PascalCase to kebab-case
function toKebabCase(str) {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // get all lowercase letters that are near to uppercase ones
    .replace(/[\s_]+/g, '-') // replace all spaces and low-lines
    .toLowerCase();
}


/**
 * Generates code content for a component or service based on its specification.
 * @param {string} specType - "componentSpec" or "serviceSpec".
 * @param {object} specDetails - The componentSpec or serviceSpec object.
 * @param {object} itemDetails - The full details object of the current scaffolding item.
 * @param {string} moduleName - Name of the current module.
 * @param {object} fullCodeGenPlan - The entire codeGenPlan object for broader context.
 * @param {function} llmGenerator - Async LLM utility. Signature: (prompt, model, expressRes) => Promise<string>.
 * @param {function} sendSseMessage - For logging.
 * @returns {Promise<string|null>} Generated code content or null on failure.
 */
async function generateContentFromSpec(specType, specDetails, itemDetails, moduleName, fullCodeGenPlan, llmGenerator, sendSseMessage) {
  const logPrefix = `[CodeGenerator.generateContentFromSpec.${specType}]`;
  const modelPreference = fullCodeGenPlan.modelPreference || 'phi3'; // Or a default model for code gen

  try {
    if (specType === "componentSpec") {
      const componentName = specDetails.componentName || "MyComponent";
      sendSseMessage('log_entry', { message: `${logPrefix} Generating Vue component: ${componentName}` });

      let templatePath = path.join(__dirname, 'templates', 'vue_component_basic.template');
      if (specDetails.framework === 'react') { // Example for future extension
        templatePath = path.join(__dirname, 'templates', 'react_component_basic.template'); // Assuming this exists
         sendSseMessage('log_entry', { message: `${logPrefix} React framework specified, attempting to use React template.` });
      }

      let baseTemplate;
      try {
        baseTemplate = fs.readFileSync(templatePath, 'utf-8');
      } catch (e) {
        sendSseMessage('error', { content: `${logPrefix} Error reading template file ${templatePath}: ${e.message}` });
        return `// Error: Could not load template ${templatePath}. ${e.message}`;
      }

      let templateContent = `<!-- LLM-generated template for ${componentName} -->\n<p>${componentName} works!</p>`;
      if (specDetails.templatePrompt) {
        templateContent = await llmGenerator(specDetails.templatePrompt, modelPreference, null) || templateContent;
      }

      let scriptSetupContent = '';
      let propsContent = "{}"; // Default empty object string
      let dataContent = "return {};";
      let methodsContent = "";
      let computedContent = "";
      let watchContent = "";
      let emitsArray = specDetails.outputs || []; // from componentSpec.outputs
      let emitsContent = emitsArray.length > 0 ? `emits: ['${emitsArray.join("', '")}'],` : '';


      if (specDetails.useCompositionApi) { // Vue 3 Composition API
        sendSseMessage('log_entry', { message: `${logPrefix} Using Composition API for ${componentName}` });
        let scriptSetupParts = [];
        if(specDetails.propsPrompt) { // Prompt for entire <script setup> if available
            scriptSetupContent = await llmGenerator(specDetails.propsPrompt, modelPreference, null) || '// LLM failed to generate script setup content.';
        } else { // Generate parts if no overarching prompt
            if (specDetails.inputs && specDetails.inputs.length > 0) {
                 propsContent = `defineProps({\n  ${specDetails.inputs.map(p => `${p.split(':')[0].trim()}: ${p.split(':')[1]?.trim() || 'Object'}`).join(',\n  ')}\n});`;
                 scriptSetupParts.push(propsContent);
            }
            if (emitsArray.length > 0) {
                const emitsDefine = `const emit = defineEmits(['${emitsArray.join("', '")}']);`;
                scriptSetupParts.push(emitsDefine);
            }
            // Add more composition API parts as prompts are defined in spec (e.g. reactive state, lifecycle hooks)
            if (specDetails.logicPrompt) {
                 const logic = await llmGenerator(specDetails.logicPrompt, modelPreference, null) || '// LLM failed to generate setup logic';
                 scriptSetupParts.push(logic);
            }
            scriptSetupContent = scriptSetupParts.join('\n\n');
        }
        // For <script setup>, props, data, methods, computed, watch are usually defined within the setup block directly or via composables.
        // The baseTemplate should ideally have a {{scriptSetupContent}} placeholder.
        // For simplicity, we are injecting primarily into scriptSetupContent.
        // Clear Options API placeholders as they are not used with <script setup>
        propsContent = ""; dataContent = ""; methodsContent = ""; computedContent = ""; watchContent = ""; emitsContent = "";
      } else { // Vue 2 Options API or Vue 3 Options API
        sendSseMessage('log_entry', { message: `${logPrefix} Using Options API for ${componentName}` });
        if (specDetails.inputs && specDetails.inputs.length > 0) {
          propsContent = `props: {\n    ${specDetails.inputs.map(p => `${p.split(':')[0].trim()}: { type: ${p.split(':')[1]?.trim() || 'Object'}, default: null }`).join(',\n    ')}\n  },`;
        } else {
          propsContent = "props: {},";
        }
        if (specDetails.dataPrompt) {
          dataContent = await llmGenerator(specDetails.dataPrompt, modelPreference, null) || dataContent;
        }
        if (specDetails.methods && specDetails.methods.length > 0) {
          const methodStrings = await Promise.all(specDetails.methods.map(async (m) => {
            const body = m.bodyPrompt ? (await llmGenerator(m.bodyPrompt, modelPreference, null) || '// LLM failed to generate method body') : '// Method body placeholder';
            return `${m.methodName || 'unnamedMethod'}() {\n      ${body.replace(/\n/g, '\n      ')}\n    }`;
          }));
          methodsContent = `methods: {\n    ${methodStrings.join(',\n    ')}\n  },`;
        }
         if (specDetails.computedPrompt) { // Assuming one prompt for all computed properties
            const allComputed = await llmGenerator(specDetails.computedPrompt, modelPreference, null) || "";
            if(allComputed) computedContent = `computed: {\n  ${allComputed.replace(/\n/g, '\n    ')}\n },`;
        }
      }

      // Assemble the component
      let finalContent = baseTemplate
        .replace(/\{\{componentName\}\}/g, componentName)
        .replace(/\{\{componentNameKebabCase\}\}/g, toKebabCase(componentName))
        .replace(/\{\{templateContent\}\}/g, templateContent)
        .replace(/\{\{scriptLangAttribute\}\}/g, specDetails.scriptLang === 'ts' ? ' lang="ts"' : '')
        .replace(/\{\{scriptContent\}\}/g, scriptSetupContent ? scriptSetupContent : [propsContent, emitsContent, `data() {\n    ${dataContent}\n  },`, methodsContent, computedContent, watchContent].filter(Boolean).join('\n\n  '))
        .replace(/\{\{scriptSetupContent\}\}/g, scriptSetupContent) // If template has specific setup placeholder
        .replace(/\{\{propsContent\}\}/g, propsContent)
        .replace(/\{\{emitsContent\}\}/g, emitsContent)
        .replace(/\{\{dataContent\}\}/g, dataContent)
        .replace(/\{\{methodsContent\}\}/g, methodsContent)
        .replace(/\{\{computedContent\}\}/g, computedContent)
        .replace(/\{\{watchContent\}\}/g, watchContent);

      return finalContent;

    } else if (specType === "serviceSpec") {
      const serviceName = specDetails.serviceName || "MyService";
      sendSseMessage('log_entry', { message: `${logPrefix} Generating service: ${serviceName}` });
      const functions = specDetails.methods || []; // Renamed from 'functions' to 'methods' in schema
      let functionStrings = [];

      for (const func of functions) {
        let body = `// TODO: Implement ${func.methodName || 'unnamedFunction'}\n    throw new Error('Not implemented');`;
        if (func.bodyPrompt || func.description) { // Use description as a fallback for body prompt
          const prompt = func.bodyPrompt || `Implement the function ${func.methodName} which is described as: ${func.description}. Only output the function body.`;
          body = await llmGenerator(prompt, modelPreference, null) || body;
        }
        const params = (func.parameters || []).join(', '); // Assuming 'parameters' array in spec
        functionStrings.push(`  async ${func.methodName || 'unnamedFunction'}(${params}) {\n    ${body.replace(/\n/g, '\n    ')}\n  }`);
      }

      // Basic class or object structure
      return `// ${serviceName} - Generated Service\n\nclass ${serviceName} {\n${functionStrings.join('\n\n')}\n}\n\nexport default new ${serviceName}();\n`;

    } else {
      sendSseMessage('error', { content: `${logPrefix} Unknown specType: ${specType}` });
      return `// Error: Unknown specType '${specType}' provided to generateContentFromSpec.`;
    }
  } catch (error) {
    sendSseMessage('error', { content: `${logPrefix} Error generating content for ${specDetails?.componentName || specDetails?.serviceName || specType}: ${error.message}` });
    console.error(`${logPrefix} Error: `, error);
    return `// Error generating content: ${error.message}`;
  }
}


/**
 * Iterates through scaffolding items and creates directories.
 * Assumes paths in item.details.dirPath might contain {{targetBaseDir}} and {{moduleName}} placeholders.
 *
 * @param {Array<object>} scaffoldingItems - Array of scaffolding operations from codeGenPlan.scaffolding.
 * @param {string} targetBaseDir - The root directory where generation should occur.
 * @param {string} moduleName - The name of the module being generated.
 * @param {function} sendSseMessage - Function to send Server-Sent Events for logging.
 *                                    Signature: (type, data) => void
 * @param {Array<string>} overallExecutionLog - Array to push server-side log messages to.
 * @returns {Promise<object>} - Resolves to an object:
 *                            { success: true, createdDirectories: Array<string> } if all successful, or
 *                            { success: false, error: string, createdDirectories: Array<string> } if any failure.
 */
async function scaffoldDirectories(scaffoldingItems, targetBaseDir, moduleName, sendSseMessage, overallExecutionLog) {
  const createdDirectories = [];
  const logPrefix = '[CodeGenerator.scaffoldDirectories]';

  if (!targetBaseDir || typeof targetBaseDir !== 'string') {
    const errorMsg = `${logPrefix} Invalid targetBaseDir provided: ${targetBaseDir}`;
    console.error(errorMsg);
    if (sendSseMessage) sendSseMessage('error', { content: errorMsg });
    if (overallExecutionLog) overallExecutionLog.push(`ERROR: ${errorMsg}`);
    return { success: false, error: errorMsg, createdDirectories };
  }
  if (!moduleName || typeof moduleName !== 'string') {
    const errorMsg = `${logPrefix} Invalid moduleName provided: ${moduleName}`;
    // Logging and returning error similarly to targetBaseDir could be added if moduleName is strictly required here
    // For now, it's mainly used for templating, so an empty string might be acceptable in some edge cases.
    console.warn(`${logPrefix} moduleName is undefined or not a string: '${moduleName}'. Path templating might be affected.`);
  }


  for (const item of scaffoldingItems) {
    if (item.type === 'createDirectory') {
      if (!item.details || typeof item.details.path !== 'string') {
        const errorMsg = `${logPrefix} Invalid 'createDirectory' item: 'details.path' is missing or not a string. Item: ${JSON.stringify(item)}`;
        console.error(errorMsg);
        if (sendSseMessage) sendSseMessage('error', { content: errorMsg });
        if (overallExecutionLog) overallExecutionLog.push(`ERROR: ${errorMsg}`);
        return { success: false, error: errorMsg, createdDirectories };
      }

      let rawDirPath = item.details.path;

      // Perform placeholder replacements
      // Ensure targetBaseDir always ends with a slash if it's not empty, for clean joins if dirPath is not absolute.
      let effectiveBaseDir = targetBaseDir;
      if (effectiveBaseDir && !effectiveBaseDir.endsWith(path.sep) && !effectiveBaseDir.endsWith('/')) {
        // Use path.sep for OS-agnostic separator, but also check for '/' if manually entered.
        effectiveBaseDir += '/'; // Or path.sep, but for string replacement, '/' is simpler if paths are expected to be posix-like
      }

      // Replace {{targetBaseDir}} - this assumes dirPath might be defined relative to it, or include it.
      // If dirPath is intended to be *within* targetBaseDir, it should not start with {{targetBaseDir}} but be relative.
      // For flexibility, we'll allow {{targetBaseDir}} to be explicitly used by the LLM in the path.
      let resolvedPath = rawDirPath.replace(/\{\{targetBaseDir\}\}/g, effectiveBaseDir.endsWith('/') ? effectiveBaseDir.slice(0, -1) : effectiveBaseDir);
      resolvedPath = resolvedPath.replace(/\{\{moduleName\}\}/g, moduleName);

      // If, after replacements, the path is NOT absolute, prepend the targetBaseDir.
      // fsAgent.createDirectory expects paths relative to WORKSPACE_DIR or absolute.
      // Here, 'resolvedPath' after templating should ideally be relative to WORKSPACE_DIR.
      // The `targetBaseDir` itself is usually relative to WORKSPACE_DIR.
      // So, if `rawDirPath` was like "components" and `targetBaseDir` is "output/src",
      // then `resolvedPath` should become "output/src/components".
      // The fsAgent.createDirectory will handle paths relative to WORKSPACE_DIR.

      // Let's clarify path strategy:
      // 1. LLM provides paths in `item.details.path` that are *relative to the module being generated*.
      // 2. `targetBaseDir` is the root of that module (e.g., "src/my-feature/").
      // 3. So, the actual path to create is effectively `path.join(targetBaseDir, item.details.path)` (after {{moduleName}} replaced in item.details.path).

      // Corrected path resolution:
      // Remove {{targetBaseDir}} replacement as it's implicit. Path should be relative to targetBaseDir.
      let dirPathRelativeToModule = rawDirPath.replace(/\{\{moduleName\}\}/g, moduleName);
      resolvedPath = path.join(targetBaseDir, dirPathRelativeToModule);
      // path.join handles path separators correctly and normalizes the path.
      // Example: targetBaseDir = "src/myModule", dirPathRelativeToModule = "components" -> "src/myModule/components"
      // Example: targetBaseDir = "src/myModule", dirPathRelativeToModule = "./components" -> "src/myModule/components"

      const logMsg = `${logPrefix} Attempting to create directory: '${resolvedPath}' (from item path '${rawDirPath}')`;
      if (sendSseMessage) sendSseMessage('log_entry', { message: logMsg });
      if (overallExecutionLog) overallExecutionLog.push(logMsg);
      console.log(logMsg);

      // fsAgent.createDirectory expects paths relative to WORKSPACE_DIR or absolute.
      // `resolvedPath` here is constructed to be relative to WORKSPACE_DIR because `targetBaseDir` is.
      const result = fsAgent.createDirectory(resolvedPath, {
        requireConfirmation: false,
        isConfirmedAction: true, // Assuming pre-approved for scaffolding
      });

      if (!result.success) {
        const errorDetail = result.message || 'Unknown error from fsAgent.createDirectory.';
        const errorMsg = `${logPrefix} Failed to create directory '${resolvedPath}'. Reason: ${errorDetail}`;
        console.error(errorMsg, result);
        if (sendSseMessage) sendSseMessage('error', { content: errorMsg });
        if (overallExecutionLog) overallExecutionLog.push(`ERROR: ${errorMsg}`);
        return { success: false, error: errorMsg, createdDirectories };
      }

      const successMsg = `${logPrefix} Successfully created directory: '${result.fullPath}'`;
      if (sendSseMessage) sendSseMessage('log_entry', { message: successMsg });
      if (overallExecutionLog) overallExecutionLog.push(successMsg);
      console.log(successMsg);
      createdDirectories.push(result.fullPath);
    }
    // Other item types will be handled by different functions.
  }

  const finalSuccessMsg = `${logPrefix} All 'createDirectory' operations completed successfully. ${createdDirectories.length} directories processed/created.`;
  if (sendSseMessage) sendSseMessage('log_entry', { message: finalSuccessMsg });
  if (overallExecutionLog) overallExecutionLog.push(finalSuccessMsg);
  console.log(finalSuccessMsg);

  return { success: true, createdDirectories };
}


/**
 * Iterates through scaffolding items and creates files with static or LLM-generated content.
 *
 * @param {Array<object>} scaffoldingItems - Array of scaffolding operations from codeGenPlan.scaffolding.
 * @param {string} targetBaseDir - The root directory where generation should occur.
 * @param {string} moduleName - The name of the module being generated.
 * @param {object} fullCodeGenPlan - The entire codeGenPlan object, for context in prompts.
 * @param {function} llmGenerator - Async LLM utility.
 * @param {function} sendSseMessage - Function to send Server-Sent Events for logging.
 * @param {Array<string>} overallExecutionLog - Array to push server-side log messages to.
 * @param {object} [taskContext] - Optional task context for storing outputs (if output_id is specified).
 * @returns {Promise<object>} - Resolves to an object:
 *                            { success: true, createdFiles: Array<object> } // {path, source}
 *                            { success: false, error: string, createdFiles: Array<object> }
 */
async function createFilesFromPlan(
    scaffoldingItems,
    targetBaseDir,
    moduleName,
    fullCodeGenPlan,
    llmGenerator,
    sendSseMessage,
    overallExecutionLog,
    taskContext // Optional: for storing outputs if item.details.output_id is used
) {
  const createdFiles = [];
  const logPrefix = '[CodeGenerator.createFilesFromPlan]';
  const modelPreference = fullCodeGenPlan.modelPreference || 'phi3'; // Default model for generic content

  for (const item of scaffoldingItems) {
    let fileContent = null;
    let contentSource = 'unknown';
    let resolvedFilePath; // Will be determined based on item type and details

    // Skip if not a file creation type or if essential path info is missing
    if (!['createFile', 'createComponent', 'createService', 'genericCodeGen'].includes(item.type)) {
      continue;
    }
    if (!item.details) {
      sendSseMessage('warning', { content: `${logPrefix} Item type ${item.type} is missing 'details'. Skipping. Item: ${JSON.stringify(item)}` });
      continue;
    }

    // Determine file path based on item type
    let itemFilePath = item.details.filePath; // For createFile
    if (item.type === 'createComponent' && item.details.componentSpec) {
        itemFilePath = item.details.componentSpec.filePathSuggestion;
    } else if (item.type === 'createService' && item.details.serviceSpec) {
        itemFilePath = item.details.serviceSpec.filePathSuggestion;
    } else if (item.type === 'genericCodeGen' && item.details.filePathSuggestion) {
        itemFilePath = item.details.filePathSuggestion;
    }

    if (!itemFilePath || typeof itemFilePath !== 'string') {
      const pathErrorMsg = `${logPrefix} No valid filePath or filePathSuggestion found for item type '${item.type}'. Purpose: '${item.purpose || 'N/A'}'. Skipping.`;
      sendSseMessage('warning', { content: pathErrorMsg });
      overallExecutionLog.push(`WARN: ${pathErrorMsg}`);
      console.warn(pathErrorMsg, item);
      continue;
    }

    resolvedFilePath = path.join(targetBaseDir, itemFilePath.replace(/\{\{moduleName\}\}/g, moduleName));

    const fileLogPrefix = `${logPrefix} File: '${resolvedFilePath}' (Type: ${item.type})`;

    sendSseMessage('log_entry', { message: `${fileLogPrefix} Preparing to generate content.` });

    try {
      if (item.type === 'createFile') {
        if (item.details.content && typeof item.details.content === 'string') {
          fileContent = item.details.content;
          contentSource = 'static';
        } else if (item.details.content && typeof item.details.content.prompt === 'string') { // ContentPromptDetail
          const promptDetail = item.details.content;
          sendSseMessage('log_entry', { message: `${fileLogPrefix} Using contentPrompt: "${promptDetail.prompt.substring(0, 70)}..."` });
          fileContent = await llmGenerator(promptDetail.prompt, promptDetail.model || modelPreference, null);
          contentSource = 'contentPrompt (from createFile)';
          if (fileContent && fileContent.startsWith('// LLM_ERROR:')) { // Check for LLM error
            sendSseMessage('error', { content: `${fileLogPrefix} LLM error for contentPrompt: ${fileContent}` });
            overallExecutionLog.push(`ERROR: ${fileLogPrefix} LLM error for contentPrompt: ${fileContent}`);
            fileContent = `// LLM generation failed for this file. Error: ${fileContent}`; // Keep placeholder
          }
        } else {
          sendSseMessage('warning', { content: `${fileLogPrefix} 'createFile' has no static 'content' string or valid 'content.prompt'. Creating empty file.` });
          fileContent = `// No content specified for ${resolvedFilePath}`;
          contentSource = 'placeholder (empty)';
        }
      } else if (item.type === 'createComponent' && item.details.componentSpec) {
        fileContent = await generateContentFromSpec('componentSpec', item.details.componentSpec, item.details, moduleName, fullCodeGenPlan, llmGenerator, sendSseMessage);
        contentSource = 'componentSpec';
        if (fileContent && fileContent.startsWith('// Error')) { // Check for error from generateContentFromSpec
             sendSseMessage('error', { content: `${fileLogPrefix} Error generating component: ${fileContent.substring(0,100)}...` });
        }
      } else if (item.type === 'createService' && item.details.serviceSpec) {
        fileContent = await generateContentFromSpec('serviceSpec', item.details.serviceSpec, item.details, moduleName, fullCodeGenPlan, llmGenerator, sendSseMessage);
        contentSource = 'serviceSpec';
         if (fileContent && fileContent.startsWith('// Error')) { // Check for error from generateContentFromSpec
             sendSseMessage('error', { content: `${fileLogPrefix} Error generating service: ${fileContent.substring(0,100)}...` });
        }
      } else if (item.type === 'genericCodeGen' && item.details.prompt) {
        sendSseMessage('log_entry', { message: `${fileLogPrefix} Using genericCodeGen prompt: "${item.details.prompt.substring(0, 70)}..."` });
        fileContent = await llmGenerator(item.details.prompt, item.details.model || modelPreference, null);
        contentSource = 'genericCodeGen';
        if (fileContent && fileContent.startsWith('// LLM_ERROR:')) { // Check for LLM error
          sendSseMessage('error', { content: `${fileLogPrefix} LLM error for genericCodeGen: ${fileContent}` });
          overallExecutionLog.push(`ERROR: ${fileLogPrefix} LLM error for genericCodeGen: ${fileContent}`);
          fileContent = `// LLM generation failed for this file. Error: ${fileContent}`; // Keep placeholder
        }
      } else {
        const skipMsg = `${fileLogPrefix} Skipped due to unrecognized type or missing details for file content generation.`;
        sendSseMessage('warning', { content: skipMsg });
        overallExecutionLog.push(`WARN: ${skipMsg}`);
        console.warn(skipMsg, item);
        continue; // Skip to next item
      }

      if (fileContent !== null && !fileContent.startsWith('// Error') && !fileContent.startsWith('// LLM_ERROR')) {
        const createFileMessage = `${fileLogPrefix} Creating file with content from '${contentSource}'. Length: ${fileContent.length}`;
        sendSseMessage('log_entry', { message: createFileMessage });
        overallExecutionLog.push(createFileMessage);
        console.log(createFileMessage);

        const result = fsAgent.createFile(resolvedFilePath, fileContent, {
          requireConfirmation: false,
          isConfirmedAction: true, // Scaffolding operations are pre-approved
        });

        if (!result.success) {
          const errorDetail = result.message || 'Unknown error from fsAgent.createFile.';
          const errorMsg = `${fileLogPrefix} Failed to create file. Reason: ${errorDetail}`;
          sendSseMessage('error', { content: errorMsg });
          overallExecutionLog.push(`ERROR: ${errorMsg}`);
          console.error(errorMsg, result);
          return { success: false, error: errorMsg, createdFiles };
        }

        const successMsg = `${fileLogPrefix} Successfully created file from source '${contentSource}'. Path: ${result.fullPath}`;
        sendSseMessage('file_written', { path: result.fullPath, source: contentSource, message: successMsg });
        overallExecutionLog.push(successMsg);
        console.log(successMsg);
        createdFiles.push({ path: result.fullPath, source: contentSource });

        if (item.details.output_id && taskContext && taskContext.outputs) {
          taskContext.outputs[item.details.output_id] = fileContent;
          const contextMsg = `${fileLogPrefix} Stored generated content in taskContext.outputs['${item.details.output_id}']`;
          sendSseMessage('log_entry', { message: contextMsg });
          overallExecutionLog.push(contextMsg);
        }
      } else {
        const contentGenFailureMsg = `${fileLogPrefix} Content generation failed or resulted in an error state. Source: '${contentSource}'. File not written.`;
        sendSseMessage('error', { content: contentGenFailureMsg });
        overallExecutionLog.push(`ERROR: ${contentGenFailureMsg}`);
        console.error(contentGenFailureMsg, "Generated content was:", fileContent ? fileContent.substring(0, 200) + "..." : "null");
        // Decide if this should be a hard stop or allow other files to be created.
        // For now, let's make it a hard stop if content generation was attempted but failed critically.
        if(contentSource !== 'placeholder (empty)' && contentSource !== 'unknown' && (fileContent === null || fileContent.startsWith('// Error') || fileContent.startsWith('// LLM_ERROR'))) {
            return { success: false, error: contentGenFailureMsg, createdFiles };
        }
      }
    } catch (error) {
      const generalErrorMsg = `${fileLogPrefix} An unexpected error occurred during file processing: ${error.message}`;
      sendSseMessage('error', { content: generalErrorMsg });
      overallExecutionLog.push(`ERROR: ${generalErrorMsg}`);
      console.error(generalErrorMsg, error);
      return { success: false, error: generalErrorMsg, createdFiles };
    }
  } // End of for loop

  const finalSuccessMsg = `${logPrefix} All specified file creation operations completed. ${createdFiles.length} files processed/created.`;
  if (sendSseMessage) sendSseMessage('log_entry', { message: finalSuccessMsg });
  if (overallExecutionLog) overallExecutionLog.push(finalSuccessMsg);
  console.log(finalSuccessMsg);

  return { success: true, createdFiles };
}


module.exports = {
  scaffoldDirectories,
  generateContentFromSpec,
  createFilesFromPlan,
};

// --- Barrel File Creation (Helper - May be superseded by LLM generating content directly) ---
/**
 * Creates or updates an index.js (or index.ts) barrel file.
 * For now, it overwrites the file with new export statements.
 *
 * @param {string} barrelFilePath - Full path to the index.js/ts file.
 * @param {Array<object>} itemsToExport - Array of objects, each with `name` and `filePath` (relative path from barrel file to the item).
 * @param {string} itemType - e.g., "component" or "service" (currently not used for specific syntax, but could be).
 * @param {function} sendSseMessage - For logging.
 * @param {Array<string>} overallExecutionLog - For server-side logging.
 * @returns {Promise<object>} - { success: boolean, error?: string, filePath?: string }
 */
async function createBarrelFile(barrelFilePath, itemsToExport, itemType, sendSseMessage, overallExecutionLog) {
  const logPrefix = `[CodeGenerator.createBarrelFile: ${barrelFilePath}]`;

  if (!barrelFilePath || !Array.isArray(itemsToExport)) {
    const errorMsg = `${logPrefix} Invalid parameters. barrelFilePath and itemsToExport (array) are required.`;
    if (sendSseMessage) sendSseMessage('error', { content: errorMsg });
    if (overallExecutionLog) overallExecutionLog.push(`ERROR: ${errorMsg}`);
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  if (itemsToExport.length === 0) {
    const warnMsg = `${logPrefix} No items provided to export. Barrel file will be empty or not created if it doesn't exist.`;
    if (sendSseMessage) sendSseMessage('warning', { content: warnMsg });
    if (overallExecutionLog) overallExecutionLog.push(`WARN: ${warnMsg}`);
    console.warn(warnMsg);
    // Optionally create an empty file or a file with a comment
    // For now, let's just return success as there's nothing to do.
    return { success: true, filePath: barrelFilePath, message: "No items to export, barrel file creation skipped or left empty." };
  }

  let barrelContent = `// Auto-generated barrel file by Roadrunner Code Generator (${new Date().toISOString()})\n`;
  barrelContent += `// Purpose: Conveniently re-export ${itemType}s from this directory.\n\n`;

  for (const item of itemsToExport) {
    if (!item.name || !item.filePath) {
      const itemErrorMsg = `${logPrefix} Skipping item due to missing 'name' or 'filePath': ${JSON.stringify(item)}`;
      if (sendSseMessage) sendSseMessage('warning', { content: itemErrorMsg });
      if (overallExecutionLog) overallExecutionLog.push(`WARN: ${itemErrorMsg}`);
      console.warn(itemErrorMsg);
      continue;
    }
    // Ensure filePath is relative and uses POSIX separators for JS imports generally
    const relativePath = item.filePath.startsWith('./') ? item.filePath : `./${item.filePath.replace(/\\/g, '/')}`;
    barrelContent += `export { default as ${item.name} } from '${relativePath}';\n`;
  }

  barrelContent += `\n// End of auto-generated content.\n`;

  const sseMsg = `${logPrefix} Generating content for barrel file. Items: ${itemsToExport.length}.`;
  if (sendSseMessage) sendSseMessage('log_entry', { message: sseMsg });
  if (overallExecutionLog) overallExecutionLog.push(sseMsg);
  console.log(sseMsg);

  const result = fsAgent.createFile(barrelFilePath, barrelContent, {
    requireConfirmation: false,
    isConfirmedAction: true, // Scaffolding operation
  });

  if (!result.success) {
    const errorDetail = result.message || 'Unknown error from fsAgent.createFile.';
    const errorMsg = `${logPrefix} Failed to create barrel file. Reason: ${errorDetail}`;
    if (sendSseMessage) sendSseMessage('error', { content: errorMsg });
    if (overallExecutionLog) overallExecutionLog.push(`ERROR: ${errorMsg}`);
    console.error(errorMsg, result);
    return { success: false, error: errorMsg };
  }

  const successMsg = `${logPrefix} Successfully created/updated barrel file. Path: ${result.fullPath}`;
  if (sendSseMessage) sendSseMessage('file_written', { path: result.fullPath, source: 'barrel-generator', message: successMsg });
  if (overallExecutionLog) overallExecutionLog.push(successMsg);
  console.log(successMsg);
  return { success: true, filePath: result.fullPath };
}


// --- Registration Instructions File Generation ---
/**
 * Creates a REGISTRATION_INSTRUCTIONS.md file based on hints from the codeGenPlan.
 *
 * @param {Array<object>} registrationHints - Array from codeGenPlan.registrationHints.
 * @param {string} targetBaseDir - The root directory where the module is being generated.
 * @param {string} moduleName - The name of the module.
 * @param {function} sendSseMessage - For SSE logging.
 * @param {Array<string>} overallExecutionLog - For server-side logging.
 * @returns {Promise<object>} - { success: boolean, filePath?: string, error?: string }
 */
async function generateRegistrationInstructionsFile(registrationHints, targetBaseDir, moduleName, sendSseMessage, overallExecutionLog) {
  const logPrefix = '[CodeGenerator.generateRegistrationInstructionsFile]';

  if (!registrationHints || registrationHints.length === 0) {
    const noHintsMsg = `${logPrefix} No registration hints provided. Skipping creation of instructions file.`;
    if (sendSseMessage) sendSseMessage('log_entry', { message: noHintsMsg });
    if (overallExecutionLog) overallExecutionLog.push(noHintsMsg);
    console.log(noHintsMsg);
    return { success: true, message: "No registration hints to process." };
  }

  let markdownContent = `# Registration Instructions for Module: ${moduleName}\n\n`;
  markdownContent += `This file provides hints for manually registering the generated components, routes, stores, etc., into your existing project.\n`;
  markdownContent += `Please review and adapt these snippets according to your project's specific structure and conventions.\n`;
  markdownContent += `The placeholder '{{moduleName}}' should be replaced with '${moduleName}' if not already done by the generation process.\n\n`;
  markdownContent += `Date Generated: ${new Date().toISOString()}\n\n`;
  markdownContent += `--- \n\n`;


  for (const hint of registrationHints) {
    if (!hint.type || !hint.targetFileHint || !hint.importStatement || !hint.registrationCode) {
      const skipMsg = `${logPrefix} Skipping invalid registration hint (missing required fields): ${JSON.stringify(hint)}`;
      if (sendSseMessage) sendSseMessage('warning', { content: skipMsg });
      if (overallExecutionLog) overallExecutionLog.push(`WARN: ${skipMsg}`);
      console.warn(skipMsg);
      continue;
    }

    const typeDisplay = hint.type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // "vueRoute" -> "Vue Route"

    markdownContent += `## Register ${typeDisplay}\n\n`;
    markdownContent += `**Description:** ${hint.notes || 'No specific notes provided.'}\n\n`;
    markdownContent += `**Suggested Target File:** \`${hint.targetFileHint}\`\n\n`;

    markdownContent += `**1. Import Statement:**\n`;
    markdownContent += "```javascript\n";
    markdownContent += `${hint.importStatement.replace(/\{\{moduleName\}\}/g, moduleName)}\n`;
    markdownContent += "```\n\n";

    markdownContent += `**2. Registration Code:**\n`;
    markdownContent += "```javascript\n";
    markdownContent += `${hint.registrationCode.replace(/\{\{moduleName\}\}/g, moduleName)}\n`;
    markdownContent += "```\n\n";

    if(hint.notes) {
        markdownContent += `**Additional Notes from Planner:**\n`;
        markdownContent += `${hint.notes}\n\n`;
    }
    markdownContent += `--- \n\n`;
  }

  const instructionsFilePath = path.join(targetBaseDir, moduleName, 'REGISTRATION_INSTRUCTIONS.md');

  const sseMsg = `${logPrefix} Generating registration instructions file at: '${instructionsFilePath}'`;
  if (sendSseMessage) sendSseMessage('log_entry', { message: sseMsg });
  if (overallExecutionLog) overallExecutionLog.push(sseMsg);
  console.log(sseMsg);

  const result = fsAgent.createFile(instructionsFilePath, markdownContent, {
    requireConfirmation: false,
    isConfirmedAction: true, // Scaffolding operation
  });

  if (!result.success) {
    const errorDetail = result.message || 'Unknown error from fsAgent.createFile.';
    const errorMsg = `${logPrefix} Failed to create registration instructions file '${instructionsFilePath}'. Reason: ${errorDetail}`;
    if (sendSseMessage) sendSseMessage('error', { content: errorMsg });
    if (overallExecutionLog) overallExecutionLog.push(`ERROR: ${errorMsg}`);
    console.error(errorMsg, result);
    return { success: false, error: errorMsg };
  }

  const successMsg = `${logPrefix} Successfully created registration instructions file. Path: ${result.fullPath}`;
  if (sendSseMessage) sendSseMessage('file_written', { path: result.fullPath, source: 'registration-hints-generator', message: successMsg });
  if (overallExecutionLog) overallExecutionLog.push(successMsg);
  console.log(successMsg);
  return { success: true, filePath: result.fullPath };
}


module.exports = {
  scaffoldDirectories,
  generateContentFromSpec,
  createFilesFromPlan,
  createBarrelFile, // Exporting even if used indirectly or for future
  generateRegistrationInstructionsFile,
};
