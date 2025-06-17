import { mount } from '@vue/test-utils/dist/vue-test-utils.cjs.js';
import RoadrunnerExecutor from './RoadrunnerExecutor.vue'; // Assuming spec file is in the same directory

// Mock global EventSource
const mockEventSourceInstance = {
  onopen: jest.fn(),
  onmessage: jest.fn(),
  onerror: jest.fn(),
  close: jest.fn(),
};
global.EventSource = jest.fn(() => mockEventSourceInstance);

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: 'ok' }), // For health check in mounted
    text: () => Promise.resolve(''), // For other potential fetch calls
  })
);

describe('RoadrunnerExecutor.vue', () => {
  let wrapper;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset EventSource instance mocks for each test if needed
    mockEventSourceInstance.onopen.mockClear();
    mockEventSourceInstance.onmessage.mockClear();
    mockEventSourceInstance.onerror.mockClear();
    mockEventSourceInstance.close.mockClear();

    wrapper = mount(RoadrunnerExecutor, {
      global: {
        stubs: {
          // Stub any child components if necessary, though for this test, not immediately obvious
        }
      }
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  test('clicking "Revert Last Commit" button calls triggerGitOperation and initiates EventSource with correct parameters', async () => {
    // Set safetyModeActive to true (default) explicitly for clarity in assertion
    await wrapper.setData({ safetyModeActive: true, backendHealthy: true });

    // Find the "Revert Last Commit" button
    // Looking at RoadrunnerExecutor.vue, the button has @click="triggerGitOperation('revert_last_commit')"
    // and text "Revert Last Commit". We can find it by text or a more specific selector if available.
    const revertButton = wrapper.findAll('button').find(b => b.text().includes('Revert Last Commit'));

    expect(revertButton).toBeDefined();
    if (!revertButton) {
        throw new Error("Revert Last Commit button not found"); // Fail fast if button isn't there
    }

    await revertButton.trigger('click');

    // Assert EventSource was called
    expect(global.EventSource).toHaveBeenCalledTimes(1);

    // Assert the URL passed to EventSource
    const eventSourceUrl = global.EventSource.mock.calls[0][0];
    expect(eventSourceUrl).toContain('http://127.0.0.1:3333/execute-autonomous-task');

    const params = new URLSearchParams(eventSourceUrl.split('?')[1]);
    expect(params.get('task_description')).toBe('Revert the last Git commit');

    const expectedSteps = [{ type: 'git_operation', details: { command: 'revert_last_commit' } }];
    expect(JSON.parse(params.get('steps'))).toEqual(expectedSteps);

    expect(params.get('safetyMode')).toBe('true'); // wrapper.vm.safetyModeActive is true
    expect(params.get('isAutonomousMode')).toBe('false');

    // Check that the log was updated (optional, but good for seeing UI feedback)
    expect(wrapper.vm.log).toContain('Triggering Git operation: revert_last_commit');
    expect(wrapper.vm.log).toContain('Connecting to backend for Git operation: revert_last_commit');
  });

  test('triggerGitOperation constructs correct EventSource URL when safetyMode is false', async () => {
    await wrapper.setData({ safetyModeActive: false, backendHealthy: true });

    // Directly call the method for this test variation
    await wrapper.vm.triggerGitOperation('revert_last_commit');

    expect(global.EventSource).toHaveBeenCalledTimes(1);
    const eventSourceUrl = global.EventSource.mock.calls[0][0];
    const params = new URLSearchParams(eventSourceUrl.split('?')[1]);

    expect(params.get('task_description')).toBe('Revert the last Git commit');
    const expectedSteps = [{ type: 'git_operation', details: { command: 'revert_last_commit' } }];
    expect(JSON.parse(params.get('steps'))).toEqual(expectedSteps);
    expect(params.get('safetyMode')).toBe('false'); // Key check for this test
    expect(params.get('isAutonomousMode')).toBe('false');
  });

  test('triggerGitOperation does not proceed if backend is not healthy', async () => {
    await wrapper.setData({ backendHealthy: false });
    await wrapper.vm.triggerGitOperation('revert_last_commit');

    expect(global.EventSource).not.toHaveBeenCalled();
    expect(wrapper.vm.log).toContain('Error: Backend is not healthy. Cannot perform Git operation.');
  });

  test('triggerGitOperation does not proceed if in autonomous mode', async () => {
    await wrapper.setData({ isAutonomousMode: true, backendHealthy: true });
    await wrapper.vm.triggerGitOperation('revert_last_commit');

    expect(global.EventSource).not.toHaveBeenCalled();
    expect(wrapper.vm.log).toContain('Git operations via direct buttons are not available in Autonomous Mode.');
  });

});
