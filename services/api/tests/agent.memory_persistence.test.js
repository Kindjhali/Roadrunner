const request = require('supertest');
const { app, pendingToolConfirmations, initializeAgentExecutor } = require('../server'); // Import what's needed

// Mock initializeAgentExecutor to see if it's NOT called during confirmation
// This is a bit indirect. A more direct way would be to spy on it if it were, for example,
// part of an exported object that could be spied on.
// For now, the logic relies on the fact that if initializeAgentExecutor WAS called,
// it would likely overwrite the agentExecutor, and our mockActiveAgentExecutor.stream wouldn't be the one called.
// This test primarily ensures the flow *uses* the provided activeAgentExecutor.

describe('Agent Memory Persistence API', () => {
  beforeEach(() => {
    // Clear pendingToolConfirmations before each test
    for (const key in pendingToolConfirmations) {
      delete pendingToolConfirmations[key];
    }
    jest.clearAllMocks(); // Clear all mocks, including any on activeAgentExecutor if it were a global mock
  });

  it('should reuse activeAgentExecutor on tool confirmation and not re-initialize', async () => {
    const mockStreamMethod = jest.fn().mockImplementation(async function* () {
      yield { event: 'on_agent_action', data: { tool: 'final_tool', toolInput: {} } }; // Mock some stream events
      yield { event: 'on_tool_end', data: { tool: 'final_tool', output: 'Mocked tool output' } };
      yield { event: 'on_agent_finish', data: { output: "Mocked agent finish from activeAgentExecutor" } };
    });

    const mockActiveAgentExecutor = {
      stream: mockStreamMethod,
      agent: { constructor: { name: 'MockedAgent' } }, // For console logging in server.js
      memory: {
        chatHistory: {
          getMessages: jest.fn().mockResolvedValue([]),
          addMessages: jest.fn().mockResolvedValue(undefined), // Mock addMessages if called
          // Langchain memory might have other methods, mock them if errors indicate they are used.
        }
      }
    };

    const confirmationId = 'persist-test-123';
    const mockSendSseMessage = jest.fn();

    // Mock Express response object
    const mockExpressHttpRes = {
      write: jest.fn(),
      end: jest.fn(),
      writable: true,
      flushHeaders: jest.fn(),
      setHeader: jest.fn()
    };

    pendingToolConfirmations[confirmationId] = {
      activeAgentExecutor: mockActiveAgentExecutor,
      originalExpressHttpRes: mockExpressHttpRes,
      sendSseMessage: mockSendSseMessage,
      overallExecutionLog: ['Initial log'],
      originalTaskDescription: 'Test Task for persistence',
      toolName: 'example_tool',
      toolInput: JSON.stringify({ data: 'someinput' }), // Ensure toolInput is a string like it would be stored
      safetyMode: true,
      chatHistoryMessages: [{ type: 'human', content: 'Previous human message' }],
      originalAgentRunConfigurable: { /* initial config if any */ }
    };

    const response = await request(app)
      .post(`/api/confirm-action/${confirmationId}`)
      .send({ confirmed: true });

    // Check response from the API call itself
    expect(response.statusCode).toBe(200); // Or 202 if that's the expected response upon queuing/backgrounding

    // Check that the specific mock stream method of our activeAgentExecutor was called
    expect(mockActiveAgentExecutor.stream).toHaveBeenCalledTimes(1);

    // Check that the SSE message for approval was sent
    expect(mockSendSseMessage).toHaveBeenCalledWith('log_entry', { message: expect.stringContaining('User APPROVED action: example_tool') });

    // Check that the stream yielded the final message through SSE
    expect(mockSendSseMessage).toHaveBeenCalledWith('agent_event', { event_type: 'on_agent_finish', data: { output: "Mocked agent finish from activeAgentExecutor" }});

    // Check that the confirmation was removed
    expect(pendingToolConfirmations[confirmationId]).toBeUndefined();

    // Implicitly, initializeAgentExecutor should not have been called in a way that
    // would prevent mockActiveAgentExecutor.stream from being used.
    // If initializeAgentExecutor was a spyable mock, we'd assert: expect(spyOnInitialize).not.toHaveBeenCalled();
  });
});
