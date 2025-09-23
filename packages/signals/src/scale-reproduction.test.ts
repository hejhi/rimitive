import { describe, it, expect } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createBaseContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
import { createGraphTraversal } from './helpers/graph-traversal';
import { createPullPropagator } from './helpers/pull-propagator';

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

describe('Scale Reproduction - Match Benchmark', () => {
  it('should reproduce the memory pattern from scaling-computed-computed', () => {
    const subscriberCount = 200; // Match benchmark

    // Measure memory before
    if (global.gc) global.gc();
    const memBefore = process.memoryUsage().heapUsed;
    console.log(`Memory before: ${(memBefore / 1024 / 1024).toFixed(2)} MB`);

    // Create API exactly like benchmark
    const api = createApi();
    const signal = api.signal;
    const computed = api.computed;

    // Create first layer - 200 computeds reading signal
    const source = signal(0);
    const firstLayer = Array.from({ length: subscriberCount }, (_, i) =>
      computed(() => {
        const val = source();
        let result = val;
        for (let j = 0; j < 3; j++) {
          result = (result * (i + 1) + j) % 1000007;
        }
        return result;
      })
    );

    // Create second layer - 200 computeds reading first layer
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

    // Force evaluation like benchmark
    source(1);
    secondLayer.forEach(c => c());

    // Measure memory after
    if (global.gc) global.gc();
    const memAfter = process.memoryUsage().heapUsed;
    const memUsed = memAfter - memBefore;
    console.log(`Memory after: ${(memAfter / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Memory used: ${(memUsed / 1024 / 1024).toFixed(2)} MB`);

    // Now update multiple times like the benchmark would
    console.log('\nRunning updates like benchmark:');
    for (let iter = 0; iter < 10; iter++) {
      source(iter);
      secondLayer.forEach(c => c());

      if (global.gc) global.gc();
      const memCurrent = process.memoryUsage().heapUsed;
      const memDelta = memCurrent - memBefore;
      console.log(`After update ${iter + 1}: ${(memDelta / 1024 / 1024).toFixed(2)} MB`);
    }

    // Final measurement
    if (global.gc) global.gc();
    const memFinal = process.memoryUsage().heapUsed;
    const totalUsed = memFinal - memBefore;
    console.log(`\nFinal memory usage: ${(totalUsed / 1024 / 1024).toFixed(2)} MB`);

    // Check if we're seeing the issue
    const expectedHighUsage = totalUsed > 10 * 1024 * 1024; // More than 10MB would indicate the issue
    console.log(`High memory usage detected: ${expectedHighUsage}`);

    // The test itself doesn't fail - we just want to observe
    expect(true).toBe(true);
  });

  it('should measure memory with MITATA-STYLE repeated creation', () => {
    console.log('\n=== MITATA-STYLE TEST ===');

    // This simulates what mitata does - creating nodes multiple times
    const subscriberCount = 200;
    const iterations = 100; // Mitata runs many samples

    if (global.gc) global.gc();
    const memStart = process.memoryUsage().heapUsed;

    // Create a shared API like the benchmark
    const api = createApi();
    const signal = api.signal;
    const computed = api.computed;

    // Simulate mitata creating nodes repeatedly
    for (let iter = 0; iter < iterations; iter++) {
      // Create nodes fresh each iteration like mitata generator
      const source = signal(0);
      const firstLayer = Array.from({ length: subscriberCount }, (_, i) =>
        computed(() => {
          const val = source();
          let result = val;
          for (let j = 0; j < 3; j++) {
            result = (result * (i + 1) + j) % 1000007;
          }
          return result;
        })
      );

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

      // Run the benchmark work
      source(1);
      secondLayer.forEach(c => c());

      // Log memory every 10 iterations
      if ((iter + 1) % 10 === 0) {
        if (global.gc) global.gc();
        const memCurrent = process.memoryUsage().heapUsed;
        const memUsed = (memCurrent - memStart) / 1024 / 1024;
        console.log(`After ${iter + 1} iterations: ${memUsed.toFixed(2)} MB`);
      }
    }

    if (global.gc) global.gc();
    const memEnd = process.memoryUsage().heapUsed;
    const totalMemory = (memEnd - memStart) / 1024 / 1024;
    console.log(`\nTotal memory after ${iterations} iterations: ${totalMemory.toFixed(2)} MB`);
    console.log(`Average per iteration: ${(totalMemory / iterations).toFixed(3)} MB`);

    // This would show the accumulation if it exists
    const hasAccumulation = totalMemory > 10; // More than 10MB indicates accumulation
    console.log(`Memory accumulation detected: ${hasAccumulation}`);

    expect(true).toBe(true);
  });
});