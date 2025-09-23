#!/usr/bin/env node

// Test to verify if Lattice API retains memory between benchmark iterations

import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';

function createApi() {
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
}

// Create a single API instance (like the benchmark does)
const api = createApi();
const signal = api.signal;
const computed = api.computed;

console.log('Testing memory retention across iterations...\n');

// Force garbage collection
if (global.gc) {
  global.gc();
}

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Initial memory
const initialMemory = process.memoryUsage().heapUsed;
console.log('Initial heap:', formatBytes(initialMemory));

// Run 10 iterations, creating new signals each time
for (let iter = 0; iter < 10; iter++) {
  // Create diamond dependency graph
  const source = signal(0);
  const left = computed(() => source() * 2);
  const right = computed(() => source() * 3);
  const bottom = computed(() => left() + right());

  // Run updates
  for (let i = 0; i < 10000; i++) {
    source(i);
    bottom(); // Force evaluation
  }

  // Measure memory after each iteration
  if (global.gc) global.gc();
  const currentMemory = process.memoryUsage().heapUsed;
  const delta = currentMemory - initialMemory;
  console.log(`Iteration ${iter + 1}: heap = ${formatBytes(currentMemory)}, delta = ${formatBytes(delta)}`);
}

console.log('\nCreating new API instance each iteration...\n');

// Reset
if (global.gc) global.gc();
const resetMemory = process.memoryUsage().heapUsed;
console.log('Reset heap:', formatBytes(resetMemory));

// Now test with fresh API each iteration
for (let iter = 0; iter < 10; iter++) {
  // Create fresh API each time
  const freshApi = createApi();
  const freshSignal = freshApi.signal;
  const freshComputed = freshApi.computed;

  // Create diamond dependency graph
  const source = freshSignal(0);
  const left = freshComputed(() => source() * 2);
  const right = freshComputed(() => source() * 3);
  const bottom = freshComputed(() => left() + right());

  // Run updates
  for (let i = 0; i < 10000; i++) {
    source(i);
    bottom(); // Force evaluation
  }

  // Measure memory after each iteration
  if (global.gc) global.gc();
  const currentMemory = process.memoryUsage().heapUsed;
  const delta = currentMemory - resetMemory;
  console.log(`Iteration ${iter + 1}: heap = ${formatBytes(currentMemory)}, delta = ${formatBytes(delta)}`);
}