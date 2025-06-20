const express = require('express');
const { registerAgentResponse, evaluateResponses, initiateInput } = require('./roadrunner');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Endpoint to initiate an input and schedule evaluation
app.post('/input', (req, res) => {
  try {
    const { inputID, actualInputText } = req.body;

    if (!inputID || !actualInputText) {
      return res.status(400).json({ error: 'inputID and actualInputText are required.' });
    }

    // Ensure initiateInput is wrapped in try-catch in case it could throw
    try {
      initiateInput(inputID, actualInputText);
    } catch (e) {
      console.error(`Error during input initiation for inputID: ${inputID}`, e);
      return res.status(500).json({ message: 'Failed to initiate input.', error: e.message });
    }

    const effectiveTimeout = Number(req.body.timeout) || DEFAULT_TIMEOUT;

    setTimeout(() => {
      console.log(`Timeout reached for inputID: ${inputID}. Evaluating responses automatically.`);
      try {
        // evaluateResponses itself handles logging of its results and finding no responses
        const evaluationResult = evaluateResponses(inputID);
        // If we wanted to do something with the result here (e.g., send it somewhere), we could.
        // For now, evaluateResponses handles its own logging.
        if (evaluationResult.error) {
          console.log(`Scheduled evaluation for ${inputID} completed with message: ${evaluationResult.error}`);
        } else {
          console.log(`Scheduled evaluation for ${inputID} completed successfully. Selected: ${evaluationResult.selectedProposal?.proposal}`);
        }
      } catch (e) {
        // This catch is for unexpected errors within evaluateResponses or the timeout callback itself
        console.error(`Error during scheduled evaluation for inputID: ${inputID}`, e);
      }
    }, effectiveTimeout);

    res.status(200).json({
      message: 'Input initiated. Evaluation scheduled.',
      inputID,
      timeout: effectiveTimeout
    });

  } catch (error) {
    // Catch-all for any unexpected errors in the endpoint logic itself
    console.error('Error in /input endpoint:', error);
    res.status(500).json({ message: 'Failed to process input request.', error: error.message });
  }
});

// Endpoint to register an agent's response
app.post('/agentresponse', (req, res) => {
  try {
    const { inputID, agentID, proposal, confidence, flags } = req.body;
    if (!inputID || !agentID || !proposal || confidence === undefined) {
      return res.status(400).json({ message: 'Missing required fields: inputID, agentID, proposal, confidence.' });
    }
    registerAgentResponse(inputID, agentID, proposal, confidence, flags);
    res.status(200).json({ message: 'Response registered successfully.' });
  } catch (error) {
    console.error('Error in /agentresponse:', error);
    res.status(500).json({ message: 'Failed to register response.', error: error.message });
  }
});

// Endpoint to evaluate responses for a given inputID
app.get('/evaluate/:inputID', (req, res) => {
  try {
    const { inputID } = req.params;
    if (!inputID) {
      return res.status(400).json({ message: 'Missing inputID parameter.' });
    }
    const result = evaluateResponses(inputID);
    // evaluateResponses returns an object that might contain an error field for "no responses"
    // This is a valid outcome, not necessarily a server error.
    res.status(200).json(result);
  } catch (error) {
    // This catch is for unexpected errors within evaluateResponses or endpoint logic
    console.error(`Error in /evaluate/${req.params.inputID}:`, error);
    res.status(500).json({ message: 'Failed to evaluate responses.', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Roadrunner server listening on port ${PORT}`);
});
