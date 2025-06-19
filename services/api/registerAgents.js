import fsAgent from './fsAgent.js';
import gitAgent from './gitAgent.js';
import * as codeGenerator from './codeGenerator.js';
import * as sniperPlanner from './sniperCodeGenPlanner.js';
import { registerAgent } from './AgentRegistry.js';

// Wrap default instances so registry returns callable functions
registerAgent('fs', async ({ method, args = [] } = {}) => {
  if (typeof fsAgent[method] !== 'function') {
    throw new Error(`Unknown fsAgent method: ${method}`);
  }
  return fsAgent[method](...args);
});

registerAgent('git', async ({ method, args = [] } = {}) => {
  if (typeof gitAgent[method] !== 'function') {
    throw new Error(`Unknown gitAgent method: ${method}`);
  }
  return gitAgent[method](...args);
});

registerAgent('codeGenerator', codeGenerator.generateContentFromSpec);
registerAgent('sniperPlanner', sniperPlanner.default || sniperPlanner);

export const agents = {
  fs: fsAgent,
  git: gitAgent,
  codeGenerator,
  sniperPlanner,
};

export default agents;
