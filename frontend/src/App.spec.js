import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

// Mock Electron IPC and other global properties if they cause issues during mounting
// For example, if window.electron.ipcRenderer is accessed on mount.
// This is a basic mock. More specific mocks might be needed if methods are called.
vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(() => vi.fn()), // Mock 'on' to return a cleanup function
    send: vi.fn(),
  }
}), { virtual: true });

global.window.electron = {
  ipcRenderer: {
    invoke: vi.fn(async (channel, ...args) => {
      if (channel === 'scan-for-roadmaps') {
        return { success: true, modules: [] }; // Default mock response
      }
      if (channel === 'read-roadmap-file') {
        return { success: true, content: '' }; // Default mock response
      }
      if (channel === 'send-brainstorming-chat') {
        return { success: true, response: 'Mocked chat response' };
      }
      return { success: true }; // Default for other invokes
    }),
    on: vi.fn(() => {
      return () => {}; // Return a cleanup function for listeners
    }),
    send: vi.fn(),
  }
};

describe('Roadrunner App.vue', () => {
  it('renders without errors', () => {
    const wrapper = mount(App);
    expect(wrapper.exists()).toBe(true);
  });

  it('renders the main application container', () => {
    const wrapper = mount(App);
    expect(wrapper.find('.furnariidae-inner-panel').exists()).toBe(true);
  });

  it('renders Coder tab button', () => {
    const wrapper = mount(App);
    const coderTabButton = wrapper.findAll('button').find(button => button.text() === 'Coder');
    expect(coderTabButton.exists()).toBe(true);
  });

  it('renders Brainstorming tab button', () => {
    const wrapper = mount(App);
    const brainstormingTabButton = wrapper.findAll('button').find(button => button.text() === 'Brainstorming');
    expect(brainstormingTabButton.exists()).toBe(true);
  });

  it('defaults to Coder tab being active', () => {
    const wrapper = mount(App);
    const coderTabButton = wrapper.findAll('button').find(button => button.text() === 'Coder');
    // Check if the activeTab data property is 'coder'
    // Or check if the button has the 'active' class
    expect(wrapper.vm.activeTab).toBe('coder');
    expect(coderTabButton.classes()).toContain('active');
  });

  // Add more tests as needed, for example, to check:
  // - if clicking tabs changes the active view
  // - if model selection dropdowns populate (might require more advanced mocking of fetch or IPC)
});
