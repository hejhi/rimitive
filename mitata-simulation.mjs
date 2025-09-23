// Simulate how mitata measures memory in the benchmark
import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';
import { createSignalAPI } from './packages/signals/dist/api.js';

import { signal as preactSignal, computed as preactComputed } from './packages/benchmarks/node_modules/@preact/signals-core/dist/signals-core.mjs';

const ITERATIONS = 100000;

console.log('SIMULATING MITATA BENCHMARK MEMORY MEASUREMENT');
console.log('='.repeat(60));
console.log('Mitata measures memory INSIDE the generator function,');
console.log('which includes the setup phase for each benchmark run.\n');

// Simulate Lattice benchmark
function* latticeBenchmark() {
  // This happens INSIDE the measurement - contributes to memory!
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

  // Yield the iteration function
  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source(i);
      void bottom();
    }
  };
}

// Simulate Preact benchmark
function* preactBenchmark() {
  // This happens INSIDE the measurement - minimal overhead!
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

  // Yield the iteration function
  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source.value = i;
      void bottom.value;
    }
  };
}

// Measure Lattice
console.log('Lattice benchmark (with API creation inside):');
if (global.gc) global.gc();
const latticeBeforeSetup = process.memoryUsage().heapUsed;

const latticeGen = latticeBenchmark();
const latticeIterFn = latticeGen.next().value;

if (global.gc) global.gc();
const latticeAfterSetup = process.memoryUsage().heapUsed;
console.log('  Setup phase:', ((latticeAfterSetup - latticeBeforeSetup) / 1024).toFixed(2), 'KB');

// Run iterations
latticeIterFn();

if (global.gc) global.gc();
const latticeAfterIter = process.memoryUsage().heapUsed;
console.log('  After iterations:', ((latticeAfterIter - latticeAfterSetup) / 1024).toFixed(2), 'KB');
console.log('  TOTAL:', ((latticeAfterIter - latticeBeforeSetup) / 1024 / 1024).toFixed(2), 'MB');

// Measure Preact
console.log('\nPreact benchmark (minimal setup):');
if (global.gc) global.gc();
const preactBeforeSetup = process.memoryUsage().heapUsed;

const preactGen = preactBenchmark();
const preactIterFn = preactGen.next().value;

if (global.gc) global.gc();
const preactAfterSetup = process.memoryUsage().heapUsed;
console.log('  Setup phase:', ((preactAfterSetup - preactBeforeSetup) / 1024).toFixed(2), 'KB');

// Run iterations
preactIterFn();

if (global.gc) global.gc();
const preactAfterIter = process.memoryUsage().heapUsed;
console.log('  After iterations:', ((preactAfterIter - preactAfterSetup) / 1024).toFixed(2), 'KB');
console.log('  TOTAL:', ((preactAfterIter - preactBeforeSetup) / 1024 / 1024).toFixed(2), 'MB');

console.log('\n' + '='.repeat(60));
console.log('THE PROBLEM:');
console.log('The benchmark includes API creation INSIDE the measurement!');
console.log('Lattice ratio:', ((latticeAfterIter - latticeBeforeSetup) / (preactAfterIter - preactBeforeSetup)).toFixed(2) + 'x');

// Now test with API created OUTSIDE
console.log('\n' + '='.repeat(60));
console.log('IF API CREATED OUTSIDE (like it should be):');

// Create API outside
const { propagate } = createGraphTraversal();
const graphEdges = createGraphEdges();
const { trackDependency } = graphEdges;
const ctx = createBaseContext();
const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });
const sharedAPI = createSignalAPI(
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

function* latticeOptimizedBenchmark() {
  // Use pre-created API
  const source = sharedAPI.signal(0);
  const left = sharedAPI.computed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 31 + j) % 1000007;
    }
    return result;
  });
  const right = sharedAPI.computed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 37 + j * 2) % 1000007;
    }
    return result;
  });
  const bottom = sharedAPI.computed(() => {
    const l = left();
    const r = right();
    return (l * l + r * r) % 1000007;
  });

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source(i);
      void bottom();
    }
  };
}

console.log('\nLattice with API created outside:');
if (global.gc) global.gc();
const optBeforeSetup = process.memoryUsage().heapUsed;

const optGen = latticeOptimizedBenchmark();
const optIterFn = optGen.next().value;

if (global.gc) global.gc();
const optAfterSetup = process.memoryUsage().heapUsed;
console.log('  Setup phase:', ((optAfterSetup - optBeforeSetup) / 1024).toFixed(2), 'KB');

optIterFn();

if (global.gc) global.gc();
const optAfterIter = process.memoryUsage().heapUsed;
console.log('  After iterations:', ((optAfterIter - optAfterSetup) / 1024).toFixed(2), 'KB');
console.log('  TOTAL:', ((optAfterIter - optBeforeSetup) / 1024 / 1024).toFixed(2), 'MB');

console.log('\nOptimized ratio:', ((optAfterIter - optBeforeSetup) / (preactAfterIter - preactBeforeSetup)).toFixed(2) + 'x');