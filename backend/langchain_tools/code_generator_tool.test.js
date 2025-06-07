const { CodeGeneratorTool } = require('./code_generator_tool');
const codeGenerator = require('../codeGenerator');
const server = require('../server'); // To mock generateFromLocal
const { ConfirmationRequiredError } = require('./common');
const { v4: uuidv4 } = require('uuid');

jest.mock('../codeGenerator.js');
jest.mock('../server.js'); // Mock generateFromLocal
jest.mock('uuid', () => ({ v4: jest.fn() }));

describe('CodeGeneratorTool', () => {
  let tool;
  let mockRunManager;

  beforeEach(() => {
    jest.clearAllMocks();
    uuidv4.mockImplementation(() => 'test-codegen-uuid');
    tool = new CodeGeneratorTool();
    mockRunManager = {
      config: {
        safetyMode: false,
        isConfirmedActionForTool: {},
        originalExpressHttpRes: null,
        sendSseMessage: jest.fn(), // Mock SSE for tool's internal logging
        llm: { modelName: 'default-test-model' }, // Mock llm config if tool uses it
      }
    };
  });

  const validInput = {
    moduleName: 'TestModule',
    targetBaseDir: 'src/components',
    scaffolding: {
      directories: ['helpers'],
      files: [{ filePath: 'TestModule.vue', generationPrompt: 'Create a Vue component.' }]
    },
    specs: { componentSpec: { TestModule: { details: "some details" } } },
    modelPreference: 'ollama'
  };

  test('should call scaffoldDirectories and createFilesFromPlan for valid input', async () => {
    codeGenerator.scaffoldDirectories.mockResolvedValue(undefined);
    codeGenerator.createFilesFromPlan.mockResolvedValue(undefined);
    server.generateFromLocal.mockResolvedValue("Generated code here"); // Mock LLM response

    const inputJson = JSON.stringify(validInput);
    const result = await tool._call(inputJson, mockRunManager);

    expect(codeGenerator.scaffoldDirectories).toHaveBeenCalledWith(
      path.join(validInput.targetBaseDir, validInput.moduleName), // Use path.join for consistency
      validInput.scaffolding.directories,
      expect.any(Function) // mockSendSseMessage
    );
    expect(codeGenerator.createFilesFromPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleName: validInput.moduleName,
        targetBaseDir: validInput.targetBaseDir,
        files: validInput.scaffolding.files,
        specs: validInput.specs,
        modelPreference: validInput.modelPreference
      }),
      expect.any(Function), // llmGeneratorWrapper
      expect.any(Function), // mockSendSseMessage
      'coder_agent',
      true
    );
    expect(result).toMatch(/Code generation for module 'TestModule' completed/i);
  });

  test('should return error for invalid JSON input', async () => {
    const result = await tool._call("not json", mockRunManager);
    expect(result).toMatch(/Error: Invalid JSON string/i);
    expect(codeGenerator.scaffoldDirectories).not.toHaveBeenCalled();
    expect(codeGenerator.createFilesFromPlan).not.toHaveBeenCalled();
  });

  test('should return error for missing required fields in codeGenPlan', async () => {
    const invalidInput = { ...validInput, moduleName: undefined };
    const result = await tool._call(JSON.stringify(invalidInput), mockRunManager);
    expect(result).toMatch(/Error: Input JSON 'codeGenPlan' MUST include 'moduleName', 'targetBaseDir', 'scaffolding', and 'specs' keys./i);
  });

  test('should throw ConfirmationRequiredError in safetyMode if not confirmed', async () => {
    mockRunManager.config.safetyMode = true;
    const inputJson = JSON.stringify(validInput);

    await expect(tool._call(inputJson, mockRunManager)).rejects.toThrow(ConfirmationRequiredError);
    const error = await tool._call(inputJson, mockRunManager).catch(e => e);
    expect(error.data.toolName).toBe('code_generator');
    expect(error.data.confirmationId).toBe('test-codegen-uuid');
    expect(error.data.message).toMatch(/Proceed with code generation for module 'TestModule'/);
    expect(codeGenerator.scaffoldDirectories).not.toHaveBeenCalled();
    expect(codeGenerator.createFilesFromPlan).not.toHaveBeenCalled();
  });

  test('should NOT throw if safetyMode true but action IS confirmed', async () => {
    mockRunManager.config.safetyMode = true;
    const inputJson = JSON.stringify(validInput);
    mockRunManager.config.isConfirmedActionForTool = { [tool.name]: { [inputJson]: true } };

    codeGenerator.scaffoldDirectories.mockResolvedValue(undefined);
    codeGenerator.createFilesFromPlan.mockResolvedValue(undefined);
    server.generateFromLocal.mockResolvedValue("Generated code here");

    await tool._call(inputJson, mockRunManager);
    expect(codeGenerator.scaffoldDirectories).toHaveBeenCalled();
    expect(codeGenerator.createFilesFromPlan).toHaveBeenCalled();
  });

  test('llmGeneratorWrapper should call generateFromLocal with correct parameters', async () => {
    // This test is more involved as it tests an inner function of _call.
    // We need to ensure createFilesFromPlan is called and then inspect its llmGenerator argument.
    codeGenerator.createFilesFromPlan.mockImplementation(async (plan, llmGenerator) => {
      // Call the passed llmGenerator to test it
      await llmGenerator("test prompt", "test-model");
    });

    const inputJson = JSON.stringify(validInput);
    await tool._call(inputJson, mockRunManager);

    expect(server.generateFromLocal).toHaveBeenCalledWith(
      "test prompt",
      "test-model",
      null, // originalExpressHttpRes from runManager.config
      { agentType: 'coder_agent', llmProvider: validInput.modelPreference }
    );
  });
});

// Need to import path for the scaffoldDirectories call if it's used in the main module
const path = require('path');
