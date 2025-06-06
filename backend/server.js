// --- Global Error Handlers for Backend Stability ---
process.on('uncaughtException', (error, origin) => {
  // Using console.error to ensure it goes to stderr
  console.error(`[Backend CRITICAL] Uncaught Exception at: ${origin}`);
  console.error('[Backend CRITICAL] Error details:', error);
  // It's often recommended to exit after an uncaught exception,
  // as the application state might be corrupt.
  // However, for debugging, we might initially just log.
  // Consider adding process.exit(1) here if stability is preferred over continued (but potentially flawed) execution.
  // fs.writeSync(process.stderr.fd, `Caught exception: ${error}\nException origin: ${origin}`); // Alternative direct stderr write
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Backend CRITICAL] Unhandled Rejection at Promise:', promise);
  console.error('[Backend CRITICAL] Reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});
// --- End Global Error Handlers ---

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os'); // Added
const cors = require('cors');

// ... other requires ...
const { v4: uuidv4 } = require('uuid'); // Ensure uuid is required
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// --- OwlCore, Ollama, Config, Helpers (Assume these are defined as in previous complete versions) ---
async function checkOllamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`); // MODIFIED to use OLLAMA_BASE_URL
    if (response.ok) {
      console.log('[Ollama Status] Ollama is responsive.');
      return true;
    } else {
      console.warn(`[Ollama Status] Ollama check failed. Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`[Ollama Status] Error checking Ollama status: ${error.message}`);
    return false;
  }
}
async function startOllama() {
  // In Docker mode, Ollama is managed by Docker Compose.
  // This function (startOllama) should not attempt to execute "ollama serve".
  console.log(`[Ollama Startup] startOllama called. OLLAMA_BASE_URL is '${OLLAMA_BASE_URL}'. Docker Compose handles Ollama service.`);
  if (OLLAMA_BASE_URL && OLLAMA_BASE_URL.includes('ollama:')) { // Heuristic for Docker env
    console.log('[Ollama Startup] Assuming Docker environment, not running exec command.');
    return Promise.resolve(); // Indicate success without exec
  }
  // Fallback to original behavior if not clearly in Docker or OLLAMA_BASE_URL is localhost
  console.log('[Ollama Startup] Attempting to start Ollama server locally (original behavior)...');

  const { exec } = require('child_process'); // Ensure exec is available
  return new Promise((resolve, reject) => {
    const ollamaProcess = exec('ollama serve', (error, stdout, stderr) => {
      if (error) {
        console.error(`[Ollama Startup] Original exec error: ${error.message}`);
        reject(error);
        return;
      }
      console.log(`[Ollama Startup] Original exec stdout: ${stdout}`);
      if (stderr) {
        console.error(`[Ollama Startup] Original exec stderr: ${stderr}`);
      }
    });
    setTimeout(() => {
      console.log('[Ollama Startup] Assuming ollama serve process started. Resolving after timeout.');
      resolve();
    }, 5000);
  });
}


const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { exec } = require('child_process');

// --- End Ollama Check and Startup ---
const fsAgent = require('./fsAgent');
const gitAgent = require('./gitAgent');
const { resolvePathInWorkspace, generateDirectoryTree } = fsAgent;

// Sandbox Directory Names
const CONFERENCE_SANDBOX_DIR = 'conference_files';
const BRAINSTORMING_SANDBOX_DIR = 'brainstorming_files';

// Allowed File Extensions for Conference/Brainstorming Agents
const ALLOWED_AGENT_FILE_EXTENSIONS = ['.py', '.json', '.js', '.vue', '.css', '.md', '.svg', '.pdf', '.txt', '.sh', '.yaml', '.yml'];


// --- Path Configuration ---
// Specific for backend server settings (LLM provider, API key)
const BACKEND_CONFIG_FILE_PATH = path.join(__dirname, 'config', 'backend_config.json');
const BACKEND_CONFIG_EXAMPLE_PATH = path.join(__dirname, 'config', 'backend_config.example.json');
let backendSettings = {
  llmProvider: null, // e.g., 'ollama', 'openai'
  apiKey: '',        // API key if required by the provider
  // Default Ollama model to use if provider is 'ollama'
  defaultOllamaModel: 'codellama',
};

// Function to load backend settings
function loadBackendConfig() {
  const defaultConfig = { llmProvider: null, apiKey: '', defaultOllamaModel: 'codellama' };
  let settingsSource = 'hardcoded defaults'; // Assume defaults initially

  try {
    console.log(`[Config] Attempting to load backend settings from ${BACKEND_CONFIG_FILE_PATH}`);
    if (fs.existsSync(BACKEND_CONFIG_FILE_PATH)) {
      const configFileContent = fs.readFileSync(BACKEND_CONFIG_FILE_PATH, 'utf-8');
      try {
        backendSettings = JSON.parse(configFileContent);
        settingsSource = `file (${BACKEND_CONFIG_FILE_PATH})`;
        console.log(`[Config] Successfully loaded backend settings from ${BACKEND_CONFIG_FILE_PATH}`);
      } catch (parseError) {
        console.error(`[Config] Failed to parse JSON from ${BACKEND_CONFIG_FILE_PATH}. Error: ${parseError.message}. Falling back...`);
        // Fallback logic continues below
      }
    } else {
      console.log(`[Config] File ${BACKEND_CONFIG_FILE_PATH} not found. Checking for example config.`);
    }

    // If settings were not loaded from main file (either it didn't exist or failed to parse)
    if (settingsSource === 'hardcoded defaults' && fs.existsSync(BACKEND_CONFIG_EXAMPLE_PATH)) {
      console.log(`[Config] Attempting to load backend settings from example ${BACKEND_CONFIG_EXAMPLE_PATH}`);
      const exampleFileContent = fs.readFileSync(BACKEND_CONFIG_EXAMPLE_PATH, 'utf-8');
      try {
        backendSettings = JSON.parse(exampleFileContent);
        settingsSource = `example file (${BACKEND_CONFIG_EXAMPLE_PATH})`;
        console.log(`[Config] Successfully loaded backend settings from example ${BACKEND_CONFIG_EXAMPLE_PATH}.`);
        // Attempt to write the example content to the main config file
        try {
          fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(backendSettings, null, 2), 'utf-8');
          console.log(`[Config] Copied settings from example to ${BACKEND_CONFIG_FILE_PATH}`);
        } catch (writeError) {
          console.error(`[Config] Failed to write settings from example to ${BACKEND_CONFIG_FILE_PATH}. Error: ${writeError.message}`);
        }
      } catch (parseError) {
        console.error(`[Config] Failed to parse JSON from example ${BACKEND_CONFIG_EXAMPLE_PATH}. Error: ${parseError.message}. Falling back to hardcoded defaults.`);
        backendSettings = { ...defaultConfig }; // Ensure it's a fresh copy
        settingsSource = 'hardcoded defaults (example parse failed)';
      }
    } else if (settingsSource === 'hardcoded defaults') { // Main file didn't exist/parse and example also didn't exist
      console.log(`[Config] Neither main config nor example config found or parsed. Using hardcoded defaults.`);
      backendSettings = { ...defaultConfig }; // Ensure it's a fresh copy
      // Attempt to create the default config file
      try {
        fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(backendSettings, null, 2), 'utf-8');
        console.log(`[Config] Created default backend settings file at ${BACKEND_CONFIG_FILE_PATH} with hardcoded defaults.`);
      } catch (writeError) {
        console.error(`[Config] Failed to write hardcoded default settings to ${BACKEND_CONFIG_FILE_PATH}. Error: ${writeError.message}`);
      }
    }
  } catch (error) { // Catch errors from fs.readFileSync or other unexpected issues
    console.error(`[Config] Critical error during backend config loading: ${error.message}. Using hardcoded defaults.`);
    backendSettings = { ...defaultConfig }; // Ensure it's a fresh copy
    settingsSource = 'hardcoded defaults (critical error)';
  }
  // Ensure backendSettings is always a valid object.
  if (typeof backendSettings !== 'object' || backendSettings === null) {
    console.warn(`[Config] backendSettings ended up invalid (type: ${typeof backendSettings}). Resetting to hardcoded defaults.`);
    backendSettings = { ...defaultConfig };
    settingsSource = 'hardcoded defaults (post-load validation)';
  }

  console.log(`[Config] Final backend settings determined. Source: ${settingsSource}. Settings:`, JSON.stringify(backendSettings));
}

// Load backend settings on server startup
loadBackendConfig();

// --- Path Configuration for Workspace, Logs, etc. ---
// NOTE: Both BACKEND_CONFIG_FILE_PATH (used for LLM provider settings, API keys, default models)
// and CONFIG_FILE_PATH (used by getConfiguredPath for logDir, workspaceDir, etc.)
// point to the *same* 'backend_config.json' file.
// This means 'backend_config.json' stores a mix of settings:
// 1. LLM provider configurations (provider, apiKey, defaultOllamaModel) - managed by loadBackendConfig().
// 2. Path configurations (logDir, workspaceDir, componentDir [though componentDir seems unused]) - managed by getConfiguredPath().
// While they use the same file, they are loaded and utilized by different parts of the configuration logic.
const CONFIG_FILE_PATH = path.join(__dirname, 'config', 'backend_config.json');

// Helper function to resolve path, ensuring it's absolute
// If a path is relative, it's resolved from __dirname (i.e., roadrunner/backend)
const resolveConfigPath = (configPath) => {
  if (!path.isAbsolute(configPath)) {
    return path.resolve(__dirname, configPath);
  }
  return configPath;
};

// Load configuration from JSON file
let jsonConfig = {};
if (fs.existsSync(CONFIG_FILE_PATH)) {
  try {
    const configFileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    jsonConfig = JSON.parse(configFileContent);
    console.log(`[Config] Loaded path configuration from ${CONFIG_FILE_PATH}`);
  } catch (error) {
    console.error(`[Config] Error reading or parsing ${CONFIG_FILE_PATH}:`, error);
  }
} else {
  console.log(`[Config] Path configuration file not found at ${CONFIG_FILE_PATH}. Using environment variables or defaults.`);
}

// Get path from environment variable, then JSON config, then default
// isCritical: if true, failure to create the directory will throw an error.
const getConfiguredPath = (envVarName, jsonKey, defaultValue, isDir = true, isCritical = false) => {
  let value;
  let source = ''; // Will be set to 'environment variable', 'JSON config', or 'default'

  let value;
  let source = '';
  let originalRelativePath = null; // For logging if path is resolved

  if (process.env[envVarName]) {
    value = process.env[envVarName];
    source = `environment variable (${envVarName})`;
  } else if (jsonConfig && jsonConfig[jsonKey]) {
    if (typeof jsonConfig[jsonKey] !== 'string') {
      console.warn(`[Config] Value for '${jsonKey}' in JSON config is not a string (type: ${typeof jsonConfig[jsonKey]}), ignoring. Value:`, jsonConfig[jsonKey]);
      // value remains undefined, will proceed to default
    } else {
      value = jsonConfig[jsonKey];
      source = `JSON config (${CONFIG_FILE_PATH} -> ${jsonKey})`;
      if (!path.isAbsolute(value)) {
        originalRelativePath = value; // Store original relative path for logging
      }
      // Paths from JSON config, if relative, are relative to __dirname (backend directory)
      value = resolveConfigPath(value);
    }
  }

  // If value is still undefined (not found in env or valid JSON), use default
  if (value === undefined) {
    value = defaultValue;
    source = `default ('${defaultValue}')`;
    if (!path.isAbsolute(value) && typeof value === 'string') { // Check if default is relative
        originalRelativePath = value;
    }
    // Default paths, if relative, are also relative to __dirname
    value = resolveConfigPath(value);
  }

  if (originalRelativePath && originalRelativePath !== value) {
    console.log(`[Config] Resolved ${jsonKey}: Path '${originalRelativePath}' (from ${source}) resolved to absolute path '${value}'.`);
  } else {
    console.log(`[Config] Resolved ${jsonKey}: Final path is '${value}' (Source: ${source}).`);
  }

  if (isDir && !fs.existsSync(value)) {
    try {
      fs.mkdirSync(value, { recursive: true });
      console.log(`[Config] Created directory for ${jsonKey} at: '${value}' (Original source: ${source})`);
    } catch (err) {
      const errorMessage = `[Config] CRITICAL ERROR: Failed to create directory for ${jsonKey} at '${value}' (Original source: ${source}). Error: ${err.message}`;
      console.error(errorMessage);
      if (isCritical) {
        throw new Error(errorMessage);
      }
      // Fallback for non-critical paths if not already using the default value from the start
      if (defaultValue !== value) { // Check if we weren't already trying the default
        const defaultResolvedPath = resolveConfigPath(defaultValue);
        console.warn(`[Config] Falling back to default for ${jsonKey} due to creation error: '${defaultResolvedPath}'`);
        value = defaultResolvedPath; // Assign resolved default path
        // Source is now 'default (fallback after error)'
        if (!fs.existsSync(value)) {
          try {
            fs.mkdirSync(value, { recursive: true });
            console.log(`[Config] Created fallback directory for ${jsonKey} at: '${value}'`);
          } catch (fallbackErr) {
            const fallbackErrorMessage = `[Config] CRITICAL ERROR: Failed to create even the fallback default directory for ${jsonKey} at '${value}'. Error: ${fallbackErr.message}`;
            console.error(fallbackErrorMessage);
            if (isCritical) {
                throw new Error(fallbackErrorMessage);
            }
          }
        }
      }
    }
  } else if (isDir) {
    console.log(`[Config] Directory for ${jsonKey} already exists at '${value}' (Original source: ${source})`);
  }
  return value;
};


// Load model categories configuration
let modelCategories = { categories: {}, default_category: 'language' }; // Default fallback
const categoriesPath = path.resolve(__dirname, 'config', 'model_categories.json'); // Ensure absolute path for logging
console.log(`[Config] Attempting to load model categories from: ${categoriesPath}`);
try {
  if (fs.existsSync(categoriesPath)) {
    const categoriesFileContent = fs.readFileSync(categoriesPath, 'utf-8');
    modelCategories = JSON.parse(categoriesFileContent);
    console.log(`[Config] Successfully loaded model categories from ${categoriesPath}`);
  } else {
    console.warn(`[Config] model_categories.json not found at ${categoriesPath}. Using default empty categories:`, modelCategories);
    // fs.writeFileSync(categoriesPath, JSON.stringify(modelCategories, null, 2)); // Optionally create default
  }
} catch (error) {
  console.error(`[Config] Error loading or parsing model_categories.json from ${categoriesPath}: ${error.message}. Using default categories.`, modelCategories);
  modelCategories = { categories: {}, default_category: 'language' }; // Ensure it's reset to a valid default
}
console.log("[Config] Final modelCategories:", JSON.stringify(modelCategories).substring(0,200) + "...");


// Load agent persona instructions
let agentInstructions = { global_instructions: [], ollama_specific_instructions: { default: [] }, openai_specific_instructions: { default: [] }, conference_participant_instructions: {} }; // Default
const instructionsPath = path.resolve(__dirname, 'config', 'agent_instructions_template.json'); // Ensure absolute path for logging
console.log(`[Config] Attempting to load agent instructions from: ${instructionsPath}`);
try {
  if (fs.existsSync(instructionsPath)) {
    const instructionsFileContent = fs.readFileSync(instructionsPath, 'utf-8');
    agentInstructions = JSON.parse(instructionsFileContent);
    console.log(`[Config] Successfully loaded agent instructions from ${instructionsPath}`);
  } else {
    console.warn(`[Config] agent_instructions_template.json not found at ${instructionsPath}. Using default empty instructions:`, agentInstructions);
    // Optionally, create a default one if it doesn't exist.
    // fs.writeFileSync(instructionsPath, JSON.stringify(agentInstructions, null, 2));
  }
} catch (error) {
  console.error(`[Config] Error loading or parsing agent_instructions_template.json from ${instructionsPath}: ${error.message}. Using default instructions.`, agentInstructions);
  agentInstructions = { global_instructions: [], ollama_specific_instructions: { default: [] }, openai_specific_instructions: { default: [] }, conference_participant_instructions: {} }; // Ensure reset
}
console.log("[Config] Final agentInstructions (summary):", {
    global_instructions_count: agentInstructions.global_instructions.length,
    ollama_specific_instructions_keys: Object.keys(agentInstructions.ollama_specific_instructions || {}),
    openai_specific_instructions_keys: Object.keys(agentInstructions.openai_specific_instructions || {}),
    conference_participant_instructions_keys: Object.keys(agentInstructions.conference_participant_instructions || {})
});


// Helper function to categorize Ollama models
function categorizeOllamaModels(ollamaModels, config) {
  const categorized = {};
  const knownCategories = Object.keys(config.categories || {});
  knownCategories.forEach(cat => categorized[cat] = []);
  if (config.default_category && !categorized[config.default_category]) {
    categorized[config.default_category] = [];
  }

  ollamaModels.forEach(model => {
    let assignedCategory = null;
    const modelNameLower = model.name.toLowerCase();

    for (const category of knownCategories) {
      const keywords = config.categories[category] || [];
      if (keywords.some(keyword => modelNameLower.includes(keyword.toLowerCase()))) {
        assignedCategory = category;
        break;
      }
    }

    if (assignedCategory) {
      categorized[assignedCategory].push(model);
      console.info(`[Model Categorization] Model '${model.name}' assigned to category '${assignedCategory}'.`);
    } else if (config.default_category) {
      // Ensure the default category list exists
      if (!categorized[config.default_category]) {
        categorized[config.default_category] = [];
      }
      categorized[config.default_category].push(model);
      console.info(`[Model Categorization] Model '${model.name}' assigned to default category '${config.default_category}'.`);
    } else {
      // If no default, maybe have an 'uncategorized' list or log it
      if (!categorized.uncategorized) categorized.uncategorized = [];
      categorized.uncategorized.push(model);
      console.warn(`[Model Categorization] Warning: Model '${model.name}' could not be categorized and 'default_category' is not configured or applicable. Placed in 'uncategorized'.`);
    }
  });
  return categorized;
}

const simpleGit = require('simple-git');

const app = express();

const MAX_PORT_ATTEMPTS = 10;

function attemptToListen(port, attempt = 1) {
  if (attempt > MAX_PORT_ATTEMPTS) {
    console.error(`[Server Startup] Failed to bind to any port after ${MAX_PORT_ATTEMPTS} attempts. Last tried: ${port -1}. Exiting.`);
    if (process.send) {
      process.send({ type: 'backend-error', message: 'Failed to find an available port.' });
    }
    process.exit(1);
    return;
  }

  const serverInstance = app.listen(port, () => {
    console.log(`[Server Startup] Roadrunner backend server listening on port ${port}`);
    console.log(`[Config] Ollama URL target: ${OLLAMA_BASE_URL}`); // OLLAMA_BASE_URL needs to be in scope
    console.log(`[Config] LOG_DIR configured to: ${LOG_DIR}`); // LOG_DIR needs to be in scope
    console.log(`[Config] WORKSPACE_DIR configured to: ${WORKSPACE_DIR}`); // WORKSPACE_DIR needs to be in scope
    console.log(`[Paths] Conferences Log Directory: ${CONFERENCES_LOG_DIR}`); // CONFERENCES_LOG_DIR needs to be in scope

    // Send the actual port being used to the parent process (Electron main)
    if (process.send) {
      process.send({ type: 'backend-port', port: port });
    }
  });

  serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server Startup] Port ${port} is in use. Attempting port ${port + 1} (Attempt ${attempt}/${MAX_PORT_ATTEMPTS})`);
      serverInstance.close(); // Ensure this server instance is closed before trying next
      setTimeout(() => attemptToListen(port + 1, attempt + 1), 100); // Add a small delay
    } else {
      console.error('[Server Startup] Error during server listen:', err);
      if (process.send) {
        process.send({ type: 'backend-error', message: `Server listen error: ${err.message}` });
      }
      process.exit(1); // Exit on other errors
    }
  });
}

// Request Logger Middleware
const requestLogger = (req, res, next) => {
  console.log(`[Request Logger] Received: ${req.method} ${req.url}`);
  next();
};
app.use(requestLogger); // Register the logger middleware

const PORT = process.env.PORT || 3030;

// In-memory store for pending confirmations
// Tasks awaiting user confirmation (e.g., for file operations in safety mode, or batch operations) are stored here.
const pendingConfirmations = {};
const pendingPlanApprovals = {}; // For Autonomous Mode plan approvals
const pendingFailures = {};

// Configuration for "Confirm After X Operations"
// Defines how many modifying operations can occur before a batch confirmation is requested in safety mode.
const CONFIRM_AFTER_N_OPERATIONS = 3;

// --- Configuration ---

// Configure paths using the new system
// For LOG_DIR, isCritical is true. Failure to establish this directory will prevent server startup.
let LOG_DIR;
try {
  LOG_DIR = getConfiguredPath('RR_LOG_DIR', 'logDir', '../logs', true, true);
} catch (error) {
  console.error(`[Config] Fatal Error: Could not establish LOG_DIR. Server cannot start. ${error.message}`);
  process.exit(1); // Exit if critical LOG_DIR cannot be set up.
}

// Workspace Directory Configuration
// Standardized to RR_WORKSPACE_DIR (env) and workspaceDir (JSON)
// This is a critical path. Failure will prevent server startup.
let WORKSPACE_DIR;
const DEFAULT_WORKSPACE_DIR_RAW = '../output'; // Default relative to backend

try {
  WORKSPACE_DIR = getConfiguredPath('RR_WORKSPACE_DIR', 'workspaceDir', DEFAULT_WORKSPACE_DIR_RAW, true, true);
} catch (error) {
  console.error(`[Config] Fatal Error: Could not establish WORKSPACE_DIR. Server cannot start. ${error.message}`);
  process.exit(1); // Exit if critical WORKSPACE_DIR cannot be set up.
}

// CONFERENCES_LOG_DIR is derived from WORKSPACE_DIR.
// It's critical in the sense that if WORKSPACE_DIR was established, this should be too.
// getConfiguredPath handles its creation.
let CONFERENCES_LOG_DIR;
try {
    CONFERENCES_LOG_DIR = getConfiguredPath(
        null, // No dedicated env var for this sub-path
        'conferencesLogDir', // Optional: could be in backend_config.json for this specific sub-directory
        // Default: relative to WORKSPACE_DIR
        (() => { // IIFE to ensure WORKSPACE_DIR is valid before path.join
            if (!WORKSPACE_DIR || typeof WORKSPACE_DIR !== 'string') {
                // This should ideally not happen if WORKSPACE_DIR's getConfiguredPath is called first and is critical.
                // However, this provides an additional safeguard specific to CONFERENCES_LOG_DIR derivation.
                console.error("[Config] CRITICAL: WORKSPACE_DIR is not valid for deriving CONFERENCES_LOG_DIR. This indicates a severe configuration problem.");
                throw new Error("WORKSPACE_DIR is not valid for deriving CONFERENCES_LOG_DIR");
            }
            return path.join(WORKSPACE_DIR, 'roadrunner_workspace');
        })(),
        true, // It's a directory
        true  // Critical: if WORKSPACE_DIR is set, this sub-directory must also be settable/creatable.
    );
} catch (error) {
    console.error(`[Config] Fatal Error: Could not establish CONFERENCES_LOG_DIR. Server cannot start. ${error.message}`);
    process.exit(1);
}
const CONFERENCES_LOG_FILE = path.join(CONFERENCES_LOG_DIR, 'conferences.json');

// Register other middleware after the request logger
app.use(cors());
app.use(express.json());

// Simple health check endpoint for frontend readiness probes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- API for Backend Settings ---
app.get('/api/settings', (req, res) => {
  // Ensure sensitive parts of backendSettings (like full API keys) are not exposed if not needed
  // For now, returning all loaded backend settings.
  // Consider filtering or providing a specific view if frontend only needs parts of it.
  res.json(backendSettings);
});

app.post('/api/settings', (req, res) => {
  const endpointName = '[POST /api/settings]';
  console.log(`${endpointName} Request received. Body:`, req.body);

  const { llmProvider, apiKey, defaultOllamaModel } = req.body;

  // Basic validation: Ensure if keys are provided, they are of expected types (string or null for apiKey)
  // More specific validation (e.g., llmProvider being one of known values) could be added if necessary.
  if (llmProvider !== undefined && typeof llmProvider !== 'string') {
    console.warn(`${endpointName} Invalid llmProvider type: ${typeof llmProvider}. Body:`, req.body);
    return res.status(400).json({ message: 'Invalid llmProvider type. Must be a string if provided.' });
  }
  if (apiKey !== undefined && !(typeof apiKey === 'string' || apiKey === null)) {
    // Allow apiKey to be explicitly set to null to clear it, but otherwise expect string.
    console.warn(`${endpointName} Invalid apiKey type: ${typeof apiKey}. Body:`, req.body);
    return res.status(400).json({ message: 'Invalid apiKey type. Must be a string or null if provided.' });
  }
  if (defaultOllamaModel !== undefined && typeof defaultOllamaModel !== 'string') {
    console.warn(`${endpointName} Invalid defaultOllamaModel type: ${typeof defaultOllamaModel}. Body:`, req.body);
    return res.status(400).json({ message: 'Invalid defaultOllamaModel type. Must be a string if provided.' });
  }

  const newSettings = {
    ...backendSettings, // Preserve existing settings not being updated
  };

  // Update settings if the new values are explicitly provided in the request.
  // The `undefined` check means that if a key is not in req.body, its value in backendSettings remains unchanged.
  // If a key is provided as `null` (e.g. apiKey: null), it will be set to null.
  // If a key is provided as an empty string (e.g. llmProvider: ""), it will be set to an empty string.
  // This behavior seems acceptable based on the audit task description.
  if (llmProvider !== undefined) newSettings.llmProvider = llmProvider;
  if (apiKey !== undefined) newSettings.apiKey = apiKey; // Allows setting to null or empty string
  if (defaultOllamaModel !== undefined) newSettings.defaultOllamaModel = defaultOllamaModel;

  try {
    fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(newSettings, null, 2), 'utf-8');
    backendSettings = newSettings; // Update in-memory settings
    console.log(`[API /api/settings] Backend settings updated and saved to ${BACKEND_CONFIG_FILE_PATH}`);
    res.json({ message: 'Settings updated successfully.', settings: backendSettings });
  } catch (error) {
    console.error(`[API /api/settings] Error saving backend settings:`, error);
    res.status(500).json({ error: 'Failed to save settings.', details: error.message });
  }
});

app.post('/api/config/openai-key', (req, res) => {
  const endpointName = '[POST /api/config/openai-key]';
  const { apiKey } = req.body;

  // Log presence and type of apiKey, not the key itself for security.
  console.log(`${endpointName} Request received. apiKey type: ${typeof apiKey}, apiKey provided: ${apiKey !== undefined}`);

  if (typeof apiKey !== 'string') {
    console.warn(`${endpointName} Received invalid API key format. Type: ${typeof apiKey}. Body:`, req.body);
    return res.status(400).json({ success: false, message: 'Invalid API key format. String expected.' });
  }

  // Optional: Consider if an empty string for apiKey should be disallowed.
  // For now, as per audit, allowing empty string.
  // if (apiKey.trim() === "") {
  //   console.warn(`${endpointName} Received empty API key.`);
  //   return res.status(400).json({ success: false, message: 'API key cannot be an empty string.' });
  // }

  console.log(`${endpointName} Processing request to save OpenAI API Key.`);

  // Create a new settings object to avoid direct mutation issues if backendSettings is complex
  const newSettings = {
    ...backendSettings, // Spread existing settings
    openaiApiKey: apiKey, // Add or update the OpenAI API key
  };

  try {
    // Persist to BACKEND_CONFIG_FILE_PATH
    fs.writeFileSync(BACKEND_CONFIG_FILE_PATH, JSON.stringify(newSettings, null, 2), 'utf-8');
    backendSettings = newSettings; // Update the in-memory settings object

    console.log(`${logPrefix} OpenAI API Key saved successfully.`);
    res.json({ success: true, message: 'OpenAI API Key saved successfully.' });
  } catch (error) {
    console.error(`${logPrefix} Error saving OpenAI API Key to config file:`, error);
    res.status(500).json({ success: false, message: 'Failed to save OpenAI API Key due to a server error.' });
  }
});


// --- LLM Interaction Functions ---

async function generateFromLocal(originalPrompt, modelName, expressRes, options = {}) {
  const provider = backendSettings.llmProvider;
  let accumulatedResponse = '';
  let finalPrompt = originalPrompt;
  const instructionsToApply = [];
  const { agentType, agentRole, speakerContext } = options; // Extract agentType, agentRole, and speakerContext

  // Start with global instructions
  if (agentInstructions.global_instructions && agentInstructions.global_instructions.length > 0) {
    instructionsToApply.push(...agentInstructions.global_instructions);
  }

  // Add provider-specific default instructions
  if (provider === 'openai' && agentInstructions.openai_specific_instructions && agentInstructions.openai_specific_instructions.default) {
    instructionsToApply.push(...agentInstructions.openai_specific_instructions.default);
  } else if (provider !== 'openai' && agentInstructions.ollama_specific_instructions && agentInstructions.ollama_specific_instructions.default) { // Default to ollama if not openai
    instructionsToApply.push(...agentInstructions.ollama_specific_instructions.default);
  }

  // Add agent-specific instructions
  if (agentType === 'coder_agent' && agentInstructions.coder_agent) {
    instructionsToApply.push(...agentInstructions.coder_agent);
  } else if (agentType === 'brainstorming_agent' && agentInstructions.brainstorming_agent) {
    instructionsToApply.push(...agentInstructions.brainstorming_agent);
  } else if (agentType === 'conference_agent' && agentRole && agentInstructions.conference_agent && agentInstructions.conference_agent[agentRole]) {
    instructionsToApply.push(...agentInstructions.conference_agent[agentRole]);
  }
  // Note: The old options.role check for conference_participant_instructions is now covered by agentType/agentRole for conference_agent

  if (instructionsToApply.length > 0) {
    const instructionsString = instructionsToApply.join('\n');
    finalPrompt = `${instructionsString}\n\n---\nUser Prompt:\n${originalPrompt}`;
  }

  console.log(`[LLM Generation] Provider: ${provider || 'ollama (default)'}, Model: ${modelName}, AgentType: ${agentType || 'N/A'}, AgentRole: ${agentRole || 'N/A'}`);
  console.log(`[LLM Generation] Final prompt (first 200 chars): "${finalPrompt.substring(0, 200)}..."`);


  if (provider === 'openai') {
    console.log(`[LLM OpenAI] Initiating for prompt to model ${modelName || 'gpt-3.5-turbo'}: "${finalPrompt.substring(0, 100)}..."`);
    if (!backendSettings.apiKey && !(backendSettings.openaiApiKey)) { // Check both possible key locations
      const errorMessage = 'OpenAI API key is missing in backend settings.';
      console.error(`[LLM OpenAI] ${errorMessage}`);
      if (expressRes && expressRes.writable) {
        expressRes.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
      }
      return `// LLM_ERROR: ${errorMessage} //`;
    }

    const effectiveOpenAIApiKey = backendSettings.apiKey || backendSettings.openaiApiKey; // Prefer generic apiKey, fallback to specific openaiApiKey
    const openAIModel = modelName || backendSettings.defaultOpenAIModel || 'gpt-3.5-turbo';

    try {
      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveOpenAIApiKey}`,
        },
        body: JSON.stringify({
          model: openAIModel,
          messages: [{ role: 'user', content: finalPrompt }], // Use finalPrompt
          stream: true,
        }),
      });

      if (!openAIResponse.ok) {
        const errorBodyText = await openAIResponse.text(); // Get raw text first
        let errorDetails = errorBodyText;
        try {
            const parsedError = JSON.parse(errorBodyText); // Try to parse as JSON
            errorDetails = parsedError.error?.message || JSON.stringify(parsedError);
        } catch (e) {
            // Not JSON, use the raw text, already assigned to errorDetails
        }
        console.error(
          `[LLM OpenAI] Error from OpenAI API: ${openAIResponse.status} ${openAIResponse.statusText}`,
          errorDetails
        );
        const errorMessage = `OpenAI API request failed: ${openAIResponse.status} ${openAIResponse.statusText} - ${errorDetails.substring(0, 100)}`;
        if (expressRes && expressRes.writable) {
          expressRes.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
        }
        return `// LLM_ERROR: ${errorMessage} //`;
      }

      console.log('[LLM OpenAI] Stream started.');
      for await (const chunk of openAIResponse.body) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataJson = line.substring(6);
            if (dataJson.trim() === '[DONE]') {
              console.log('[LLM OpenAI] Stream finished by OpenAI.');
              if (expressRes && expressRes.writable) {
                // Optional: Send a specific 'done' message if your frontend expects it
                // expressRes.write(`data: ${JSON.stringify({ type: 'llm_done' })}\n\n`);
              }
              return accumulatedResponse;
            }
            try {
              const parsed = JSON.parse(dataJson);
              if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const contentChunk = parsed.choices[0].delta.content;
                accumulatedResponse += contentChunk;
                if (expressRes && expressRes.writable) {
                  const ssePayload = { type: 'llm_chunk', content: contentChunk };
                  if (speakerContext) ssePayload.speaker = speakerContext;
                  expressRes.write(`data: ${JSON.stringify(ssePayload)}\n\n`);
                }
              }
            } catch (e) {
              console.warn(`[LLM OpenAI] Error parsing stream chunk: "${dataJson.substring(0,100)}..."`, e.message);
               if (expressRes && expressRes.writable) {
                expressRes.write(
                  `data: ${JSON.stringify({ type: 'log_entry', content: `[LLM Stream Warning] Could not parse OpenAI line: ${dataJson.substring(0,50)}...` })}\n\n`
                );
              }
            }
          }
        }
      }
      console.log('[LLM OpenAI] Stream processing complete from our side.');
      // This might be reached if stream ends without [DONE] under some circumstances
      return accumulatedResponse;

    } catch (error) {
      console.error('[LLM OpenAI] Failed to fetch or process stream from OpenAI:', error);
      const errorMessage = `Error communicating with OpenAI: ${error.message}`;
      if (expressRes && expressRes.writable) {
        expressRes.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
      }
      return `// LLM_ERROR: ${errorMessage} //`;
    }

  } else { // Default to Ollama if provider is 'ollama' or null/undefined
    const effectiveOllamaModel = modelName || backendSettings.defaultOllamaModel || 'codellama';
    console.log(
      `[LLM Ollama] Initiating for prompt to ${effectiveOllamaModel}: "${finalPrompt.substring(0, 100)}..."` // Use finalPrompt
    );
    try {
      const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: effectiveOllamaModel, prompt: finalPrompt, stream: true }), // Use finalPrompt
      });
      if (!ollamaRes.ok) {
        const errorBody = await ollamaRes.text();
        console.error(
          `[LLM Ollama] Error from Ollama API: ${ollamaRes.status} ${ollamaRes.statusText}`,
          errorBody
        );
        let errorMessage = `Ollama API request failed: ${ollamaRes.status} ${ollamaRes.statusText} - ${errorBody.substring(0, 100)}`;
        const errorBodyLower = errorBody.toLowerCase();
        if (errorBodyLower.includes("unknown model") || errorBodyLower.includes("model not found")) {
          errorMessage = `Error: Model '${effectiveOllamaModel}' not found in your Ollama instance. Please ensure the model is pulled and available in Ollama. (Original Ollama error: ${errorBody.substring(0, 100)})`;
        }

        if (expressRes && expressRes.writable) {
          expressRes.write(
            `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`
          );
        }
        return `// LLM_ERROR: ${errorMessage} //`;
      }

      const contentType = ollamaRes.headers.get('content-type');
      if (!contentType || (!contentType.includes('application/json') && !contentType.includes('application/x-ndjson'))) {
        const errorBody = await ollamaRes.text();
        console.error(
          `[LLM Ollama] Unexpected Content-Type from Ollama API: ${contentType}`,
          errorBody
        );
        const errorMessage = `Ollama API returned unexpected Content-Type: ${contentType} - ${errorBody.substring(0, 100)}`;
        if (expressRes && expressRes.writable) {
          expressRes.write(
            `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`
          );
        }
        return `// LLM_ERROR: ${errorMessage} //`;
      }

      console.log('[LLM Ollama] Stream started.');
      let anyResponseProcessed = false;
      let ollamaErrorDetected = null;

      for await (const chunk of ollamaRes.body) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim() === '') continue;
          try {
            const parsedLine = JSON.parse(line);

            if (parsedLine.error) {
              ollamaErrorDetected = `Ollama reported an error: ${parsedLine.error}`;
              const parsedErrorLower = parsedLine.error.toLowerCase();
              if (parsedErrorLower.includes("unknown model") || parsedErrorLower.includes("model not found")) {
                ollamaErrorDetected = `Error: Model '${effectiveOllamaModel}' not found in your Ollama instance during streaming. Please ensure the model is pulled and available. (Original Ollama error: ${parsedLine.error})`;
              }
              console.error(`[LLM Ollama] ${ollamaErrorDetected}`);
              if (expressRes && expressRes.writable) {
                expressRes.write(
                  `data: ${JSON.stringify({ type: 'error', content: ollamaErrorDetected })}\n\n`
                );
              }
              return `// LLM_ERROR: ${ollamaErrorDetected} //`;
            }

            if (parsedLine.response) {
              accumulatedResponse += parsedLine.response;
              anyResponseProcessed = true;

              if (expressRes && expressRes.writable) {
                const ssePayload = { type: 'llm_chunk', content: parsedLine.response };
                if (speakerContext) ssePayload.speaker = speakerContext;
                expressRes.write(`data: ${JSON.stringify(ssePayload)}\n\n`);
              }
            }

            if (parsedLine.done) {
              console.log('[LLM Ollama] Stream finished by Ollama.');
              if (!anyResponseProcessed && !ollamaErrorDetected) {
                console.warn('[LLM Ollama] Ollama stream ended (done=true) but no response content was processed.');
              }
              return accumulatedResponse;
            }
          } catch (parseError) {
            console.warn(
              `[LLM Ollama] Failed to parse JSON line from Ollama stream. Line: "${line}". Error: ${parseError.message}`
            );
            if (expressRes && expressRes.writable) {
              expressRes.write(
                `data: ${JSON.stringify({ type: 'log_entry', content: `[LLM Stream Warning] Could not parse Ollama line: ${line.substring(0,50)}...` })}\n\n`
              );
            }
          }
        }
      }
      console.log(
        '[LLM Ollama] Stream processing complete from our side.'
      );
      if (!anyResponseProcessed && !ollamaErrorDetected) {
          const warningMessage = "[LLM Ollama] Stream ended without a 'done' signal from Ollama and no response content was processed.";
          console.warn(warningMessage);
          if (expressRes && expressRes.writable) {
              expressRes.write(
                  `data: ${JSON.stringify({ type: 'log_entry', content: warningMessage })}\n\n`
              );
          }
          if (accumulatedResponse === '') {
             return `// LLM_WARNING: Stream ended abruptly or was empty. No content. //`;
          }
      }
      return accumulatedResponse;
    } catch (error) {
      console.error(
        '[LLM Ollama] Failed to fetch or process stream from Ollama:',
        error
      );
      const errorMessage = `Error communicating with Ollama LLM: ${error.message}`;
      if (expressRes && expressRes.writable) {
        expressRes.write(
          `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`
        );
      }
      return `// LLM_ERROR: ${errorMessage} //`;
    }
  }
}

// --- Helper Functions ---

function resolveTemplates(text, contextOutputs, sendSseMessage) {
  if (typeof text !== 'string') return text;
  return text.replace(
    /\{\{outputs\.([a-zA-Z0-9_]+)\}\}/g,
    (match, variableName) => {
      if (contextOutputs.hasOwnProperty(variableName)) {
        return contextOutputs[variableName];
      }
      const criticalWarningMsg = `[Templating] CRITICAL: Output variable '${variableName}' not found in context. Template '${match}' will remain unresolved!`;
      console.error(criticalWarningMsg); // Changed to console.error for more visibility
      if (sendSseMessage) {
        // Send as an error type to frontend for potential highlighting
        sendSseMessage('error', { content: `Template variable error: '${variableName}' not found in context. Step might fail or misbehave.` });
      }
      return match; // Return the original template string, relying on subsequent validation
    }
  );
}

function parseTaskPayload(req) {
  const logPrefix = `[parseTaskPayload Method: ${req.method}]`;
  let task_description, stepsString, safetyModeString, isAutonomousModeString;

  if (req.method === 'POST') {
    console.log(`${logPrefix} Parsing POST body:`, req.body);
    ({ task_description, steps: stepsString, safetyMode: safetyModeString, isAutonomousMode: isAutonomousModeString } = req.body);
  } else if (req.method === 'GET') {
    console.log(`${logPrefix} Parsing GET query:`, req.query);
    ({ task_description, steps: stepsString, safetyMode: safetyModeString, isAutonomousMode: isAutonomousModeString } = req.query);
  } else {
    console.warn(`${logPrefix} Unsupported request method.`);
    return { error: 'Unsupported request method.' };
  }

  // Validate task_description
  if (task_description === null || task_description === undefined || String(task_description).trim() === '') {
    console.warn(`${logPrefix} task_description is missing or empty.`);
    return { error: 'task_description is required and cannot be empty.' };
  }

  // isAutonomousMode defaults to false if not 'true'.
  // Current behavior: any string other than 'true' results in false.
  const isAutonomousMode = isAutonomousModeString === 'true';
  console.log(`${logPrefix} Autonomous Mode: ${isAutonomousMode} (raw string: '${isAutonomousModeString}')`);

  let steps = [];
  if (stepsString) {
    try {
      steps = JSON.parse(stepsString);
      if (!Array.isArray(steps)) {
        console.warn(`${logPrefix} Parsed steps is not an array. Value:`, steps);
        return { error: 'Invalid steps format. Must be a JSON stringified array.' };
      }
    } catch (e) {
      console.error(`${logPrefix} Error parsing stepsString: "${stepsString}". Error:`, e);
      return { error: 'Invalid steps format. Must be a JSON stringified array.' };
    }
  }

  // If not in autonomous mode, steps must be provided and be a non-empty array.
  if (!isAutonomousMode && (!stepsString || steps.length === 0)) {
    // This also covers cases where stepsString was provided but parsed to an empty array.
    console.warn(`${logPrefix} Non-autonomous mode requires non-empty steps. Provided stepsString: "${stepsString}", Parsed steps count: ${steps.length}`);
    return { error: 'Missing or empty steps in parameters (and not in Autonomous Mode).' };
  }


  // safetyMode defaults to true if not explicitly 'false'.
  // Current behavior: any string other than 'false' (e.g., 'true', 'on', an empty string, or undefined) results in true.
  const safetyMode = safetyModeString !== 'false';
  console.log(`${logPrefix} Safety Mode: ${safetyMode} (raw string: '${safetyModeString}')`);

  return { task_description, steps, safetyMode, isAutonomousMode };
}

// --- Main Task Execution Handler ---

// Refactored main execution logic to be callable for initial and resumed tasks

// Helper function to execute steps within a loop
// This function is responsible for executing the sequence of steps defined within a 'loop_iterations' step.
// It manages its own context for the current iteration number and resolves templates using that context.
async function executeLoopBody(
  expressHttpRes,
  task_description,
  loopSteps, // Array of step objects for the loop body
  taskContext,
  overallExecutionLog,
  sendSseMessage,
  safetyMode,
  parentStepNumber, // For logging context (e.g., "Loop in Step 5, Iteration 1")
  loopIterationNumber, // For logging context
  initialOperationCount // Current operation count from parent
) {
  let operationCount = initialOperationCount;
  const loopBodyLogPrefix = `[Loop Body in Parent Step ${parentStepNumber}, Iteration ${loopIterationNumber + 1}]`;

  if (!Array.isArray(loopSteps)) {
    const errorMsg = `${loopBodyLogPrefix} loop_steps is not an array. Cannot execute.`;
    console.error(errorMsg);
    sendSseMessage('error', { content: `[SSE] ${errorMsg}` });
    // This is a structural issue with the plan, return failure for the whole loop_iterations step.
    return { status: 'failed', error: new Error(errorMsg), operationCount, failingInnerStepType: 'loop_iterations_setup', failingInnerStepDetails: { loop_steps: loopSteps } };
  }

  sendSseMessage('log_entry', { message: `[SSE] ${loopBodyLogPrefix} Starting execution of ${loopSteps.length} inner steps. Initial op count for this iteration: ${operationCount}` });
  console.log(`${loopBodyLogPrefix} Starting with ${loopSteps.length} inner steps. Initial op count for this iteration: ${operationCount}`);

  for (let idx = 0; idx < loopSteps.length; idx++) {
    let currentLoopStep = JSON.parse(JSON.stringify(loopSteps[idx])); // Deep clone
    const innerStepNumber = idx + 1;
    const innerStepLogPrefix = `${loopBodyLogPrefix} Inner Step ${innerStepNumber}/${loopSteps.length} (Type: ${currentLoopStep.type})`;

    // Guard template resolution
    if (currentLoopStep.details) {
      for (const key in currentLoopStep.details) {
        if (typeof currentLoopStep.details[key] === 'string') {
          currentLoopStep.details[key] = resolveTemplates(
            currentLoopStep.details[key],
            taskContext.outputs,
            sendSseMessage
          );
        }
      }
    } else { // No details object at all
        const missingDetailsMsg = `${innerStepLogPrefix}: Step details are missing.`;
        console.warn(missingDetailsMsg);
        // This is a failure for this inner step
        return { status: 'failed', error: new Error(missingDetailsMsg), operationCount, failingInnerStepType: currentLoopStep.type, failingInnerStepDetails: null };
    }

    console.log(`${innerStepLogPrefix} Processing. Validated Details: ${JSON.stringify(currentLoopStep.details)}`);
    // No SSE for validated details to avoid too much noise, server log is sufficient.
    overallExecutionLog.push(`${innerStepLogPrefix} Validated Details: ${JSON.stringify(currentLoopStep.details)}`);


    try {
      // IMPORTANT: Operations inside executeLoopBody are considered non-interactive for confirmation purposes *for now*.
      // They increment the operationCount, and batch confirmation is handled by executeStepsInternal *after* an iteration.
      // Individual step confirmations (e.g., a createFile requiring its own confirmation) are NOT handled by pausing inside executeLoopBody.
      // Such steps will execute as if safety mode is off or they are pre-confirmed for the purpose of this loop body.
      const isConfirmedActionWithinLoop = true; // Effectively, all actions inside a loop iteration are treated as confirmed in batch.

      if (currentLoopStep.type === 'generic_step' || currentLoopStep.type === 'execute_generic_task_with_llm') {
        const promptText = currentLoopStep.details.prompt || currentLoopStep.details.description;
        if (!promptText || typeof promptText !== 'string' || promptText.trim() === '') {
          throw new Error("Missing or invalid 'prompt' or 'description' in details for generic_step.");
        }
        if (currentLoopStep.details.output_id && (typeof currentLoopStep.details.output_id !== 'string' || currentLoopStep.details.output_id.trim() === '')) {
            throw new Error("Invalid 'output_id' in details for generic_step: must be a non-empty string if provided.");
        }
        console.log(`${innerStepLogPrefix} Executing LLM. Prompt: "${promptText.substring(0,50)}...", Output ID: ${currentLoopStep.details.output_id || 'N/A'}`);
        const llmFullResponse = await generateFromLocal(promptText, backendSettings.defaultOllamaModel || 'codellama', expressHttpRes, { agentType: 'coder_agent' });
        if (llmFullResponse.startsWith('// LLM_ERROR:') || llmFullResponse.startsWith('// LLM_WARNING:')) {
          throw new Error(`LLM generation failed: ${llmFullResponse}`);
        }
        if (currentLoopStep.details.output_id) {
          taskContext.outputs[currentLoopStep.details.output_id.trim()] = llmFullResponse;
          sendSseMessage('log_entry', { message: `[SSE] ${innerStepLogPrefix}: Stored LLM output to '${currentLoopStep.details.output_id.trim()}'.` });
        }
        operationCount++;
        overallExecutionLog.push(`  ${innerStepLogPrefix}: LLM call completed. Operation count: ${operationCount}`);
      } else if (currentLoopStep.type === 'createFile') {
        const { filePath, content } = currentLoopStep.details;
        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') throw new Error("Missing or invalid 'filePath' for createFile.");
        if (content === undefined || typeof content !== 'string') throw new Error("Missing or invalid 'content' for createFile (must be a string, can be empty).");

        console.log(`${innerStepLogPrefix} Creating file. Path: ${filePath}, Content Length: ${content.length}`);
        const createFileResult = fsAgent.createFile(filePath, content, { requireConfirmation: false, isConfirmedAction: isConfirmedActionWithinLoop });
        if (!createFileResult.success) throw new Error(`Failed to create file: ${createFileResult.message}`);

        sendSseMessage('file_written', { path: createFileResult.fullPath, message: `[SSE] ${innerStepLogPrefix}: File created: ${createFileResult.fullPath}` });
        operationCount++;
        overallExecutionLog.push(`  ${innerStepLogPrefix}: File created. Path: ${createFileResult.fullPath}. Operation count: ${operationCount}`);
      } else if (currentLoopStep.type === 'create_file_with_llm_content') {
        const { filePath, prompt, output_id } = currentLoopStep.details;
        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') throw new Error("Missing or invalid 'filePath' for create_file_with_llm_content.");
        if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') throw new Error("Missing or invalid 'prompt' for create_file_with_llm_content.");
        if (output_id && (typeof output_id !== 'string' || output_id.trim() === '')) throw new Error("Invalid 'output_id' for create_file_with_llm_content (must be non-empty string if provided).");

        console.log(`${innerStepLogPrefix} Creating file with LLM. Path: ${filePath}, Prompt: "${prompt.substring(0,50)}...", Output ID: ${output_id || 'N/A'}`);
        const fileContent = await generateFromLocal(prompt, backendSettings.defaultOllamaModel || 'codellama', expressHttpRes, { agentType: 'coder_agent' });
        if (fileContent.startsWith('// LLM_ERROR:') || fileContent.startsWith('// LLM_WARNING:')) {
          throw new Error(`LLM generation for file content failed: ${fileContent}`);
        }
        if (output_id) {
          taskContext.outputs[output_id.trim()] = fileContent;
           sendSseMessage('log_entry', { message: `[SSE] ${innerStepLogPrefix}: Stored generated file content to '${output_id.trim()}'.` });
        }

        const createFileResult = fsAgent.createFile(filePath, fileContent, { requireConfirmation: false, isConfirmedAction: isConfirmedActionWithinLoop });
        if (!createFileResult.success) throw new Error(`Failed to create file with LLM content: ${createFileResult.message}`);

        sendSseMessage('file_written', { path: createFileResult.fullPath, message: `[SSE] ${innerStepLogPrefix}: File created with LLM content: ${createFileResult.fullPath}` });
        operationCount++;
        overallExecutionLog.push(`  ${innerStepLogPrefix}: File with LLM content created. Path: ${createFileResult.fullPath}. Operation count: ${operationCount}`);
      } else if (currentLoopStep.type === 'readFile' || currentLoopStep.type === 'read_file_to_output') {
        const { filePath, output_id } = currentLoopStep.details;
        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') throw new Error("Missing or invalid 'filePath' for readFile.");
        if (!output_id || typeof output_id !== 'string' || output_id.trim() === '') throw new Error("Missing or invalid 'output_id' for readFile.");

        console.log(`${innerStepLogPrefix} Reading file. Path: ${filePath}, Output ID: ${output_id}`);
        const readFileResult = fsAgent.readFile(filePath);
        if (!readFileResult.success) throw new Error(`Failed to read file: ${readFileResult.message}`);
        taskContext.outputs[output_id.trim()] = readFileResult.content;
        sendSseMessage('log_entry', { message: `[SSE] ${innerStepLogPrefix}: File read: ${readFileResult.fullPath}, content stored in '${output_id.trim()}'.`});
        overallExecutionLog.push(`  ${innerStepLogPrefix}: File read. Path: ${readFileResult.fullPath}.`);
      } else if (currentLoopStep.type === 'updateFile') {
        const { filePath, content, append } = currentLoopStep.details;
        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') throw new Error("Missing or invalid 'filePath' for updateFile.");
        if (content === undefined || typeof content !== 'string') throw new Error("Missing or invalid 'content' for updateFile (must be a string, can be empty).");
        if (append !== undefined && typeof append !== 'boolean') throw new Error("Invalid 'append' value for updateFile (must be boolean if provided).");

        const effectiveAppend = append === undefined ? false : append; // Default append to false if not provided
        console.log(`${innerStepLogPrefix} Updating file. Path: ${filePath}, Content Length: ${content.length}, Append: ${effectiveAppend}`);
        const updateFileResult = fsAgent.updateFile(filePath, content, { append: effectiveAppend, requireConfirmation: false, isConfirmedAction: isConfirmedActionWithinLoop });
        if(!updateFileResult.success) throw new Error(`Failed to update file: ${updateFileResult.message}`);
        sendSseMessage('log_entry', { message: `[SSE] ${innerStepLogPrefix}: File updated: ${updateFileResult.fullPath}`});
        operationCount++;
        overallExecutionLog.push(`  ${innerStepLogPrefix}: File updated. Path: ${updateFileResult.fullPath}. Operation count: ${operationCount}`);
      } else {
        const unknownStepMsg = `[SSE] ${innerStepLogPrefix}: Unknown or unsupported step type '${currentLoopStep.type}' within loop body. Skipping.`;
        sendSseMessage('log_entry', { message: unknownStepMsg });
        overallExecutionLog.push(`  ${innerStepLogPrefix}: WARNING - ${unknownStepMsg.replace('[SSE] ', '')}`);
        console.warn(`${innerStepLogPrefix}: Unknown step type '${currentLoopStep.type}' in loop. Skipping.`);
      }
      // No individual batch confirmation check *inside* executeLoopBody. It's handled by the caller after an iteration.
    } catch (loopStepError) {
      const errorMsg = `${innerStepLogPrefix}: Execution failed. Error: ${loopStepError.message}`;
      sendSseMessage('error', { content: `[SSE] ${errorMsg}` }); // Send error via SSE
      overallExecutionLog.push(`  ${innerStepLogPrefix}: ❌ ERROR - ${loopStepError.message}`); // Add to main log
      console.error(`${errorMsg}`, loopStepError);

      return {
        status: 'failed',
        error: loopStepError,
        operationCount, // Return the count of operations successfully completed *before* this failure
        failingInnerStepType: currentLoopStep.type,
        failingInnerStepDetails: currentLoopStep.details
      };
    }
  } // End of for loop for inner steps

  sendSseMessage('log_entry', { message: `[SSE] ${loopBodyLogPrefix} Finished all ${loopSteps.length} inner steps. Operation count for this iteration is now ${operationCount}.` });
  console.log(`${loopBodyLogPrefix} Finished all inner steps. Operation count for this iteration: ${operationCount}`);
  return { status: 'completed', operationCount };
}

async function executeStepsInternal(
  expressHttpRes, // The response object for SSE
  task_description,
  steps, // Array of step objects
  taskContext, // { outputs: {} }
  overallExecutionLog, // Array of log strings
  startingStepIndex = 0, // To allow resumption
  sendSseMessage, // SSE sending function
  safetyMode, // Global safety mode for this task execution
  initialOperationCount = 0 // For resuming operation count
) {
  // Main function for processing a task's steps. It handles:
  // - Sequential execution of steps.
  // - Resumption from a specific step (startingStepIndex).
  // - Safety mode confirmations (batch and per-step).
  // - Retries and LLM-based refinements for failed steps.
  // - LLM-based evaluation of step outputs.
  console.log(`[executeStepsInternal] Starting/Resuming task: "${task_description}" from step ${startingStepIndex + 1}. Safety Mode: ${safetyMode}, Initial Op Count: ${initialOperationCount}`);
  sendSseMessage('log_entry', { message: `[SSE] Task execution started/resumed for "${task_description}" from step ${startingStepIndex + 1}. Safety Mode: ${safetyMode}` }, expressHttpRes);

  let operationCountSinceLastConfirmation = initialOperationCount;

  // Helper function to trigger step failure
  // Standardizes error reporting, stores failure details for potential user resolution, and sends failure options to the client.
  const triggerStepFailure = (errorMessage, errorDetails, stepType, stepNumber, currentStepContext) => {
    let displayErrorMessage = errorMessage;
    const currentStepForErrorMessage = steps[currentStepContext.i]; // Access step from outer scope for context

    // Try to create a more specific message if the incoming one is generic
    if (errorMessage === "Unknown error after retries/refinements." ||
        errorMessage === "Unknown error after retries/refinements/evaluation." ||
        errorMessage === "Step processing failed with an unspecified error before triggering failure." || // From previous changes
        !errorMessage) {
        if (errorDetails && errorDetails.details && errorDetails.details.originalError && errorDetails.details.originalError !== "null" && errorDetails.details.originalError.trim() !== "") {
            displayErrorMessage = `Step failed after all attempts. Last known original error: ${errorDetails.details.originalError}`;
        } else if (errorDetails && errorDetails.message && errorDetails.message !== errorMessage && errorDetails.message.trim() !== "") {
            // If errorDetails.message is more specific than the generic one (and not empty)
            displayErrorMessage = `Step failed after all attempts. Last reported reason: ${errorDetails.message}`;
        } else if (currentStepForErrorMessage && currentStepForErrorMessage.details && currentStepForErrorMessage.details.evaluationPrompt && errorMessage.includes("Evaluation failed")) {
            // Generic fallback for evaluation failures if other details are missing
            displayErrorMessage = `Step ${stepNumber} (${stepType}) failed LLM evaluation after all attempts with an unspecified evaluation error.`;
        } else {
            displayErrorMessage = `Step ${stepNumber} (${stepType}) failed with an unspecified error after all attempts.`;
        }
    }

    const fullErrorMessage = `Step ${stepNumber} (${stepType}): ${displayErrorMessage}`;
    overallExecutionLog.push(`  -> ❌ ${fullErrorMessage}`);
    console.error(`[executeStepsInternal] ${fullErrorMessage}`, errorDetails || '');

    const failureId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);

    let originalErrorDetailString = errorDetails instanceof Error ? errorDetails.toString() : (typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails));
    if (originalErrorDetailString === "\"null\"" || originalErrorDetailString === "null") { // Handles JSON stringified "null" or direct string "null"
        originalErrorDetailString = "No specific original error message provided.";
    }


    let standardizedError = {
      code: 'SERVER_STEP_EXECUTION_FAILED', // Default code
      message: displayErrorMessage, // Use the potentially improved message
      details: {
        originalError: originalErrorDetailString,
        stack: errorDetails instanceof Error ? errorDetails.stack : undefined,
      },
      stepType: stepType,
      stepNumber: stepNumber,
    };

    // If errorDetails is an object from our agents (fsAgent, gitAgent)
    // which contains a structured .error property, use that.
    if (errorDetails && typeof errorDetails === 'object' && errorDetails.error && typeof errorDetails.error.code === 'string') {
      standardizedError.code = errorDetails.error.code; // Use specific code from agent
      standardizedError.message = errorDetails.error.message || displayErrorMessage; // Prefer agent's message, fallback to displayErrorMessage
      standardizedError.details = { ...standardizedError.details, ...errorDetails.error.details, agentReported: true };
      // Keep the original full errorDetails in details if it's more than just the .error part
      if (Object.keys(errorDetails).filter(k => k !== 'error' && k !== 'success' && k !== 'message').length > 0) {
        standardizedError.details.fullAgentResponse = errorDetails;
      }
    } else if (errorDetails instanceof Error) {
        // For generic Error objects, try to make a more specific code if possible based on message or type
        if (displayErrorMessage && displayErrorMessage.includes("LLM generation failed")) { // Check displayErrorMessage
            standardizedError.code = 'LLM_GENERATION_FAILED_IN_STEP';
        } else if (displayErrorMessage && displayErrorMessage.includes("Loop body execution failed")) { // Check displayErrorMessage
            standardizedError.code = 'LOOP_BODY_EXECUTION_FAILED';
        }
        // message is already displayErrorMessage or a more specific one from agent
        // details.originalError and details.stack are already set
    }


    pendingFailures[failureId] = {
      originalExpressHttpRes: expressHttpRes,
      sendSseMessage,
      task_description,
      steps,
      currentStepIndex: currentStepContext.i, // currentStepIndex from the loop
      taskContext,
      overallExecutionLog,
      safetyMode,
      errorDetails: standardizedError, // Store the standardized error
    };
    sendSseMessage('step_failed_options', { failureId, errorDetails: standardizedError, failedStep: { ...steps[currentStepContext.i] } }, expressHttpRes);
    console.log(`[executeStepsInternal] Step ${stepNumber} (${stepType}) failed. Pausing task. Failure ID: ${failureId}`);
  };

  // Main loop for iterating through each step in the task.
  for (let i = startingStepIndex; i < steps.length; i++) {
    let currentStep = JSON.parse(JSON.stringify(steps[i])); // Deep clone current step
    const stepNumber = i + 1;
    const stepLogPrefix = `[executeStepsInternal Step ${stepNumber} (${currentStep.type})]`;

    // Resolve templates in step details if details exist
    if (currentStep.details) {
      for (const key in currentStep.details) {
        if (typeof currentStep.details[key] === 'string') {
          currentStep.details[key] = resolveTemplates(
            currentStep.details[key],
            taskContext.outputs,
            (type, data) => sendSseMessage(type, data, expressHttpRes) // Pass sendSseMessage correctly
          );
        }
      }
    } else if (currentStep.type !== 'show_workspace_tree') { // show_workspace_tree can have null details
      // For most steps, details are required.
      triggerStepFailure("Step details are missing.", null, currentStep.type, stepNumber, {i});
      return; // Stop processing this task
    }

    // Log initial details before validation specific to step type might modify/fail
    console.log(`${stepLogPrefix} Initial Details after template resolution: ${JSON.stringify(currentStep.details)}`);
    sendSseMessage('log_entry', { message: `\n[SSE] Processing Step ${stepNumber}: Type: ${currentStep.type}, Initial Details: ${JSON.stringify(currentStep.details)}` }, expressHttpRes);
    overallExecutionLog.push(`${stepLogPrefix} Initial Details: ${JSON.stringify(currentStep.details)}`);

    // Initialize retry and refinement counts for the current step
    currentStep._internalRetryCount = currentStep._internalRetryCount || 0;
    currentStep._internalRefineCount = currentStep._internalRefineCount || 0; // For later use

    let stepProcessedSuccessfully = false;
    let lastErrorForStep = null;

    // This loop handles retries (simple or after refinement) for the current step.
    // It continues as long as the step hasn't succeeded and retry/refinement attempts are within limits.
    while (!stepProcessedSuccessfully &&
           (currentStep._internalRetryCount < (currentStep.details?.maxRetries || 0)) ||
           (currentStep.details?.onError === 'refine_and_retry' && currentStep._internalRefineCount < (currentStep.details?.maxRefinementRetries || 1))) { // Default 1 refinement attempt if not specified

      // Resolve templates just before each attempt, in case context changed due to refinement
      if (currentStep.details) {
        for (const key in currentStep.details) {
          if (typeof currentStep.details[key] === 'string') {
            currentStep.details[key] = resolveTemplates(
              currentStep.details[key],
              taskContext.outputs,
              (type, data) => sendSseMessage(type, data, expressHttpRes)
            );
          }
        }
      }
      if (currentStep._internalRetryCount > 0 || currentStep._internalRefineCount > 0) {
        const attemptMessage = `[SSE] Attempt ${currentStep._internalRetryCount + currentStep._internalRefineCount + 1} for Step ${stepNumber}. Type: ${currentStep.type}, Details: ${JSON.stringify(currentStep.details)}`;
        sendSseMessage('log_entry', { message: attemptMessage }, expressHttpRes);
        overallExecutionLog.push(attemptMessage.replace('[SSE] ', ''));
        console.log(`[executeStepsInternal] ${attemptMessage.replace('[SSE] ', '')}`);
      }

      // Try to execute the current step's logic.
      try {
        const isConfirmedAction = currentStep.details?.isConfirmedAction || false;
        lastErrorForStep = null; // Clear last error before new attempt

        // --- Sandboxing Logic ---
        // Hypothetical: agentContext could come from taskContext.agentType or currentStep.agentContext
        const agentContext = taskContext.agentType || currentStep.agentContext;
        let sandboxSubDir = null;

        if (agentContext === 'conference_agent') {
          sandboxSubDir = CONFERENCE_SANDBOX_DIR;
        } else if (agentContext === 'brainstorming_agent') {
          sandboxSubDir = BRAINSTORMING_SANDBOX_DIR;
        }

        // --- Actual Step Execution Logic (moved inside the while loop) ---
        if (currentStep.type === 'loop_iterations') {
          if (!currentStep.details) { // Should have been caught earlier, but as a safeguard
            triggerStepFailure("Step details are missing for loop_iterations.", null, currentStep.type, stepNumber, {i});
            return;
          }
          const { count, loop_steps, iterator_var } = currentStep.details; // No || {} here, details must exist.

          if (typeof count !== 'number' || count <= 0) {
            triggerStepFailure("Missing or invalid 'count' in details for loop_iterations step: must be a positive number.", { count }, currentStep.type, stepNumber, {i});
            return;
          }
          if (!Array.isArray(loop_steps) || loop_steps.length === 0) {
            triggerStepFailure("Missing or invalid 'loop_steps' in details for loop_iterations step: must be a non-empty array.", { loop_steps }, currentStep.type, stepNumber, {i});
            return;
          }
          if (iterator_var !== undefined && (typeof iterator_var !== 'string' || iterator_var.trim() === '')) {
            // Log a warning and proceed without it, or fail if it should be critical
            console.warn(`${stepLogPrefix} Invalid 'iterator_var': "${iterator_var}". Must be a non-empty string if provided. Proceeding without setting iterator variable.`);
            // To make it critical: triggerStepFailure(...) and return. For now, warning.
            currentStep.details.iterator_var = undefined; // Effectively disable it if invalid
          }
          console.log(`${stepLogPrefix} Validated Details: Count=${count}, Loop Steps Count=${loop_steps.length}, Iterator Var=${currentStep.details.iterator_var || 'N/A'}`);
          overallExecutionLog.push(`${stepLogPrefix} Validated Details - Count: ${count}, Loop Steps Count: ${loop_steps.length}, Iterator Var: ${currentStep.details.iterator_var || 'N/A'}`);
          sendSseMessage('log_entry', { message: `[SSE] ${stepLogPrefix} Starting loop for ${count} iterations.` });

          const originalIteratorValue = iterator_var ? taskContext.outputs[iterator_var] : undefined;

          for (let iter = 0; iter < count; iter++) {
            const iterationLogPrefix = `${logLoopPrefix} Iteration ${iter + 1}/${count}`;
            sendSseMessage('log_entry', { message: `[SSE] ${iterationLogPrefix}: Starting.` });
            overallExecutionLog.push(`    ${iterationLogPrefix}:`);
            console.log(`${iterationLogPrefix}: Starting.`);

            if (iterator_var) {
              taskContext.outputs[iterator_var] = iter;
              sendSseMessage('log_entry', { message: `[SSE] ${iterationLogPrefix}: Set '${iterator_var}' to ${iter}.` });
              console.log(`${iterationLogPrefix}: Set '${iterator_var}' to ${iter}.`);
            }

            // Execute the body of the loop
            const loopBodyResult = await executeLoopBody(
              expressHttpRes,
              task_description,
              loop_steps, // These are the steps to execute *inside* the loop
              taskContext,    // Pass the main taskContext, potentially modified with iterator_var
              overallExecutionLog, // Pass the main log array
              sendSseMessage, // Pass the main SSE sender
              safetyMode,     // Pass the global safetyMode
              loopStepNumberForLog, // Parent step number (the loop_iterations step itself)
              iter,                 // Current iteration number (0-based)
              operationCountSinceLastConfirmation // Pass current operation count from the main execution flow
            );

            // Update the main operation count with the count from the completed loop body execution
            operationCountSinceLastConfirmation = loopBodyResult.operationCount;

            if (loopBodyResult.status === 'failed') {
              const failureMessage = `${iterationLogPrefix}: Loop body execution failed. Error: ${loopBodyResult.error?.message}`;
              const errorDetailsForFailure = {
                message: `Loop body execution failed at Iteration ${iter + 1}. Error: ${loopBodyResult.error?.message}`,
                originalError: loopBodyResult.error, // Preserve original error from loop body
                type: currentStep.type, // loop_iterations
                stepNumber: loopStepNumberForLog, // The loop_iterations step number
                iteration: iter + 1,
                failingInnerStepType: loopBodyResult.failingInnerStepType, // If available from executeLoopBody
                failingInnerStepDetails: loopBodyResult.failingInnerStepDetails // If available
              };
              // Error message already sent by executeLoopBody via SSE
              overallExecutionLog.push(`  -> ❌ ${failureMessage}`);
              console.error(failureMessage, loopBodyResult.error);
              triggerStepFailure(failureMessage, errorDetailsForFailure, currentStep.type, loopStepNumberForLog, {i});
              return; // Pause main execution
            }

            sendSseMessage('log_entry', { message: `[SSE] ${iterationLogPrefix}: Finished successfully.` });
            overallExecutionLog.push(`    ${iterationLogPrefix}: Finished. Operation count now: ${operationCountSinceLastConfirmation}`);
            console.log(`${iterationLogPrefix}: Finished successfully. Operation count now: ${operationCountSinceLastConfirmation}`);

            // Batch confirmation check AFTER each full iteration of the loop body completes.
            // No confirmation after the very last iteration of the loop.
            if (safetyMode && operationCountSinceLastConfirmation >= CONFIRM_AFTER_N_OPERATIONS && iter < count - 1) {
              const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
              const confirmationMessage = `After ${operationCountSinceLastConfirmation} operations (last in loop iteration ${iter + 1} of ${count}), proceed with the next iteration?`;
              sendSseMessage('confirmation_required', {
                  confirmationId,
                  message: confirmationMessage,
                  details: {
                    type: 'batch_confirmation',
                    nextOperationWillBe: `loop iteration ${iter + 2}`,
                    operationCount: operationCountSinceLastConfirmation,
                    parentStep: loopStepNumberForLog
                  }
              }, expressHttpRes);

              pendingConfirmations[confirmationId] = {
                  expressHttpRes,
                  task_description,
                  steps,
                  currentStepIndex: i, // currentStepIndex is the index of the 'loop_iterations' step itself
                  taskContext,
                  overallExecutionLog,
                  currentStep, // currentStep is the 'loop_iterations' step object
                  actionType: 'batch_confirmation_resume_step', // Re-evaluate if a more specific actionType is needed for loop resume
                  confirmationType: 'batch',
                  safetyMode,
                  operationCountSinceLastConfirmation: 0, // Reset for the next batch if confirmed
                  // It's important that if this confirmation is for a loop, the resume logic knows how to continue the loop.
                  // The `currentStepIndex` points to the loop_iterations step. The resume logic for 'batch_confirmation_resume_step'
                  // might need to be aware or a more specific actionType used.
                  // For now, 'batch_confirmation_resume_step' will just re-enter executeStepsInternal at the loop_iterations step.
                  // This means the loop_iterations step needs to be able to resume from a specific iteration.
                  // This is NOT currently implemented. The loop will restart from iteration 0.
                  // TODO: Enhance loop_iterations to support starting from a specific iteration if a batch confirmation occurs mid-loop.
                  // For this pass, a batch confirmation mid-loop will cause the loop to restart if confirmed.
              };
              console.log(`${logLoopPrefix} Batch confirmation required after iteration ${iter + 1}. Pausing task. Confirmation ID: ${confirmationId}. NOTE: Loop will restart if confirmed.`);
              return; // Pause main execution, wait for confirmation
            }
          } // End of for loop (iterations)

          if (iterator_var) {
            if (originalIteratorValue === undefined) {
              delete taskContext.outputs[iterator_var]; // Clean up if it didn't exist before
            } else {
              taskContext.outputs[iterator_var] = originalIteratorValue; // Restore original value
            }
            sendSseMessage('log_entry', { message: `[SSE] ${logLoopPrefix} Restored/cleared '${iterator_var}' in context after loop completion.` });
            console.log(`${logLoopPrefix} Restored/cleared '${iterator_var}' in context.`);
          }
          sendSseMessage('log_entry', { message: `[SSE] ${logLoopPrefix} Finished all ${count} iterations successfully.` });
          overallExecutionLog.push(`  -> ${logLoopPrefix} Finished all iterations. Final operation count for this step: ${operationCountSinceLastConfirmation}`);
          console.log(`${logLoopPrefix} Finished all ${count} iterations successfully.`);
          // operationCountSinceLastConfirmation is carried forward

      // Handles 'generic_step' or 'execute_generic_task_with_llm' for general LLM interactions.
      } else if (
        currentStep.type === 'generic_step' ||
        currentStep.type === 'execute_generic_task_with_llm'
      ) {
        if (!currentStep.details) { triggerStepFailure("Step details are missing.", null, currentStep.type, stepNumber, {i}); return; }
        const promptText = currentStep.details.prompt || currentStep.details.description;
        const outputId = currentStep.details.output_id;

        if (!promptText || typeof promptText !== 'string' || promptText.trim() === '') {
          triggerStepFailure("Missing or invalid 'prompt' or 'description' in details for generic_step.", {promptText}, currentStep.type, stepNumber, {i}); return;
        }
        if (outputId !== undefined && (typeof outputId !== 'string' || outputId.trim() === '')) {
          triggerStepFailure("Invalid 'output_id' in details for generic_step: must be a non-empty string if provided.", {outputId}, currentStep.type, stepNumber, {i}); return;
        }

        console.log(`${stepLogPrefix} Validated Details - Prompt length: ${promptText.length}, Output ID: ${outputId || 'N/A'}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - Prompt length: ${promptText.length}, Output ID: ${outputId || 'N/A'}`);
        sendSseMessage('log_entry', { message: `[SSE] ${stepLogPrefix} Sending prompt to LLM: "${promptText.substring(0, 100)}..."` }, expressHttpRes);

        console.log(`${stepLogPrefix} Calling generateFromLocal with prompt: "${promptText.substring(0,50)}...", model: ${backendSettings.defaultOllamaModel || 'codellama'}`);
        let llmFullResponse = await generateFromLocal(promptText, backendSettings.defaultOllamaModel || 'codellama', expressHttpRes, { agentType: 'coder_agent' });

        if (llmFullResponse.startsWith('// LLM_ERROR:') || llmFullResponse.startsWith('// LLM_WARNING:')) {
          triggerStepFailure(`LLM generation failed.`, llmFullResponse, currentStep.type, stepNumber, {i});
          return;
        }
        sendSseMessage('log_entry', { message: `[SSE] ${stepLogPrefix} LLM stream completed.` }, expressHttpRes);
        overallExecutionLog.push(`  -> ${stepLogPrefix} LLM Response (summary): ${llmFullResponse.substring(0, 200)}...`);

        if (outputId) {
          taskContext.outputs[outputId.trim()] = llmFullResponse;
          sendSseMessage('log_entry', { message: `[SSE] Stored LLM response in context as output_id: '${outputId.trim()}'` }, expressHttpRes);
          overallExecutionLog.push(`  -> ${stepLogPrefix} Stored LLM response in context as output_id: '${outputId.trim()}'`);
        }
        operationCountSinceLastConfirmation++;
      } else if (currentStep.type === 'create_file_with_llm_content') { // Validations for this type are already done above.
        // This block now mainly contains sandboxing, agent calls, and confirmation logic.
        // Details like filePath, prompt, content_from_llm, output_id were validated before this try-catch's main body.
        const { filePath: originalFilePath_llm, prompt, content_from_llm, output_id } = currentStep.details;
        let filePath = originalFilePath_llm;
        const originalFilePathForExtensionCheck = originalFilePath_llm;

        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
          triggerStepFailure("Missing or invalid 'filePath' in details for create_file_with_llm_content.", {filePath}, currentStep.type, stepNumber, {i}); return;
        }
        if (output_id !== undefined && (typeof output_id !== 'string' || output_id.trim() === '')) {
          triggerStepFailure("Invalid 'output_id' in details for create_file_with_llm_content: must be a non-empty string if provided.", {output_id}, currentStep.type, stepNumber, {i}); return;
        }
        if (content_from_llm === undefined && (!prompt || typeof prompt !== 'string' || prompt.trim() === '')) {
          triggerStepFailure("Missing or invalid 'prompt' (required if 'content_from_llm' is not provided) in details for create_file_with_llm_content.", {prompt}, currentStep.type, stepNumber, {i}); return;
        }
        if (content_from_llm !== undefined && typeof content_from_llm !== 'string') {
          triggerStepFailure("Invalid 'content_from_llm' in details for create_file_with_llm_content (must be string if provided).", {content_from_llm_type: typeof content_from_llm }, currentStep.type, stepNumber, {i}); return;
        }

        console.log(`${stepLogPrefix} Validated Details - FilePath: ${filePath}, Prompt: ${prompt ? `len ${prompt.length}` : 'N/A'}, Content_from_LLM: ${content_from_llm !== undefined ? `len ${content_from_llm.length}` : 'N/A'}, Output ID: ${output_id || 'N/A'}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - FilePath: ${filePath}, Prompt: ${prompt ? `len ${prompt.length}` : 'N/A'}, Content_from_LLM: ${content_from_llm !== undefined ? `len ${content_from_llm.length}` : 'N/A'}, Output ID: ${output_id || 'N/A'}`);

        // Sandboxing (already existed, kept as is)
        if (sandboxSubDir && filePath) {
          filePath = path.join(sandboxSubDir, filePath);
          console.log(`[Sandboxing] Remapped filePath for ${agentContext} to: ${filePath}`);
          sendSseMessage('log_entry', { message: `[SSE] Path sandboxed for ${agentContext}: ${filePath}` }, expressHttpRes);
        }

        // File type restriction check (already existed)
        if ((agentContext === 'conference_agent' || agentContext === 'brainstorming_agent') && originalFilePathForExtensionCheck) {
          const fileExt = path.extname(originalFilePathForExtensionCheck).toLowerCase();
          if (!ALLOWED_AGENT_FILE_EXTENSIONS.includes(fileExt)) {
            const errorMsg = `File type '${fileExt}' is not allowed for ${agentContext}. Allowed types: ${ALLOWED_AGENT_FILE_EXTENSIONS.join(', ')}`;
            sendSseMessage('error', { content: `[SSE] ${errorMsg}` });
            overallExecutionLog.push(`  -> ❌ ${errorMsg}`);
            console.warn(`[File Restriction] ${errorMsg}`);
            triggerStepFailure(errorMsg, { filePath: originalFilePathForExtensionCheck, extension: fileExt, allowedExtensions: ALLOWED_AGENT_FILE_EXTENSIONS }, currentStep.type, stepNumber, {i});
            return; // Important: stop processing this step
          }
        }

        const stepRequiresConfirmation = currentStep.details?.requireConfirmation === true;
        const stepDisablesConfirmation = currentStep.details?.requireConfirmation === false;
        let effectiveRequireConfirmationForStep = false;
        if (safetyMode) {
            effectiveRequireConfirmationForStep = !stepDisablesConfirmation;
        } else {
            effectiveRequireConfirmationForStep = stepRequiresConfirmation;
        }

        const fsOptions = {
          requireConfirmation: effectiveRequireConfirmationForStep, // This is for file-specific confirmation
          isConfirmedAction: isConfirmedAction
        };
        let fileContent = '';
        let contentSource = '';

        // filePath already validated
        if (content_from_llm !== undefined) {
          fileContent = content_from_llm; // Already validated as string if provided
          contentSource = 'content_from_llm';
        } else { // prompt must be valid if content_from_llm is not used (already checked)
          contentSource = 'llm_prompt';
          sendSseMessage('log_entry', { message: `[SSE] ${stepLogPrefix} Sending prompt to LLM for file content: "${prompt.substring(0, 100)}..."` }, expressHttpRes);
          console.log(`${stepLogPrefix} Calling generateFromLocal for file content. Prompt: "${prompt.substring(0,50)}...", Model: ${backendSettings.defaultOllamaModel || 'codellama'}`);
          fileContent = await generateFromLocal(prompt, backendSettings.defaultOllamaModel || 'codellama', expressHttpRes, { agentType: 'coder_agent' });
          sendSseMessage('log_entry', { message: `[SSE] ${stepLogPrefix} LLM stream for file content completed.` }, expressHttpRes);

          if (fileContent.startsWith('// LLM_ERROR:') || fileContent.startsWith('// LLM_WARNING:')) {
            triggerStepFailure(`LLM generation for file content failed.`, fileContent, currentStep.type, stepNumber, {i});
            return;
          }
        }
        // output_id already validated
        if (output_id) {
          taskContext.outputs[output_id.trim()] = fileContent;
          sendSseMessage('log_entry', { message: `[SSE] Stored content (from ${contentSource}) in context as output_id: '${output_id.trim()}'` }, expressHttpRes);
        }
        sendSseMessage('log_entry', { message: `[SSE] Creating file: '${filePath}' with content from ${contentSource}` }, expressHttpRes);
        console.log(`${stepLogPrefix} Calling fsAgent.createFile. Path: ${filePath}, Content Length: ${fileContent.length}, Options: ${JSON.stringify(fsOptions)}`);
        operationCountSinceLastConfirmation++;
        if (safetyMode && operationCountSinceLastConfirmation >= CONFIRM_AFTER_N_OPERATIONS && !fsOptions.requireConfirmation && !isConfirmedAction) {
            const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            sendSseMessage('confirmation_required', {
                confirmationId,
                message: `You've performed ${operationCountSinceLastConfirmation} operations. Proceed with the next batch (up to ${CONFIRM_AFTER_N_OPERATIONS} operations)?`,
                details: { type: 'batch_confirmation', nextOperationWillBe: currentStep.type, operationCount: operationCountSinceLastConfirmation }
            }, expressHttpRes);
            pendingConfirmations[confirmationId] = {
                expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep,
                actionType: 'batch_confirmation_resume_step', confirmationType: 'batch', safetyMode,
                operationCountSinceLastConfirmation: 0 // Reset for next batch if confirmed
            };
            console.log(`[executeStepsInternal] Batch confirmation required. Pausing task. ID: ${confirmationId}`);
            return; // Pause for batch confirmation
        }

        const createFileResult = fsAgent.createFile(filePath, fileContent, fsOptions); // This line was already here
        if (createFileResult.confirmationNeeded && !fsOptions.isConfirmedAction) {
          const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          pendingConfirmations[confirmationId] = {
            expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep,
            actionType: 'create_file_with_llm_content', confirmationType: 'file', safetyMode,
            operationCountSinceLastConfirmation // Preserve current count for when file op is confirmed
          };
          sendSseMessage('confirmation_required', { confirmationId, message: createFileResult.message, details: createFileResult }, expressHttpRes);
          console.log(`[executeStepsInternal] File-specific confirmation required for ${filePath}. Pausing task. ID: ${confirmationId}`);
          return; // Pause execution
        }
        if (createFileResult.success && isConfirmedAction) {
            operationCountSinceLastConfirmation = 0;
        }
        if (createFileResult.warnings && createFileResult.warnings.length > 0) {
          createFileResult.warnings.forEach((w) =>
            sendSseMessage('log_entry', { message: `[fsAgent Warning] ${w}` }, expressHttpRes)
          );
        }
        if (createFileResult.success) {
          sendSseMessage('file_written', { path: createFileResult.fullPath, message: `  -> ✅ File created successfully at: ${createFileResult.fullPath}` }, expressHttpRes);
        } else if (!createFileResult.confirmationNeeded) {
          console.error(`[executeStepsInternal] fsAgent.createFile failed for path '${filePath}'. Full result:`, JSON.stringify(createFileResult, null, 2));
          triggerStepFailure(
              `fsAgent.createFile failed: ${createFileResult.message || 'Unspecified error from fsAgent'}`,
              createFileResult,
              currentStep.type,
              stepNumber,
              {i}
          );
          return;
        }
      // Handles 'git_operation' steps for executing Git commands.
      } else if (currentStep.type === 'git_operation') {
      } else if (currentStep.type === 'git_operation') {
        if (!currentStep.details) { triggerStepFailure("Step details are missing for git_operation.", null, currentStep.type, stepNumber, {i}); return; }

        const { command, output_id, ...opDetails } = currentStep.details; // Use opDetails for command-specific values
        const projectRoot = path.resolve(__dirname, '../../'); // For path relativity
        let gitAgentFunction;
        let gitArgs = [];

        if (!command || typeof command !== 'string' || command.trim() === '') {
          triggerStepFailure("Missing or invalid 'command' in details for git_operation.", {command}, currentStep.type, stepNumber, {i}); return;
        }
        if (output_id !== undefined && (typeof output_id !== 'string' || output_id.trim() === '')) {
          triggerStepFailure("Invalid 'output_id' in details for git_operation: must be a non-empty string if provided.", {output_id}, currentStep.type, stepNumber, {i}); return;
        }

        const validCommands = ['add', 'commit', 'pull', 'push', 'revert_last_commit'];
        if (!validCommands.includes(command)) {
          triggerStepFailure(`Unsupported 'command' "${command}" in details for git_operation.`, {command}, currentStep.type, stepNumber, {i}); return;
        }

        let validatedOpDetailsString = `Command: ${command}`;

        switch (command) {
          case 'add':
            gitAgentFunction = gitAgent.gitAdd;
            if (!opDetails.filePath || typeof opDetails.filePath !== 'string' || opDetails.filePath.trim() === '') {
              triggerStepFailure("Missing or invalid 'filePath' in details for git add operation.", opDetails, currentStep.type, stepNumber, {i}); return;
            }
            // Path resolution logic (remains similar, ensure opDetails.filePath is used)
            const absoluteFilePath = fsAgent.resolvePathInWorkspace(opDetails.filePath).fullPath;
            if (absoluteFilePath) {
                gitArgs = [path.relative(projectRoot, absoluteFilePath)];
            } else {
                triggerStepFailure(`Error resolving path for git add: ${opDetails.filePath}`, { filePath: opDetails.filePath }, currentStep.type, stepNumber, {i}); return;
            }
            validatedOpDetailsString += `, FilePath: ${opDetails.filePath} (resolved to ${gitArgs[0]})`;
            break;
          case 'commit':
            gitAgentFunction = gitAgent.gitCommit;
            if (!opDetails.message || typeof opDetails.message !== 'string' || opDetails.message.trim() === '') {
              triggerStepFailure("Missing or invalid 'message' in details for git commit operation.", opDetails, currentStep.type, stepNumber, {i}); return;
            }
            gitArgs = [opDetails.message];
            validatedOpDetailsString += `, Message: "${opDetails.message}"`;
            break;
          case 'pull':
            gitAgentFunction = gitAgent.gitPull;
            if (opDetails.remote !== undefined && (typeof opDetails.remote !== 'string' || opDetails.remote.trim() === '')) {
              triggerStepFailure("Invalid 'remote' in details for git pull: must be non-empty string if provided.", opDetails, currentStep.type, stepNumber, {i}); return;
            }
            if (opDetails.branch !== undefined && (typeof opDetails.branch !== 'string' || opDetails.branch.trim() === '')) {
              triggerStepFailure("Invalid 'branch' in details for git pull: must be non-empty string if provided.", opDetails, currentStep.type, stepNumber, {i}); return;
            }
            gitArgs = [opDetails.remote, opDetails.branch]; // gitAgent handles undefined defaults
            validatedOpDetailsString += `, Remote: ${opDetails.remote || 'default'}, Branch: ${opDetails.branch || 'default'}`;
            break;
          case 'push':
            gitAgentFunction = gitAgent.gitPush;
            if (opDetails.remote !== undefined && (typeof opDetails.remote !== 'string' || opDetails.remote.trim() === '')) {
              triggerStepFailure("Invalid 'remote' in details for git push: must be non-empty string if provided.", opDetails, currentStep.type, stepNumber, {i}); return;
            }
            if (opDetails.branch !== undefined && (typeof opDetails.branch !== 'string' || opDetails.branch.trim() === '')) {
              triggerStepFailure("Invalid 'branch' in details for git push: must be non-empty string if provided.", opDetails, currentStep.type, stepNumber, {i}); return;
            }
            gitArgs = [opDetails.remote, opDetails.branch];
            validatedOpDetailsString += `, Remote: ${opDetails.remote || 'default'}, Branch: ${opDetails.branch || 'default'}`;
            break;
          case 'revert_last_commit':
            gitAgentFunction = gitAgent.gitRevertLastCommit;
            gitArgs = [];
            // No specific details needed for revert_last_commit beyond the command itself
            break;
        }

        console.log(`${stepLogPrefix} Validated Details - ${validatedOpDetailsString}, Output ID: ${output_id || 'N/A'}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - ${validatedOpDetailsString}, Output ID: ${output_id || 'N/A'}`);
        sendSseMessage('log_entry', { message: `[SSE] ${stepLogPrefix} Executing Git operation: ${command} with details ${JSON.stringify(opDetails)}` }, expressHttpRes);
        console.log(`${stepLogPrefix} Calling ${gitAgentFunction.name} with args: ${JSON.stringify(gitArgs)} and options.`);


        const stepRequiresConfirmation = currentStep.details.requireConfirmation === true;
        const stepDisablesConfirmation = currentStep.details?.requireConfirmation === false;
        let effectiveRequireConfirmationForStep = false;
        if (safetyMode) {
            effectiveRequireConfirmationForStep = !stepDisablesConfirmation;
        } else {
            effectiveRequireConfirmationForStep = stepRequiresConfirmation;
        }

        const gitOptions = {
            requireConfirmation: effectiveRequireConfirmationForStep,
            isConfirmedAction: isConfirmedAction
        };

        const modifyingGitCommands = ['commit', 'push', 'revert_last_commit']; // Ensure 'revert_last_commit' is here
        if (modifyingGitCommands.includes(command) || command === 'add') {
            operationCountSinceLastConfirmation++;
            // Batch confirmation check for modifying operations
            if (safetyMode && operationCountSinceLastConfirmation >= CONFIRM_AFTER_N_OPERATIONS && !gitOptions.requireConfirmation && !isConfirmedAction) {
                const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                sendSseMessage('confirmation_required', {
                    confirmationId,
                    message: `You've performed ${operationCountSinceLastConfirmation} operations. Proceed with the next batch (up to ${CONFIRM_AFTER_N_OPERATIONS} operations, next is git ${command})?`,
                    details: { type: 'batch_confirmation', nextOperationWillBe: currentStep.type, subType: command, operationCount: operationCountSinceLastConfirmation }
                }, expressHttpRes);
                pendingConfirmations[confirmationId] = {
                    expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep,
                    actionType: 'batch_confirmation_resume_step', confirmationType: 'batch', safetyMode,
                    operationCountSinceLastConfirmation: 0
                };
                console.log(`[executeStepsInternal] Batch confirmation required before git op. Pausing. ID: ${confirmationId}`);
                return;
            }
        }

        overallExecutionLog.push(
          `  -> Executing Git: ${command} ${gitArgs.join(' ')} with options: ${JSON.stringify(gitOptions)}`
        );
        // Call gitAgent method: arguments are specific to command, then options object
        // For revertLastCommit, gitArgs is empty, so it's just gitAgent.revertLastCommit(gitOptions)
        const result = await gitAgentFunction(...gitArgs, gitOptions);

        // Standard Safety Mode confirmation handling for the operation
        if (result.confirmationNeeded && !isConfirmedAction) {
            const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            pendingConfirmations[confirmationId] = {
                expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep,
                actionType: `git_${command}`, // e.g., git_revert_last_commit
                confirmationType: 'git', // General type for git operations
                safetyMode,
                operationCountSinceLastConfirmation // Preserve current op count
            };
            sendSseMessage('confirmation_required', {
                confirmationId,
                message: result.message, // Message from gitAgent (e.g., "Are you sure you want to revert the last commit?")
                details: {
                    type: 'git_confirmation',
                    command: command,
                    stepDetails: currentStep.details,
                    gitAgentDetails: result.details // Additional details from gitAgent if any
                }
            }, expressHttpRes);
            console.log(`[executeStepsInternal] Git operation '${command}' requires confirmation. Pausing. ID: ${confirmationId}`);
            return; // Pause execution, wait for user confirmation
        }

        // If the action was pre-confirmed (e.g. user clicked "confirm" in UI, or Safety Mode OFF)
        // and it was a modifying command, reset the batch operation counter.
        if (result.success && isConfirmedAction && modifyingGitCommands.includes(command)) {
             operationCountSinceLastConfirmation = 0; // Reset counter because this action was confirmed
        }

        const logMessage = `  -> Git operation '${command}' ${result.success ? 'succeeded' : 'failed'}. Message: ${result.message}`;
        overallExecutionLog.push(logMessage);
        sendSseMessage('log_entry', { message: logMessage }, expressHttpRes);

        if (!result.success && !result.confirmationNeeded) { // Genuine failure, not a confirmation pause
            const failureMessage = result.message || `Git operation '${command}' failed.`;
            // result.error might contain more details from gitAgent
            triggerStepFailure(failureMessage, result.error || result, currentStep.type, stepNumber, {i});
            return; // Pause execution due to failure
        }

        if (output_id && result.success && result.data) { // Store output if specified and available
            taskContext.outputs[output_id] = result.data;
            const storeMsg = `  -> Stored Git operation '${command}' output in context as output_id: '${output_id}'.`;
            overallExecutionLog.push(storeMsg);
            sendSseMessage('log_entry', { message: storeMsg }, expressHttpRes);
        } else if (output_id && !result.success) {
            overallExecutionLog.push(
                `  -> Git operation '${command}' failed or produced no data, not storing output for '${output_id}'.`
            );
        }
        // Note: Not all git operations reset operationCountSinceLastConfirmation, only modifying ones IF they were individually confirmed.
        // Batch confirmation resets are handled by the batch confirmation logic itself.
      // Handles 'show_workspace_tree' steps to display directory structures.
      } else if (currentStep.type === 'show_workspace_tree') {
        // This step is considered non-operational in terms of modification count
        let targetPath = WORKSPACE_DIR; // Default to overall workspace for non-sandboxed contexts
        let rootName = 'workspace_root';
        let originalTreePath = (currentStep.details && currentStep.details.path !== undefined) ? currentStep.details.path : '';

        if (currentStep.details && currentStep.details.path !== undefined && typeof currentStep.details.path !== 'string') {
          // If path is provided but not a string, it's invalid.
          // Unlike other steps, show_workspace_tree can proceed with a default if path is invalid or missing.
          console.warn(`${stepLogPrefix} Invalid 'path' in details for show_workspace_tree: must be a string if provided. Received: ${typeof currentStep.details.path}. Using workspace root.`);
          originalTreePath = ''; // Force default to root
        }

        console.log(`${stepLogPrefix} Validated Details - Path: ${originalTreePath || 'WORKSPACE_DIR'}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - Path: ${originalTreePath || 'WORKSPACE_DIR'}`);

        if (sandboxSubDir) {
            targetPath = path.join(WORKSPACE_DIR, sandboxSubDir, originalTreePath);
            rootName = sandboxSubDir + (originalTreePath ? `/${path.basename(originalTreePath)}` : '');
            // Ensure the sandboxed targetPath exists before trying to generate a tree
            if (!fs.existsSync(path.join(WORKSPACE_DIR, sandboxSubDir))) {
                fs.mkdirSync(path.join(WORKSPACE_DIR, sandboxSubDir), { recursive: true });
                 console.log(`[Sandboxing] Created sandbox dir for show_workspace_tree: ${sandboxSubDir}`);
            }
             console.log(`[Sandboxing] Remapped show_workspace_tree path for ${agentContext} to root: ${targetPath}`);
             sendSseMessage('log_entry', { message: `[SSE] Workspace tree path sandboxed for ${agentContext} to: ${rootName}` }, expressHttpRes);
        } else if (originalTreePath) {
            // If a path is provided but no sandbox, resolve it normally within WORKSPACE_DIR
            const resolvedPathResult = fsAgent.resolvePathInWorkspace(originalTreePath);
            if (resolvedPathResult.success) {
                targetPath = resolvedPathResult.fullPath;
                rootName = path.basename(targetPath);
            } else {
                triggerStepFailure(`Error resolving path for show_workspace_tree: ${resolvedPathResult.message}`, resolvedPathResult, currentStep.type, stepNumber, {i});
                return;
            }
        }
        // If no path provided and no sandbox, targetPath remains WORKSPACE_DIR, rootName workspace_root

        const treeString = fsAgent.generateDirectoryTree(targetPath, '', rootName);
        sendSseMessage('log_entry', { message: `Workspace tree (${rootName}):\n\`\`\`\n${treeString}\n\`\`\`` }, expressHttpRes);
      // Handles 'conference_task' steps for multi-model debates and synthesis.
      } else if (currentStep.type === 'conference_task') {
        if (!currentStep.details) { triggerStepFailure("Step details are missing for conference_task.", null, currentStep.type, stepNumber, {i}); return; }

        const {
          prompt: userPrompt,
          model_name: conferenceModelName, // Optional
          model_a_id, model_b_id, arbiter_model_id, // Optional
          model_a_role, model_b_role, arbiter_model_role, // Optional
          output_id, // Optional
          num_rounds // Optional
        } = currentStep.details;

        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim() === '') {
          triggerStepFailure("Missing or invalid 'prompt' in details for conference_task.", {userPrompt}, currentStep.type, stepNumber, {i}); return;
        }
        if (output_id !== undefined && (typeof output_id !== 'string' || output_id.trim() === '')) {
          triggerStepFailure("Invalid 'output_id' in details for conference_task: must be a non-empty string if provided.",{output_id}, currentStep.type, stepNumber, {i}); return;
        }
        if (num_rounds !== undefined && (typeof num_rounds !== 'number' || num_rounds <= 0)) {
          console.warn(`${stepLogPrefix} Invalid 'num_rounds' ("${num_rounds}"). Defaulting to 1.`);
          currentStep.details.num_rounds = 1; // Correct in currentStep for later use
        }
        // Optional string fields: if provided but not valid strings, they will be ignored by || default logic later.
        // Add warnings if types are unexpected for these optional fields.
        const stringFields = {conferenceModelName, model_a_id, model_b_id, arbiter_model_id, model_a_role, model_b_role, arbiter_model_role};
        for(const field in stringFields) {
            if (stringFields[field] !== undefined && typeof stringFields[field] !== 'string') {
                console.warn(`${stepLogPrefix} Invalid type for '${field}' (expected string, got ${typeof stringFields[field]}). Will use default or ignore. Value:`, stringFields[field]);
            }
        }

        const effectiveNumRounds = currentStep.details.num_rounds || 1; // Use potentially corrected value
        console.log(`${stepLogPrefix} Validated Details - UserPrompt length: ${userPrompt.length}, Output ID: ${output_id || 'N/A'}, Num Rounds: ${effectiveNumRounds}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - UserPrompt length: ${userPrompt.length}, Output ID: ${output_id || 'N/A'}, Num Rounds: ${effectiveNumRounds}`);

        const conferenceId = uuidv4();
        // This initial log is fine.
        sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Starting conference task for prompt: "${userPrompt.substring(0,100)}..."`}, expressHttpRes);
        overallExecutionLog.push(`  -> [Conference ${conferenceId}] Starting conference for prompt: "${userPrompt.substring(0,100)}..."`);

        const modelName = conferenceModelName || backendSettings.defaultOllamaModel || 'llama3';
        const finalModelARole = requestedModelARole || "Model A"; // Simpler defaults
        const finalModelBRole = requestedModelBRole || "Model B";
        const finalArbiterModelRole = requestedArbiterModelRole || "Arbiter";

        let conferenceLogMessagesArray = []; // For storing specific conference logs if needed for output

        let responseA = ''; // To store Model A's final response for the round/conference
        let responseB = ''; // To store Model B's final response for the round/conference
        let arbiterResponse = '';
        let debate_history = [];
        // Prompts for logging purposes
        let model_a_prompt_for_log = "";
        let model_b_prompt_for_log = "";
        let arbiter_prompt_for_log = "";

        // Try-catch blocks for each model call will go here, removing the outer try-catch
        if (num_rounds === 1) {
          // Model A
          try {
            const systemPromptA = `You are ${finalModelARole}. Analyze the following prompt and provide a concise, logical answer.`;
            const fullPromptA = `${systemPromptA}\n\nUser Prompt: "${userPrompt}"`;
            model_a_prompt_for_log = fullPromptA;
            responseA = await generateFromLocal(fullPromptA, model_a_id || modelName, expressHttpRes, { agentType: 'conference_agent', agentRole: 'model_a', speakerContext: finalModelARole });
            if (responseA.startsWith('// LLM_ERROR:') || responseA.startsWith('// LLM_WARNING:')) {
              throw new Error(responseA); // Treat LLM error strings as exceptions
            }
            sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Model A (${finalModelARole}) response received.`}, expressHttpRes);
            overallExecutionLog.push(`  -> [Conference ${conferenceId}] Model A (${finalModelARole}) response (full length ${responseA.length}): ${responseA.substring(0,100)}...`);
            debate_history.push({ round: 1, model_a_response: responseA, model_b_response: "" });
          } catch (modelAError) {
            const errorMsg = `Conference Model A (${finalModelARole}) failed: ${modelAError.message}`;
            triggerStepFailure(errorMsg, modelAError, currentStep.type, stepNumber, {i});
            return; // Stop processing this conference task
          }

          // Model B
          try {
            const systemPromptB = `You are ${finalModelBRole}. Analyze the following prompt and provide an innovative and imaginative answer.`;
            const fullPromptB = `${systemPromptB}\n\nUser Prompt: "${userPrompt}"`;
            model_b_prompt_for_log = fullPromptB;
            responseB = await generateFromLocal(fullPromptB, model_b_id || modelName, expressHttpRes, { agentType: 'conference_agent', agentRole: 'model_b', speakerContext: finalModelBRole });
            if (responseB.startsWith('// LLM_ERROR:') || responseB.startsWith('// LLM_WARNING:')) {
              throw new Error(responseB);
            }
            sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Model B (${finalModelBRole}) response received.`}, expressHttpRes);
            overallExecutionLog.push(`  -> [Conference ${conferenceId}] Model B (${finalModelBRole}) response (full length ${responseB.length}): ${responseB.substring(0,100)}...`);
            if (debate_history.length > 0) debate_history[0].model_b_response = responseB; else debate_history.push({ round: 1, model_a_response: responseA, model_b_response: responseB });
          } catch (modelBError) {
            const errorMsg = `Conference Model B (${finalModelBRole}) failed: ${modelBError.message}`;
            triggerStepFailure(errorMsg, modelBError, currentStep.type, stepNumber, {i});
            return;
          }

          // Arbiter Model
          try {
            const arbiterSystemPrompt = `You are an ${finalArbiterModelRole}. Given the original prompt and the two responses below, evaluate them. Determine which response is better or synthesize a comprehensive answer that combines the best elements of both.`;
            const arbiterFullPrompt = `${arbiterSystemPrompt}\n\nOriginal Prompt: "${userPrompt}"\n\nResponse A (${finalModelARole}): "${responseA}"\n\nResponse B (${finalModelBRole}): "${responseB}"\n\nYour evaluation and synthesized answer:`;
            arbiter_prompt_for_log = arbiterFullPrompt;
            arbiterResponse = await generateFromLocal(arbiterFullPrompt, arbiter_model_id || modelName, expressHttpRes, { agentType: 'conference_agent', agentRole: 'arbiter', speakerContext: finalArbiterModelRole });
            if (arbiterResponse.startsWith('// LLM_ERROR:') || arbiterResponse.startsWith('// LLM_WARNING:')) {
              throw new Error(arbiterResponse);
            }
            sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Arbiter Model (${finalArbiterModelRole}) response received.`}, expressHttpRes);
            overallExecutionLog.push(`  -> [Conference ${conferenceId}] Arbiter Model (${finalArbiterModelRole}) response (full length ${arbiterResponse.length}): ${arbiterResponse.substring(0,100)}...`);
          } catch (arbiterError) {
            const errorMsg = `Conference Arbiter Model (${finalArbiterModelRole}) failed: ${arbiterError.message}`;
            triggerStepFailure(errorMsg, arbiterError, currentStep.type, stepNumber, {i});
            return;
          }
        } else { // num_rounds > 1
          for (let round = 1; round <= num_rounds; round++) {
            sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Starting Round ${round}/${num_rounds}`}, expressHttpRes);
            overallExecutionLog.push(`  -> [Conference ${conferenceId}] Starting Round ${round}/${num_rounds}`);
            conferenceLogMessagesArray.push(`Round ${round}/${num_rounds} starting.`);

            // Model A's turn
            try {
              let promptA;
              if (round === 1) {
                promptA = `You are ${finalModelARole}. The user's request is: "${userPrompt}". Provide your initial argument or response.`;
              } else {
                promptA = `You are ${finalModelARole}. The original request was: "${userPrompt}". Your opponent (Model B) previously said: "${responseB}". Based on this, provide your updated argument or rebuttal as ${finalModelARole}.`;
              }
              model_a_prompt_for_log = promptA;
              const currentResponseA = await generateFromLocal(promptA, model_a_id || modelName, expressHttpRes, { agentType: 'conference_agent', agentRole: 'model_a', speakerContext: finalModelARole });
              if (currentResponseA.startsWith('// LLM_ERROR:') || currentResponseA.startsWith('// LLM_WARNING:')) {
                throw new Error(currentResponseA);
              }
              responseA = currentResponseA;
              sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId} R${round}] Model A response received.`}, expressHttpRes);
              overallExecutionLog.push(`  -> [Conference ${conferenceId} R${round}] Model A (full length ${responseA.length}): ${responseA.substring(0,50)}...`);
            } catch (modelAError) {
              const errorMsg = `Conference Model A (${finalModelARole}) failed in Round ${round}: ${modelAError.message}`;
              triggerStepFailure(errorMsg, modelAError, currentStep.type, stepNumber, {i});
              return;
            }

            // Model B's turn
            try {
              let promptB;
              if (round === 1) {
                promptB = `You are ${finalModelBRole}. The user's request is: "${userPrompt}". Provide your initial argument or response.`;
              } else {
                promptB = `You are ${finalModelBRole}. The original request was: "${userPrompt}". Your opponent (Model A) just said: "${responseA}". Based on this, provide your updated argument or rebuttal as ${finalModelBRole}.`;
              }
              model_b_prompt_for_log = promptB;
              const currentResponseB = await generateFromLocal(promptB, model_b_id || modelName, expressHttpRes, { agentType: 'conference_agent', agentRole: 'model_b', speakerContext: finalModelBRole });
              if (currentResponseB.startsWith('// LLM_ERROR:') || currentResponseB.startsWith('// LLM_WARNING:')) {
                throw new Error(currentResponseB);
              }
              responseB = currentResponseB;
              sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId} R${round}] Model B response received.`}, expressHttpRes);
              overallExecutionLog.push(`  -> [Conference ${conferenceId} R${round}] Model B (full length ${responseB.length}): ${responseB.substring(0,50)}...`);
            } catch (modelBError) {
              const errorMsg = `Conference Model B (${finalModelBRole}) failed in Round ${round}: ${modelBError.message}`;
              triggerStepFailure(errorMsg, modelBError, currentStep.type, stepNumber, {i});
              return;
            }
            debate_history.push({ round: round, model_a_response: responseA, model_b_response: responseB });
          }

          // Arbiter after all rounds
          try {
            let formattedDebateHistory = debate_history.map(r => `Round ${r.round}:\n  Model A (${finalModelARole}): ${r.model_a_response}\n  Model B (${finalModelBRole}): ${r.model_b_response}`).join('\n\n');
            const arbiterSystemPrompt = `You are an ${finalArbiterModelRole}. You have observed a debate between Model A (${finalModelARole}) and Model B (${finalModelBRole}) over several rounds.`;
            const arbiterFullPrompt = `${arbiterSystemPrompt}\n\nOriginal Prompt: "${userPrompt}"\n\nFull Debate History:\n${formattedDebateHistory}\n\nBased on the entire debate, provide a comprehensive synthesized answer as ${finalArbiterModelRole}.`;
            arbiter_prompt_for_log = arbiterFullPrompt;
            arbiterResponse = await generateFromLocal(arbiterFullPrompt, arbiter_model_id || modelName, expressHttpRes, { agentType: 'conference_agent', agentRole: 'arbiter', speakerContext: finalArbiterModelRole });
            if (arbiterResponse.startsWith('// LLM_ERROR:') || arbiterResponse.startsWith('// LLM_WARNING:')) {
              throw new Error(arbiterResponse);
            }
            sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Arbiter Model (${finalArbiterModelRole}) response received.`}, expressHttpRes);
            overallExecutionLog.push(`  -> [Conference ${conferenceId}] Arbiter Model (${finalArbiterModelRole}) response (full length ${arbiterResponse.length}): ${arbiterResponse.substring(0,100)}...`);
          } catch (arbiterError) {
            const errorMsg = `Conference Arbiter Model (${finalArbiterModelRole}) failed after debate: ${arbiterError.message}`;
            triggerStepFailure(errorMsg, arbiterError, currentStep.type, stepNumber, {i});
            return;
          }
        }
        // Logging and output handling remains the same, but outside the removed try-catch
        if (output_id) {
          // Store the structured result
            taskContext.outputs[output_id] = {
              final_response: arbiterResponse,
              model_a_response: responseA, // Contains the final response from Model A after all rounds
              model_b_response: responseB, // Contains the final response from Model B after all rounds
              log_messages: conferenceLogMessagesArray // Optional array of specific conference log messages
            };
            sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Stored structured conference result in context as output_id: '${output_id}'`}, expressHttpRes);
            overallExecutionLog.push(`  -> [Conference ${conferenceId}] Stored structured conference result in context as output_id: '${output_id}'`);
          }

          // Log conference details to conferences.json (this logging can remain detailed)
          const logEntry = {
            conference_id: conferenceId,
            timestamp: new Date().toISOString(),
            original_prompt: userPrompt,
            num_rounds: num_rounds, // Log num_rounds
            model_a_name: modelName,
            model_a_role: finalModelARole,
            // For simplicity, log only the last prompts for A and B if multi-round, or the direct prompts if single round.
            // A more detailed logging could store all prompts for each round in debate_history if needed.
            model_a_prompt: model_a_prompt_for_log,
            model_b_name: modelName,
            model_b_role: finalModelBRole,
            model_b_prompt: model_b_prompt_for_log,
            debate_history: debate_history, // Log the full debate history
            arbiter_model_name: modelName,
            arbiter_model_role: finalArbiterModelRole,
            arbiter_model_prompt: arbiter_prompt_for_log,
            arbiter_model_response: arbiterResponse,
            source: 'roadmap_step'
          };

          let conferences = [];
          try {
            if (fs.existsSync(CONFERENCES_LOG_FILE)) {
              const fileContent = fs.readFileSync(CONFERENCES_LOG_FILE, 'utf-8');
              if (fileContent.trim() !== "") { conferences = JSON.parse(fileContent); }
            }
          } catch (readError) {
            console.warn(`[Conference ${conferenceId}] Error reading or parsing ${CONFERENCES_LOG_FILE} during step execution. Initializing. Error: ${readError.message}`);
            sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Warning: Could not read conference log file: ${readError.message}. Will create a new one.`}, expressHttpRes);
            conferences = []; // Initialize if file is corrupt or unparsable
          }
          conferences.push(logEntry);
          fs.writeFileSync(CONFERENCES_LOG_FILE, JSON.stringify(conferences, null, 2));
          sendSseMessage('log_entry', { message: `[SSE] [Conference ${conferenceId}] Conference log saved.`}, expressHttpRes);
          overallExecutionLog.push(`  -> [Conference ${conferenceId}] Logged successfully to ${CONFERENCES_LOG_FILE}`);

        // Removed the outer try-catch for confError as errors are handled per model call now.

      } else if (currentStep.type === 'createDirectory') {
        if (!currentStep.details) { triggerStepFailure("Step details are missing for createDirectory.", null, currentStep.type, stepNumber, {i}); return; }
        const { dirPath: originalDirPath } = currentStep.details;
        let dirPath = originalDirPath;

        if (!dirPath || typeof dirPath !== 'string' || dirPath.trim() === '') {
          triggerStepFailure("Missing or invalid 'dirPath' in details for createDirectory.", {dirPath}, currentStep.type, stepNumber, {i}); return;
        }
        console.log(`${stepLogPrefix} Validated Details - DirPath: ${dirPath}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - DirPath: ${dirPath}`);

        if (sandboxSubDir) {
          dirPath = path.join(sandboxSubDir, dirPath);
          console.log(`[Sandboxing] Remapped dirPath for ${agentContext} to: ${dirPath}`);
          sendSseMessage('log_entry', { message: `[SSE] Path sandboxed for ${agentContext}: ${dirPath}` }, expressHttpRes);
        }

        const stepRequiresConfirmation = currentStep.details?.requireConfirmation === true;
        const stepDisablesConfirmation = currentStep.details?.requireConfirmation === false;
        let effectiveRequireConfirmationForStep = false;
        if (safetyMode) { effectiveRequireConfirmationForStep = !stepDisablesConfirmation; }
        else { effectiveRequireConfirmationForStep = stepRequiresConfirmation; }

        operationCountSinceLastConfirmation++;
        if (safetyMode && operationCountSinceLastConfirmation >= CONFIRM_AFTER_N_OPERATIONS && !effectiveRequireConfirmationForStep && !isConfirmedAction) {
            const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            sendSseMessage('confirmation_required', { confirmationId, message: `Batch confirmation: ${operationCountSinceLastConfirmation} operations. Proceed?`, details: { type: 'batch_confirmation', nextOperationWillBe: currentStep.type } }, expressHttpRes);
            pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'batch', safetyMode, operationCountSinceLastConfirmation: 0 };
            return;
        }
        const result = fsAgent.createDirectory(dirPath, { requireConfirmation: effectiveRequireConfirmationForStep, isConfirmedAction });
        if (result.confirmationNeeded && !isConfirmedAction) {
          const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'file', safetyMode, operationCountSinceLastConfirmation };
          sendSseMessage('confirmation_required', { confirmationId, message: result.message, details: result }, expressHttpRes);
          return;
        }
        if (result.success && isConfirmedAction) { operationCountSinceLastConfirmation = 0; }
        if (result.success) sendSseMessage('log_entry', { message: `✅ Directory created: ${result.fullPath}` }, expressHttpRes);
        else if (!result.confirmationNeeded) { // Genuine failure
            triggerStepFailure(`fsAgent.createDirectory failed: ${result.message}`, result, currentStep.type, stepNumber, {i});
            return;
        }
      } else if (currentStep.type === 'createFile') {
        if (!currentStep.details) { triggerStepFailure("Step details are missing for createFile.", null, currentStep.type, stepNumber, {i}); return; }
        const { filePath: originalFilePath_create, content } = currentStep.details;
        let filePath = originalFilePath_create;
        const originalFilePathForExtensionCheck_create = originalFilePath_create;

        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
            triggerStepFailure("Missing or invalid 'filePath' in details for createFile.", {filePath}, currentStep.type, stepNumber, {i}); return;
        }
        if (content === undefined || typeof content !== 'string') { // Allow empty string for content
            triggerStepFailure("Missing or invalid 'content' in details for createFile (must be a string).", {contentType: typeof content}, currentStep.type, stepNumber, {i}); return;
        }
        console.log(`${stepLogPrefix} Validated Details - FilePath: ${filePath}, Content Length: ${content.length}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - FilePath: ${filePath}, Content Length: ${content.length}`);

        if (sandboxSubDir) {
          filePath = path.join(sandboxSubDir, filePath);
          console.log(`[Sandboxing] Remapped filePath for ${agentContext} to: ${filePath}`);
          sendSseMessage('log_entry', { message: `[SSE] Path sandboxed for ${agentContext}: ${filePath}` }, expressHttpRes);
        }

        // File type restriction check
        if ((agentContext === 'conference_agent' || agentContext === 'brainstorming_agent') && originalFilePathForExtensionCheck_create) {
          const fileExt = path.extname(originalFilePathForExtensionCheck_create).toLowerCase();
          if (!ALLOWED_AGENT_FILE_EXTENSIONS.includes(fileExt)) {
            const errorMsg = `File type '${fileExt}' is not allowed for ${agentContext}. Allowed types: ${ALLOWED_AGENT_FILE_EXTENSIONS.join(', ')}`;
            sendSseMessage('error', { content: `[SSE] ${errorMsg}` });
            overallExecutionLog.push(`  -> ❌ ${errorMsg}`);
            console.warn(`[File Restriction] ${errorMsg}`);
            triggerStepFailure(errorMsg, { filePath: originalFilePathForExtensionCheck_create, extension: fileExt, allowedExtensions: ALLOWED_AGENT_FILE_EXTENSIONS }, currentStep.type, stepNumber, {i});
            return; // Important: stop processing this step
          }
        }

        const stepRequiresConfirmation = currentStep.details?.requireConfirmation === true;
        const stepDisablesConfirmation = currentStep.details?.requireConfirmation === false;
        let effectiveRequireConfirmationForStep = false;
        if (safetyMode) { effectiveRequireConfirmationForStep = !stepDisablesConfirmation; }
        else { effectiveRequireConfirmationForStep = stepRequiresConfirmation; }

        operationCountSinceLastConfirmation++;
        if (safetyMode && operationCountSinceLastConfirmation >= CONFIRM_AFTER_N_OPERATIONS && !effectiveRequireConfirmationForStep && !isConfirmedAction) {
            const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            sendSseMessage('confirmation_required', { confirmationId, message: `Batch confirmation: ${operationCountSinceLastConfirmation} operations. Proceed?`, details: { type: 'batch_confirmation', nextOperationWillBe: currentStep.type } }, expressHttpRes);
            pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'batch', safetyMode, operationCountSinceLastConfirmation: 0 };
            return;
        }
        const result = fsAgent.createFile(filePath, content, { requireConfirmation: effectiveRequireConfirmationForStep, isConfirmedAction });
        if (result.confirmationNeeded && !isConfirmedAction) {
          const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'file', safetyMode, operationCountSinceLastConfirmation };
          sendSseMessage('confirmation_required', { confirmationId, message: result.message, details: result }, expressHttpRes);
          return;
        }
        if (result.success && isConfirmedAction) { operationCountSinceLastConfirmation = 0; }
        if (result.success) {
            sendSseMessage('file_written', { path: result.fullPath, message: `✅ File created: ${result.fullPath}` }, expressHttpRes);
        } else if (!result.confirmationNeeded) { // Genuine failure
            console.error(`[executeStepsInternal] fsAgent.createFile (from manual step type 'createFile') failed for path '${filePath}'. Full result:`, JSON.stringify(result, null, 2));
            triggerStepFailure(
                `fsAgent.createFile failed: ${result.message || 'Unspecified error from fsAgent'}`,
                result,
                currentStep.type,
                stepNumber,
                {i}
            );
            return;
        }
      } else if ( currentStep.type === 'readFile' || currentStep.type === 'read_file_to_output') {
        if (!currentStep.details) { triggerStepFailure("Step details are missing for readFile.", null, currentStep.type, stepNumber, {i}); return; }
        const { filePath: originalFilePath_read, output_id } = currentStep.details;
        let filePath = originalFilePath_read;

        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
            triggerStepFailure("Missing or invalid 'filePath' in details for readFile.", {filePath}, currentStep.type, stepNumber, {i}); return;
        }
        if (!output_id || typeof output_id !== 'string' || output_id.trim() === '') {
            triggerStepFailure("Missing or invalid 'output_id' in details for readFile.", {output_id}, currentStep.type, stepNumber, {i}); return;
        }
        console.log(`${stepLogPrefix} Validated Details - FilePath: ${filePath}, Output ID: ${output_id}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - FilePath: ${filePath}, Output ID: ${output_id}`);

        if (sandboxSubDir) {
          filePath = path.join(sandboxSubDir, filePath);
          console.log(`[Sandboxing] Remapped filePath for ${agentContext} to: ${filePath}`);
          sendSseMessage('log_entry', { message: `[SSE] Path sandboxed for ${agentContext}: ${filePath}` }, expressHttpRes);
        }

        const result = fsAgent.readFile(filePath);
        if (result.success) {
          if (output_id) taskContext.outputs[output_id] = result.content;
          sendSseMessage('log_entry', { message: `✅ File read: ${result.fullPath}. Stored in ${output_id || 'log'}.` }, expressHttpRes);
        } else { // Genuine failure
            triggerStepFailure(`fsAgent.readFile failed: ${result.message}`, result, currentStep.type, stepNumber, {i});
            return;
        }
      } else if (currentStep.type === 'updateFile') {
        if (!currentStep.details) { triggerStepFailure("Step details are missing for updateFile.", null, currentStep.type, stepNumber, {i}); return; }
        const { filePath: originalFilePath_update, content, append } = currentStep.details;
        let filePath = originalFilePath_update;
        const originalFilePathForExtensionCheck_update = originalFilePath_update;

        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
            triggerStepFailure("Missing or invalid 'filePath' in details for updateFile.", {filePath}, currentStep.type, stepNumber, {i}); return;
        }
        if (content === undefined || typeof content !== 'string') { // Allow empty string for content
            triggerStepFailure("Missing or invalid 'content' in details for updateFile (must be a string).", {contentType: typeof content}, currentStep.type, stepNumber, {i}); return;
        }
        if (append !== undefined && typeof append !== 'boolean') {
            triggerStepFailure("Invalid 'append' value in details for updateFile (must be boolean if provided).", {append}, currentStep.type, stepNumber, {i}); return;
        }
        const effectiveAppend = append === undefined ? false : append; // Default append to false
        console.log(`${stepLogPrefix} Validated Details - FilePath: ${filePath}, Content Length: ${content.length}, Append: ${effectiveAppend}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - FilePath: ${filePath}, Content Length: ${content.length}, Append: ${effectiveAppend}`);
        if (sandboxSubDir) {
          filePath = path.join(sandboxSubDir, filePath);
          console.log(`[Sandboxing] Remapped filePath for ${agentContext} to: ${filePath}`);
          sendSseMessage('log_entry', { message: `[SSE] Path sandboxed for ${agentContext}: ${filePath}` }, expressHttpRes);
        }

        // File type restriction check
        if ((agentContext === 'conference_agent' || agentContext === 'brainstorming_agent') && originalFilePathForExtensionCheck_update) {
          const fileExt = path.extname(originalFilePathForExtensionCheck_update).toLowerCase();
          if (!ALLOWED_AGENT_FILE_EXTENSIONS.includes(fileExt)) {
            const errorMsg = `File type '${fileExt}' is not allowed for ${agentContext}. Allowed types: ${ALLOWED_AGENT_FILE_EXTENSIONS.join(', ')}`;
            sendSseMessage('error', { content: `[SSE] ${errorMsg}` });
            overallExecutionLog.push(`  -> ❌ ${errorMsg}`);
            console.warn(`[File Restriction] ${errorMsg}`);
            triggerStepFailure(errorMsg, { filePath: originalFilePathForExtensionCheck_update, extension: fileExt, allowedExtensions: ALLOWED_AGENT_FILE_EXTENSIONS }, currentStep.type, stepNumber, {i});
            return; // Important: stop processing this step
          }
        }

        const stepRequiresConfirmation = currentStep.details?.requireConfirmation === true;
        const stepDisablesConfirmation = currentStep.details?.requireConfirmation === false;
        let effectiveRequireConfirmationForStep = false;
        if (safetyMode) { effectiveRequireConfirmationForStep = !stepDisablesConfirmation; }
        else { effectiveRequireConfirmationForStep = stepRequiresConfirmation; }

        operationCountSinceLastConfirmation++;
        if (safetyMode && operationCountSinceLastConfirmation >= CONFIRM_AFTER_N_OPERATIONS && !effectiveRequireConfirmationForStep && !isConfirmedAction) {
            const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            sendSseMessage('confirmation_required', { confirmationId, message: `Batch confirmation: ${operationCountSinceLastConfirmation} operations. Proceed?`, details: { type: 'batch_confirmation', nextOperationWillBe: currentStep.type } }, expressHttpRes);
            pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'batch', safetyMode, operationCountSinceLastConfirmation: 0 };
            return;
        }
        const result = fsAgent.updateFile(filePath, content, { append, requireConfirmation: effectiveRequireConfirmationForStep, isConfirmedAction });
        if (result.confirmationNeeded && !isConfirmedAction) {
          const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'file', safetyMode, operationCountSinceLastConfirmation };
          sendSseMessage('confirmation_required', { confirmationId, message: result.message, details: result }, expressHttpRes);
          return;
        }
        if (result.success && isConfirmedAction) { operationCountSinceLastConfirmation = 0; }
        if (result.success) sendSseMessage('log_entry', { message: `✅ File updated: ${result.fullPath}` }, expressHttpRes);
        else if (!result.confirmationNeeded) { // Genuine failure
            triggerStepFailure(`fsAgent.updateFile failed: ${result.message}`, result, currentStep.type, stepNumber, {i});
            return;
        }
      } else if (currentStep.type === 'deleteFile') {
        if (!currentStep.details) { triggerStepFailure("Step details are missing for deleteFile.", null, currentStep.type, stepNumber, {i}); return; }
        const { filePath: originalFilePath_delete } = currentStep.details;
        let filePath = originalFilePath_delete;

        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
            triggerStepFailure("Missing or invalid 'filePath' in details for deleteFile.", {filePath}, currentStep.type, stepNumber, {i}); return;
        }
        console.log(`${stepLogPrefix} Validated Details - FilePath: ${filePath}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - FilePath: ${filePath}`);
        if (sandboxSubDir) {
          filePath = path.join(sandboxSubDir, filePath);
          console.log(`[Sandboxing] Remapped filePath for ${agentContext} to: ${filePath}`);
          sendSseMessage('log_entry', { message: `[SSE] Path sandboxed for ${agentContext}: ${filePath}` }, expressHttpRes);
        }

        const stepRequiresConfirmation = currentStep.details?.requireConfirmation === true;
        const stepDisablesConfirmation = currentStep.details?.requireConfirmation === false;
        let effectiveRequireConfirmationForStep = false;
        if (safetyMode) { effectiveRequireConfirmationForStep = !stepDisablesConfirmation; }
        else { effectiveRequireConfirmationForStep = stepRequiresConfirmation; }

        operationCountSinceLastConfirmation++;
        if (safetyMode && operationCountSinceLastConfirmation >= CONFIRM_AFTER_N_OPERATIONS && !effectiveRequireConfirmationForStep && !isConfirmedAction) {
            const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            sendSseMessage('confirmation_required', { confirmationId, message: `Batch confirmation: ${operationCountSinceLastConfirmation} operations. Proceed?`, details: { type: 'batch_confirmation', nextOperationWillBe: currentStep.type } }, expressHttpRes);
            pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'batch', safetyMode, operationCountSinceLastConfirmation: 0 };
            return;
        }
        const result = fsAgent.deleteFile(filePath, { requireConfirmation: effectiveRequireConfirmationForStep, isConfirmedAction });
        if (result.confirmationNeeded && !isConfirmedAction) {
          const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'file', safetyMode, operationCountSinceLastConfirmation };
          sendSseMessage('confirmation_required', { confirmationId, message: result.message, details: result }, expressHttpRes);
          return;
        }
        if (result.success && isConfirmedAction) { operationCountSinceLastConfirmation = 0; }
        if (result.success) sendSseMessage('log_entry', { message: `✅ File deleted: ${result.fullPath}` }, expressHttpRes);
        else if (!result.confirmationNeeded) { // Genuine failure
            triggerStepFailure(`fsAgent.deleteFile failed: ${result.message}`, result, currentStep.type, stepNumber, {i});
            return;
        }
      } else if (currentStep.type === 'deleteDirectory') {
        if (!currentStep.details) { triggerStepFailure("Step details are missing for deleteDirectory.", null, currentStep.type, stepNumber, {i}); return; }
        const { dirPath: originalDirPath_delete } = currentStep.details;
        let dirPath = originalDirPath_delete;

        if (!dirPath || typeof dirPath !== 'string' || dirPath.trim() === '') {
            triggerStepFailure("Missing or invalid 'dirPath' in details for deleteDirectory.", {dirPath}, currentStep.type, stepNumber, {i}); return;
        }
        console.log(`${stepLogPrefix} Validated Details - DirPath: ${dirPath}`);
        overallExecutionLog.push(`${stepLogPrefix} Validated Details - DirPath: ${dirPath}`);

        if (sandboxSubDir) {
          dirPath = path.join(sandboxSubDir, dirPath);
          console.log(`[Sandboxing] Remapped dirPath for ${agentContext} to: ${dirPath}`);
          sendSseMessage('log_entry', { message: `[SSE] Path sandboxed for ${agentContext}: ${dirPath}` }, expressHttpRes);
        }

        const stepRequiresConfirmation = currentStep.details?.requireConfirmation === true;
        const stepDisablesConfirmation = currentStep.details?.requireConfirmation === false;
        let effectiveRequireConfirmationForStep = false;
        if (safetyMode) { effectiveRequireConfirmationForStep = !stepDisablesConfirmation; }
        else { effectiveRequireConfirmationForStep = stepRequiresConfirmation; }

        operationCountSinceLastConfirmation++;
        if (safetyMode && operationCountSinceLastConfirmation >= CONFIRM_AFTER_N_OPERATIONS && !effectiveRequireConfirmationForStep && !isConfirmedAction) {
            const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            sendSseMessage('confirmation_required', { confirmationId, message: `Batch confirmation: ${operationCountSinceLastConfirmation} operations. Proceed?`, details: { type: 'batch_confirmation', nextOperationWillBe: currentStep.type } }, expressHttpRes);
            pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'batch', safetyMode, operationCountSinceLastConfirmation: 0 };
            return;
        }
        const result = fsAgent.deleteDirectory(dirPath, { requireConfirmation: effectiveRequireConfirmationForStep, isConfirmedAction });
        if (result.confirmationNeeded && !isConfirmedAction) {
          const confirmationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          pendingConfirmations[confirmationId] = { expressHttpRes, task_description, steps, currentStepIndex: i, taskContext, overallExecutionLog, currentStep, confirmationType: 'file', safetyMode, operationCountSinceLastConfirmation };
          sendSseMessage('confirmation_required', { confirmationId, message: result.message, details: result }, expressHttpRes);
          return;
        }
        if (result.success && isConfirmedAction) { operationCountSinceLastConfirmation = 0; }
        if (result.success) sendSseMessage('log_entry', { message: `✅ Directory deleted: ${result.fullPath}` }, expressHttpRes);
        else if (!result.confirmationNeeded) { // Genuine failure
            triggerStepFailure(`fsAgent.deleteDirectory failed: ${result.message}`, result, currentStep.type, stepNumber, {i});
            return;
        }
        } else {
          sendSseMessage('log_entry', {
            message: `  -> Unknown step type '${currentStep.type}'. Execution not implemented.`,
          }, expressHttpRes);
        }
        // If we reach here, the step's core logic did not throw an error for this attempt
        stepProcessedSuccessfully = true;

      } catch (stepAttemptError) {
        if (!stepAttemptError.message) {
            lastErrorForStep = new Error("Step attempt failed without a specific message.");
        } else {
            lastErrorForStep = stepAttemptError;
        }
        const maxRetries = currentStep.details?.maxRetries || 0;
        // const onErrorAction = currentStep.details?.onError; // For future refinement logic

        if (currentStep._internalRetryCount < maxRetries) {
          currentStep._internalRetryCount++;
          const retryLogMsg = `[SSE] Step ${stepNumber} (${currentStep.type}) failed. Attempting retry ${currentStep._internalRetryCount}/${maxRetries}. Error: ${stepAttemptError.message}`;
          sendSseMessage('log_entry', { message: retryLogMsg }, expressHttpRes);
          overallExecutionLog.push(retryLogMsg.replace('[SSE]', ''));
          console.warn(`[executeStepsInternal] ${retryLogMsg.replace('[SSE]', '')}`);
          // The while loop will continue for the next retry
        } else if (currentStep.details?.onError === 'refine_and_retry' &&
                   currentStep._internalRefineCount < (currentStep.details?.maxRefinementRetries || 1)) {
          currentStep._internalRefineCount++;
          const refineLogMsg = `[SSE] Step ${stepNumber} (${currentStep.type}) failed. Attempting refinement ${currentStep._internalRefineCount}/${currentStep.details?.maxRefinementRetries || 1}. Error: ${stepAttemptError.message}`;
          sendSseMessage('log_entry', { message: refineLogMsg }, expressHttpRes);
          overallExecutionLog.push(refineLogMsg.replace('[SSE]', ''));
          console.warn(`[executeStepsInternal] ${refineLogMsg.replace('[SSE]', '')}`);

          const refinementPrompt = `
Original step: ${JSON.stringify(currentStep, null, 2)}
Error encountered: ${stepAttemptError.message}
Task context outputs so far: ${JSON.stringify(taskContext.outputs, null, 2)}

Please provide a revised JSON for the 'details' field of this step to address the error.
Output *only* the revised JSON for the 'details' field. For example:
{ "prompt": "New, corrected prompt here...", "filePath": "path/to/file.ext" }
Do not output the entire step, only the 'details' object.
`;
          sendSseMessage('log_entry', { message: `[SSE] Step ${stepNumber}: Sending refinement prompt to LLM...` }, expressHttpRes);
          // Use a different model or settings if needed for refinement, e.g. 'phi3' for structured output
          const refinedDetailsString = await generateFromLocal(refinementPrompt, 'phi3', null); // Pass null for expressRes to avoid streaming to client during refinement

          if (refinedDetailsString.startsWith('// LLM_ERROR:') || refinedDetailsString.startsWith('// LLM_WARNING:')) {
            const llmErrorMsg = `[SSE] Step ${stepNumber}: LLM failed to provide refinement. Error: ${refinedDetailsString}`;
            sendSseMessage('error', { content: llmErrorMsg }, expressHttpRes);
            overallExecutionLog.push(llmErrorMsg.replace('[SSE]', ''));
            console.error(`[executeStepsInternal] ${llmErrorMsg.replace('[SSE]', '')}`);
            // This refinement attempt failed, break from while to triggerStepFailure
            break;
          }

          try {
            const refinedDetails = JSON.parse(refinedDetailsString);
            const refinementNotification = `[SSE] Step ${stepNumber}: LLM proposed refinement: ${JSON.stringify(refinedDetails)}`;
            sendSseMessage('log_entry', { message: refinementNotification }, expressHttpRes);
            overallExecutionLog.push(refinementNotification.replace('[SSE]', ''));
            console.log(`[executeStepsInternal] ${refinementNotification.replace('[SSE]', '')}`);

            currentStep.details = refinedDetails; // Update step details
            currentStep._internalRetryCount = 0; // Reset simple retry counter for the refined step
            // The while loop will continue, attempting the refined step
          } catch (parseError) {
            const parseErrorMsg = `[SSE] Step ${stepNumber}: Failed to parse LLM refinement response: ${parseError.message}. LLM Raw: ${refinedDetailsString.substring(0,100)}...`;
            sendSseMessage('error', { content: parseErrorMsg }, expressHttpRes);
            overallExecutionLog.push(parseErrorMsg.replace('[SSE]', ''));
            console.error(`[executeStepsInternal] ${parseErrorMsg.replace('[SSE]', '')}`);
            // This refinement attempt failed due to parsing, break from while
            break;
          }
        } else {
          // All retries and refinements exhausted. Break from internal loop to trigger failure.
          const exhaustedMsg = `[SSE] Step ${stepNumber} (${currentStep.type}) exhausted all retries and refinements. Last error: ${stepAttemptError.message}`;
          sendSseMessage('log_entry', { message: exhaustedMsg }, expressHttpRes); // Log it before triggering failure options
          overallExecutionLog.push(exhaustedMsg.replace('[SSE]', ''));
          console.warn(`[executeStepsInternal] ${exhaustedMsg.replace('[SSE]', '')}`);
          break; // Exit while loop, stepProcessedSuccessfully is false
        }
      }
    } // End of internal while loop for retries/refinements

    if (!stepProcessedSuccessfully) {
      // If loop finished and step was not successful (all retries/refinements failed)
      // Ensure lastErrorForStep is used here as per subtask item 1.
      const finalErrorMessage = lastErrorForStep ? lastErrorForStep.message : "Unknown error after retries/refinements.";
      triggerStepFailure(finalErrorMessage, lastErrorForStep, currentStep.type, stepNumber, {i});
      return; // Pause main execution, pass to user
    }
    // If step was successful so far, reset its internal error-handling counters
    // before proceeding to optional evaluation.
    // We do this here because if evaluation fails and leads to a 'retry' or 'refine_and_retry',
    // these counters should be fresh for the re-execution of the step's main logic.
    currentStep._internalRetryCount = 0;
    currentStep._internalRefineCount = 0;
    // currentStep._internalEvalRetryCount is managed separately below.

    // --- LLM-based Result Evaluation (Part B) ---
    if (stepProcessedSuccessfully && currentStep.details?.evaluationPrompt) {
      const evalLogPrefix = `[Step ${stepNumber} (${currentStep.type}) Evaluation]`;
      sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Output produced. Evaluating with LLM...` }, expressHttpRes);
      overallExecutionLog.push(`  -> ${evalLogPrefix} Output produced. Evaluating with LLM.`);
      console.log(`${evalLogPrefix} Starting evaluation.`);

      currentStep._internalEvalRetryCount = currentStep._internalEvalRetryCount || 0;
      const maxEvaluationRetries = typeof currentStep.details.maxEvaluationRetries === 'number' ? currentStep.details.maxEvaluationRetries : 1;
      let evaluationPassed = false;

      while (currentStep._internalEvalRetryCount < maxEvaluationRetries && !evaluationPassed) {
        const attemptNum = currentStep._internalEvalRetryCount + 1;
        sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Evaluation attempt ${attemptNum}/${maxEvaluationRetries}.`}, expressHttpRes);
        console.log(`${evalLogPrefix} Attempt ${attemptNum}/${maxEvaluationRetries}.`);

        const stepOutputId = currentStep.details.output_id;
        const stepOutput = stepOutputId ? taskContext.outputs[stepOutputId] : "No output_id was specified for this step.";

        if (stepOutputId && !taskContext.outputs.hasOwnProperty(stepOutputId)) {
          const evalErrorMsg = `${evalLogPrefix} Cannot evaluate. Output variable '${stepOutputId}' not found in task context.`;
          sendSseMessage('error', { content: `[SSE] ${evalErrorMsg}` });
          overallExecutionLog.push(`  -> ❌ ${evalErrorMsg}`);
          console.error(evalErrorMsg);
          lastErrorForStep = new Error(evalErrorMsg);
          stepProcessedSuccessfully = false; // Mark step as failed
          break; // Break from evaluation retry loop
        }

        let finalEvaluationPrompt = currentStep.details.evaluationPrompt;
        finalEvaluationPrompt = finalEvaluationPrompt.replace(/\{\{step_output\}\}/g, typeof stepOutput === 'string' ? stepOutput : JSON.stringify(stepOutput));
        const originalStepPrompt = currentStep.details.prompt || currentStep.details.description || "N/A";
        finalEvaluationPrompt = finalEvaluationPrompt.replace(/\{\{original_prompt\}\}/g, originalStepPrompt);

        sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Sending evaluation prompt to LLM: "${finalEvaluationPrompt.substring(0, 100)}..."` }, expressHttpRes);
        // Using phi3 for potentially structured output, or a model specified in backendSettings.
        const evalModel = backendSettings.defaultOllamaModel || 'phi3';
        const evaluationResultString = await generateFromLocal(finalEvaluationPrompt, evalModel, null); // null for expressRes - internal call

        if (evaluationResultString.startsWith('// LLM_ERROR:') || evaluationResultString.startsWith('// LLM_WARNING:')) {
          const llmErrorMsg = `${evalLogPrefix} LLM failed to provide evaluation. Error: ${evaluationResultString}`;
          sendSseMessage('error', { content: `[SSE] ${llmErrorMsg}` });
          overallExecutionLog.push(`  -> ❌ ${llmErrorMsg}`);
          console.error(llmErrorMsg);
          if (evaluationResultString && evaluationResultString.replace('// LLM_ERROR:', '').replace('// LLM_WARNING:', '').trim()) {
              lastErrorForStep = new Error(evaluationResultString);
          } else {
              lastErrorForStep = new Error(`${evalLogPrefix} LLM failed to provide evaluation and returned an empty error/warning message.`);
          }
          stepProcessedSuccessfully = false; // Mark step as failed
          // Potentially increment _internalEvalRetryCount here if we want LLM failure to count as an attempt.
                          currentStep._internalEvalRetryCount++;
                          if (currentStep._internalEvalRetryCount >= maxEvaluationRetries) {
                              sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Max evaluation retries reached due to LLM error.` }, expressHttpRes);
                              break; // Break from while, stepProcessedSuccessfully is false
                          }
                          sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Retrying evaluation due to LLM error. Attempt ${currentStep._internalEvalRetryCount +1}/${maxEvaluationRetries}` }, expressHttpRes);
                          continue; // Try evaluation again if LLM fails and retries are left
        }

        const evaluationResult = evaluationResultString.trim().toLowerCase();
        sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} LLM Evaluation Result: "${evaluationResult}"` }, expressHttpRes);
        overallExecutionLog.push(`  -> ${evalLogPrefix} LLM Evaluation Result: "${evaluationResult}"`);
        console.log(`${evalLogPrefix} LLM Evaluation Result: "${evaluationResult}"`);

        if (evaluationResult.includes('success')) { // Define "success" criteria more robustly if needed
          evaluationPassed = true;
          // stepProcessedSuccessfully remains true
          sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Evaluation PASSED.` }, expressHttpRes);
          console.log(`${evalLogPrefix} Evaluation PASSED.`);
          break; // Exit evaluation loop
        } else { // Evaluation failed
          currentStep._internalEvalRetryCount++;
          if (evaluationResult && evaluationResult.trim()) {
              lastErrorForStep = new Error(`${evalLogPrefix} Evaluation failed. LLM response: ${evaluationResult}`);
          } else {
              lastErrorForStep = new Error(`${evalLogPrefix} Evaluation failed with an empty or non-descriptive LLM response.`);
          }
          stepProcessedSuccessfully = false; // Mark step as failed for this attempt cycle

          const onEvalFailureAction = currentStep.details.onEvaluationFailure || 'fail_step';
          sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Evaluation FAILED (Attempt ${currentStep._internalEvalRetryCount}/${maxEvaluationRetries}). Action: ${onEvalFailureAction}.` }, expressHttpRes);
          console.log(`${evalLogPrefix} Evaluation FAILED (Attempt ${currentStep._internalEvalRetryCount}/${maxEvaluationRetries}). Action: ${onEvalFailureAction}.`);

          if (currentStep._internalEvalRetryCount >= maxEvaluationRetries) {
            sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Max evaluation retries reached. Step will be marked as failed.` }, expressHttpRes);
            console.log(`${evalLogPrefix} Max evaluation retries reached.`);
            break; // Exit evaluation loop, stepProcessedSuccessfully is false
          }

          // If more evaluation retries are allowed, decide action
          if (onEvalFailureAction === 'retry') {
            sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Evaluation failed. Marked for full step re-execution.` }, expressHttpRes);
            console.log(`${evalLogPrefix} Marked for full step re-execution.`);
            // stepProcessedSuccessfully is already false. The outer `while` loop for the step will handle re-execution.
            // _internalRetryCount and _internalRefineCount were reset before evaluation block.
            break; // Break evaluation loop; outer loop will re-run step.
          } else if (onEvalFailureAction === 'refine_and_retry') {
            sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Evaluation failed. Marked for step refinement and re-execution.` }, expressHttpRes);
            console.log(`${evalLogPrefix} Marked for step refinement and re-execution.`);
            currentStep.details.onError = 'refine_and_retry'; // Ensure main refinement logic is triggered
            // Exhaust simple retries to force refinement path in the main step loop
            currentStep._internalRetryCount = currentStep.details.maxRetries || 0;
            stepProcessedSuccessfully = false; // Ensure outer loop sees this as a failure requiring action
            break; // Break evaluation loop; outer loop will go to refinement.
          } else { // 'fail_step' or default
            sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Evaluation failed. Step will be marked as failed. No more evaluation retries for this policy.` }, expressHttpRes);
            console.log(`${evalLogPrefix} Step will be marked as failed. No more evaluation retries for this policy.`);
            // stepProcessedSuccessfully is already false. lastErrorForStep is set.
            // Let it proceed to exhaust evaluation retries or break if this was the last one.
            // If fail_step is the policy, we might just break here as further eval retries are pointless.
            break;
          }
        }
      } // End of while for evaluation retries

      if (!evaluationPassed) {
        stepProcessedSuccessfully = false; // Ensure step is marked as failed if all eval retries are exhausted and it didn't pass
        if (!lastErrorForStep) { // Should be set, but as a fallback
            lastErrorForStep = new Error(`${evalLogPrefix} Step failed LLM evaluation after all attempts with an unspecified error.`);
        }
        sendSseMessage('log_entry', { message: `[SSE] ${evalLogPrefix} Step FAILED evaluation after all attempts.` }, expressHttpRes);
        console.log(`${evalLogPrefix} Step FAILED evaluation after all attempts.`);
      }
    } // End of if currentStep.details.evaluationPrompt

    // This existing block will now catch failures from main processing OR from evaluation.
    if (!stepProcessedSuccessfully && !lastErrorForStep) {
        lastErrorForStep = new Error("Step processing failed with an unspecified error before triggering failure.");
        console.warn(`[executeStepsInternal] Step ${stepNumber} (${currentStep.type}) failed without lastErrorForStep being set. Defaulting error.`);
    }
    if (!stepProcessedSuccessfully) {
      // If loop finished and step was not successful (all retries/refinements/evaluations failed)
      const finalErrorMessage = lastErrorForStep ? lastErrorForStep.message : "Unknown error after retries/refinements/evaluation.";
      triggerStepFailure(finalErrorMessage, lastErrorForStep, currentStep.type, stepNumber, {i});
      return; // Pause main execution, pass to user
    }
    // If step was successful, reset its internal counters for any future manual retries by user
    currentStep._internalRetryCount = 0;
    currentStep._internalRefineCount = 0;
    currentStep._internalEvalRetryCount = 0; // Reset eval retry count also

  } // End of for loop iterating through steps

  console.log(`[executeStepsInternal] Task processing complete for: "${task_description}"`);
  sendSseMessage('log_entry', { message: '[SSE] All steps processed on server.' }, expressHttpRes);
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(LOG_DIR, `task-streamed-${timestamp}.log.md`);
    fs.writeFileSync(logPath, `# Task: ${task_description}\n\n${overallExecutionLog.join('\n')}`);
    sendSseMessage('log_entry', { message: `[SSE] Summary log saved to ${logPath}` }, expressHttpRes);
  } catch (err) {
    sendSseMessage('error', { content: `[SSE] Failed to save summary log: ${err.message}` }, expressHttpRes);
  }
  sendSseMessage('execution_complete', { message: 'Autonomous task execution finished.', finalLogSummary: overallExecutionLog }, expressHttpRes);

  if (expressHttpRes.writable) {
    expressHttpRes.end();
  }
}

const handleExecuteAutonomousTask = async (req, expressHttpRes) => {
  const endpointName = `[${req.method} /execute-autonomous-task]`;
  console.log(`${endpointName} Request received. Query:`, req.query, "Body:", req.body);

  const payload = parseTaskPayload(req);

  if (payload.error) {
    console.warn(`${endpointName} Invalid payload from parseTaskPayload: ${payload.error}`);
    return expressHttpRes.status(400).json({ message: payload.error });
  }

  let { task_description, steps, safetyMode, isAutonomousMode } = payload;

  // Destructure query parameters specifically for conference task type, as they are only relevant there.
  const {
    task_type, // Used to switch to conference mode
    model_a_id, model_b_id, arbiter_model_id, // Conference-specific model IDs
    model_a_role, model_b_role, arbiter_model_role, // Conference-specific roles
    history: historyString // Conference-specific history
  } = req.query;

  console.log(`${endpointName} Parsed main parameters. Goal: "${String(task_description).substring(0,100)}...", Safety Mode: ${safetyMode}, Autonomous Mode: ${isAutonomousMode}, Task Type: ${task_type}`);

  // expressHttpRes is the original response object for this specific request.
  // It's crucial for sending SSE messages back to the correct client.

  if (!task_description) { // Should be caught by parseTaskPayload, but double check
    return expressHttpRes
      .status(400)
      .json({ message: 'Invalid payload: task_description is essential.' });
  }
  // If not in autonomous mode, steps must be a non-empty array (frontend ensures this, parseTaskPayload too)
  if (!isAutonomousMode && (!steps || !Array.isArray(steps))) {
    // Frontend should prevent empty steps if not autonomous, parseTaskPayload also checks
    console.log('[handleExecuteAutonomousTask] Error: Non-autonomous task received without valid steps.');
    return expressHttpRes
        .status(400)
        .json({ message: 'Invalid payload: Steps are required for non-autonomous mode.' });
  }

  expressHttpRes.setHeader('Content-Type', 'text/event-stream');
  expressHttpRes.setHeader('Cache-Control', 'no-cache');
  expressHttpRes.setHeader('Connection', 'keep-alive');
  expressHttpRes.flushHeaders();

  // This sendSseMessage can now be passed to executeStepsInternal
  // and used by the confirmation endpoint as well, as it can target a specific res.
  const sendSseMessage = (type, data, res = expressHttpRes) => {
    if (res && res.writable) {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    } else {
      console.warn(
        `[SSE] Attempted to write to a closed or unavailable stream. Type: ${type}`
      );
    }
  };

  // Initialize log and context here, as they might be stored for pending plan approval
  // before executeStepsInternal is called.
  const overallExecutionLog = [`Task: "${task_description}"`];
  const taskContext = { outputs: {} };

  // --- Conference Task Type Handling ---
  if (task_type === 'conference') {
    sendSseMessage('log_entry', { message: `[SSE] Conference Mode detected for goal: "${task_description}"` });
    overallExecutionLog.push(`[Conference Mode] Preparing conference task for goal: "${task_description}"`);
    console.log(`${endpointName} Conference Mode: Preparing task. Received query params for conference: model_a_id=${model_a_id}, model_b_id=${model_b_id}, arbiter_model_id=${arbiter_model_id}, model_a_role=${model_a_role}, model_b_role=${model_b_role}, arbiter_model_role=${arbiter_model_role}, historyString provided: ${!!historyString}`);

    let parsedHistory = [];
    if (historyString) {
      try {
        parsedHistory = JSON.parse(historyString);
        if (!Array.isArray(parsedHistory)) {
            console.warn(`${endpointName} Conference historyString parsed but is not an array. Type: ${typeof parsedHistory}. Using empty history.`);
            sendSseMessage('log_entry', { message: `[SSE] Warning: Conference history was provided but was not a valid array. Proceeding with empty history. Original: ${historyString.substring(0,100)}...` });
            parsedHistory = []; // Ensure it's an array
        }
      } catch (e) {
        const historyParseErrorMsg = `Error parsing conference history: ${e.message}. Provided historyString: "${historyString.substring(0,100)}..."`;
        sendSseMessage('error', { content: `[SSE] ${historyParseErrorMsg}. Using empty history.` });
        overallExecutionLog.push(`${endpointName} [Conference Mode] ❌ ${historyParseErrorMsg}. Using empty history.`);
        console.error(`${endpointName} [Conference Mode] ${historyParseErrorMsg}`, e);
        // Proceed with empty history as per current logic
        parsedHistory = [];
      }
    }

    const conferenceSteps = [{
      type: 'conference_task',
      details: {
        prompt: task_description, // task_description from query is the conference prompt
        model_name: model_a_id || model_b_id || arbiter_model_id || backendSettings.defaultOllamaModel || 'llama3',
        model_a_id: model_a_id,
        model_b_id: model_b_id,
        arbiter_model_id: arbiter_model_id,
        model_a_role: model_a_role || "Model A",
        model_b_role: model_b_role || "Model B",
        arbiter_model_role: arbiter_model_role || "Arbiter",
        history: parsedHistory,
        output_id: 'conference_result'
      }
    }];

    // Override/set specific modes for internal conference execution
    safetyMode = false;
    isAutonomousMode = true; // Internally, it's an autonomous execution of a fixed plan

    sendSseMessage('log_entry', { message: `[SSE] Executing conference as a single step task. Safety Mode: ${safetyMode}, Autonomous: ${isAutonomousMode}` });
    overallExecutionLog.push(`[Conference Mode] Executing as single step. Safety: ${safetyMode}, Autonomous: ${isAutonomousMode}. Details: ${JSON.stringify(conferenceSteps[0].details)}`);

    // Directly execute for conference mode
    await executeStepsInternal(
      expressHttpRes,
      task_description, // Original task description
      conferenceSteps,  // The manually constructed conference step
      taskContext,
      overallExecutionLog,
      0, // Start from step 0
      sendSseMessage,
      safetyMode, // Use the overridden safetyMode
      0 // Initial operation count
    );
    return; // Conference task execution is complete.
  }

  // --- Autonomous Mode: Plan Generation (Original Logic) ---
  // If in autonomous mode (and not a conference task), the system uses an LLM to generate a sequence of steps.
  if (isAutonomousMode) {
    sendSseMessage('log_entry', { message: `[SSE] Autonomous Mode enabled (Non-Conference). Attempting to generate steps for goal: "${task_description}"` });
    overallExecutionLog.push(`[Autonomous Mode (Non-Conference)] Generating steps for goal: "${task_description}"`);
    console.log(`[handleExecuteAutonomousTask] Autonomous Mode (Non-Conference): Generating steps for goal "${task_description}"`);

    // Prompt for the LLM to generate a plan (sequence of steps) based on the user's task description.
    const autonomousPrompt = `
You are an AI assistant that helps break down a complex user goal into a series of actionable steps for an automated execution system.
The user's goal is: "${task_description}"

You must generate a JSON array of step objects. Each object must have a "type" and a "details" field.
Output *only* the JSON array of steps. Do not include any other text, explanations, or markdown (i.e. no \`\`\`json ... \`\`\` wrapper).

Valid step "type"s are:
- "generic_step": For general tasks or prompts that need further LLM processing during actual execution. \`details\` should include \`{"description": "textual description of the step"}\`. Can also include \`{"output_id": "some_var_name"}\` if the LLM response for this step should be stored.
- "create_file_with_llm_content": Creates a file using an LLM to generate its content. \`details\` must include \`{"filePath": "path/to/file.ext", "prompt": "LLM prompt to generate file content"}\`. Can also include \`{"output_id": "some_var_name"}\` to store the generated content.
- "createFile": Creates a file with specified static content. \`details\` must include \`{"filePath": "path/to/file.ext", "content": "Static content here"}\`.
- "readFile": Reads a file and stores its content. \`details\` must include \`{"filePath": "path/to/file.ext", "output_id": "variable_name_for_content"}\`. (Note: 'read_file_to_output' is also a valid type that does the same)
- "updateFile": Updates an existing file or appends to it. \`details\` must include \`{"filePath": "path/to/file.ext", "content": "Content to write/append", "append": true_or_false}\`. 'append' is a boolean (true to append, false to overwrite).
- "deleteFile": Deletes a file. \`details\` must include \`{"filePath": "path/to/file.ext"}\`.
- "createDirectory": Creates a new directory. \`details\` must include \`{"dirPath": "path/to/directory"}\`.
- "deleteDirectory": Deletes a directory. \`details\` must include \`{"dirPath": "path/to/directory"}\`.
- "git_operation": Performs a git operation. \`details\` must include \`{"command": "add|commit|pull|push|revert_last_commit", ...other_git_params}\`.
    Examples:
    \`{"command": "add", "filePath": "path/to/file.ext"}\` (or use "." for all changes)
    \`{"command": "commit", "message": "Your commit message"}\`
    \`{"command": "pull", "remote": "origin", "branch": "main"}\` (optional remote/branch, defaults may apply)
    \`{"command": "push", "remote": "origin", "branch": "main"}\` (optional remote/branch)
    \`{"command": "revert_last_commit"}\`
- "show_workspace_tree": Displays the directory structure of the workspace or a subfolder. \`details\` can optionally include \`{"path": "relative/path/to/show"}\` (defaults to workspace root).
- "loop_iterations": Repeats a sequence of steps a specified number of times. \`details\` must include \`{"count": N, "loop_steps": [array_of_steps_for_loop_body]}\`. Optionally, \`{"iterator_var": "var_name"}\` can be provided to make the current loop index (0-based) available as \`{{outputs.var_name}}\` within the \`loop_steps\`.
- "conference_task": Initiates a multi-model debate to generate a response. \`details\` must include \`{"prompt": "The user's core prompt/question for the conference"}\`. Optional fields include \`"model_name"\`, \`"model_a_role"\`, \`"model_b_role"\`, \`"arbiter_model_role"\`, \`"num_rounds"\`, and \`"output_id"\`.

Step Result Evaluation (Optional):
For steps that produce an output (e.g., using "output_id"), you can optionally add fields to their "details" for LLM-based evaluation:
- "evaluationPrompt": An LLM prompt to evaluate the step's output. This prompt *must* include the template \`{{step_output}}\` which will be replaced with the actual output of the step. It can also use \`{{original_prompt}}\` if the step had a prompt. The evaluation LLM should respond with "success" if the output is good, or describe the failure.
- "maxEvaluationRetries": (Optional, default 1) Number of times to retry evaluation if it fails.
- "onEvaluationFailure": (Optional, default 'fail_step') Action if evaluation fails after all retries. Options:
    - 'fail_step': The step is marked as failed.
    - 'retry': The original step is re-executed from scratch.
    - 'refine_and_retry': An LLM is used to refine the original step's details based on the evaluation failure, then the refined step is tried.

Analyze the user's goal and decompose it into these structured steps. Ensure all paths are relative to the workspace root.
Be careful with file paths, ensuring they are valid and make sense in the context of the steps.

Example with Evaluation:
Goal: "Write a short story about a brave knight to 'story.txt', then verify the story is at least 50 words long."
[
  {
    "type": "create_file_with_llm_content",
    "details": {
      "filePath": "story.txt",
      "prompt": "Write a very short story (around 70-100 words) about a brave knight saving a village from a mild inconvenience.",
      "output_id": "knight_story_content",
      "evaluationPrompt": "The following text is a story: '{{step_output}}'. Is this story at least 50 words long? Respond with 'success' if yes, or 'failure: too short' if no.",
      "onEvaluationFailure": "retry",
      "maxEvaluationRetries": 2
    }
  },
  {
    "type": "generic_step",
    "details": {
        "description": "The story 'story.txt' has been written and verified for length."
    }
  }
]

For example, if the goal is "Create a new project called 'my-app', add a README.md, and then commit it", the steps might be:
[
  {"type": "createDirectory", "details": {"dirPath": "my-app"}},
  {"type": "create_file_with_llm_content", "details": {"filePath": "my-app/README.md", "prompt": "Write a basic README for a new project called my-app."}},
  {"type": "git_operation", "details": {"command": "add", "filePath": "my-app/README.md"}},
  {"type": "git_operation", "details": {"command": "commit", "message": "Initial commit: Add README for my-app"}}
]

Another example, for a goal "Create 3 numbered log files and then display the workspace tree":
[
  {
    "type": "loop_iterations",
    "details": {
      "count": 3,
      "iterator_var": "idx",
      "loop_steps": [
        {
          "type": "createFile",
          "details": {
            "filePath": "output/log_{{outputs.idx}}.txt",
            "content": "Log entry for iteration {{outputs.idx}}"
          }
        }
      ]
    }
  },
  {"type": "show_workspace_tree", "details": {}}
]
Remember, output *only* the JSON array.
`;

    const llmModelForPlanGeneration = backendSettings.defaultOllamaModel || 'phi3'; // Use settings or fallback
    sendSseMessage('log_entry', { message: `[SSE] Using model '${llmModelForPlanGeneration}' for plan generation.` });
    overallExecutionLog.push(`[Autonomous Mode] Using model '${llmModelForPlanGeneration}' for plan generation.`);
    console.log(`[handleExecuteAutonomousTask] Autonomous Mode: Using model '${llmModelForPlanGeneration}' for plan generation.`);

    // For plan generation, no specific agentType/agentRole is passed, so it uses global/provider instructions.
    const llmGeneratedStepsString = await generateFromLocal(autonomousPrompt, llmModelForPlanGeneration, expressHttpRes, {});

    // Log the raw output (or a significant portion) for debugging, regardless of success or failure after this point.
    console.log(`[handleExecuteAutonomousTask] Raw LLM output for steps (full): ${llmGeneratedStepsString}`);
    overallExecutionLog.push(`[Autonomous Mode] Raw LLM output for steps: ${llmGeneratedStepsString.substring(0, 500)}... (see server console for full output)`);
    sendSseMessage('log_entry', { message: `[SSE] Received raw LLM output. Length: ${llmGeneratedStepsString.length}. Attempting to parse.` });


    if (!llmGeneratedStepsString || llmGeneratedStepsString.trim() === '' || llmGeneratedStepsString.startsWith('// LLM_ERROR:') || llmGeneratedStepsString.startsWith('// LLM_WARNING:')) {
      const errorMsg = `LLM failed to generate a plan or returned an empty/error response. Output: ${llmGeneratedStepsString}`;
      console.error(`[handleExecuteAutonomousTask] ${errorMsg}`);
      overallExecutionLog.push(`[Autonomous Mode] ❌ ${errorMsg}`);
      sendSseMessage('error', { content: errorMsg });
      sendSseMessage('execution_complete', { message: 'Task terminated due to LLM plan generation error or empty response.' });
      if (expressHttpRes.writable) {
        expressHttpRes.end();
      }
      return;
    }

    let generatedSteps;
    try {
      const jsonMatch = llmGeneratedStepsString.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (!jsonMatch) {
        throw new Error("No valid JSON array found in LLM output. Output started with: " + llmGeneratedStepsString.substring(0, 200));
      }
      const extractedJsonString = jsonMatch[0];
      generatedSteps = JSON.parse(extractedJsonString);

      if (!Array.isArray(generatedSteps) || generatedSteps.length === 0) {
        throw new Error('LLM output, while valid JSON, is not a non-empty array of steps. Parsed: ' + JSON.stringify(generatedSteps).substring(0, 200));
      }
      if (generatedSteps.some(step => typeof step.type !== 'string' || typeof step.details !== 'object')) {
        throw new Error('LLM output is not a valid array of step objects (each needs type:string and details:object). Parsed: ' + JSON.stringify(generatedSteps).substring(0, 200));
      }

      sendSseMessage('log_entry', { message: `[SSE] Successfully parsed ${generatedSteps.length} steps from LLM output.` });
      overallExecutionLog.push(`[Autonomous Mode] Successfully parsed ${generatedSteps.length} steps from LLM output.`);
      console.log(`[handleExecuteAutonomousTask] Autonomous Mode: Parsed ${generatedSteps.length} steps from LLM.`);
      steps = generatedSteps; // Assign to the 'steps' variable that was declared earlier
    } catch (e) {
      const errorMsg = `Failed to parse LLM-generated steps into a valid JSON array of step objects. Error: ${e.message}. Raw LLM output (first 300 chars): ${llmGeneratedStepsString.substring(0, 300)}... (see server console for full output)`;
      console.error(`[handleExecuteAutonomousTask] ${errorMsg}`);
      overallExecutionLog.push(`[Autonomous Mode] ❌ ${errorMsg}`);
      sendSseMessage('error', { content: errorMsg });
      sendSseMessage('execution_complete', { message: 'Task terminated due to LLM step generation or parsing error.' });
      if (expressHttpRes.writable) {
        expressHttpRes.end();
      }
      return;
    }

    const planId = uuidv4(); // Using uuidv4 for planId
    pendingPlanApprovals[planId] = {
      generatedSteps: steps,
      task_description,
      safetyMode,
      originalExpressHttpRes: expressHttpRes,
      sendSseMessage,
      overallExecutionLog,
      taskContext,
    };
    console.log(`[handleExecuteAutonomousTask] Plan ${planId} generated and awaiting approval. Stored originalExpressHttpRes, sendSseMessage, logs, and context.`);
    sendSseMessage('proposed_plan', { planId, generated_steps: steps });
    return; // IMPORTANT: Return here to wait for approval. Do not execute steps immediately.

  } else { // Not Autonomous Mode
    sendSseMessage('log_entry', { message: '[SSE] Manual Mode enabled. Using user-provided steps.' });
    overallExecutionLog.push('[Manual Mode] Using user-provided steps.');
    console.log('[handleExecuteAutonomousTask] Manual Mode: Using user-provided steps.');
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
        const errorMsg = 'Non-autonomous task requires a valid array of steps.';
        console.error(`[handleExecuteAutonomousTask] ${errorMsg}`);
        overallExecutionLog.push(`[Manual Mode] ❌ ${errorMsg}`);
        sendSseMessage('error', { content: errorMsg });
        sendSseMessage('execution_complete', { message: 'Task terminated due to missing/invalid steps in manual mode.' });
        if (expressHttpRes.writable) { expressHttpRes.end(); }
        return;
    }
    // Directly execute for non-autonomous mode
    await executeStepsInternal(
      expressHttpRes,
      task_description,
      steps,
      taskContext,
      overallExecutionLog,
      0,
      sendSseMessage,
      safetyMode,
      0
    );
  }
};

app.post('/execute-autonomous-task', handleExecuteAutonomousTask);
app.get('/execute-autonomous-task', handleExecuteAutonomousTask);

// --- Plan Approval Endpoints ---
// --- Plan Approval Endpoints ---
// Endpoint for the user to approve a plan generated by the LLM in autonomous mode.
app.post('/api/approve-plan/:planId', async (req, res) => {
  const endpointName = '[POST /api/approve-plan/:planId]';
  const { planId } = req.params;
  console.log(`${endpointName} Request received for planId: ${planId}. Body:`, req.body); // req.body is likely empty but good to log

  const planDetails = pendingPlanApprovals[planId];
  if (!planDetails) {
    console.warn(`${endpointName} Plan ID "${planId}" not found or already processed.`);
    return res.status(404).json({ message: 'Plan ID not found or already processed.' });
  }

  const {
    generatedSteps,
    task_description,
    safetyMode,
    originalExpressHttpRes, // Crucial: the response stream of the original client
    sendSseMessage: originalSendSseMessage, // The SSE sender for that client
    overallExecutionLog,
    taskContext,
  } = planDetails;

  if (!originalExpressHttpRes || !originalExpressHttpRes.writable) {
    console.error(`[API /api/approve-plan/${planId}] Original HTTP response stream is not writable. Cannot execute plan.`);
    // Clean up anyway
    delete pendingPlanApprovals[planId];
    return res.status(500).json({ message: 'Cannot execute plan: original client connection likely lost.' });
  }

  delete pendingPlanApprovals[planId]; // Remove before execution to prevent re-processing

  originalSendSseMessage('log_entry', { message: `[SSE] Plan ${planId} approved by user. Starting execution...` }, originalExpressHttpRes);
  overallExecutionLog.push(`[Autonomous Mode] Plan ${planId} approved by user. Starting execution.`);
  console.log(`[API /api/approve-plan/${planId}] Plan approved. Starting execution for original client.`);

  try {
    await executeStepsInternal(
      originalExpressHttpRes, // Use the original client's response stream
      task_description,
      generatedSteps,         // Use the LLM-generated steps
      taskContext,            // Use the stored context
      overallExecutionLog,    // Use the stored log
      0,                      // Start from step 0
      originalSendSseMessage, // Use the stored SSE sender
      safetyMode,
      0                       // Initial operation count
    );
    res.status(200).json({ message: 'Plan approved and execution started.' });
  } catch (e) {
    console.error(`[API /api/approve-plan/${planId}] Error during execution after approval:`, e);
    originalSendSseMessage('error', { content: `Critical error during execution of approved plan ${planId}: ${e.message}` }, originalExpressHttpRes);
    if (originalExpressHttpRes.writable) {
      originalExpressHttpRes.end(); // Ensure stream is closed on error
    }
    // Don't send res.status(500) if headers already sent by executeStepsInternal or SSE
    if (!res.headersSent) {
        res.status(500).json({ message: 'Error during execution after approval.' });
    }
  }
});

// Endpoint for the user to decline an LLM-generated plan.
app.post('/api/decline-plan/:planId', async (req, res) => {
  const endpointName = '[POST /api/decline-plan/:planId]';
  const { planId } = req.params;
  console.log(`${endpointName} Request received for planId: ${planId}. Body:`, req.body); // req.body is likely empty

  const planDetails = pendingPlanApprovals[planId];
  if (!planDetails) {
    console.warn(`${endpointName} Plan ID "${planId}" not found or already processed.`);
    return res.status(404).json({ message: 'Plan ID not found or already processed.' });
  }

  const { originalExpressHttpRes, sendSseMessage: originalSendSseMessage, overallExecutionLog } = planDetails;
  delete pendingPlanApprovals[planId];

  if (originalExpressHttpRes && originalExpressHttpRes.writable) {
    const declineMessage = `[SSE] Plan ${planId} declined by user. Task will not be executed.`;
    originalSendSseMessage('log_entry', { message: declineMessage }, originalExpressHttpRes);
    overallExecutionLog.push(`[Autonomous Mode] Plan ${planId} declined by user.`); // Log it server-side too
    console.log(`[API /api/decline-plan/${planId}] Plan declined. Notifying original client and closing stream.`);
    originalSendSseMessage('execution_complete', { message: `Plan ${planId} declined. Task cancelled.` }, originalExpressHttpRes);
    originalExpressHttpRes.end();
  } else {
    console.log(`[API /api/decline-plan/${planId}] Original client connection for plan ${planId} seems to be already closed.`);
  }

  res.status(200).json({ message: 'Plan declined successfully.' });
});

// --- Resume Task Endpoint ---
// Handles user responses (confirm/deny) to actions requiring confirmation (e.g., file operations, batch operations).
app.post('/api/confirm-action/:confirmationId', async (req, res) => {
  const endpointName = '[POST /api/confirm-action/:confirmationId]';
  const { confirmationId } = req.params;
  const { confirmed } = req.body;

  console.log(`${endpointName} Request received for confirmationId: ${confirmationId}. Body:`, req.body);

  if (typeof confirmed !== 'boolean') {
    console.warn(`${endpointName} Invalid payload: 'confirmed' must be a boolean. Received: ${typeof confirmed}`);
    return res.status(400).json({ message: "Invalid payload: confirmed must be a boolean." });
  }
  console.log(`${endpointName} Parsed 'confirmed': ${confirmed}`);

  const SseMessageWrapper = (type, data, httpRes) => {
    if (httpRes && httpRes.writable) {
        httpRes.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    } else {
        console.warn(`[SSE Confirm] Attempted to write to a closed or unavailable stream. Type: ${type}`);
    }
  };

  const pendingTask = pendingConfirmations[confirmationId];
  if (!pendingTask) {
    console.warn(`${endpointName} Confirmation ID "${confirmationId}" not found or already processed.`);
    return res.status(404).json({ message: 'Confirmation ID not found or already processed.' });
  }

  const {
    expressHttpRes: originalExpressHttpRes,
    task_description,
    steps,
    currentStepIndex,
    taskContext,
    overallExecutionLog,
    currentStep,
    safetyMode: taskSafetyMode,
    confirmationType, // 'file', 'batch', or 'git'
    operationCountSinceLastConfirmation: storedOpCount
   } = pendingTask;

  if (!originalExpressHttpRes || !originalExpressHttpRes.writable) {
    console.error(`[POST /api/confirm-action/${confirmationId}] Original HTTP response stream is not writable. Cannot resume.`);
    delete pendingConfirmations[confirmationId];
    return res.status(500).json({ message: 'Cannot resume task: original client connection lost.' });
  }

  const sendResumedSseMessage = (type, data) => SseMessageWrapper(type, data, originalExpressHttpRes);
  delete pendingConfirmations[confirmationId]; // Clean up immediately

  if (confirmationType === 'batch') {
    if (confirmed) {
      sendResumedSseMessage('log_entry', { message: `[SSE] Batch execution confirmed by user for ID: ${confirmationId}. Resuming task.` });
      overallExecutionLog.push(`[Confirmation] Batch execution for ${CONFIRM_AFTER_N_OPERATIONS} operations confirmed by user.`);
      try {
        await executeStepsInternal(
          originalExpressHttpRes, task_description, steps, taskContext, overallExecutionLog,
          currentStepIndex, // Resume from the step that triggered batch confirmation
          sendResumedSseMessage, taskSafetyMode,
          storedOpCount // This should be 0, as it was reset when batch confirmation was stored
        );
      } catch (resumeError) { console.error(`[POST /api/confirm-action/${confirmationId}] Error resuming batch: `, resumeError); sendResumedSseMessage('error', { content: `Error resuming task: ${resumeError.message}` }); if (originalExpressHttpRes.writable) { originalExpressHttpRes.end(); } }
    } else { // Batch denied
      overallExecutionLog.push(`[Confirmation] Batch execution denied by user for ID: ${confirmationId}. Task terminated.`);
      sendResumedSseMessage('log_entry', { message: `[SSE] User cancelled batch execution for ID: ${confirmationId}. Task terminated.`});
      sendResumedSseMessage('execution_complete', { message: 'Task terminated by user at batch confirmation.' });
      if (originalExpressHttpRes.writable) { originalExpressHttpRes.end(); }
      console.log(`[POST /api/confirm-action/${confirmationId}] Batch execution denied. Task terminated.`);
    }
  } else if (confirmationType === 'file' || confirmationType === 'git') { // File or Git specific confirmation
    if (confirmed) {
      sendResumedSseMessage('log_entry', { message: `[SSE] Action for ${confirmationType} ID: ${confirmationId} confirmed by user. Resuming task.` });
      overallExecutionLog.push(`[Confirmation] Action for step ${currentStepIndex + 1} (${currentStep.type}) (type: ${confirmationType}) confirmed by user.`);
      currentStep.details = currentStep.details || {};
      currentStep.details.isConfirmedAction = true;
      const updatedSteps = [...steps];
      updatedSteps[currentStepIndex] = currentStep;
      try {
        await executeStepsInternal(
          originalExpressHttpRes, task_description, updatedSteps, taskContext, overallExecutionLog,
          currentStepIndex, sendResumedSseMessage, taskSafetyMode,
          storedOpCount // Pass the preserved operation count
        );
      } catch (resumeError) { console.error(`[POST /api/confirm-action/${confirmationId}] Error resuming ${confirmationType}: `, resumeError); sendResumedSseMessage('error', { content: `Error resuming task: ${resumeError.message}` }); if (originalExpressHttpRes.writable) { originalExpressHttpRes.end(); }}
    } else { // File or Git specific action denied
      sendResumedSseMessage('log_entry', { message: `[SSE] Action for ${confirmationType} ID: ${confirmationId} denied by user. Skipping step.` });
      overallExecutionLog.push(`[Confirmation] Action for step ${currentStepIndex + 1} (${currentStep.type}) (type: ${confirmationType}) denied by user. Skipping.`);
      try {
        await executeStepsInternal(
          originalExpressHttpRes, task_description, steps, taskContext, overallExecutionLog,
          currentStepIndex + 1, // Skip current step
          sendResumedSseMessage, taskSafetyMode,
          storedOpCount // Pass the preserved operation count
        );
      } catch (resumeError) { console.error(`[POST /api/confirm-action/${confirmationId}] Error after skipping ${confirmationType} step: `, resumeError); sendResumedSseMessage('error', { content: `Error resuming task: ${resumeError.message}` }); if (originalExpressHttpRes.writable) { originalExpressHttpRes.end(); }}
    }
  } else {
     console.error(`[POST /api/confirm-action/${confirmationId}] Unknown confirmation type: ${confirmationType}`);
     sendResumedSseMessage('error', { content: `Cannot process unknown confirmation type: ${confirmationType}` });
     if (originalExpressHttpRes.writable) { originalExpressHttpRes.end(); }
  }
  res.status(200).json({ message: `Action processed for ${confirmationId}. User confirmed: ${confirmed}` });
});

// --- Step Failure Resolution Endpoints ---

// Helper function to handle common failure retrieval and validation logic
// Retrieves details of a failed task step that is awaiting user intervention.
function getPendingFailureDetails(failureId, res) {
  const failureDetails = pendingFailures[failureId];
  if (!failureDetails) {
    console.log(`[API Failure Handling] Failure ID ${failureId} not found or already processed.`);
    res.status(404).json({ message: 'Failure ID not found or already processed.' });
    return null;
  }

  const { originalExpressHttpRes, sendSseMessage } = failureDetails;
  if (!originalExpressHttpRes || !originalExpressHttpRes.writable) {
    console.error(`[API Failure Handling] Original HTTP response stream for ${failureId} is not writable. Cannot proceed.`);
    // Clean up if stream is dead
    delete pendingFailures[failureId];
    res.status(500).json({ message: 'Cannot proceed with failure resolution: original client connection likely lost.' });
    return null;
  }
  return failureDetails;
}

// 1. Retry Step Endpoint
// Allows the user to retry a failed step.
app.post('/api/retry-step/:failureId', async (req, res) => {
  const endpointName = '[POST /api/retry-step/:failureId]';
  const { failureId } = req.params;
  console.log(`${endpointName} Request received for failureId: ${failureId}. Body:`, req.body); // req.body is likely empty

  const failureDetails = getPendingFailureDetails(failureId, res);
  if (!failureDetails) return; // getPendingFailureDetails handles logging and response if null

  const {
    originalExpressHttpRes,
    sendSseMessage, // This is the specific SSE sender for the original client
    task_description,
    steps,
    currentStepIndex, // Index of the failed step
    taskContext,
    overallExecutionLog,
    safetyMode,
    // errorDetails, // Not directly needed for retry logic itself, but was part of stored state
  } = failureDetails;

  delete pendingFailures[failureId]; // Remove before attempting retry

  const retryMessage = `[SSE] User chose to retry step ${currentStepIndex + 1}. Resuming task.`;
  sendSseMessage('log_entry', { message: retryMessage }, originalExpressHttpRes);
  overallExecutionLog.push(`[Failure Resolution] User chose to retry step ${currentStepIndex + 1}.`);
  console.log(`[API /api/retry-step/${failureId}] Retrying step ${currentStepIndex + 1} for task "${task_description.substring(0,50)}..."`);

  try {
    await executeStepsInternal(
      originalExpressHttpRes,
      task_description,
      steps,
      taskContext,
      overallExecutionLog,
      currentStepIndex, // Retry the same step
      sendSseMessage,
      safetyMode,
      0 // Reset operation count for the retry, or manage more complex state if needed
    );
    res.status(200).json({ message: 'Retry initiated for step.' });
  } catch (e) {
    console.error(`[API /api/retry-step/${failureId}] Error during retry execution:`, e);
    sendSseMessage('error', { content: `Critical error during retry of step ${currentStepIndex + 1}: ${e.message}` }, originalExpressHttpRes);
    if (originalExpressHttpRes.writable) {
      originalExpressHttpRes.end(); // Ensure stream is closed on critical error during retry
    }
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error during retry execution.' });
    }
  }
});

// 2. Skip Step Endpoint
// Allows the user to skip a failed step and continue with the next one.
app.post('/api/skip-step/:failureId', async (req, res) => {
  const endpointName = '[POST /api/skip-step/:failureId]';
  const { failureId } = req.params;
  console.log(`${endpointName} Request received for failureId: ${failureId}. Body:`, req.body); // req.body is likely empty

  const failureDetails = getPendingFailureDetails(failureId, res);
  if (!failureDetails) return; // getPendingFailureDetails handles logging and response if null

  const {
    originalExpressHttpRes,
    sendSseMessage,
    task_description,
    steps,
    currentStepIndex, // Index of the failed step
    taskContext,
    overallExecutionLog,
    safetyMode,
  } = failureDetails;

  delete pendingFailures[failureId];

  const skipMessage = `[SSE] User chose to skip step ${currentStepIndex + 1}. Resuming task from next step.`;
  sendSseMessage('log_entry', { message: skipMessage }, originalExpressHttpRes);
  overallExecutionLog.push(`[Failure Resolution] User chose to skip step ${currentStepIndex + 1}.`);
  console.log(`[API /api/skip-step/${failureId}] Skipping step ${currentStepIndex + 1}, resuming from ${currentStepIndex + 2} for task "${task_description.substring(0,50)}..."`);

  try {
    await executeStepsInternal(
      originalExpressHttpRes,
      task_description,
      steps,
      taskContext,
      overallExecutionLog,
      currentStepIndex + 1, // Start from the NEXT step
      sendSseMessage,
      safetyMode,
      0 // Reset operation count
    );
    res.status(200).json({ message: 'Skipped step. Continuing task execution.' });
  } catch (e) {
    console.error(`[API /api/skip-step/${failureId}] Error during execution after skipping:`, e);
    sendSseMessage('error', { content: `Critical error after skipping step ${currentStepIndex + 1}: ${e.message}` }, originalExpressHttpRes);
    if (originalExpressHttpRes.writable) {
      originalExpressHttpRes.end();
    }
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error during execution after skipping step.' });
    }
  }
});

// 3. Convert to Manual Endpoint
// Allows the user to halt autonomous execution and receive the remaining steps to handle manually.
app.post('/api/convert-to-manual/:failureId', async (req, res) => {
  const endpointName = '[POST /api/convert-to-manual/:failureId]';
  const { failureId } = req.params;
  console.log(`${endpointName} Request received for failureId: ${failureId}. Body:`, req.body); // req.body is likely empty

  const failureDetails = getPendingFailureDetails(failureId, res);
  if (!failureDetails) return; // getPendingFailureDetails handles logging and response if null

  const {
    originalExpressHttpRes,
    sendSseMessage,
    task_description, // For logging context if needed
    steps,
    currentStepIndex,
    overallExecutionLog,
  } = failureDetails;

  delete pendingFailures[failureId];

  const remainingSteps = steps.slice(currentStepIndex);
  const manualMessage = `[SSE] Task converted to manual mode by user. Remaining ${remainingSteps.length} steps provided.`;

  sendSseMessage('manual_mode_activated', {
    message: 'Task converted to manual mode. Remaining steps provided.',
    remainingSteps: remainingSteps,
  }, originalExpressHttpRes);

  overallExecutionLog.push(`[Failure Resolution] Task "${task_description.substring(0,50)}..." converted to manual mode by user at step ${currentStepIndex + 1}. Execution terminated by Roadrunner. Remaining steps sent to client.`);
  console.log(`[API /api/convert-to-manual/${failureId}] Converting task to manual. ${remainingSteps.length} steps sent to client.`);

  sendSseMessage('execution_complete', { message: 'Task converted to manual mode by user. Backend processing halted.' }, originalExpressHttpRes);

  if (originalExpressHttpRes.writable) {
    originalExpressHttpRes.end(); // Close the original SSE connection
  }

  res.status(200).json({ message: 'Task converted to manual mode. Remaining steps sent to client.' });
});

// New endpoint for categorized Ollama models
app.get('/api/ollama-models/categorized', async (req, res) => {
  const logPrefix = '[Ollama Fetch Debug]';
  console.log(`${logPrefix} Attempting to fetch Ollama models from /api/tags...`);
  let ollamaApiResponse;
  let rawBodyText;
  try {
    ollamaApiResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    console.log(`${logPrefix} Received response from /api/tags - Status: ${ollamaApiResponse.status}, Headers: ${JSON.stringify(Object.fromEntries(ollamaApiResponse.headers))}`);

    rawBodyText = await ollamaApiResponse.text();
    console.log(`${logPrefix} Raw response body from /api/tags: ${rawBodyText}`);

    if (!ollamaApiResponse.ok) {
      console.error(
        `${logPrefix} Ollama API Error /api/tags: ${ollamaApiResponse.status} ${ollamaApiResponse.statusText}`,
        rawBodyText
      );
      throw new Error(
        `Ollama API request to /api/tags failed: ${ollamaApiResponse.status} ${ollamaApiResponse.statusText}. Body: ${rawBodyText.substring(0, 100)}`
      );
    }

    const ollamaData = JSON.parse(rawBodyText);
    console.log(`${logPrefix} Parsed JSON data from /api/tags:`, ollamaData);

    const models = ollamaData.models || [];
    console.log(`${logPrefix} Extracted models array:`, models);

    // === Add this loop ===
    models.forEach(model => {
      model.type = 'ollama'; // Add the type property
      // Optionally, ensure model.id exists, similar to frontend, though frontend also does this.
      // if (!model.id && model.model) model.id = model.model;
    });
    // === End of loop ===

    const categorizedModels = categorizeOllamaModels(models, modelCategories);
    console.log(`${logPrefix} Final categorized models being sent:`, categorizedModels);
    res.json(categorizedModels);
  } catch (error) {
    console.error(`${logPrefix} Error during Ollama fetch or processing:`, error.message, error.stack);
    // Log more specific errors based on whether it's a fetch issue or an API response issue
    if (ollamaApiResponse && !ollamaApiResponse.ok) {
      // This branch handles errors thrown after a failed API response (e.g. 4xx, 5xx from Ollama)
      console.error(
        `${logPrefix} [Error /api/ollama-models/categorized] Ollama API returned an error:`,
        error.message
      );
      res.status(500).json({
        error: 'Failed to fetch models from Ollama API',
        details: error.message,
        ollama_status: ollamaApiResponse.status,
        ollama_body: rawBodyText ? rawBodyText.substring(0,500) : "Could not read body",
      });
    } else {
      // This branch handles network errors or other issues where fetch itself failed
      console.error(
        `${logPrefix} [Fetch Error /api/ollama-models/categorized] Error fetching from Ollama /api/tags:`,
        error
      );
      res.status(500).json({
        error: 'Failed to connect or send request to Ollama API',
        details: error.message,
      });
    }
  }
});

// --- Agent Instructions API Endpoints ---

// GET /api/instructions/:agentType
app.get('/api/instructions/:agentType', (req, res) => {
  const { agentType } = req.params;
  console.log(`[API GET /api/instructions/${agentType}] Request received.`);
  try {
    // Read the latest instructions from file for each request to ensure freshness
    const currentAgentInstructions = JSON.parse(fs.readFileSync(instructionsPath, 'utf-8'));

    if (agentType === 'coder_agent' && currentAgentInstructions.coder_agent) {
      res.json(currentAgentInstructions.coder_agent);
    } else if (agentType === 'brainstorming_agent' && currentAgentInstructions.brainstorming_agent) {
      res.json(currentAgentInstructions.brainstorming_agent);
    } else if (agentType === 'conference_agent' && currentAgentInstructions.conference_agent) {
      // For /api/instructions/conference_agent, return the whole conference_agent object
      res.json(currentAgentInstructions.conference_agent);
    } else {
      console.log(`[API GET /api/instructions/${agentType}] Agent type not found.`);
      res.status(404).json({ message: `Agent type '${agentType}' not found.` });
    }
  } catch (error) {
    console.error(`[API GET /api/instructions/${agentType}] Error reading instructions file:`, error);
    res.status(500).json({ message: 'Error reading agent instructions file.', details: error.message });
  }
});

// GET /api/instructions/conference_agent/:agentRole
app.get('/api/instructions/conference_agent/:agentRole', (req, res) => {
  const { agentRole } = req.params;
  console.log(`[API GET /api/instructions/conference_agent/${agentRole}] Request received.`);
  try {
    const currentAgentInstructions = JSON.parse(fs.readFileSync(instructionsPath, 'utf-8'));

    if (currentAgentInstructions.conference_agent && currentAgentInstructions.conference_agent[agentRole]) {
      res.json(currentAgentInstructions.conference_agent[agentRole]);
    } else {
      console.log(`[API GET /api/instructions/conference_agent/${agentRole}] Conference agent role '${agentRole}' not found.`);
      res.status(404).json({ message: `Conference agent role '${agentRole}' not found.` });
    }
  } catch (error) {
    console.error(`[API GET /api/instructions/conference_agent/${agentRole}] Error reading instructions file:`, error);
    res.status(500).json({ message: 'Error reading agent instructions file.', details: error.message });
  }
});

// POST /api/instructions/:agentType
app.post('/api/instructions/:agentType', (req, res) => {
  const endpointName = '[POST /api/instructions/:agentType]';
  const { agentType } = req.params;
  const { instructions } = req.body;
  console.log(`${endpointName} Request for agentType: ${agentType}. Received instructions:`, instructions, "Body:", req.body);

  if (agentType === 'conference_agent') {
    console.warn(`${endpointName} Invalid agentType '${agentType}' for this endpoint. Use role-specific conference endpoint.`);
    return res.status(400).json({ message: `To update conference_agent instructions, please use the /api/instructions/conference_agent/:agentRole endpoint.` });
  }

  if (!Array.isArray(instructions) || !instructions.every(item => typeof item === 'string')) {
    console.warn(`${endpointName} Invalid payload for agentType '${agentType}': instructions must be an array of strings. Received:`, instructions);
    return res.status(400).json({ message: 'Invalid payload: instructions must be an array of strings.' });
  }

  try {
    let currentAgentInstructions = JSON.parse(fs.readFileSync(instructionsPath, 'utf-8'));

    if (agentType === 'coder_agent') {
      currentAgentInstructions.coder_agent = instructions;
    } else if (agentType === 'brainstorming_agent') {
      currentAgentInstructions.brainstorming_agent = instructions;
    } else {
      // This case should ideally not be reached if conference_agent is handled above,
      // but as a safeguard for other potential agent types not covered.
      console.log(`[API POST /api/instructions/${agentType}] Agent type not found for update.`);
      return res.status(404).json({ message: `Agent type '${agentType}' not found or cannot be updated via this endpoint.` });
    }

    fs.writeFileSync(instructionsPath, JSON.stringify(currentAgentInstructions, null, 2), 'utf-8');
    agentInstructions = currentAgentInstructions; // Update in-memory instructions
    console.log(`[API POST /api/instructions/${agentType}] Instructions updated successfully.`);
    res.json({ message: `Instructions for '${agentType}' updated successfully.` });

  } catch (error) {
    console.error(`[API POST /api/instructions/${agentType}] Error processing request:`, error);
    res.status(500).json({ message: 'Error updating agent instructions.', details: error.message });
  }
});

// POST /api/instructions/conference_agent/:agentRole
app.post('/api/instructions/conference_agent/:agentRole', (req, res) => {
  const endpointName = '[POST /api/instructions/conference_agent/:agentRole]';
  const { agentRole } = req.params;
  const { instructions } = req.body;
  console.log(`${endpointName} Request for agentRole: ${agentRole}. Received instructions:`, instructions, "Body:", req.body);

  if (!Array.isArray(instructions) || !instructions.every(item => typeof item === 'string')) {
    console.warn(`${endpointName} Invalid payload for agentRole '${agentRole}': instructions must be an array of strings. Received:`, instructions);
    return res.status(400).json({ message: 'Invalid payload: instructions must be an array of strings.' });
  }

  try {
    let currentAgentInstructions = JSON.parse(fs.readFileSync(instructionsPath, 'utf-8'));

    if (!currentAgentInstructions.conference_agent) {
      // This case might occur if the conference_agent key was deleted from the file manually.
      // Initialize it to allow role creation.
      console.warn(`[API POST /api/instructions/conference_agent/${agentRole}] 'conference_agent' object not found in instructions file. Initializing.`);
      currentAgentInstructions.conference_agent = {};
    }
    // It's okay if the role doesn't exist yet; this will create it.
    // A stricter version might check if agentRole is one of 'model_a', 'model_b', 'arbiter' only.
    currentAgentInstructions.conference_agent[agentRole] = instructions;

    fs.writeFileSync(instructionsPath, JSON.stringify(currentAgentInstructions, null, 2), 'utf-8');
    agentInstructions = currentAgentInstructions; // Update in-memory instructions
    console.log(`[API POST /api/instructions/conference_agent/${agentRole}] Instructions updated successfully for role '${agentRole}'.`);
    res.json({ message: `Instructions for conference_agent role '${agentRole}' updated successfully.` });

  } catch (error) {
    console.error(`[API POST /api/instructions/conference_agent/${agentRole}] Error processing request:`, error);
    res.status(500).json({ message: 'Error updating conference agent instructions.', details: error.message });
  }
});


// Search logs via LogCore
app.get('/api/logs/search', async (req, res) => {
  try {
    // const { modules, levels, limit, ...rest } = req.query; // logcore options not needed
    // const options = { ...rest }; // logcore options not needed
    // if (modules) options.modules = Array.isArray(modules) ? modules : String(modules).split(',');
    // if (levels) options.levels = Array.isArray(levels) ? levels : String(levels).split(',');
    // if (limit) options.limit = parseInt(limit, 10);

    // Replace logcore call with 501 response
    console.error('[API /api/logs/search] Endpoint hit, but feature is unavailable (logcore removed).');
    res.status(501).json({
        message: "Log search functionality is currently unavailable. Advanced logging features are pending reimplementation.",
        note: "Basic task execution logs are saved as .md files in the configured Log Directory."
    });
  } catch (err) { // This catch might still be relevant if other parts of the setup fail
    console.error('[API /api/logs/search] Unexpected error (logcore removed):', err.message);
    if (!res.headersSent) { // Ensure headers aren't already sent by the 501 response
        res.status(500).json({ error: 'Log search failed due to an unexpected issue.', details: err.message });
    }
  }
});

// Export logs based on query
app.get('/api/logs/export', async (req, res) => {
  try {
    // const { format = 'jsonl', ...rest } = req.query; // logcore options not needed

    // Replace logcore call with 501 response
    console.error('[API /api/logs/export] Endpoint hit, but feature is unavailable (logcore removed).');
    res.status(501).json({
        message: "Log export functionality is currently unavailable. Advanced logging features are pending reimplementation."
    });
  } catch (err) { // This catch might still be relevant if other parts of the setup fail
    console.error('[API /api/logs/export] Unexpected error (logcore removed):', err.message);
    if (!res.headersSent) { // Ensure headers aren't already sent by the 501 response
        res.status(500).json({ error: 'Log export failed due to an unexpected issue.', details: err.message });
    }
  }
});

// Endpoint to initiate Ollama model download and stream progress
app.post('/api/ollama/pull-model', async (req, res) => {
  const endpointName = '[POST /api/ollama/pull-model]';
  const { modelName } = req.body;
  console.log(`${endpointName} Request received. Body:`, req.body);

  if (!modelName || typeof modelName !== 'string' || modelName.trim() === '') {
    console.warn(`${endpointName} Invalid modelName: "${modelName}". Type: ${typeof modelName}.`);
    return res.status(400).json({ message: "modelName (string) is required and cannot be empty." });
  }

  console.log(`${endpointName} Processing request to download model: ${modelName}`);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Send headers immediately

  const sendSseDownloadStatus = (ollamaStatusObject) => {
    if (res.writable) {
      res.write(`data: ${JSON.stringify({ type: 'model_pull_status', payload: ollamaStatusObject })}\n\n`);
    }
  };

  const sendSseError = (errorMessage, details = {}) => {
    if (res.writable) {
      res.write(`data: ${JSON.stringify({ type: 'model_pull_error', message: errorMessage, modelName, ...details })}\n\n`);
      // Consider ending the response here or letting the main try/catch handle it
    }
  };

  req.on('close', () => {
    console.log(`[SSE /api/ollama/pull-model] Client disconnected for model ${modelName}. Download will continue in background if Ollama supports it.`);
    // Ollama's /api/pull doesn't have a direct abort mechanism via API once started.
    // The fetch request itself could be aborted if we kept a reference to AbortController's signal,
    // but that only stops our side from processing the stream, not Ollama from downloading.
  });

  try {
    console.info(`[Ollama Pull /api/pull-model] Initiating pull request for model: ${modelName} to ${OLLAMA_BASE_URL}/api/pull`);
    const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    console.info(`[Ollama Pull /api/pull-model] Received response from Ollama for ${modelName}. Status: ${ollamaRes.status} ${ollamaRes.statusText}`);

    if (!ollamaRes.ok) {
      const errorBody = await ollamaRes.text();
      console.error(`[Ollama Pull /api/pull-model] Ollama API error for ${modelName}: ${ollamaRes.status} ${ollamaRes.statusText} - ${errorBody}`);
      sendSseError(
        `Ollama API request failed: ${ollamaRes.status} ${ollamaRes.statusText}`,
        { details: errorBody.substring(0, 200), ollama_status: ollamaRes.status }
      );
      if (res.writable) res.end();
      return;
    }

    for await (const chunk of ollamaRes.body) {
      if (!res.writable) { // Check if client disconnected
          console.log(`[Ollama Pull /api/pull-model] Client disconnected for ${modelName}, but Ollama stream is still sending data. Stopping SSE forward.`);
          return;
      }
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.trim() === '') continue;
        try {
          const parsedOllamaObject = JSON.parse(line);
          console.debug(`[Ollama Pull /api/pull-model] Received data line for ${modelName}: `, parsedOllamaObject);

          if (parsedOllamaObject.error) {
            console.error(`[Ollama Pull /api/pull-model] Error from Ollama stream for ${modelName}: ${parsedOllamaObject.error}`);
            sendSseError(`Ollama stream error: ${parsedOllamaObject.error}`, { ollamaError: parsedOllamaObject.error, model_name: modelName });
            // No need to 'continue' here as we want to send this error and then let the stream naturally end or continue if Ollama sends more.
            // If this error is terminal, Ollama should close the stream.
          }

          sendSseDownloadStatus(parsedOllamaObject); // Send the object to the client

          if (parsedOllamaObject.status) {
            const statusLower = parsedOllamaObject.status.toLowerCase();
            if (statusLower.includes('layer already exists') || statusLower.includes('up to date')) {
              console.info(`[Ollama Pull /api/pull-model] Status for ${modelName}: ${parsedOllamaObject.status}`);
            }
            if (statusLower.includes('success')) {
             console.info(`[Ollama Pull /api/pull-model] Detected success status from Ollama for ${modelName}: ${parsedOllamaObject.status}`);
            }
          }
        } catch (parseError) {
          console.warn(`[Ollama Pull /api/pull-model] Failed to parse JSON line from Ollama stream for ${modelName}. Line: "${line.substring(0, 100)}...". Error: ${parseError.message}`);
        }
      }
    }
    console.info(`[Ollama Pull /api/pull-model] Ollama stream ended for model ${modelName}.`);
    sendSseDownloadStatus({ status: `Download stream for '${modelName}' finished or Ollama stream ended.`, modelName: modelName, final: true });

  } catch (error) {
    console.error(`[Ollama Pull /api/pull-model] Fetch exception for model ${modelName}:`, error);
    sendSseError(
      'Failed to connect to Ollama or network error during pull.',
      { model_name: modelName, original_error: error.message }
    );
  } finally {
    if (res.writable) {
      console.log(`[SSE /api/ollama/pull-model] Closing SSE connection for ${modelName}.`);
      res.end();
    }
  }
});

// --- Multi-Model Conference Endpoint ---
// Re-implemented based on roadrunner.model_conference.md for single-round debate
app.post('/execute-conference-task', async (req, res) => {
  const conferenceId = uuidv4(); // Generate unique ID for this conference
  const logMessages = [];
  const log = (msg, level = 'log') => {
    logMessages.push(msg);
    console[level](msg); // Keep existing console[level] behavior
  };
  log(`[Conference ${conferenceId}] Received POST /execute-conference-task request. Body: ${JSON.stringify(req.body)}`);

  try {
    const { prompt: userPrompt, modelName: requestedModelName, modelARole: requestedModelARole, modelBRole: requestedModelBRole, arbiterModelRole: requestedArbiterModelRole, history } = req.body;

    if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim() === '') {
      const errorMsg = 'prompt is required and must be a non-empty string.';
      log(`[Conference ${conferenceId}] Error: ${errorMsg}. Received prompt: "${userPrompt}"`, 'warn');
      return res.status(400).json({ error: errorMsg, conference_id: conferenceId, log_messages: logMessages });
    }
    log(`[Conference ${conferenceId}] User Prompt (first 100 chars): "${userPrompt.substring(0, 100)}..."`);

    // Log received optional parameters and their types if they exist
    if (requestedModelName !== undefined) log(`[Conference ${conferenceId}] Requested modelName: "${requestedModelName}" (type: ${typeof requestedModelName})`);
    if (requestedModelARole !== undefined) log(`[Conference ${conferenceId}] Requested modelARole: "${requestedModelARole}" (type: ${typeof requestedModelARole})`);
    if (requestedModelBRole !== undefined) log(`[Conference ${conferenceId}] Requested modelBRole: "${requestedModelBRole}" (type: ${typeof requestedModelBRole})`);
    if (requestedArbiterModelRole !== undefined) log(`[Conference ${conferenceId}] Requested arbiterModelRole: "${requestedArbiterModelRole}" (type: ${typeof requestedArbiterModelRole})`);
    if (history !== undefined) log(`[Conference ${conferenceId}] History provided. Type: ${typeof history}`);


    // Determine model and roles, falling back to defaults.
    // Ensure that if an optional param is provided but is not a string (e.g. null, number), it still falls back.
    const currentModelName = (typeof requestedModelName === 'string' && requestedModelName.trim() !== '') ? requestedModelName : (backendSettings.defaultOllamaModel || 'llama3');
    const roleA = (typeof requestedModelARole === 'string' && requestedModelARole.trim() !== '') ? requestedModelARole : 'Logical Reasoner';
    const roleB = (typeof requestedModelBRole === 'string' && requestedModelBRole.trim() !== '') ? requestedModelBRole : 'Creative Problem Solver';
    const roleArbiter = (typeof requestedArbiterModelRole === 'string' && requestedArbiterModelRole.trim() !== '') ? requestedArbiterModelRole : 'Arbiter and Synthesizer';

    log(`[Conference ${conferenceId}] Effective Model: ${currentModelName}, Role A: ${roleA}, Role B: ${roleB}, Arbiter: ${roleArbiter}`);

    const historyText = Array.isArray(history) ? history.map(h => `${h.role}: ${h.content || h.message}`).join('\n') : '';

    // Model A Interaction
    const promptA = `You are ${roleA}.${historyText ? ` The conversation so far:\n${historyText}\n` : ' '}The user's question is: "${userPrompt}". Provide your analysis and response.`;
    log(`[Conference ${conferenceId}] Prompting Model A (${roleA})...`);
    console.log('[Backend Conference] /execute-conference-task: Preparing to call Model A.');
    const responseA = await generateFromLocal(promptA, currentModelName, null, { agentType: 'conference_agent', agentRole: 'model_a' }); // null for expressRes
    if (responseA.startsWith('// LLM_ERROR:') || responseA.startsWith('// LLM_WARNING:')) {
      log(`[Conference ${conferenceId}] Error from Model A: ${responseA}`, 'error');
      return res.status(500).json({ error: 'Error in Model A response.', conference_id: conferenceId, details: responseA, log_messages: logMessages });
    }
    log(`[Conference ${conferenceId}] Model A Response (first 100 chars): "${responseA.substring(0, 100)}..."`);

    // Model B Interaction
    const promptB = `You are ${roleB}.${historyText ? ` The conversation so far:\n${historyText}\n` : ' '}The user's question is: "${userPrompt}". Provide your analysis and response.`;
    log(`[Conference ${conferenceId}] Prompting Model B (${roleB})...`);
    const responseB = await generateFromLocal(promptB, currentModelName, null, { agentType: 'conference_agent', agentRole: 'model_b' });
    if (responseB.startsWith('// LLM_ERROR:') || responseB.startsWith('// LLM_WARNING:')) {
      log(`[Conference ${conferenceId}] Error from Model B: ${responseB}`, 'error');
      return res.status(500).json({ error: 'Error in Model B response.', conference_id: conferenceId, details: responseB, log_messages: logMessages });
    }
    log(`[Conference ${conferenceId}] Model B Response (first 100 chars): "${responseB.substring(0, 100)}..."`);

    // Arbiter Interaction
    const promptArbiter = `You are ${roleArbiter}. The conversation so far is as follows:${historyText ? `\n${historyText}` : ''}\nUser's latest question: "${userPrompt}"\n\nModel A (${roleA}) responded: "${responseA}"\n\nModel B (${roleB}) responded: "${responseB}"\n\nProvide a comprehensive synthesized answer.`;
    log(`[Conference ${conferenceId}] Prompting Arbiter Model (${roleArbiter})...`);
    const finalResponse = await generateFromLocal(promptArbiter, currentModelName, null, { agentType: 'conference_agent', agentRole: 'arbiter' });
    if (finalResponse.startsWith('// LLM_ERROR:') || finalResponse.startsWith('// LLM_WARNING:')) {
      log(`[Conference ${conferenceId}] Error from Arbiter Model: ${finalResponse}`, 'error');
      return res.status(500).json({ error: 'Error in Arbiter Model response.', conference_id: conferenceId, details: finalResponse, log_messages: logMessages });
    }
    log(`[Conference ${conferenceId}] Arbiter Response (first 100 chars): "${finalResponse.substring(0, 100)}..."`);

    // Logging
    const logEntry = {
      conference_id: conferenceId,
      timestamp: new Date().toISOString(),
      user_prompt: userPrompt,
      model_used: currentModelName,
      model_a_role: roleA,
      model_a_prompt: promptA,
      model_a_response: responseA,
      model_b_role: roleB,
      model_b_prompt: promptB,
      model_b_response: responseB,
      arbiter_model_role: roleArbiter,
      arbiter_model_prompt: promptArbiter,
      arbiter_model_response: finalResponse,
      conversation_history: history || [],
      source: "direct_api_call_v2" // Indicate new version
    };

    let conferences = [];
    try {
      if (fs.existsSync(CONFERENCES_LOG_FILE)) {
        const fileContent = fs.readFileSync(CONFERENCES_LOG_FILE, 'utf-8');
        if (fileContent.trim() !== "") {
          conferences = JSON.parse(fileContent);
        }
      }
    } catch (readError) {
      log(`[Conference ${conferenceId}] Error reading or parsing ${CONFERENCES_LOG_FILE}. Initializing with new array. Error: ${readError.message}`);
      // Log a warning but proceed with an empty array, so the current conference can still be logged.
      conferences = [];
    }

    conferences.push(logEntry);
    try {
      fs.writeFileSync(CONFERENCES_LOG_FILE, JSON.stringify(conferences, null, 2));
      log(`[Conference ${conferenceId}] Logged successfully to ${CONFERENCES_LOG_FILE}`);
    } catch (writeError) {
      log(`[Conference ${conferenceId}] Failed to write conference log to ${CONFERENCES_LOG_FILE}: ${writeError.message}`, 'error');
      // Do not fail the request if logging fails, but log the error.
    }

    // Response
    log(`[Conference ${conferenceId}] Task completed successfully. Sending response to client.`);
    res.json({
      conference_id: conferenceId,
      final_response: finalResponse,
      model_a_response: responseA,
      model_b_response: responseB,
      log_messages: logMessages
    });

  } catch (error) {
    log(`[Conference ${conferenceId}] Unhandled error processing conference task: ${error.message}`, 'error');
    // Ensure conferenceId is included in the error response if available
    res.status(500).json({
        error: 'Failed to execute conference task due to an internal server error.',
        conference_id: conferenceId,
        details: error.message,
        log_messages: logMessages
    });
  }
});

(async () => {
  try {
    // Preserve any existing logic that was inside the IIFE before app.listen
    // For example, if checkOllamaStatus() or startOllama() were called here,
    // they should be preserved if they are still relevant.
    // Based on previous analysis, the original IIFE was just a placeholder comment.
    // If there was actual logic, it would need to be reinstated here.
    // We assume for now the primary goal is to get app.listen working with the new config.

    console.log('[Server Startup] Checking Ollama status...');
    let ollamaReady = await checkOllamaStatus(); // Ensure checkOllamaStatus is available in this scope
    if (!ollamaReady) {
      console.log('[Server Startup] Ollama not detected or not responsive. Attempting to start Ollama...');
      try {
        await startOllama(); // Ensure startOllama is available in this scope
        // Wait a moment for Ollama to initialize after exec (if applicable)
        console.log('[Server Startup] Waiting for Ollama to initialize after start attempt (5s)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        ollamaReady = await checkOllamaStatus(); // Check status again
      } catch (startError) {
        console.error(`[Server Startup] Error during Ollama start attempt: ${startError.message}`);
        // Ollama could not be started by exec, ollamaReady remains false.
      }
    }
    // Removed the redundant, nested IIFE structure here.
    // The logic continues within the single, top-level IIFE.
    if (!ollamaReady) {
      console.error('--------------------------------------------------------------------');
      console.error('[Server Startup] WARNING: Ollama is not running and/or could not be started by the server.');
      console.error('[Server Startup] Roadrunner backend will start, but LLM-dependent features will fail.');
      console.error('[Server Startup] Please ensure Ollama is installed and running manually if needed.');
      console.error(`[Server Startup] Attempted to connect/start Ollama at: ${OLLAMA_BASE_URL}`);
      console.error('--------------------------------------------------------------------');
    } else {
      console.log('[Server Startup] Ollama reported as operational.');
    }

    // Start server only if this script is executed directly (not required by a test)
    if (require.main === module) {
      const initialPort = parseInt(process.env.PORT || '3030', 10);
      attemptToListen(initialPort);
    }
  } catch (err) {
    console.error('[Server Startup IIFE] Error during server startup:', err);
    if (require.main === module) { // Only exit if run directly
        process.exit(1);
    } else {
        throw err; // Re-throw for test runner to catch, allowing tests to see startup errors
    }
  }
})();

// Export for testing purposes and potentially for other modules if needed
module.exports = {
  app, // The Express app instance
  backendSettings, // The loaded backend settings
  loadBackendConfig, // The function to load/reload settings
  handleExecuteAutonomousTask, // Existing export
  generateFromLocal, // Export for testing
  resolveTemplates, // Export for testing
  executeStepsInternal, // Export for testing
  // Add any other functions or variables you might need to test or use externally
};
