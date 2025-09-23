import { createSignalAPI } from './packages/signals/dist/api.js';
import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';
import { createScheduler } from './packages/signals/dist/helpers/scheduler.js';

// Create context with all dependencies
function createDefaultContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();
  const { traverseGraph } = createGraphTraversal();

  return {
    ctx,
    ...graphEdges,
    ...createPullPropagator({ ctx, track: graphEdges.track }),
    ...createScheduler({ propagate: traverseGraph }),
  };
}

// Create API
const api = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
}, createDefaultContext());

console.log('API object:', api);
console.log('API keys:', Object.keys(api));

const { signal, computed } = api;
console.log('signal function:', signal);
console.log('computed function:', computed);

// Simple test
const s = signal(1);
console.log('Signal object:', s);
console.log('Type of s:', typeof s);

const c = computed(() => s() * 2);
console.log('Computed object:', c);
console.log('Type of c:', typeof c);

console.log('Initial signal value:', s());
console.log('Initial computed value:', c());

s(5);  // Set value by calling signal as function
console.log('After update signal value:', s());
console.log('After update computed value:', c());

if (c() !== 10) {
  throw new Error(`Expected 10, got ${c()}`);
}

console.log('✅ API works correctly');