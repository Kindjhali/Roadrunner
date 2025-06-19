import fsAgent from './fsAgent.js';
import gitAgent from './gitAgent.js';
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

// Load heavier agents lazily to avoid circular dependencies during tests
async function loadOptionalAgents() {
  try {
    const { generateContentFromSpec } = await import('./codeGenerator.js');
    registerAgent('codeGenerator', generateContentFromSpec);
  } catch (err) {
    console.error('[AgentRegistry] Failed to load codeGenerator agent:', err);
  }
  try {
    const { generateCodeGenPlan } = await import('./sniperCodeGenPlanner.js');
    registerAgent('sniperPlanner', generateCodeGenPlan);
  } catch (err) {
    console.error('[AgentRegistry] Failed to load sniperPlanner agent:', err);
  }
}

loadOptionalAgents();

export const agents = {
  fs: fsAgent,
  git: gitAgent,
};

export default agents;
