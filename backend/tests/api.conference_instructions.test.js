// backend/tests/api.conference_instructions.test.js
const request = require('supertest');
const { app } = require('../server'); // Assuming server.js exports app
const fs = require('fs');
const path = require('path');

const TEST_INSTRUCTIONS_DIR = path.join(__dirname, 'test_config_files');
const TEST_INSTRUCTIONS_FILE_PATH = path.join(TEST_INSTRUCTIONS_DIR, 'conference_agent_instructions.test.json');

// This line is crucial: it sets the environment variable *before* server.js is loaded by require('../server')
// when Jest runs this test file.
process.env.TEST_CONFERENCE_INSTRUCTIONS_PATH = TEST_INSTRUCTIONS_FILE_PATH;


// Helper to directly manipulate the test instructions file
const writeTestInstructions = (data) => {
  if (!fs.existsSync(TEST_INSTRUCTIONS_DIR)) {
    fs.mkdirSync(TEST_INSTRUCTIONS_DIR, { recursive: true });
  }
  fs.writeFileSync(TEST_INSTRUCTIONS_FILE_PATH, JSON.stringify(data, null, 2));
};
const readTestInstructions = () => {
  if (!fs.existsSync(TEST_INSTRUCTIONS_FILE_PATH)) return null;
  return JSON.parse(fs.readFileSync(TEST_INSTRUCTIONS_FILE_PATH));
};
const deleteTestInstructionsFile = () => {
  if (fs.existsSync(TEST_INSTRUCTIONS_FILE_PATH)) {
    fs.unlinkSync(TEST_INSTRUCTIONS_FILE_PATH);
  }
  // Remove dir if empty, for cleanup
  // if (fs.existsSync(TEST_INSTRUCTIONS_DIR) && fs.readdirSync(TEST_INSTRUCTIONS_DIR).length === 0) {
  //   fs.rmdirSync(TEST_INSTRUCTIONS_DIR);
  // }
};

describe('Conference Agent Instructions API', () => {
  beforeEach(() => {
    // The environment variable is set above, so server.js will use the test path.
    // initializeConferenceInstructionsFile() in server.js will be called when server.js is imported,
    // and it will use the TEST_INSTRUCTIONS_FILE_PATH due to the env var.
    // We ensure a clean state for each test by deleting and writing an empty object.
    deleteTestInstructionsFile();
    writeTestInstructions({}); // Start with an empty instructions object. server.js initialize will also try to create it if missing.
  });

  afterAll(() => {
    deleteTestInstructionsFile(); // Clean up after all tests
    // Optional: remove the test directory if it's empty and was created by tests
    if (fs.existsSync(TEST_INSTRUCTIONS_DIR) && fs.readdirSync(TEST_INSTRUCTIONS_DIR).length === 0) {
        fs.rmdirSync(TEST_INSTRUCTIONS_DIR);
    }
  });

  it('should allow POSTing new instructions for a role and then GETting them', async () => {
    const plannerInstructions = 'You are a planner. Your goal is to create a plan.';
    const resPost = await request(app)
      .post('/api/instructions/conference_agent/Planner')
      .send({ instructions: plannerInstructions });
    expect(resPost.statusCode).toEqual(200);
    expect(resPost.body.message).toContain('updated successfully');
    expect(resPost.body.instructions).toEqual(plannerInstructions);

    const fileData = readTestInstructions();
    expect(fileData.Planner).toEqual(plannerInstructions);

    const resGet = await request(app).get('/api/instructions/conference_agent/Planner');
    expect(resGet.statusCode).toEqual(200);
    expect(resGet.body.instructions).toEqual(plannerInstructions);
  });

  it('should allow updating existing instructions for a role', async () => {
    writeTestInstructions({ Planner: 'Old instructions' });
    const updatedInstructions = 'New planner instructions.';
    const resPost = await request(app)
      .post('/api/instructions/conference_agent/Planner')
      .send({ instructions: updatedInstructions });
    expect(resPost.statusCode).toEqual(200);
    expect(resPost.body.instructions).toEqual(updatedInstructions);

    const fileData = readTestInstructions();
    expect(fileData.Planner).toEqual(updatedInstructions);
  });

  it('should return 404 when GETting instructions for a non-existent role', async () => {
    const resGet = await request(app).get('/api/instructions/conference_agent/NonExistentRole');
    expect(resGet.statusCode).toEqual(404);
  });

  it('should return 400 on POST if instructions are missing in the body', async () => {
    const resPost = await request(app)
      .post('/api/instructions/conference_agent/Critic')
      .send({});
    expect(resPost.statusCode).toEqual(400);
    expect(resPost.body.message).toContain('Invalid or missing instructions');
  });

  it('should return 400 on POST if instructions field is not a string', async () => {
    const resPost = await request(app)
      .post('/api/instructions/conference_agent/Critic')
      .send({ instructions: { text: 'this is an object' } });
    expect(resPost.statusCode).toEqual(400);
    expect(resPost.body.message).toContain('Invalid or missing instructions');
  });
});
