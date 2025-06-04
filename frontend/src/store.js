import { createStore } from 'vuex';

export default createStore({
  state: {
    models: {},
  },
  mutations: {
    SET_MODELS(state, models) {
      state.models = models;
    },
  },
  actions: {
    updateModels({ commit }, models) {
      commit('SET_MODELS', models);
    },
  },
  getters: {
    getCategorizedModels: (state) => state.models,
  },
});
