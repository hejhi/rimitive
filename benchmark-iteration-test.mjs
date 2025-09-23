// Test memory growth during benchmark iterations
import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';
import { createSignalAPI } from './packages/signals/dist/api.js';

import { signal as preactSignal, computed as preactComputed } from './packages/benchmarks/node_modules/@preact/signals-core/dist/signals-core.mjs';

const ITERATIONS = 100000;

function testMemoryGrowth(name, setupFn, iterateFn) {
  console.log(`\n${name}:`);

  // Setup
  if (global.gc) global.gc();
  const setupBefore = process.memoryUsage().heapUsed;

  const objects = setupFn();

  if (global.gc) global.gc();
  const setupAfter = process.memoryUsage().heapUsed;
  console.log(`  Setup: ${((setupAfter - setupBefore) / 1024).toFixed(2)} KB`);

  // Warmup - run a few iterations to establish dependencies
  for (let i = 0; i < 10; i++) {
    iterateFn(objects, i);
  }

  if (global.gc) global.gc();
  const iterBefore = process.memoryUsage().heapUsed;

  // Run iterations
  for (let i = 0; i < ITERATIONS; i++) {
    iterateFn(objects, i);
  }

  if (global.gc) global.gc();
  const iterAfter = process.memoryUsage().heapUsed;
  console.log(`  ${ITERATIONS} iterations: ${((iterAfter - iterBefore) / 1024).toFixed(2)} KB`);
  console.log(`  Per iteration: ${((iterAfter - iterBefore) / ITERATIONS).toFixed(2)} bytes`);

  return objects;
}

// Setup Lattice API once
const { propagate } = createGraphTraversal();
const graphEdges = createGraphEdges();
const ctx = createBaseContext();
const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });
const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
  },
  {
    ctx,
    trackDependency: graphEdges.trackDependency,
    propagate,
    pullUpdates,
  }
);

console.log('DIAMOND DEPENDENCY PATTERN - Memory Growth During Iterations');
console.log('='.repeat(60));

// Test Lattice with simple computation (matching benchmark)
testMemoryGrowth(
  'Lattice - Simple Diamond',
  () => {
    const source = latticeAPI.signal(0);
    const left = latticeAPI.computed(() => {
      const val = source();
      let result = val;
      for (let j = 0; j < 5; j++) {
        result = (result * 31 + j) % 1000007;
      }
      return result;
    });
    const right = latticeAPI.computed(() => {
      const val = source();
      let result = val;
      for (let j = 0; j < 5; j++) {
        result = (result * 37 + j * 2) % 1000007;
      }
      return result;
    });
    const bottom = latticeAPI.computed(() => {
      const l = left();
      const r = right();
      return (l * l + r * r) % 1000007;
    });

    return { source, left, right, bottom };
  },
  (objects, i) => {
    objects.source(i);
    objects.bottom();
  }
);

// Test Preact with same computation
testMemoryGrowth(
  'Preact - Simple Diamond',
  () => {
    const source = preactSignal(0);
    const left = preactComputed(() => {
      const val = source.value;
      let result = val;
      for (let j = 0; j < 5; j++) {
        result = (result * 31 + j) % 1000007;
      }
      return result;
    });
    const right = preactComputed(() => {
      const val = source.value;
      let result = val;
      for (let j = 0; j < 5; j++) {
        result = (result * 37 + j * 2) % 1000007;
      }
      return result;
    });
    const bottom = preactComputed(() => {
      const l = left.value;
      const r = right.value;
      return (l * l + r * r) % 1000007;
    });

    return { source, left, right, bottom };
  },
  (objects, i) => {
    objects.source.value = i;
    objects.bottom.value;
  }
);

// Test Lattice with minimal computation
testMemoryGrowth(
  'Lattice - Minimal Diamond',
  () => {
    const source = latticeAPI.signal(0);
    const left = latticeAPI.computed(() => source() * 2);
    const right = latticeAPI.computed(() => source() * 3);
    const bottom = latticeAPI.computed(() => left() + right());

    return { source, left, right, bottom };
  },
  (objects, i) => {
    objects.source(i);
    objects.bottom();
  }
);

// Test Preact with minimal computation
testMemoryGrowth(
  'Preact - Minimal Diamond',
  () => {
    const source = preactSignal(0);
    const left = preactComputed(() => source.value * 2);
    const right = preactComputed(() => source.value * 3);
    const bottom = preactComputed(() => left.value + right.value);

    return { source, left, right, bottom };
  },
  (objects, i) => {
    objects.source.value = i;
    objects.bottom.value;
  }
);

console.log('\n' + '='.repeat(60));
console.log('ANALYSIS:');
console.log('The memory growth during iterations shows if there are leaks');
console.log('or temporary allocations that aren\'t being cleaned up properly.');