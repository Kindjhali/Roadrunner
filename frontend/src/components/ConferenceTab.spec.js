const { shallowMount } = require('@vue/test-utils/dist/vue-test-utils.cjs.js');
const ConferenceTab = require('./ConferenceTab.vue').default;

let callbacks;

const mockElectron = {
  startConferenceStream: jest.fn(),
  onConferenceStreamChunk: jest.fn(cb => { callbacks.chunk = cb; }),
  onConferenceStreamError: jest.fn(cb => { callbacks.error = cb; }),
  onConferenceStreamEnd: jest.fn(cb => { callbacks.end = cb; }),
  removeAllConferenceListeners: jest.fn(),
};

describe('ConferenceTab.vue', () => {
  let wrapper;

  beforeEach(() => {
    callbacks = {};
    global.window.electronAPI = mockElectron;
    jest.clearAllMocks();
    wrapper = shallowMount(ConferenceTab);
  });

  it('renders correctly', () => {
    expect(wrapper.find('h2').text()).toBe('Model Conference');
  });

  it('errors on empty prompt', async () => {
    await wrapper.find('button').trigger('click');
    expect(wrapper.vm.error).toBe('Prompt cannot be empty.');
    expect(mockElectron.startConferenceStream).not.toHaveBeenCalled();
  });

  it('sends payload via electronAPI when starting', async () => {
    await wrapper.setData({
      prompt: 'Hello',
      selectedModelA: 'a',
      selectedModelB: 'b',
      selectedArbiter: 'c'
    });
    await wrapper.find('button').trigger('click');
    expect(mockElectron.startConferenceStream).toHaveBeenCalledWith({
      prompt: 'Hello',
      model_a_id: 'a',
      model_b_id: 'b',
      arbiter_model_id: 'c',
      history: [{ role: 'user', content: 'Hello' }]
    });
  });

  it('updates result on conference end', async () => {
    await wrapper.setData({
      prompt: 'Hi',
      selectedModelA: 'a',
      selectedModelB: 'b',
      selectedArbiter: 'c'
    });
    await wrapper.find('button').trigger('click');
    callbacks.end({}, { final_response: 'done' });
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.result.final_response).toBe('done');
  });

  it('handles error events', async () => {
    callbacks.error({}, { error: 'fail' });
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.error).toContain('fail');
  });
});
