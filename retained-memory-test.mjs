// Test RETAINED memory after multiple benchmark runs
// Mitata runs each benchmark multiple times and measures peak memory

import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';
import { createSignalAPI } from './packages/signals/dist/api.js';

import { signal as preactSignal, computed as preactComputed } from './packages/benchmarks/node_modules/@preact/signals-core/dist/signals-core.mjs';

const ITERATIONS = 100000;
const RUNS = 30; // Mitata runs each benchmark multiple times

console.log('TESTING RETAINED MEMORY ACROSS MULTIPLE RUNS');
console.log('='.repeat(60));
console.log(`Running each benchmark ${RUNS} times with ${ITERATIONS} iterations each\n`);

// Create Lattice API once (outside benchmark)
const { propagate } = createGraphTraversal();
const graphEdges = createGraphEdges();
const { trackDependency } = graphEdges;
const ctx = createBaseContext();
const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });
const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
  },
  {
    ctx,
    trackDependency,
    propagate,
    pullUpdates,
  }
);

// Store all created objects to prevent GC
const latticeRuns = [];
const preactRuns = [];

// Test Lattice
console.log('Lattice - Creating and running', RUNS, 'diamond instances:');
if (global.gc) global.gc();
const latticeStart = process.memoryUsage().heapUsed;

for (let run = 0; run < RUNS; run++) {
  // Create new diamond for each run (simulating benchmark)
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

  // Run iterations
  for (let i = 0; i < ITERATIONS; i++) {
    source(i);
    void bottom();
  }

  // Store to prevent GC (simulating what happens in benchmark)
  latticeRuns.push({ source, left, right, bottom });
}

if (global.gc) global.gc();
const latticeEnd = process.memoryUsage().heapUsed;
const latticeTotal = (latticeEnd - latticeStart) / 1024 / 1024;
console.log('  Total memory:', latticeTotal.toFixed(2), 'MB');
console.log('  Per run:', (latticeTotal / RUNS).toFixed(3), 'MB');

// Test Preact
console.log('\nPreact - Creating and running', RUNS, 'diamond instances:');
if (global.gc) global.gc();
const preactStart = process.memoryUsage().heapUsed;

for (let run = 0; run < RUNS; run++) {
  // Create new diamond for each run
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

  // Run iterations
  for (let i = 0; i < ITERATIONS; i++) {
    source.value = i;
    void bottom.value;
  }

  // Store to prevent GC
  preactRuns.push({ source, left, right, bottom });
}

if (global.gc) global.gc();
const preactEnd = process.memoryUsage().heapUsed;
const preactTotal = (preactEnd - preactStart) / 1024 / 1024;
console.log('  Total memory:', preactTotal.toFixed(2), 'MB');
console.log('  Per run:', (preactTotal / RUNS).toFixed(3), 'MB');

console.log('\n' + '='.repeat(60));
console.log('RESULTS:');
console.log('Lattice per run:', (latticeTotal / RUNS).toFixed(3), 'MB');
console.log('Preact per run:', (preactTotal / RUNS).toFixed(3), 'MB');
console.log('Ratio:', (latticeTotal / preactTotal).toFixed(2) + 'x');

// Now test what happens if we DON'T retain the objects
console.log('\n' + '='.repeat(60));
console.log('WITHOUT RETAINING OBJECTS (allowing GC):');

// Lattice without retention
console.log('\nLattice - Running without retention:');
if (global.gc) global.gc();
const latticeNoRetainStart = process.memoryUsage().heapUsed;

for (let run = 0; run < RUNS; run++) {
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

  for (let i = 0; i < ITERATIONS; i++) {
    source(i);
    void bottom();
  }
  // NOT storing - allow GC
}

if (global.gc) global.gc();
const latticeNoRetainEnd = process.memoryUsage().heapUsed;
console.log('  Total memory:', ((latticeNoRetainEnd - latticeNoRetainStart) / 1024 / 1024).toFixed(2), 'MB');

// Preact without retention
console.log('\nPreact - Running without retention:');
if (global.gc) global.gc();
const preactNoRetainStart = process.memoryUsage().heapUsed;

for (let run = 0; run < RUNS; run++) {
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

  for (let i = 0; i < ITERATIONS; i++) {
    source.value = i;
    void bottom.value;
  }
  // NOT storing - allow GC
}

if (global.gc) global.gc();
const preactNoRetainEnd = process.memoryUsage().heapUsed;
console.log('  Total memory:', ((preactNoRetainEnd - preactNoRetainStart) / 1024 / 1024).toFixed(2), 'MB');