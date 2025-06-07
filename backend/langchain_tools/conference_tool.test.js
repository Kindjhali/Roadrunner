const { ConferenceTool } = require('./conference_tool');
const server = require('../server'); // To mock generateFromLocal
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

jest.mock('../server.js'); // Mocks generateFromLocal
jest.mock('fs');
jest.mock('uuid', () => ({ v4: jest.fn() }));

// Define a mock for path.join to handle it consistently in tests if used by the tool
// const actualPath = jest.requireActual('path');
// jest.mock('path', () => ({
//   ...actualPath,
//   join: (...args) => args.join('/'), // Simple mock for path.join
//   resolve: (...args) => args.join('/'), // Simple mock for path.resolve
// }));


describe('ConferenceTool', () => {
  let tool;
  let mockRunManager;
  let mockConferenceLogFile;

  beforeEach(() => {
    jest.clearAllMocks();
    uuidv4.mockImplementation(() => 'test-conference-uuid');

    // Mock path resolution for CONFERENCES_LOG_FILE if it's complex in the tool
    // For this test, we'll assume a simple path or mock it if complex logic is in tool
    // conference_tool.js uses path.resolve and path.join, could mock them if they cause issues
    // For now, let's assume fs.existsSync and fs.mkdirSync are enough to control behavior for logging path.

    fs.existsSync.mockImplementation((p) => {
      // Let's assume the log directory needs to be created for some tests
      if (p.includes('roadrunner_workspace')) return false;
      return true; // Assume other paths (like the file itself initially) don't exist
    });
    fs.mkdirSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue("[]"); // Default to empty JSON array for existing log file
    fs.writeFileSync.mockReturnValue(undefined);


    tool = new ConferenceTool();
    mockRunManager = {
      config: {
        safetyMode: false, // Not directly used by ConferenceTool for ConfirmationRequiredError
        isConfirmedActionForTool: {},
        originalExpressHttpRes: null, // Mock SSE utilities
        sendSseMessage: jest.fn(),
        llm: { modelName: 'default-test-model', provider: 'ollama' }, // Mock LLM config
      }
    };
  });

  const validDebateInput = {
    prompt: "Discuss AI ethics.",
    model_a_role: "Philosopher",
    model_b_role: "Engineer",
    arbiter_model_role: "Judge",
    num_rounds: 1,
    model_name: "test-debate-model"
  };

  test('should successfully run a 1-round debate and log it', async () => {
    server.generateFromLocal
      .mockResolvedValueOnce("Philosopher's argument about AI ethics.") // Model A
      .mockResolvedValueOnce("Engineer's counter-argument on AI ethics.") // Model B
      .mockResolvedValueOnce("Judge's summary of the AI ethics debate."); // Arbiter

    const inputJson = JSON.stringify(validDebateInput);
    const result = await tool._call(inputJson, mockRunManager);

    expect(server.generateFromLocal).toHaveBeenCalledTimes(3);
    expect(server.generateFromLocal).toHaveBeenNthCalledWith(1,
      expect.stringContaining("You are Philosopher. The discussion topic is: \"Discuss AI ethics.\""),
      "test-debate-model",
      null,
      expect.objectContaining({ agentType: 'conference_agent', agentRole: 'Philosopher', speakerContext: 'Philosopher', llmProvider: 'ollama'})
    );
    // Add more specific checks for other generateFromLocal calls if needed

    expect(fs.writeFileSync).toHaveBeenCalled();
    const logData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    const lastEntry = logData[logData.length-1];
    expect(lastEntry.conference_id).toBe('test-conference-uuid');
    expect(lastEntry.user_prompt).toBe("Discuss AI ethics.");
    expect(lastEntry.arbiter_response).toBe("Judge's summary of the AI ethics debate.");

    expect(result).toContain("Debate completed. Arbiter's final synthesized response: Judge's summary of the AI ethics debate.");
    expect(mockRunManager.config.sendSseMessage).toHaveBeenCalledWith('log_entry', expect.objectContaining({ message: expect.stringContaining("Debate finished successfully.") }));
  });

  test('should use default roles and rounds if not provided', async () => {
    server.generateFromLocal.mockResolvedValue("Some LLM response");
    const simpleInput = { prompt: "Minimal debate" };
    const inputJson = JSON.stringify(simpleInput);
    await tool._call(inputJson, mockRunManager);

    expect(server.generateFromLocal).toHaveBeenCalledWith(
      expect.stringContaining("You are Proponent."), // Default role
      "default-test-model", // Default model from runManager config
      null,
      expect.objectContaining({ agentRole: 'Proponent' })
    );
     // Check if num_rounds was 1 (default) by checking calls for Model A, B, Arbiter (3 calls total)
    expect(server.generateFromLocal).toHaveBeenCalledTimes(3);
  });

  test('should handle LLM errors gracefully during debate', async () => {
    server.generateFromLocal
      .mockResolvedValueOnce("Philosopher's valid argument.")
      .mockResolvedValueOnce("// LLM_ERROR: Model B failed unexpectedly. //") // Model B fails
      .mockResolvedValueOnce("Arbiter's summary attempt."); // Arbiter might still run or not depending on error handling

    const inputJson = JSON.stringify(validDebateInput);
    const result = await tool._call(inputJson, mockRunManager);

    expect(result).toMatch(/Error during multi_model_debate: Model B \(Engineer\) failed: \/\/ LLM_ERROR: Model B failed unexpectedly. \/\//i);
    expect(mockRunManager.config.sendSseMessage).toHaveBeenCalledWith('log_entry', expect.objectContaining({ message: expect.stringContaining("Error during debate:") }));
  });

  test('should return error for invalid JSON input', async () => {
    const result = await tool._call("not proper json", mockRunManager);
    expect(result).toMatch(/Error parsing input: Unexpected token/i);
  });

  test('should return error if prompt is missing', async () => {
    const input = JSON.stringify({ model_a_role: "A" });
    const result = await tool._call(input, mockRunManager);
    expect(result).toMatch(/Error parsing input: Input JSON MUST include a 'prompt' key./i);
  });

  test('should handle multiple rounds correctly', async () => {
    server.generateFromLocal.mockResolvedValue("Iterative response"); // Generic response for all calls
    const multiRoundInput = { ...validDebateInput, num_rounds: 2 };
    const inputJson = JSON.stringify(multiRoundInput);
    await tool._call(inputJson, mockRunManager);

    // Model A (R1), Model B (R1)
    // Model A (R2), Model B (R2)
    // Arbiter (1)
    expect(server.generateFromLocal).toHaveBeenCalledTimes(2 * 2 + 1);
    // Check a prompt from round 2 to see if previous response is included
    expect(server.generateFromLocal).toHaveBeenCalledWith(
        expect.stringContaining("Your opponent (Engineer) previously said: \"Iterative response\""), // Model A, Round 2
        "test-debate-model",
        null,
        expect.objectContaining({agentRole: "Philosopher"})
    );
    expect(server.generateFromLocal).toHaveBeenCalledWith(
        expect.stringContaining("Your opponent (Philosopher) just said: \"Iterative response\""), // Model B, Round 2
        "test-debate-model",
        null,
        expect.objectContaining({agentRole: "Engineer"})
    );
  });

});
