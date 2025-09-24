// Exactly replicate how Mitata measures memory
import { getHeapStatistics } from 'node:v8';
import { createSignalAPI } from './packages/signals/dist/api.js';
import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';

console.log('=== EXACT MITATA MEMORY MEASUREMENT ===\n');

// This simulates the createApi() at line 27 of computed-diamond-simple.bench.ts
const createApi = () => {
  const { propagate } = createGraphTraversal();
  const graphEdges = createGraphEdges();
  const { trackDependency } = graphEdges;
  const ctx = createBaseContext();
  const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });

  return createSignalAPI(
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
};

// Created ONCE outside benchmark (line 27)
const api = createApi();
const { signal, computed } = api;

// Test 1: Diamond pattern (like computed-diamond-simple)
console.log('Test 1: Diamond pattern (computed-diamond-simple style)');
{
  // This is what happens INSIDE the generator function but BEFORE yield
  const source = signal(0);
  const left = computed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 31 + j) % 1000007;
    }
    return result;
  });
  const right = computed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 37 + j * 2) % 1000007;
    }
    return result;
  });
  const bottom = computed(() => {
    const l = left();
    const r = right();
    return (l * l + r * r) % 1000007;
  });

  // Mitata measures AFTER yield, with graph already created
  if (global.gc) global.gc();
  const heapBefore = getHeapStatistics().used_heap_size / 1024 / 1024;

  // Run iterations (what happens in yield function)
  for (let i = 0; i < 100000; i++) {
    source(i);
    bottom();
  }

  if (global.gc) global.gc();
  const heapAfter = getHeapStatistics().used_heap_size / 1024 / 1024;

  console.log(`  Heap before iterations: ${heapBefore.toFixed(2)} MB`);
  console.log(`  Heap after iterations: ${heapAfter.toFixed(2)} MB`);
  console.log(`  Heap delta (what Mitata reports): ${(heapAfter - heapBefore).toFixed(2)} MB`);
}

// Test 2: For comparison, measure INCLUDING graph creation
console.log('\nTest 2: Measuring INCLUDING graph creation');
{
  const api2 = createApi();
  const { signal, computed } = api2;

  if (global.gc) global.gc();
  const heapBefore = getHeapStatistics().used_heap_size / 1024 / 1024;

  // Create graph
  const source = signal(0);
  const left = computed(() => source() * 2);
  const right = computed(() => source() * 3);
  const bottom = computed(() => left() + right());

  // Run iterations
  for (let i = 0; i < 100000; i++) {
    source(i);
    bottom();
  }

  if (global.gc) global.gc();
  const heapAfter = getHeapStatistics().used_heap_size / 1024 / 1024;

  console.log(`  Total memory including graph: ${(heapAfter - heapBefore).toFixed(2)} MB`);
}

console.log('\n=== CONCLUSION ===');
console.log('Mitata measures heap delta AFTER graph creation,');
console.log('so the 3.82 MB includes the graph structure itself!');