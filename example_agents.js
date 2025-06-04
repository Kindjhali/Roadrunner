// example_agents.js
const roadrunner = require('./roadrunner');

const inputID1 = "meeting_summary_123";
roadrunner.registerAgentResponse(inputID1, "AgentAlpha", "Summarize key points", 0.9, ["priority"]);
roadrunner.registerAgentResponse(inputID1, "AgentBeta", "Extract action items", 0.85);

// Process inputID1 after a short delay for AgentGamma to respond,
// then processInputAndLog will itself wait for its internal timeout.
setTimeout(() => {
  roadrunner.registerAgentResponse(inputID1, "AgentGamma", "Identify sentiment", 0.7, ["experimental"]);
  console.log("AgentGamma responded for inputID1");
}, 500); // AgentGamma responds after 500ms

roadrunner.processInputAndLog(inputID1, 2000) // Roadrunner waits 2s for inputID1
  .then(decisionData => { // decisionData contains evaluationResult and allResponsesForInput
    console.log(`\nDecision for ${inputID1} (after timeout):`);
    if (decisionData === null) {
      // This case is handled by the "already pending" log in roadrunner.js itself
      // but good to check if processInputAndLog explicitly returns null for it.
      console.log("  Evaluation was already pending or explicitly returned null by processInputAndLog.");
    } else if (decisionData && decisionData.evaluationResult) {
      const { selected, agent, confidence, justification } = decisionData.evaluationResult;
      if (selected) {
        console.log(`  Selected Proposal: ${selected}`);
        console.log(`  Agent: ${agent}`);
        console.log(`  Confidence: ${confidence}`);
        console.log(`  Justification: ${justification}`);
        // console.log(`  All responses considered:`, decisionData.allResponsesForInput); // Optional: log all responses
      } else {
        console.log(`  ${justification}`);
      }
    } else {
      console.log("  No decision could be made or error in processing for inputID1.");
    }
  }).catch(error => {
    console.error(`Error processing ${inputID1}:`, error);
  });

// Example for a second input, processed concurrently
const inputID2 = "image_classification_456";
roadrunner.registerAgentResponse(inputID2, "AgentDelta", "Classify as 'cat'", 0.98);

roadrunner.processInputAndLog(inputID2, 1000) // Roadrunner waits 1s for inputID2
  .then(decisionData2 => {
    console.log(`\nDecision for ${inputID2} (after timeout):`);
    if (decisionData2 && decisionData2.evaluationResult) {
      const { selected, agent, confidence, justification } = decisionData2.evaluationResult;
      if (selected) {
        console.log(`  Selected Proposal: ${selected}`);
        console.log(`  Agent: ${agent}`);
        console.log(`  Confidence: ${confidence}`);
        console.log(`  Justification: ${justification}`);
      } else {
        console.log(`  ${justification}`);
      }
    } else {
      console.log("  No decision could be made for inputID2.");
    }
  });

// Call processInputAndLog again for inputID1 to see the "already pending" message
setTimeout(() => {
    console.log("\nAttempting to process inputID1 again while pending...");
    roadrunner.processInputAndLog(inputID1, 1000); // This should trigger the "already pending" message
}, 100); // Try well before the first call's timeout of 2000ms for inputID1

// Example for an input that will have no responses
const inputID3 = "empty_input_789";
roadrunner.processInputAndLog(inputID3, 500) // Roadrunner waits 0.5s
  .then(decisionData3 => {
    console.log(`\nDecision for ${inputID3} (after timeout):`);
    if (decisionData3 && decisionData3.evaluationResult) {
      const { selected, justification } = decisionData3.evaluationResult;
      if (selected) {
        console.log(`  Selected Proposal: ${selected}`);
      } else {
        console.log(`  ${justification}`);
      }
    } else {
        console.log("  No decision was made for inputID3.");
    }
  });

// Keep node running for a bit to see all timeouts and logs
setTimeout(() => {
    console.log("\nExample script finished. Check logs.");
}, 3000); // Should be longer than the longest processInputAndLog timeout
