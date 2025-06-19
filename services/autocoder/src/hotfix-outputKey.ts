import { initializeAgentExecutorWithOptions, BufferWindowMemory } from "langchain";

export async function createExecutor(tools, model) {
  const memory = new BufferWindowMemory({
    k: 8,
    memoryKey: "chat_history",
    outputKey: "output"
  });

  return initializeAgentExecutorWithOptions(tools, model, {
    agentType: "openai-functions",
    outputKey: "output",
    memory,
    returnIntermediateSteps: false
  });
}
