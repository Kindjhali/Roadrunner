const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Mock the fs module
jest.mock('fs');

// Import app and settings utilities AFTER mocking fs
// Ensure server.js exports these. The app export is crucial for supertest.
// backendSettings is imported as a getter function to access the live variable from server.js
let app;
let loadBackendConfig;
let getBackendSettings;

const BACKEND_CONFIG_FILE_PATH = path.join(__dirname, '..', 'config', 'backend_config.json');
const BACKEND_CONFIG_EXAMPLE_PATH = path.join(__dirname, '..', 'config', 'backend_config.example.json');

describe('API Settings Endpoints', () => {
  let originalBackendSettings;

  beforeAll(() => {
    // Dynamically import server components AFTER fs has been mocked above
    const server = require('../server');
    app = server.app;
    loadBackendConfig = server.loadBackendConfig;
    // Create a getter for backendSettings to ensure we can see live changes if server.js modifies it directly
    // For the purpose of these tests, we'll primarily be checking file writes and responses.
    // Direct inspection of the 'backendSettings' variable in server.js from here can be tricky
    // due to module caching. Re-invoking loadBackendConfig() and checking responses is more robust.
  });

  beforeEach(() => {
    jest.resetAllMocks(); // Reset fs mocks for each test

    // Define a default state for backendSettings for each test run
    // This simulates the initial state of backendSettings in server.js before any file loading
    const initialDefaultSettings = {
      llmProvider: null,
      apiKey: '',
      defaultOllamaModel: 'codellama',
    };
    // Mock the global backendSettings from server.js by directly setting it if possible,
    // or ensure loadBackendConfig() correctly resets it based on mocks.
    // The most reliable way is to ensure loadBackendConfig() is effective.
    // So, we ensure fs mocks lead to a known state via loadBackendConfig().

    fs.existsSync.mockImplementation(filePath => {
      if (filePath === BACKEND_CONFIG_FILE_PATH) return false;
      if (filePath === BACKEND_CONFIG_EXAMPLE_PATH) return false;
      // For any other path, delegate to the actual fs.existsSync or a specific mock if needed
      return jest.requireActual('fs').existsSync(filePath);
    });
    fs.readFileSync.mockImplementation((filePath) => {
        // Default to empty or throw error if unexpected path
        if (filePath === BACKEND_CONFIG_FILE_PATH || filePath === BACKEND_CONFIG_EXAMPLE_PATH) {
            throw new Error('File not found by mock');
        }
        return JSON.stringify({});
    });
    fs.writeFileSync.mockClear();

    // Manually set the settings in server.js to a known default before each test,
    // then call loadBackendConfig to apply mocks. This is a bit of a state reset.
    const serverModule = require('../server'); // Re-require to get access to the module's context
    serverModule.backendSettings.llmProvider = initialDefaultSettings.llmProvider;
    serverModule.backendSettings.apiKey = initialDefaultSettings.apiKey;
    serverModule.backendSettings.defaultOllamaModel = initialDefaultSettings.defaultOllamaModel;
  });

  describe('GET /api/settings', () => {
    it('should return default settings if no config file exists and no example', async () => {
      fs.existsSync.mockReturnValue(false); // No config, no example
      loadBackendConfig(); // This will create and write the default config

      const response = await request(app).get('/api/settings');
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        llmProvider: null,
        apiKey: '',
        defaultOllamaModel: 'codellama',
      });
      // It should have written the default config
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        BACKEND_CONFIG_FILE_PATH,
        JSON.stringify({ llmProvider: null, apiKey: '', defaultOllamaModel: 'codellama' }, null, 2),
        'utf-8'
      );
    });

    it('should return settings from backend_config.json if it exists', async () => {
      const mockSettings = {
        llmProvider: 'openai',
        apiKey: 'test_api_key',
        defaultOllamaModel: 'gpt-4',
      };
      fs.existsSync.mockImplementation(filePath => filePath === BACKEND_CONFIG_FILE_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockSettings));
      loadBackendConfig();

      const response = await request(app).get('/api/settings');
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockSettings);
    });

    it('should return settings from example file if config does not exist but example does', async () => {
      const exampleSettings = {
        llmProvider: 'ollama_example',
        apiKey: 'example_key',
        defaultOllamaModel: 'example_model',
      };
      // Mock: config doesn't exist, example does
      fs.existsSync.mockImplementation(filePath => filePath === BACKEND_CONFIG_EXAMPLE_PATH);
      // Mock: readFileSync for example, and then for the (just written) config
      fs.readFileSync.mockImplementation(filePath => {
        if (filePath === BACKEND_CONFIG_EXAMPLE_PATH) return JSON.stringify(exampleSettings);
        if (filePath === BACKEND_CONFIG_FILE_PATH) return JSON.stringify(exampleSettings); // after copy
        return JSON.stringify({});
      });
      loadBackendConfig();

      const response = await request(app).get('/api/settings');
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(exampleSettings);
      expect(fs.writeFileSync).toHaveBeenCalledWith(BACKEND_CONFIG_FILE_PATH, JSON.stringify(exampleSettings), 'utf-8');
    });
  });

  describe('POST /api/settings', () => {
    it('should update settings and save to backend_config.json', async () => {
      // Ensure loadBackendConfig starts with a clean slate (default settings)
      fs.existsSync.mockReturnValue(false); // No config, no example
      loadBackendConfig();
      // At this point, backendSettings in server.js is the default,
      // and writeFileSync was called once to save this default config.
      fs.writeFileSync.mockClear(); // Clear that initial call

      const newSettings = {
        llmProvider: 'anthropic',
        apiKey: 'new_anthropic_key',
        defaultOllamaModel: 'claude-3',
      };

      const response = await request(app)
        .post('/api/settings')
        .send(newSettings);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Settings updated successfully.');
      expect(response.body.settings).toEqual(newSettings);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        BACKEND_CONFIG_FILE_PATH,
        JSON.stringify(newSettings, null, 2),
        'utf-8'
      );

      // Verify in-memory settings reflect the change by fetching again
      // For this to pass robustly, the GET /api/settings must return the live in-memory backendSettings
      const getResponse = await request(app).get('/api/settings');
      expect(getResponse.body).toEqual(newSettings);
    });

    it('should update only provided settings fields, preserving others', async () => {
        const initialSettings = { llmProvider: 'ollama', apiKey: 'key_initial', defaultOllamaModel: 'model_initial' };
        fs.existsSync.mockImplementation(p => p === BACKEND_CONFIG_FILE_PATH);
        fs.readFileSync.mockReturnValue(JSON.stringify(initialSettings));
        loadBackendConfig(); // Load initial settings
        fs.writeFileSync.mockClear(); // Clear calls from loadBackendConfig

        const partialUpdate = { apiKey: 'updated_key' };
        // Expected: llmProvider and defaultOllamaModel from initial, apiKey from partialUpdate
        const expectedSettings = {
            llmProvider: initialSettings.llmProvider,
            apiKey: partialUpdate.apiKey,
            defaultOllamaModel: initialSettings.defaultOllamaModel
        };

        const postResponse = await request(app)
            .post('/api/settings')
            .send(partialUpdate);

        expect(postResponse.statusCode).toBe(200);
        expect(postResponse.body.settings).toEqual(expectedSettings);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            BACKEND_CONFIG_FILE_PATH,
            JSON.stringify(expectedSettings, null, 2),
            'utf-8'
        );

        // Verify with a GET
        const getResponse = await request(app).get('/api/settings');
        expect(getResponse.body).toEqual(expectedSettings);
    });

    it('should handle empty payload by not changing settings (effectively writing back current settings)', async () => {
      const initialSettings = { llmProvider: 'ollama', apiKey: 'key1', defaultOllamaModel: 'model1' };
      fs.existsSync.mockImplementation(p => p === BACKEND_CONFIG_FILE_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify(initialSettings));
      loadBackendConfig();
      fs.writeFileSync.mockClear();

      const response = await request(app)
        .post('/api/settings')
        .send({});

      expect(response.statusCode).toBe(200);
      expect(response.body.settings).toEqual(initialSettings);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        BACKEND_CONFIG_FILE_PATH,
        JSON.stringify(initialSettings, null, 2),
        'utf-8'
      );
    });

    it('should handle errors during file write', async () => {
      fs.existsSync.mockReturnValue(false); // No initial file
      loadBackendConfig(); // Creates default config
      fs.writeFileSync.mockClear(); // Clear initial write

      fs.writeFileSync.mockImplementation(() => { // Next call to writeFileSync (from POST) will throw
        throw new Error('Disk full');
      });

      const newSettings = { llmProvider: 'test', apiKey: 'test', defaultOllamaModel: 'test' };
      const response = await request(app)
        .post('/api/settings')
        .send(newSettings);

      expect(response.statusCode).toBe(500);
      expect(response.body.error).toBe('Failed to save settings.');
      expect(response.body.details).toBe('Disk full');
    });
  });
});
