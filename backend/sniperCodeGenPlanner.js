// backend/sniperCodeGenPlanner.js

/**
 * @typedef {object} ContentPromptDetail
 * @property {string} prompt - LLM prompt to generate content for this file.
 * @property {string} [output_id] - Optional ID to store the generated content in taskContext.outputs.
 */

/**
 * @typedef {object} ComponentSpecDetail
 * @property {string} componentName - Name of the component (e.g., "UserProfile", "OrderForm").
 * @property {string} [purpose] - Brief description of the component's purpose.
 * @property {string[]} [inputs] - List of input properties or data it expects.
 * @property {string[]} [outputs] - List of events or data it emits.
 * @property {string} [filePathSuggestion] - Suggested file path (e.g., "components/UserProfile.vue"). The LLM should generate this.
 * @property {string} prompt - LLM prompt to generate the component code.
 * @property {string} [output_id] - Optional ID to store the generated code in taskContext.outputs.
 */

/**
 * @typedef {object} ServiceSpecDetail
 * @property {string} serviceName - Name of the service (e.g., "AuthService", "ProductAPI").
 * @property {string} [purpose] - Brief description of the service's purpose.
 * @property {object[]} methods - Array of method definitions.
 * @property {string} methods[].methodName - Name of the method.
 * @property {string} methods[].description - Description of what the method does, its parameters, and what it returns.
 * @property {string} [filePathSuggestion] - Suggested file path (e.g., "services/AuthService.js"). The LLM should generate this.
 * @property {string} prompt - LLM prompt to generate the service code.
 * @property {string} [output_id] - Optional ID to store the generated code in taskContext.outputs.
 */

/**
 * @typedef {object} ScaffoldingItem
 * @property {'createDirectory'|'createFile'|'createComponent'|'createService'|'genericCodeGen'} type - Type of scaffolding operation.
 * @property {object} details - Details specific to the type.
 * @property {string} [details.path] - Path for 'createDirectory' or 'createFile'.
 * @property {string|ContentPromptDetail} [details.content] - Static content for 'createFile' or a prompt object.
 * @property {ComponentSpecDetail} [details.componentSpec] - Specification for 'createComponent'.
 * @property {ServiceSpecDetail} [details.serviceSpec] - Specification for 'createService'.
 * @property {string} [details.description] - Description for 'genericCodeGen'.
 * @property {string} [details.prompt] - LLM Prompt for 'genericCodeGen'.
 * @property {string} [details.filePathSuggestion] - Suggested output file path for 'genericCodeGen'.
 * @property {string} [details.output_id] - Optional ID for 'genericCodeGen' output.
 * @property {string} [purpose] - General purpose of this scaffolding step, aiding understanding.
 */

/**
 * @typedef {object} CodeGenPlan
 * @property {string} targetBaseDir - The base directory for generated code, relative to the workspace root (e.g., "src/", "packages/my-module/").
 * @property {string} moduleName - A descriptive name for the module or feature being generated (e.g., "UserAuthentication", "ProductManagement").
 * @property {string} [overallGoal] - The high-level goal extracted from the sniper.md, used to guide the LLM.
 * @property {ScaffoldingItem[]} scaffolding - An array of scaffolding items detailing file/directory operations and code generation tasks.
 * @property {object} [dependencies] - Optional object listing potential external libraries or packages.
 * @property {string[]} [dependencies.npm] - Array of npm package names.
 * @property {string} [generationNotes] - Any general notes from the LLM about the generation plan.
 * @property {Array<object>} [registrationHints] - Optional array of hints for manual registration steps.
 * @property {string} registrationHints[].type - e.g., "vueRoute", "vuexModule", "piniaStore", "globalComponent", "cssImport".
 * @property {string} registrationHints[].targetFileHint - Suggested file user needs to modify (e.g., "src/router/index.js").
 * @property {string} registrationHints[].importStatement - Example import statement (e.g., "import MyNewView from './modules/{{moduleName}}/views/MyNewView.vue';").
 * @property {string} registrationHints[].registrationCode - Example code for registration (e.g., "{ path: '/{{moduleName}}', name: '{{moduleName}}View', component: MyNewView }").
 * @property {string} registrationHints[].notes - Additional notes for the user.
 */

/**
 * Defines the target schema for the codeGenPlan.
 * This is used for documentation and potentially for validation structure.
 * @type {CodeGenPlan}
 */
const TARGET_CODE_GEN_SCHEMA_FOR_REFERENCE = {
  targetBaseDir: "src/",
  moduleName: "ExampleModule",
  overallGoal: "Create a module that does X, Y, and Z.",
  scaffolding: [
    {
      type: "createDirectory",
      details: { path: "components/" },
      purpose: "Create a directory for UI components."
    },
    {
      type: "createFile",
      details: {
        path: "components/index.js",
        content: "// Auto-generated index file for components"
      },
      purpose: "Create an index file for easy component imports."
    },
    {
      type: "createComponent",
      details: {
        componentSpec: {
          componentName: "MyButton",
          purpose: "A reusable button component.",
          inputs: ["label: string", "type: 'primary' | 'secondary'"],
          outputs: ["click: Event"],
          filePathSuggestion: "components/MyButton.vue",
          prompt: "Generate a Vue.js SFC for a button component with props 'label' and 'type', and emits a 'click' event. Use Tailwind CSS for styling.",
          output_id: "my_button_code"
        }
      },
      purpose: "Generate the MyButton component."
    },
    {
      type: "createService",
      details: {
        serviceSpec: {
          serviceName: "DataService",
          purpose: "Handles fetching and posting data.",
          methods: [
            { methodName: "fetchData", description: "Fetches data from /api/data. Takes an ID, returns a Promise." },
            { methodName: "postData", description: "Posts data to /api/submit. Takes data object, returns a Promise." }
          ],
          filePathSuggestion: "services/DataService.js",
          prompt: "Generate a JavaScript class DataService with methods fetchData(id) and postData(data). Use native fetch.",
          output_id: "data_service_code"
        }
      },
      purpose: "Generate the DataService."
    },
    {
      type: "createFile",
      details: {
        path: "utils/helpers.js",
        content: { // ContentPromptDetail
          prompt: "Generate a JavaScript utility function called 'isEmpty(value)' that returns true if a value is null, undefined, an empty string, an empty array, or an empty object. Otherwise, it returns false.",
          output_id: "helpers_is_empty_code"
        }
      },
      purpose: "Generate a helper utility file with an isEmpty function."
    },
    {
        type: "genericCodeGen",
        details: {
            description: "Generate a set of Jest unit tests for the 'isEmpty' utility function.",
            prompt: "Given the utility function: async function isEmpty(value) { /* ... implementation ... */ }, generate 3-5 comprehensive Jest unit tests. Ensure to cover edge cases like null, undefined, empty string, empty array, empty object, non-empty values, etc. Output only the test code.",
            filePathSuggestion: "tests/unit/helpers.spec.js",
            output_id: "helpers_tests_code"
        },
        purpose: "Generate unit tests for the helper utility."
    }
  ],
  dependencies: {
    npm: ["vue", "tailwindcss"]
  },
  generationNotes: "The plan focuses on Vue.js components and standard JavaScript services. Ensure Tailwind CSS is set up.",
  registrationHints: [
    {
      type: "vueRoute",
      targetFileHint: "src/router/index.js",
      importStatement: "import {{moduleName}}Routes from './modules/{{moduleName}}/routes';", // Assuming barrel file for routes
      registrationCode: "...existingRoutes, ...{{moduleName}}Routes",
      notes: "Ensure {{moduleName}}Routes are correctly defined and exported from the module's route file."
    },
    {
      type: "cssImport",
      targetFileHint: "src/main.js", // Or a global CSS file
      importStatement: "import './modules/{{moduleName}}/assets/main.css';",
      registrationCode: "// No specific registration code, just the import.",
      notes: "Ensure the CSS file path is correct and it contains relevant styles for the module."
    }
  ]
};


/**
 * Validates the LLM-generated plan against the TARGET_CODE_GEN_SCHEMA.
 * @param {object} plan - The parsed JSON plan from the LLM.
 * @returns {{isValid: boolean, errors: string[]}}
 */
function validateCodeGenPlan(plan) {
  const errors = [];
  if (!plan) {
    errors.push("Plan is null or undefined.");
    return { isValid: false, errors };
  }

  if (typeof plan.targetBaseDir !== 'string' || !plan.targetBaseDir.trim()) {
    errors.push("targetBaseDir must be a non-empty string.");
  }
  if (typeof plan.moduleName !== 'string' || !plan.moduleName.trim()) {
    errors.push("moduleName must be a non-empty string.");
  }
  if (plan.overallGoal && typeof plan.overallGoal !== 'string') {
    errors.push("overallGoal, if provided, must be a string.");
  }

  if (!Array.isArray(plan.scaffolding)) {
    errors.push("scaffolding must be an array.");
    return { isValid: false, errors }; // Stop further validation if scaffolding is not an array
  }
  if (plan.scaffolding.length === 0) {
    errors.push("scaffolding array must not be empty.");
  }

  plan.scaffolding.forEach((item, index) => {
    const itemPrefix = `Scaffolding item at index ${index}:`;
    if (typeof item !== 'object' || item === null) {
      errors.push(`${itemPrefix} is not an object.`);
      return; // Skip further validation for this item
    }
    if (!item.type || typeof item.type !== 'string') {
      errors.push(`${itemPrefix} 'type' is missing or not a string.`);
    }
    if (typeof item.details !== 'object' || item.details === null) {
      errors.push(`${itemPrefix} 'details' is missing or not an object.`);
    }
    if (item.purpose && typeof item.purpose !== 'string') {
        errors.push(`${itemPrefix} 'purpose', if provided, must be a string.`);
    }

    switch (item.type) {
      case 'createDirectory':
        if (!item.details?.path || typeof item.details.path !== 'string') {
          errors.push(`${itemPrefix} 'createDirectory' must have details.path (string).`);
        }
        break;
      case 'createFile':
        if (!item.details?.path || typeof item.details.path !== 'string') {
          errors.push(`${itemPrefix} 'createFile' must have details.path (string).`);
        }
        if (!item.details?.content && item.details?.content !== "") { // Allow empty string content
          errors.push(`${itemPrefix} 'createFile' must have details.content.`);
        } else if (typeof item.details.content === 'object') { // ContentPromptDetail
          if (!item.details.content.prompt || typeof item.details.content.prompt !== 'string') {
            errors.push(`${itemPrefix} 'createFile' with content object must have details.content.prompt (string).`);
          }
          if (item.details.content.output_id && typeof item.details.content.output_id !== 'string') {
            errors.push(`${itemPrefix} 'createFile' with content object, if output_id is present, it must be a string.`);
          }
        } else if (typeof item.details.content !== 'string') {
             errors.push(`${itemPrefix} 'createFile' details.content must be a string or a ContentPromptDetail object.`);
        }
        break;
      case 'createComponent':
        if (typeof item.details?.componentSpec !== 'object' || item.details.componentSpec === null) {
          errors.push(`${itemPrefix} 'createComponent' must have details.componentSpec (object).`);
        } else {
          const cs = item.details.componentSpec;
          if (!cs.componentName || typeof cs.componentName !== 'string') errors.push(`${itemPrefix} componentSpec.componentName missing or not a string.`);
          if (!cs.prompt || typeof cs.prompt !== 'string') errors.push(`${itemPrefix} componentSpec.prompt missing or not a string.`);
          if (cs.filePathSuggestion && typeof cs.filePathSuggestion !== 'string') errors.push(`${itemPrefix} componentSpec.filePathSuggestion must be a string if provided.`);
        }
        break;
      case 'createService':
        if (typeof item.details?.serviceSpec !== 'object' || item.details.serviceSpec === null) {
          errors.push(`${itemPrefix} 'createService' must have details.serviceSpec (object).`);
        } else {
          const ss = item.details.serviceSpec;
          if (!ss.serviceName || typeof ss.serviceName !== 'string') errors.push(`${itemPrefix} serviceSpec.serviceName missing or not a string.`);
          if (!ss.prompt || typeof ss.prompt !== 'string') errors.push(`${itemPrefix} serviceSpec.prompt missing or not a string.`);
          if (!Array.isArray(ss.methods) || ss.methods.length === 0) errors.push(`${itemPrefix} serviceSpec.methods must be a non-empty array.`);
          else {
            ss.methods.forEach((method, methodIdx) => {
              if (!method.methodName || typeof method.methodName !== 'string') errors.push(`${itemPrefix} serviceSpec.methods[${methodIdx}].methodName missing or not a string.`);
              if (!method.description || typeof method.description !== 'string') errors.push(`${itemPrefix} serviceSpec.methods[${methodIdx}].description missing or not a string.`);
            });
          }
          if (ss.filePathSuggestion && typeof ss.filePathSuggestion !== 'string') errors.push(`${itemPrefix} serviceSpec.filePathSuggestion must be a string if provided.`);
        }
        break;
      case 'genericCodeGen':
        if (!item.details?.prompt || typeof item.details.prompt !== 'string') {
            errors.push(`${itemPrefix} 'genericCodeGen' must have details.prompt (string).`);
        }
        if (item.details.description && typeof item.details.description !== 'string') {
            errors.push(`${itemPrefix} 'genericCodeGen' details.description, if provided, must be a string.`);
        }
        if (item.details.filePathSuggestion && typeof item.details.filePathSuggestion !== 'string') {
            errors.push(`${itemPrefix} 'genericCodeGen' details.filePathSuggestion, if provided, must be a string.`);
        }
        if (item.details.output_id && typeof item.details.output_id !== 'string') {
            errors.push(`${itemPrefix} 'genericCodeGen' details.output_id, if provided, must be a string.`);
        }
        break;
      default:
        errors.push(`${itemPrefix} Unknown type '${item.type}'.`);
    }
  });

  if (plan.dependencies) {
    if (typeof plan.dependencies !== 'object' || plan.dependencies === null) {
      errors.push("dependencies, if provided, must be an object.");
    } else if (plan.dependencies.npm && !Array.isArray(plan.dependencies.npm)) {
      errors.push("dependencies.npm, if provided, must be an array of strings.");
    } else if (plan.dependencies.npm) {
      plan.dependencies.npm.forEach((dep, i) => {
        if (typeof dep !== 'string') errors.push(`dependencies.npm[${i}] is not a string.`);
      });
    }
  }
  if (plan.generationNotes && typeof plan.generationNotes !== 'string') {
    errors.push("generationNotes, if provided, must be a string.");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Transforms raw sniper.md content and its basic parse into a detailed codeGenPlan JSON.
 * @param {object} parsedSniperRaw - Output from RoadmapParser.js (or similar initial parse).
 * @param {string} sniperFileContent - Raw content of the .sniper.md file.
 * @param {function} llmGenerator - Async function (like generateFromLocal from server.js) to call the LLM.
 *                                  Signature: async (prompt, modelName, expressRes) => string
 * @returns {Promise<CodeGenPlan>} - Resolves with the validated codeGenPlan or rejects with an error.
 */
async function generateCodeGenPlan(parsedSniperRaw, sniperFileContent, llmGenerator) {
  // Constructing the detailed prompt for the LLM
  const schemaDescription = `
    The target JSON schema for the code generation plan (CodeGenPlan) is as follows:

    {
      "targetBaseDir": "string", // Base directory for generated code (e.g., "src/", "packages/my-module/"). Required.
      "moduleName": "string",    // Descriptive name for the module/feature (e.g., "UserAuthentication"). Required.
      "overallGoal": "string",   // High-level goal from the sniper.md. Optional but recommended.
      "scaffolding": [           // Array of items detailing file/directory operations and code generation. Required, non-empty.
        {
          "type": "'createDirectory'|'createFile'|'createComponent'|'createService'|'genericCodeGen'", // Type of operation. Required.
          "details": { ... },    // Details specific to the type. Required.
          "purpose": "string"    // Explanation of this step's purpose. Optional but recommended.
        }
      ],
      "dependencies": {          // Optional object listing potential external libraries.
        "npm": ["string"]        // Optional array of npm package names.
      },
      "generationNotes": "string", // Optional general notes about the plan.
      "registrationHints": [       // Optional: Array of manual registration steps for the user.
        {
          "type": "string",        // E.g., "vueRoute", "vuexModule", "piniaStore", "globalComponent", "cssImport".
          "targetFileHint": "string",// Suggested file for user to modify (e.g., "src/router/index.js").
          "importStatement": "string", // Example import statement.
          "registrationCode": "string",// Example registration code snippet.
          "notes": "string"        // Additional notes for the user.
        }
      ]
    }

    Details for "scaffolding" items:

    1. type: "createDirectory"
       details: { "path": "string" } // Path for the new directory.

    2. type: "createFile"
       details: {
         "path": "string", // Path for the new file.
         "content": "string" OR { // Static content string OR a prompt object for LLM-generated content.
           "prompt": "string", // LLM prompt to generate file content.
           "output_id": "string" // Optional: ID to store generated content.
         }
       }

    3. type: "createComponent"
       details: {
         "componentSpec": { // Required.
           "componentName": "string", // E.g., "UserProfile". Required.
           "purpose": "string",       // Optional: Brief description.
           "inputs": ["string"],      // Optional: List of input props (e.g., "userId: string").
           "outputs": ["string"],     // Optional: List of events emitted (e.g., "profileUpdated: Event").
           "filePathSuggestion": "string", // Optional: Suggested file path (e.g., "components/UserProfile.vue").
           "prompt": "string",        // LLM prompt to generate component code. Required.
           "output_id": "string"      // Optional: ID to store generated code.
         }
       }

    4. type: "createService"
       details: {
         "serviceSpec": { // Required.
           "serviceName": "string",   // E.g., "AuthService". Required.
           "purpose": "string",       // Optional: Brief description.
           "methods": [               // Array of method definitions. Required.
             {
               "methodName": "string", // Required.
               "description": "string" // Description, params, return value. Required.
             }
           ],
           "filePathSuggestion": "string", // Optional: Suggested file path (e.g., "services/AuthService.js").
           "prompt": "string",        // LLM prompt to generate service code. Required.
           "output_id": "string"      // Optional: ID to store generated code.
         }
       }

    5. type: "genericCodeGen"
       details: {
         "description": "string", // Optional: Description of what code to generate.
         "prompt": "string",        // LLM prompt for the code generation. Required.
         "filePathSuggestion": "string", // Optional: Suggested file path for the generated code.
         "output_id": "string"      // Optional: ID to store generated code.
       }
    Ensure all file paths suggested are relative to the "targetBaseDir" that you also define.
    If suggesting file paths, try to follow common conventions for the likely language/framework implied by the sniper.md.
    The "overallGoal" should be a concise summary of the sniper.md's main objective.
    For "createComponent" and "createService", the "filePathSuggestion" is important.
    The "prompt" fields within componentSpec, serviceSpec, genericCodeGen, or file content objects should be detailed enough for another LLM to generate high-quality code/content.
  `;

  const prompt = `
    You are an expert software engineering assistant. Your task is to analyze the provided "sniper.md" file content and its pre-parsed summary, then transform this information into a structured JSON "CodeGenPlan" object.
    This CodeGenPlan will be used by other automated tools to scaffold directories and generate code.

    ${schemaDescription}

    Here is the content of the "sniper.md" file:
    ---BEGIN SNIPER.MD CONTENT---
    ${sniperFileContent}
    ---END SNIPER.MD CONTENT---

    Here is a pre-parsed summary of the "sniper.md" file (this might contain module names, features, or other relevant structured data):
    ---BEGIN PRE-PARSED SUMMARY---
    ${JSON.stringify(parsedSniperRaw, null, 2)}
    ---END PRE-PARSED SUMMARY---

    Based on all the provided information, generate the CodeGenPlan JSON object.
    Pay close attention to extracting entities that should become components or services.
    Define clear "filePathSuggestion" for them.
    Create detailed "prompt" fields for code generation.
    The "targetBaseDir" should be a sensible default like "src/" or based on common project structures if implied by the sniper.md.
    The "moduleName" should be derived from the sniper.md title or its main subject.
    The "overallGoal" should be a concise summary of the sniper.md's main objective.
    Ensure the "scaffolding" array is comprehensive and logically ordered.

    **Barrel Files (index.js):**
    If you generate multiple files of the same type within a subdirectory (e.g., several components in "components/", services in "services/"), you MUST also include a "createFile" step in the "scaffolding" array for an "index.js" (or "index.ts" if appropriate) barrel file in that subdirectory.
    The content for this barrel file should export all items from that directory. You can generate this content directly (as "staticContent") or provide a "contentPrompt" for it.
    Example for "components/index.js":
    {
      "type": "createFile",
      "details": {
        "path": "{{moduleName}}/components/index.js", // Assuming moduleName is part of the path
        "content": "export { default as MyComponent1 } from './MyComponent1.vue';\nexport { default as MyComponent2 } from './MyComponent2.vue';"
        // Or use a contentPrompt to generate these exports based on other planned files.
      },
      "purpose": "Barrel file for easy component imports."
    }

    **Registration Hints:**
    Analyze the generated files and common project integration points. If new components (especially views/pages for routing), Vuex/Pinia stores, global CSS, or other elements requiring manual registration are planned:
    - Populate the "registrationHints" array.
    - For each hint, provide:
        - "type": A string like "vueRoute", "vuexModule", "piniaStore", "globalComponent", "cssImport".
        - "targetFileHint": A string suggesting the file the user likely needs to modify (e.g., "src/router/index.js", "src/store/index.js", "src/main.js").
        - "importStatement": An example import statement, using placeholders like "{{moduleName}}" and actual generated file names/paths (e.g., "import {{moduleName}}Dashboard from './modules/{{moduleName}}/views/Dashboard.vue';").
        - "registrationCode": An example code snippet for the registration itself (e.g., "{ path: '/{{moduleName}}', name: '{{moduleName}}Home', component: {{moduleName}}Dashboard }").
        - "notes": Any brief, helpful notes for the user regarding this registration.
    Use placeholders like "{{moduleName}}" in the generated snippets where appropriate, as these can be replaced later. Strive to make these hints as actionable as possible.

    Output *only* the JSON object conforming to the target schema. Do not include any other text, explanations, or markdown formatting around the JSON.
  `;

  let llmResponseString;
  try {
    // Use a model known for good JSON output, like 'phi3' or a specialized one if available.
    // expressRes is null as this is an internal backend call not directly streaming to a client.
    llmResponseString = await llmGenerator(prompt, parsedSniperRaw.modelPreference || 'phi3', null);
  } catch (llmError) {
    console.error('[sniperCodeGenPlanner] LLM generation failed for codeGenPlan:', llmError);
    // Consider wrapping the error or re-throwing
    throw new Error(`LLM generation for CodeGenPlan failed: ${llmError.message || llmError}`);
  }

  if (!llmResponseString || llmResponseString.trim() === '') {
    console.error('[sniperCodeGenPlanner] LLM returned an empty response for codeGenPlan.');
    throw new Error('LLM returned an empty or whitespace response for CodeGenPlan.');
  }

  console.log(`[sniperCodeGenPlanner] Raw LLM Response for CodeGenPlan (first 500 chars): ${llmResponseString.substring(0,500)}`);

  let parsedPlan;
  try {
    // Attempt to extract JSON from potential markdown code blocks or other surrounding text
    const jsonMatch = llmResponseString.match(/```json\s*([\s\S]*?)\s*```|(\{\s*[\s\S]*?\s*\})(?![\s\S]*\1)/);
    // The (?![\s\S]*\1) is a negative lookahead to try to match the *last* object,
    // in case the LLM adds some commentary before the final JSON block.

    let jsonString = llmResponseString.trim();
    if (jsonMatch) {
        // Prioritize fenced block (jsonMatch[1]), then a general object match (jsonMatch[2])
        jsonString = jsonMatch[1] || jsonMatch[2];
        console.log('[sniperCodeGenPlanner] Extracted JSON string from LLM response.');
    } else {
        console.log('[sniperCodeGenPlanner] No JSON code block found, attempting to parse the whole response.');
    }
    parsedPlan = JSON.parse(jsonString);
  } catch (parseError) {
    console.error('[sniperCodeGenPlanner] Failed to parse LLM response into JSON for codeGenPlan. Error:', parseError.message);
    console.error('[sniperCodeGenPlanner] Full LLM Response was:\n', llmResponseString);
    throw new Error(`Failed to parse LLM response as JSON for CodeGenPlan. Parse Error: ${parseError.message}. Check server logs for full LLM response.`);
  }

  const validationResult = validateCodeGenPlan(parsedPlan);
  if (!validationResult.isValid) {
    console.error('[sniperCodeGenPlanner] LLM-generated codeGenPlan failed schema validation:', validationResult.errors);
    console.error('[sniperCodeGenPlanner] Invalid Plan Object:', JSON.stringify(parsedPlan, null, 2));
    throw new Error(`Generated CodeGenPlan failed schema validation: ${validationResult.errors.join('; ')}. Check server logs for the invalid plan object.`);
  }

  console.log('[sniperCodeGenPlanner] Successfully generated and validated CodeGenPlan.');
  return parsedPlan;
}

module.exports = {
  generateCodeGenPlan,
  TARGET_CODE_GEN_SCHEMA_FOR_REFERENCE, // Exporting for reference/testing if needed
  validateCodeGenPlan // Exporting for testing
};
