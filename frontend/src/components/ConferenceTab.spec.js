// frontend/src/components/ConferenceTab.spec.js
import { shallowMount } from '@vue/test-utils';
import ConferenceTab from './ConferenceTab.vue';

// Mocking fetch
global.fetch = jest.fn();

describe('ConferenceTab.vue', () => {
  let wrapper;

  beforeEach(() => {
    fetch.mockClear(); // Clear mock usage before each test
    wrapper = shallowMount(ConferenceTab, {
      // You can provide props, mocks, etc. here if needed
    });
  });

  it('renders the component correctly', () => {
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('h2').text()).toBe('Model Conference');
    expect(wrapper.find('textarea#conference-prompt').exists()).toBe(true);
    expect(wrapper.find('button').text()).toBe('Start Conference');
  });

  it('shows an error if prompt is empty when starting conference', async () => {
    await wrapper.find('button').trigger('click');
    expect(wrapper.vm.error).toBe('Prompt cannot be empty.');
    expect(wrapper.find('.error-section').exists()).toBe(true);
    expect(wrapper.find('.error-section p').text()).toBe('Error: Prompt cannot be empty.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls fetch with the correct parameters when prompt is provided', async () => {
    const promptText = 'Test prompt for conference';
    await wrapper.setData({ prompt: promptText });

    // Mock a successful text response
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      text: async () => 'Test conference result',
    });

    await wrapper.find('button').trigger('click');

    expect(wrapper.vm.isLoading).toBe(false); // Should be false after fetch completes
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3030/execute-conference-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText }),
    });
  });

  it('displays text result when API call is successful', async () => {
    const promptText = 'Test prompt for conference';
    const mockResultText = 'Successful conference result from API';
    await wrapper.setData({ prompt: promptText });

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      text: async () => mockResultText,
    });

    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick(); // Wait for DOM updates

    expect(wrapper.vm.isLoading).toBe(false);
    expect(wrapper.vm.result).toBe(mockResultText);
    expect(wrapper.vm.error).toBeNull();
    expect(wrapper.find('.result-section').exists()).toBe(true);
    expect(wrapper.find('.result-section pre').text()).toBe(mockResultText);
  });

  it('displays JSON result (arbiter_response) when API call is successful', async () => {
    const promptText = 'Test prompt for JSON conference';
    const mockJsonResponse = { arbiter_response: 'Arbiter says this is good.' };
    await wrapper.setData({ prompt: promptText });

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockJsonResponse,
    });

    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isLoading).toBe(false);
    expect(wrapper.vm.result).toEqual(mockJsonResponse);
    expect(wrapper.vm.error).toBeNull();
    expect(wrapper.find('.result-section').exists()).toBe(true);
    expect(wrapper.find('.result-section pre').text()).toBe(mockJsonResponse.arbiter_response);
  });

  it('displays JSON result (response) when API call is successful and arbiter_response is missing', async () => {
    const promptText = 'Test prompt for JSON conference without arbiter_response';
    const mockJsonResponse = { response: 'Generic response field.' };
    await wrapper.setData({ prompt: promptText });

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockJsonResponse,
    });

    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.result).toEqual(mockJsonResponse);
    expect(wrapper.find('.result-section pre').text()).toBe(mockJsonResponse.response);
  });

  it('displays stringified JSON result when API call is successful and specific keys are missing', async () => {
    const promptText = 'Test prompt for generic JSON conference';
    const mockJsonResponse = { some_other_key: 'Some other value.' };
    await wrapper.setData({ prompt: promptText });

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockJsonResponse,
    });

    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.result).toEqual(mockJsonResponse);
    expect(wrapper.find('.result-section pre').text()).toBe(JSON.stringify(mockJsonResponse, null, 2));
  });

  it('handles API error correctly', async () => {
    const promptText = 'Test prompt for error';
    const errorMessage = 'API Error: Failed to fetch';
    await wrapper.setData({ prompt: promptText });

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => errorMessage, // Server often returns error as text
    });

    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isLoading).toBe(false);
    expect(wrapper.vm.result).toBeNull();
    expect(wrapper.vm.error).toBe(`HTTP error! status: 500, message: ${errorMessage}`);
    expect(wrapper.find('.error-section').exists()).toBe(true);
    expect(wrapper.find('.error-section p').text()).toBe(`Error: HTTP error! status: 500, message: ${errorMessage}`);
  });

  it('handles network error (fetch throws) correctly', async () => {
    const promptText = 'Test prompt for network error';
    const networkErrorMessage = 'Network request failed';
    await wrapper.setData({ prompt: promptText });

    fetch.mockRejectedValueOnce(new Error(networkErrorMessage));

    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isLoading).toBe(false);
    expect(wrapper.vm.result).toBeNull();
    expect(wrapper.vm.error).toBe(networkErrorMessage);
    expect(wrapper.find('.error-section').exists()).toBe(true);
    expect(wrapper.find('.error-section p').text()).toBe(`Error: ${networkErrorMessage}`);
  });

  it('updates loading state correctly during API call', async () => {
    const promptText = 'Test loading state';
    await wrapper.setData({ prompt: promptText });

    // Manually control the promise resolution
    let resolveFetch;
    fetch.mockReturnValueOnce(new Promise(resolve => {
      resolveFetch = resolve;
    }));

    // Trigger the call, but don't await the fetch completion yet
    wrapper.find('button').trigger('click');

    // Let Vue react to the initial setData and click
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.isLoading).toBe(true);
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('button').text()).toBe('Processing...');
    expect(wrapper.find('.loading-section').exists()).toBe(true);

    // Now resolve the fetch
    resolveFetch({
      ok: true,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      text: async () => 'done',
    });

    // Wait for all promises to resolve and Vue to update
    await wrapper.vm.$nextTick(); // For fetch to resolve
    await wrapper.vm.$nextTick(); // For Vue to update based on fetch resolving

    expect(wrapper.vm.isLoading).toBe(false);
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('button').text()).toBe('Start Conference');
    expect(wrapper.find('.loading-section').exists()).toBe(false);
  });
});
