// Detailed analysis of memory allocations
import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';
import { createSignalAPI } from './packages/signals/dist/api.js';

// Count object allocations for Lattice
console.log('LATTICE OBJECT ALLOCATIONS:\n');

console.log('1. API Creation:');
const traversal = createGraphTraversal();
console.log('  - createGraphTraversal returns:', Object.keys(traversal));

const graphEdges = createGraphEdges();
console.log('  - createGraphEdges returns:', Object.keys(graphEdges));

const ctx = createBaseContext();
console.log('  - createBaseContext returns:', Object.keys(ctx));

const pullProp = createPullPropagator({ ctx, track: graphEdges.track });
console.log('  - createPullPropagator returns:', Object.keys(pullProp));

const api = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
  },
  {
    ctx,
    trackDependency: graphEdges.trackDependency,
    propagate: traversal.propagate,
    pullUpdates: pullProp.pullUpdates,
  }
);
console.log('  - createSignalAPI returns:', Object.keys(api));

console.log('\n2. Per-Signal Allocations:');
const testSignal = api.signal(0);
console.log('  - Signal is a:', typeof testSignal);
console.log('  - Signal properties:', Object.keys(testSignal));
console.log('  - Signal.peek is:', typeof testSignal.peek);

console.log('\n3. Per-Computed Allocations:');
const testComputed = api.computed(() => testSignal() * 2);
console.log('  - Computed is a:', typeof testComputed);
console.log('  - Computed properties:', Object.keys(testComputed));
console.log('  - Computed.peek is:', typeof testComputed.peek);

// Now analyze memory per allocation type
console.log('\n\nMEMORY BREAKDOWN:\n');

// Test 1: Just the API overhead
if (global.gc) global.gc();
const beforeAPI = process.memoryUsage().heapUsed;

const { propagate } = createGraphTraversal();
const edges = createGraphEdges();
const context = createBaseContext();
const { pullUpdates } = createPullPropagator({ ctx: context, track: edges.track });
const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
  },
  {
    ctx: context,
    trackDependency: edges.trackDependency,
    propagate,
    pullUpdates,
  }
);

if (global.gc) global.gc();
const afterAPI = process.memoryUsage().heapUsed;

console.log('API Creation overhead:', ((afterAPI - beforeAPI) / 1024).toFixed(2) + ' KB');

// Test 2: Create 100 signals to get accurate per-signal cost
if (global.gc) global.gc();
const beforeSignals = process.memoryUsage().heapUsed;

const signals = [];
for (let i = 0; i < 100; i++) {
  signals.push(latticeAPI.signal(i));
}

if (global.gc) global.gc();
const afterSignals = process.memoryUsage().heapUsed;

console.log('100 signals total:', ((afterSignals - beforeSignals) / 1024).toFixed(2) + ' KB');
console.log('Per signal:', ((afterSignals - beforeSignals) / 100).toFixed(0) + ' bytes');

// Test 3: Create 100 computed to get accurate per-computed cost
if (global.gc) global.gc();
const beforeComputed = process.memoryUsage().heapUsed;

const computeds = [];
for (let i = 0; i < 100; i++) {
  const idx = i;
  computeds.push(latticeAPI.computed(() => signals[idx]() * 2));
}

if (global.gc) global.gc();
const afterComputed = process.memoryUsage().heapUsed;

console.log('100 computed total:', ((afterComputed - beforeComputed) / 1024).toFixed(2) + ' KB');
console.log('Per computed:', ((afterComputed - beforeComputed) / 100).toFixed(0) + ' bytes');

// Test 4: Evaluate all computed to create dependencies
if (global.gc) global.gc();
const beforeDeps = process.memoryUsage().heapUsed;

for (const comp of computeds) {
  comp(); // This creates the dependency edges
}

if (global.gc) global.gc();
const afterDeps = process.memoryUsage().heapUsed;

console.log('Dependency edges for 100 computed:', ((afterDeps - beforeDeps) / 1024).toFixed(2) + ' KB');
console.log('Per dependency edge:', ((afterDeps - beforeDeps) / 100).toFixed(0) + ' bytes');

// Compare with Preact
console.log('\n\nPREACT COMPARISON:\n');

import { signal as preactSignal, computed as preactComputed } from './packages/benchmarks/node_modules/@preact/signals-core/dist/signals-core.mjs';

// Test Preact signals
if (global.gc) global.gc();
const beforePreactSignals = process.memoryUsage().heapUsed;

const preactSignals = [];
for (let i = 0; i < 100; i++) {
  preactSignals.push(preactSignal(i));
}

if (global.gc) global.gc();
const afterPreactSignals = process.memoryUsage().heapUsed;

console.log('100 Preact signals:', ((afterPreactSignals - beforePreactSignals) / 1024).toFixed(2) + ' KB');
console.log('Per Preact signal:', ((afterPreactSignals - beforePreactSignals) / 100).toFixed(0) + ' bytes');

// Test Preact computed
if (global.gc) global.gc();
const beforePreactComputed = process.memoryUsage().heapUsed;

const preactComputeds = [];
for (let i = 0; i < 100; i++) {
  const idx = i;
  preactComputeds.push(preactComputed(() => preactSignals[idx].value * 2));
}

if (global.gc) global.gc();
const afterPreactComputed = process.memoryUsage().heapUsed;

console.log('100 Preact computed:', ((afterPreactComputed - beforePreactComputed) / 1024).toFixed(2) + ' KB');
console.log('Per Preact computed:', ((afterPreactComputed - beforePreactComputed) / 100).toFixed(0) + ' bytes');

// Evaluate Preact computed
if (global.gc) global.gc();
const beforePreactDeps = process.memoryUsage().heapUsed;

for (const comp of preactComputeds) {
  comp.value; // This creates the dependency edges
}

if (global.gc) global.gc();
const afterPreactDeps = process.memoryUsage().heapUsed;

console.log('Preact dependency edges for 100 computed:', ((afterPreactDeps - beforePreactDeps) / 1024).toFixed(2) + ' KB');
console.log('Per Preact dependency edge:', ((afterPreactDeps - beforePreactDeps) / 100).toFixed(0) + ' bytes');

console.log('\n\nSUMMARY:');
console.log('Lattice per signal:', ((afterSignals - beforeSignals) / 100).toFixed(0) + ' bytes');
console.log('Preact per signal:', ((afterPreactSignals - beforePreactSignals) / 100).toFixed(0) + ' bytes');
console.log('Ratio:', ((afterSignals - beforeSignals) / (afterPreactSignals - beforePreactSignals)).toFixed(2) + 'x');

console.log('\nLattice per computed:', ((afterComputed - beforeComputed) / 100).toFixed(0) + ' bytes');
console.log('Preact per computed:', ((afterPreactComputed - beforePreactComputed) / 100).toFixed(0) + ' bytes');
console.log('Ratio:', ((afterComputed - beforeComputed) / (afterPreactComputed - beforePreactComputed)).toFixed(2) + 'x');