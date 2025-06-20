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

// --- Execution API ---------------------------------------------------------
// Basic ReACT prompt parser shared with frontend implementation
function parseReactPrompt(text) {
  const sections = { thought: '', action: '', actionInput: '', observation: '' };
  if (!text) return sections;
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^Thought:/i.test(trimmed)) {
      current = 'thought';
      sections.thought += trimmed.replace(/^Thought:\s*/i, '') + '\n';
    } else if (/^Action:/i.test(trimmed)) {
      current = 'action';
      sections.action += trimmed.replace(/^Action:\s*/i, '') + '\n';
    } else if (/^Action Input:/i.test(trimmed)) {
      current = 'actionInput';
      sections.actionInput += trimmed.replace(/^Action Input:\s*/i, '') + '\n';
    } else if (/^Observation:/i.test(trimmed)) {
      current = 'observation';
      sections.observation += trimmed.replace(/^Observation:\s*/i, '') + '\n';
    } else if (current) {
      sections[current] += line + '\n';
    }
  }
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].trim();
  }
  return sections;
}

// Example tool implementations used for simple routing
const tools = {
  echo: (input) => `Echo: ${input}`,
  reverse: (input) => input.split('').reverse().join('')
};

// POST /api/execute - run a tool based on prompt or explicit toolId
app.post('/api/execute', (req, res) => {
  try {
    const { prompt, toolId } = req.body || {};
    if (!prompt && !toolId) {
      return res.status(400).json({ success: false, message: 'Missing prompt or toolId' });
    }

    const parsed = parseReactPrompt(prompt || '');
    const selectedTool = toolId || parsed.action;
    const input = parsed.actionInput || '';

    if (!selectedTool || !tools[selectedTool]) {
      return res.status(400).json({ success: false, message: `Unknown tool ${selectedTool}` });
    }

    const output = tools[selectedTool](input);
    res.json({ success: true, output });
  } catch (err) {
    console.error('Error in /api/execute:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/models - return available tool metadata
app.get('/api/models', (_req, res) => {
  res.json([
    { id: 'echo', label: 'Echo Tool' },
    { id: 'reverse', label: 'Reverse Tool' }
  ]);
});

// GET /api/logs/:name - serve stored log files from ./logs
const fs = require('fs');
const path = require('path');
app.get('/api/logs/:name', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'logs', req.params.name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    res.type('text/plain').send(data);
  } catch (err) {
    console.error('Error in /api/logs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Roadrunner server listening on port ${PORT}`);
});
