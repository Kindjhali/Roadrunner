const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Mock the fs module
jest.mock('fs');

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: mockFetch,
}));

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

describe('GET /api/ollama-models/categorized', () => {
  const MODEL_CATEGORIES_PATH = path.join(__dirname, '..', 'config', 'model_categories.json');

  beforeEach(() => {
    // Reset mocks for each test
    mockFetch.mockReset();
    fs.readFileSync.mockReset(); // Reset fs.readFileSync specifically
    fs.existsSync.mockReset(); // Reset fs.existsSync specifically

    // Default mock for model_categories.json (can be overridden in tests)
    fs.existsSync.mockImplementation(filePath => filePath === MODEL_CATEGORIES_PATH);
    fs.readFileSync.mockImplementation(filePath => {
      if (filePath === MODEL_CATEGORIES_PATH) {
        return JSON.stringify({
          categories: {
            coder: ["codellama", "code"],
            language: ["mistral", "llama", "phi3"]
          },
          default_category: "language"
        });
      }
      // Fallback for other readFileSync calls if any (e.g., backend_config.json by loadBackendConfig)
      // For this suite, we primarily care about model_categories.json
      return JSON.stringify({});
    });
  });

  test('Test 1: Successful categorization with keyword matching', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: "codellama:7b", details: {} },
          { name: "mistral:latest", details: {} },
          { name: "special-code-model:v1", details: {} },
          { name: "phi3:mini", details: {} }
        ]
      }),
      text: async () => JSON.stringify({
        models: [
          { name: "codellama:7b", details: {} },
          { name: "mistral:latest", details: {} },
          { name: "special-code-model:v1", details: {} },
          { name: "phi3:mini", details: {} }
        ]
      })
    });

    // Specific mock for model_categories.json for this test
    fs.readFileSync.mockImplementation(filePath => {
      if (filePath === MODEL_CATEGORIES_PATH) {
        return JSON.stringify({
          categories: {
            coder: ["codellama", "code"],
            language: ["mistral", "phi"] // phi for phi3
          },
          default_category: "language"
        });
      }
      return JSON.stringify({});
    });

    const response = await request(app).get('/api/ollama-models/categorized');
    expect(response.statusCode).toBe(200);
    expect(response.body.coder).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "codellama:7b" }),
      expect.objectContaining({ name: "special-code-model:v1" })
    ]));
    expect(response.body.coder.length).toBe(2);
    expect(response.body.language).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "mistral:latest" }),
      expect.objectContaining({ name: "phi3:mini" })
    ]));
    expect(response.body.language.length).toBe(2);
  });

  test('Test 2: Models falling into default_category', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: "some-random-model:latest", details: {} },
          { name: "another-llm:7b", details: {} }
        ]
      }),
      text: async () => JSON.stringify({
         models: [
          { name: "some-random-model:latest", details: {} },
          { name: "another-llm:7b", details: {} }
        ]
      })
    });
     // model_categories.json mock from beforeEach is fine (coder, language, default: language)

    const response = await request(app).get('/api/ollama-models/categorized');
    expect(response.statusCode).toBe(200);
    expect(response.body.language).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "some-random-model:latest" }),
      expect.objectContaining({ name: "another-llm:7b" })
    ]));
    expect(response.body.language.length).toBe(2);
    expect(response.body.coder).toEqual([]);
  });

  test('Test 3: Models falling into uncategorized', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [{ name: "very-unique-model:1.0", details: {} }]
      }),
       text: async () => JSON.stringify({
        models: [{ name: "very-unique-model:1.0", details: {} }]
      })
    });

    // Mock model_categories.json without a default_category or non-matching categories
    fs.readFileSync.mockImplementation(filePath => {
      if (filePath === MODEL_CATEGORIES_PATH) {
        return JSON.stringify({
          categories: {
            coder: ["codellama"],
            specific: ["specific-keyword"]
          }
          // No default_category
        });
      }
      return JSON.stringify({});
    });

    const response = await request(app).get('/api/ollama-models/categorized');
    expect(response.statusCode).toBe(200);
    expect(response.body.uncategorized).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "very-unique-model:1.0" })
    ]));
    expect(response.body.uncategorized.length).toBe(1);
    expect(response.body.coder).toEqual([]);
    expect(response.body.specific).toEqual([]);
  });

  test('Test 4: Handling Ollama API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'Ollama service is down'
    });

    const response = await request(app).get('/api/ollama-models/categorized');
    expect(response.statusCode).toBe(500);
    expect(response.body.error).toBe('Failed to fetch models from Ollama API');
    expect(response.body.details).toContain('Ollama API request to /api/tags failed: 500 Server Error');
    expect(response.body.ollama_body).toBe('Ollama service is down');
  });

  test('Test 5: Handling empty model list from Ollama', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
      text: async () => JSON.stringify({ models: [] })
    });
    // Using default model_categories.json mock from beforeEach

    const response = await request(app).get('/api/ollama-models/categorized');
    expect(response.statusCode).toBe(200);
    expect(response.body.coder).toEqual([]);
    expect(response.body.language).toEqual([]);
    // Check for other categories defined in the default mock if any
    expect(Object.keys(response.body).sort()).toEqual(['coder', 'language'].sort()); // Ensure only these categories (empty) are present
  });
});
