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

const { signal, computed } = api;

// Measure memory allocation for deep propagation
function measureDeepPropagation() {
  const depth = 1000;  // Further reduced for testing
  const s = signal(0);

  // Create a deep chain of computed values
  let current = s;
  for (let i = 0; i < depth; i++) {
    const prev = current;
    current = computed(() => prev() + 1);
  }

  // Force GC before measurement
  if (global.gc) global.gc();

  const memBefore = process.memoryUsage().heapUsed;

  // Trigger propagation
  for (let i = 0; i < 10; i++) {
    s(i);  // Set value
    // Access the final computed to trigger full propagation
    const result = current();
    if (result === undefined) {
      throw new Error(`Got undefined result. API may not be initialized correctly.`);
    }
    if (result !== depth + i) {
      throw new Error(`Expected ${depth + i}, got ${result}`);
    }
  }

  const memAfter = process.memoryUsage().heapUsed;
  const memoryUsed = memAfter - memBefore;

  return {
    memoryUsedMB: (memoryUsed / 1024 / 1024).toFixed(2),
    memoryUsedBytes: memoryUsed,
    perIterationBytes: Math.round(memoryUsed / 10),
    perNodeBytes: Math.round(memoryUsed / 10 / depth)
  };
}

console.log('Testing memory usage for deep propagation...');
console.log('Chain depth: 1,000 nodes');
console.log('Iterations: 10');
console.log('');

const result = measureDeepPropagation();
console.log('Results:');
console.log(`  Total memory used: ${result.memoryUsedMB} MB`);
console.log(`  Memory per iteration: ${(result.perIterationBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Memory per node per iteration: ~${result.perNodeBytes} bytes`);

// Compare to target
const TARGET_PER_NODE = 5; // alien-signals achieves < 5 bytes per node
if (result.perNodeBytes <= TARGET_PER_NODE) {
  console.log(`\n✅ SUCCESS: Achieved ${result.perNodeBytes} bytes per node (target: ≤${TARGET_PER_NODE})`);
} else {
  console.log(`\n⚠️  Current: ${result.perNodeBytes} bytes per node (target: ≤${TARGET_PER_NODE})`);
  console.log(`   Improvement needed: ${result.perNodeBytes - TARGET_PER_NODE} bytes per node`);
}