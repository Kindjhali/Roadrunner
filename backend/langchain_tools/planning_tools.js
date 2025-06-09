const { Tool } = require("@langchain/core/tools");
const { requestPlanApproval, requestUserActionOnStepFailure } = require("../server.js"); // Adjust path as necessary

class ProposePlanTool extends Tool {
  static lc_name() {
    return "ProposePlanTool";
  }

  constructor() {
    super();
    this.name = "propose_plan_and_await_approval";
    this.description =
      "Proposes a plan (e.g., a sequence of steps or actions) to the user and waits for their approval before proceeding. Input MUST be a JSON string with a 'planContent' key, where 'planContent' is the detailed plan (can be a string or a JSON object/array representing the plan). Example: {\"planContent\": [\"Step 1: Do X\", \"Step 2: Do Y\"]}";
  }

  /** @param {string} inputJsonString */
  async _call(inputJsonString, runManager) {
    let planContent;
    try {
      const parsedInput = JSON.parse(inputJsonString);
      if (!parsedInput.planContent) {
        return "Error: Missing 'planContent' in JSON input. The input MUST be a JSON string with a 'planContent' key.";
      }
      planContent = parsedInput.planContent;
    } catch (e) {
      return `Error: Invalid JSON input: ${e.message}. The input MUST be a JSON string with a 'planContent' key. Example: {"planContent": ["Step 1: Do X", "Step 2: Do Y"]}`;
    }

    const {
      originalExpressHttpRes, // Note: In AgentExecutor's config, expressHttpRes is often passed as originalExpressHttpRes
      sendSseMessage,
      overallExecutionLog,
      originalTaskDescription,
      agentExecutor, // The agentExecutor instance itself
    } = runManager?.config || {};

    if (!originalExpressHttpRes || !sendSseMessage || !overallExecutionLog || !originalTaskDescription || !agentExecutor) {
      let missing = [];
      if (!originalExpressHttpRes) missing.push("Express HTTP Response (originalExpressHttpRes)");
      if (!sendSseMessage) missing.push("sendSseMessage function");
      if (!overallExecutionLog) missing.push("overallExecutionLog array");
      if (!originalTaskDescription) missing.push("originalTaskDescription string");
      if (!agentExecutor) missing.push("agentExecutor instance");
      return `Error: Tool execution context is missing required components from runManager.config: ${missing.join(', ')}. These must be configured in the AgentExecutor.`;
    }

    try {
      // The requestPlanApproval function expects 'expressHttpRes' not 'originalExpressHttpRes'
      const approvalResult = await requestPlanApproval({
        planContent,
        expressHttpRes: originalExpressHttpRes, // Map it here
        sendSseMessage,
        overallExecutionLog,
        originalTaskDescription,
        agentExecutor,
      });

      // approvalResult should be { status: 'approved', planId }
      if (approvalResult && approvalResult.status === 'approved') {
        return `User approved the plan (ID: ${approvalResult.planId}). You can now proceed with executing this plan.`;
      } else {
        // This case should ideally not be reached if requestPlanApproval's promise behaves as expected (rejects on non-approval)
        return "Plan approval status unknown or not explicitly approved. Do not proceed with the plan.";
      }
    } catch (error) {
      // This catch block handles rejection from the requestPlanApproval promise
      // (e.g., user declined, or an error within requestPlanApproval itself before user action)
      if (error.message && error.message.includes("declined by user")) {
        return `Plan declined by user: ${error.message}. You must not proceed with this plan. Re-evaluate or inform the user.`;
      } else if (error.message && error.message.includes("SSE mechanism unavailable")) {
        return `An internal error occurred during plan approval: ${error.message}. The user could not be prompted. Do not proceed.`;
      } else if (error.message && error.message.includes("Failed to send plan approval request")) {
        return `An internal error occurred during plan approval: ${error.message}. The user could not be prompted. Do not proceed.`;
      }
      // Generic error from the approval process
      return `An internal error occurred during plan approval: ${error.message}. Do not proceed with the plan.`;
    }
  }
}

class RequestUserActionOnFailureTool extends Tool {
  static lc_name() {
    return "RequestUserActionOnFailureTool";
  }

  constructor() {
    super();
    this.name = "request_user_action_on_step_failure";
    this.description =
      "Reports a failure encountered during step execution and asks the user to choose a recovery action (retry, skip, or convert to manual). Input MUST be a JSON string with a 'failureDetails' key, where 'failureDetails' is an object providing context about the failure (e.g., {\"stepName\": \"Run tests\", \"errorMessage\": \"NullPointerException\", \"context\": \"...\"}). Example: {\"failureDetails\": {\"step\": \"Install dependencies\", \"error\": \"npm install failed with exit code 1\"}}. The tool will return a string indicating the user's chosen action.";
  }

  /** @param {string} inputJsonString */
  async _call(inputJsonString, runManager) {
    let failureDetails;
    try {
      const parsedInput = JSON.parse(inputJsonString);
      if (!parsedInput.failureDetails || typeof parsedInput.failureDetails !== 'object') {
        return "Invalid input: 'failureDetails' object is required in the JSON input.";
      }
      failureDetails = parsedInput.failureDetails;
    } catch (e) {
      return `Error: Invalid JSON input: ${e.message}. The input MUST be a JSON string with a 'failureDetails' object. Example: {"failureDetails": {"step": "Install deps", "error": "npm failed"}}`;
    }

    const {
      originalExpressHttpRes,
      sendSseMessage,
      overallExecutionLog,
      originalTaskDescription,
      agentExecutor,
    } = runManager?.config || {};

    if (!originalExpressHttpRes || !sendSseMessage || !overallExecutionLog || !originalTaskDescription || !agentExecutor) {
      let missing = [];
      if (!originalExpressHttpRes) missing.push("Express HTTP Response (originalExpressHttpRes)");
      if (!sendSseMessage) missing.push("sendSseMessage function");
      if (!overallExecutionLog) missing.push("overallExecutionLog array");
      if (!originalTaskDescription) missing.push("originalTaskDescription string");
      if (!agentExecutor) missing.push("agentExecutor instance");
      return `Error: Tool execution context is missing required components from runManager.config: ${missing.join(', ')}. These must be configured in the AgentExecutor.`;
    }

    try {
      const userChoice = await requestUserActionOnStepFailure({
        failureDetails,
        expressHttpRes: originalExpressHttpRes, // Map from config name
        sendSseMessage,
        overallExecutionLog,
        originalTaskDescription,
        agentExecutor,
      });

      // userChoice should be { action: 'retry'/'skip'/'manual', failureId }
      if (userChoice && userChoice.action) {
        return `User action received: '${userChoice.action}' for failure ID ${userChoice.failureId}. Agent should proceed accordingly (e.g., retry the step, skip it, or switch to manual mode).`;
      } else {
        // Should not happen if requestUserActionOnStepFailure resolves correctly
        return "Error: User action was not clearly determined by the recovery process.";
      }
    } catch (error) {
      // This catch block handles rejection from the requestUserActionOnStepFailure promise
      // (e.g., an error within the function itself, like SSE failure)
      return `Error during the failure recovery process: ${error.message}.`;
    }
  }
}

module.exports = { ProposePlanTool, RequestUserActionOnFailureTool };
