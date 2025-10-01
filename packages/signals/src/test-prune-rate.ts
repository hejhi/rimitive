/**
 * Test to verify if pruning is happening in computed-chain-deep pattern
 */

import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createBaseContext } from './context';
import { createScheduler } from './helpers/scheduler';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createGraphTraversal } from './helpers/graph-traversal';

function createDefaultContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();
  const { traverseGraph } = createGraphTraversal();

  return {
    ctx,
    ...graphEdges,
    ...createPullPropagator({ ctx, track: graphEdges.track }),
    ...createScheduler({
      propagate: traverseGraph,
      detachAll: graphEdges.detachAll,
    }),
  };
}

const api = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
}, createDefaultContext());

const { signal, computed } = api;

console.log('\n=== Testing computed-chain-deep pattern ===\n');

const depth = 100;
const iterations = 1000;

const source = signal(0);
let last: (() => number) = source;

for (let i = 0; i < depth; i++) {
  const prev = last;
  const level = i;
  last = computed(() => {
    const val = prev();
    let result = val;
    for (let j = 0; j < 3; j++) {
      result = ((result * 31) + level + j) % 1000007;
    }
    return result;
  });
}

const final = last;

// Warmup
source(1);
void final();

console.log('After warmup:');
console.log((globalThis as any).__latticeGraphEdgesStats());

// Run iterations
for (let i = 0; i < iterations; i++) {
  source(i);
  void final();
}

console.log(`\nAfter ${iterations} iterations with ${depth}-deep chain:`);
const stats = (globalThis as any).__latticeGraphEdgesStats();
const pullStats = (globalThis as any).__latticePullPropagatorStats();
console.log('\nGraph edges stats:');
console.log(stats);
console.log('\nPull propagator stats:');
console.log(pullStats);
console.log(`\nExpected track calls: ~${depth * iterations}`);
console.log(`Actual track calls: ${stats.trackCount}`);

if (stats.pruneCount > 0) {
  console.log(`\n⚠️  PRUNING IS HAPPENING! ${stats.pruneCount} times (${stats.pruneRate})`);
  console.log('This could explain the memory allocations!');
} else {
  console.log('\n✓ No pruning detected - dependencies are stable');
}

if (pullStats.shallowPropagateCallCount > 0) {
  console.log(`\n⚠️  shallowPropagate called ${pullStats.shallowPropagateCallCount} times`);
  console.log(`   Processing ${pullStats.shallowPropagateNodeCount} total nodes (${pullStats.avgNodesPerCall} avg per call)`);
  console.log('   This happens when computed.subscribers is non-empty during pullUpdates');
} else {
  console.log('\n✓ shallowPropagate never called - no downstream computeds');
}
