const request = require('supertest');
const { app, pendingPlans } = require('../server'); // Import pendingPlans

describe('Plan Approval API', () => {
  beforeEach(() => {
    // Clear pendingPlans before each test
    for (const key in pendingPlans) {
      delete pendingPlans[key];
    }
    jest.clearAllMocks(); // Clear all mocks
  });

  describe('/api/approve-plan/:planId', () => {
    it('should approve a pending plan and return 200', async () => {
      const planId = 'test-approve-plan';
      const mockResolve = jest.fn();
      const mockSse = jest.fn();
      pendingPlans[planId] = {
        resolve: mockResolve,
        reject: jest.fn(),
        sendSseMessage: mockSse,
        overallExecutionLog: [],
        originalTaskDescription: 'Test Task'
      };

      const res = await request(app).post(`/api/approve-plan/${planId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('Plan approved and agent notified.');
      expect(mockResolve).toHaveBeenCalledWith({ status: 'approved', planId });
      expect(mockSse).toHaveBeenCalledWith('plan_approved', { planId });
      expect(pendingPlans[planId]).toBeUndefined();
    });

    it('should return 404 if planId does not exist for approval', async () => {
      const res = await request(app).post('/api/approve-plan/nonexistent-approve-id');
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('/api/decline-plan/:planId', () => {
    it('should decline a pending plan and return 200', async () => {
      const planId = 'test-decline-plan';
      const mockReject = jest.fn();
      const mockSse = jest.fn();
      pendingPlans[planId] = {
        resolve: jest.fn(),
        reject: mockReject,
        sendSseMessage: mockSse,
        overallExecutionLog: [],
        originalTaskDescription: 'Test Task Decline'
      };

      const res = await request(app).post(`/api/decline-plan/${planId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('Plan declined and agent notified.');
      expect(mockReject).toHaveBeenCalledWith(expect.any(Error)); // Check if called with an Error object
      expect(mockReject.mock.calls[0][0].message).toBe(`Plan ${planId} declined by user.`); // Check error message
      expect(mockSse).toHaveBeenCalledWith('plan_declined', { planId });
      expect(pendingPlans[planId]).toBeUndefined();
    });

    it('should return 404 if planId does not exist for declination', async () => {
      const res = await request(app).post('/api/decline-plan/nonexistent-decline-id');
      expect(res.statusCode).toEqual(404);
    });
  });
});
