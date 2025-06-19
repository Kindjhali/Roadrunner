// services/api/AgentRegistry.js
// Simple registry to map agent IDs to callable agent implementations.
// Agents should export a default function that accepts (input) and returns a Promise.
// Additional agents can be registered at runtime.

const registry = {};

export function registerAgent(id, handler) {
  if (typeof id !== 'string' || !id) {
    throw new Error('Agent id must be a non-empty string');
  }
  if (typeof handler !== 'function') {
    throw new Error('Agent handler must be a function');
  }
  registry[id] = handler;
}

export function getAgent(id) {
  return registry[id];
}

export default {
  registerAgent,
  getAgent,
  registry,
};
