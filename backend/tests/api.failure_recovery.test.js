const request = require('supertest');
const { app, pendingFailures } = require('../server'); // Import pendingFailures

describe('Step Failure Recovery API', () => {
  beforeEach(() => {
    // Clear pendingFailures before each test
    for (const key in pendingFailures) {
      delete pendingFailures[key];
    }
    jest.clearAllMocks(); // Clear all mocks
  });

  describe('/api/retry-step/:failureId', () => {
    it('should process retry for a pending failure and return 200', async () => {
      const failureId = 'test-retry-failure';
      const mockResolve = jest.fn();
      const mockSse = jest.fn();
      pendingFailures[failureId] = {
        resolve: mockResolve,
        reject: jest.fn(),
        sendSseMessage: mockSse,
        overallExecutionLog: [],
        originalTaskDescription: 'Test Task Retry',
        details: { step: 'failed step', error: 'test error' }
      };

      const res = await request(app).post(`/api/retry-step/${failureId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('Retry action acknowledged. Agent notified.');
      expect(mockResolve).toHaveBeenCalledWith({ action: 'retry', failureId });
      expect(mockSse).toHaveBeenCalledWith('user_chose_retry', { failureId });
      expect(pendingFailures[failureId]).toBeUndefined();
    });

    it('should return 404 if failureId does not exist for retry', async () => {
      const res = await request(app).post('/api/retry-step/nonexistent-retry-id');
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('/api/skip-step/:failureId', () => {
    it('should process skip for a pending failure and return 200', async () => {
      const failureId = 'test-skip-failure';
      const mockResolve = jest.fn();
      const mockSse = jest.fn();
      pendingFailures[failureId] = {
        resolve: mockResolve,
        reject: jest.fn(),
        sendSseMessage: mockSse,
        overallExecutionLog: [],
        originalTaskDescription: 'Test Task Skip',
        details: { step: 'another failed step', error: 'another test error' }
      };

      const res = await request(app).post(`/api/skip-step/${failureId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('Skip action acknowledged. Agent notified.');
      expect(mockResolve).toHaveBeenCalledWith({ action: 'skip', failureId });
      expect(mockSse).toHaveBeenCalledWith('user_chose_skip', { failureId });
      expect(pendingFailures[failureId]).toBeUndefined();
    });

    it('should return 404 if failureId does not exist for skip', async () => {
      const res = await request(app).post('/api/skip-step/nonexistent-skip-id');
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('/api/convert-to-manual/:failureId', () => {
    it('should process manual conversion for a pending failure and return 200', async () => {
      const failureId = 'test-manual-failure';
      const mockResolve = jest.fn();
      const mockSse = jest.fn();
      pendingFailures[failureId] = {
        resolve: mockResolve,
        reject: jest.fn(),
        sendSseMessage: mockSse,
        overallExecutionLog: [],
        originalTaskDescription: 'Test Task Manual',
        details: { step: 'yet another failed step', error: 'yet another test error' }
      };

      const res = await request(app).post(`/api/convert-to-manual/${failureId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('Manual conversion acknowledged. Agent notified.');
      expect(mockResolve).toHaveBeenCalledWith({ action: 'manual', failureId });
      expect(mockSse).toHaveBeenCalledWith('user_chose_manual', { failureId });
      expect(pendingFailures[failureId]).toBeUndefined();
    });

    it('should return 404 if failureId does not exist for manual conversion', async () => {
      const res = await request(app).post('/api/convert-to-manual/nonexistent-manual-id');
      expect(res.statusCode).toEqual(404);
    });
  });
});
