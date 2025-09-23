// Direct memory comparison without benchmark framework
import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';
import { createSignalAPI } from './packages/signals/dist/api.js';

// Preact signals - use the bundled version from benchmarks
import { signal as preactSignal, computed as preactComputed } from './packages/benchmarks/node_modules/@preact/signals-core/dist/signals-core.mjs';

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(3) + ' MB';
}

console.log('Testing memory usage for diamond dependency pattern\n');
console.log('='.repeat(50));

// Force GC and get baseline
if (global.gc) global.gc();
const baseline = process.memoryUsage().heapUsed;

// Test 1: Single Lattice API instance
console.log('\n1. Creating Lattice API instance:');
const before1 = process.memoryUsage().heapUsed;

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

if (global.gc) global.gc();
const after1 = process.memoryUsage().heapUsed;
console.log('Memory used:', formatBytes(after1 - before1));

// Test 2: Create diamond pattern with Lattice
console.log('\n2. Creating Lattice diamond (1 source, 2 computed, 1 bottom):');
const before2 = process.memoryUsage().heapUsed;

const latticeSource = latticeAPI.signal(0);
const latticeLeft = latticeAPI.computed(() => latticeSource() * 2);
const latticeRight = latticeAPI.computed(() => latticeSource() * 3);
const latticeBottom = latticeAPI.computed(() => latticeLeft() + latticeRight());

// Establish dependencies
latticeBottom();

if (global.gc) global.gc();
const after2 = process.memoryUsage().heapUsed;
console.log('Memory used for 4 nodes:', formatBytes(after2 - before2));
console.log('Memory per node:', formatBytes((after2 - before2) / 4));

// Test 3: Create diamond pattern with Preact
console.log('\n3. Creating Preact diamond (1 source, 2 computed, 1 bottom):');
const before3 = process.memoryUsage().heapUsed;

const preactSource = preactSignal(0);
const preactLeft = preactComputed(() => preactSource.value * 2);
const preactRight = preactComputed(() => preactSource.value * 3);
const preactBottom = preactComputed(() => preactLeft.value + preactRight.value);

// Establish dependencies
preactBottom.value;

if (global.gc) global.gc();
const after3 = process.memoryUsage().heapUsed;
console.log('Memory used for 4 nodes:', formatBytes(after3 - before3));
console.log('Memory per node:', formatBytes((after3 - before3) / 4));

// Test 4: Create 1000 Lattice signals
console.log('\n4. Creating 1000 Lattice signals:');
const before4 = process.memoryUsage().heapUsed;

const latticeSignals = [];
for (let i = 0; i < 1000; i++) {
  latticeSignals.push(latticeAPI.signal(i));
}

if (global.gc) global.gc();
const after4 = process.memoryUsage().heapUsed;
console.log('Memory used:', formatBytes(after4 - before4));
console.log('Memory per signal:', formatBytes((after4 - before4) / 1000));

// Test 5: Create 1000 Preact signals
console.log('\n5. Creating 1000 Preact signals:');
const before5 = process.memoryUsage().heapUsed;

const preactSignals = [];
for (let i = 0; i < 1000; i++) {
  preactSignals.push(preactSignal(i));
}

if (global.gc) global.gc();
const after5 = process.memoryUsage().heapUsed;
console.log('Memory used:', formatBytes(after5 - before5));
console.log('Memory per signal:', formatBytes((after5 - before5) / 1000));

// Test 6: Run iterations on Lattice diamond
console.log('\n6. Running 100k iterations on Lattice diamond:');
const before6 = process.memoryUsage().heapUsed;

for (let i = 0; i < 100000; i++) {
  latticeSource(i);
  latticeBottom();
}

if (global.gc) global.gc();
const after6 = process.memoryUsage().heapUsed;
console.log('Memory growth:', formatBytes(after6 - before6));

// Test 7: Run iterations on Preact diamond
console.log('\n7. Running 100k iterations on Preact diamond:');
const before7 = process.memoryUsage().heapUsed;

for (let i = 0; i < 100000; i++) {
  preactSource.value = i;
  preactBottom.value;
}

if (global.gc) global.gc();
const after7 = process.memoryUsage().heapUsed;
console.log('Memory growth:', formatBytes(after7 - before7));

console.log('\n' + '='.repeat(50));
console.log('SUMMARY:');
console.log('Lattice API overhead:', formatBytes(after1 - before1));
console.log('Lattice per signal:', formatBytes((after4 - before4) / 1000));
console.log('Preact per signal:', formatBytes((after5 - before5) / 1000));
console.log('Ratio:', ((after4 - before4) / (after5 - before5)).toFixed(2) + 'x');