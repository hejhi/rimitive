// Test to understand Mitata benchmark memory pattern
import { createSignalAPI } from './packages/signals/dist/api.js';
import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';

console.log('=== MITATA-STYLE MEMORY TEST ===\n');

// Test 1: How Mitata actually runs benchmarks
console.log('Test 1: Mitata-style - Create ONCE, run many times (like actual benchmark)');
{
  // This is created ONCE like line 27 of computed-diamond-simple.bench.ts
  const { propagate } = createGraphTraversal();
  const graphEdges = createGraphEdges();
  const { trackDependency } = graphEdges;
  const ctx = createBaseContext();
  const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });

  const api = createSignalAPI(
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

  const { signal, computed } = api;

  if (global.gc) global.gc();
  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

  // Create diamond ONCE (outside yield in benchmark)
  const source = signal(0);
  const left = computed(() => source() * 2);
  const right = computed(() => source() * 3);
  const bottom = computed(() => left() + right());

  // Initial evaluation
  bottom();

  if (global.gc) global.gc();
  const memAfterCreate = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`  Memory after creating graph: ${(memAfterCreate - memBefore).toFixed(2)} MB`);

  // Run 100k iterations (inside yield in benchmark)
  for (let i = 0; i < 100000; i++) {
    source(i);
    bottom();
  }

  if (global.gc) global.gc();
  const memAfterRun = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`  Memory after 100k iterations: ${(memAfterRun - memAfterCreate).toFixed(2)} MB`);
  console.log(`  Total memory used: ${(memAfterRun - memBefore).toFixed(2)} MB`);
}

// Test 2: Check scaling-computed-computed pattern
console.log('\nTest 2: Scaling pattern - 100 computed→computed chains');
{
  const { propagate } = createGraphTraversal();
  const graphEdges = createGraphEdges();
  const { trackDependency } = graphEdges;
  const ctx = createBaseContext();
  const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });

  const api = createSignalAPI(
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

  const { signal, computed } = api;

  if (global.gc) global.gc();
  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

  // Create like scaling-computed-computed benchmark
  const source = signal(0);

  // First layer: 100 computeds reading from signal
  const firstLayer = Array.from({ length: 100 }, (_, i) =>
    computed(() => {
      const val = source();
      let result = val;
      for (let j = 0; j < 3; j++) {
        result = (result * (i + 1) + j) % 1000007;
      }
      return result;
    })
  );

  // Second layer: 100 computeds reading from first layer (computed→computed)
  const secondLayer = firstLayer.map((c, i) =>
    computed(() => {
      const val = c();
      let result = val;
      for (let j = 0; j < 3; j++) {
        result = (result * (i + 1) + j) % 1000007;
      }
      return result;
    })
  );

  // Initial evaluation
  secondLayer.forEach(c => c());

  if (global.gc) global.gc();
  const memAfterCreate = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`  Memory after creating 200 computeds: ${(memAfterCreate - memBefore).toFixed(2)} MB`);

  // Run iterations
  const iterations = 1000 * Math.sqrt(100); // Like benchmark
  for (let i = 0; i < iterations; i++) {
    source(i);
    secondLayer.forEach(c => c());
  }

  if (global.gc) global.gc();
  const memAfterRun = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`  Memory after ${iterations} iterations: ${(memAfterRun - memAfterCreate).toFixed(2)} MB`);
  console.log(`  Total memory used: ${(memAfterRun - memBefore).toFixed(2)} MB`);
}

console.log('\n=== CONCLUSION ===');
console.log('This shows the ACTUAL memory usage pattern during benchmarks.');