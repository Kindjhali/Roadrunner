const path = require('path');
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: path.resolve(__dirname, '../../babel.config.cjs') }],
  },
  transformIgnorePatterns: ['node_modules/(?!.*node-fetch)'],
  moduleFileExtensions: ['js', 'json'],
  setupFiles: [path.resolve(__dirname, '../../jest.setup.js')],
  moduleNameMapper: {
    '^@langchain/community/chat_models/ollama$': path.resolve(__dirname, 'tests/mocks/ollama.js'),
  },
};
