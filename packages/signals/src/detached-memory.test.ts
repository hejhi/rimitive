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

describe.skip('Memory usage investigation', () => {
  it('should measure memory per instance', () => {
    const iterations = 1000;
    const measurements: number[] = [];

    for (let i = 0; i < 5; i++) {
      if (global.gc) global.gc();
      const before = process.memoryUsage().heapUsed;

      const api = createApi();
      const signals = [];
      const computeds = [];

      for (let j = 0; j < iterations; j++) {
        const source = api.signal(0);
        const left = api.computed(() => source() * 2);
        const right = api.computed(() => source() * 3);
        const bottom = api.computed(() => left() + right());

        // Force evaluation
        bottom();

        signals.push(source);
        computeds.push(left, right, bottom);
      }

      const after = process.memoryUsage().heapUsed;
      const perInstance = (after - before) / (iterations * 4); // 4 nodes per iteration
      measurements.push(perInstance);

      console.log(`Iteration ${i + 1}: ${perInstance.toFixed(0)} bytes per node`);
    }

    const avgPerInstance = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    console.log(`Average: ${avgPerInstance.toFixed(0)} bytes per node`);
    console.log(`Total for diamond (4 nodes): ${(avgPerInstance * 4).toFixed(0)} bytes`);

    // Check if it's reasonable (should be < 1KB per node)
    expect(avgPerInstance).toBeLessThan(1000);
  });

  it('should not leak memory across multiple API instances', () => {
    const iterations = 100;
    const measurements: number[] = [];

    for (let i = 0; i < 5; i++) {
      if (global.gc) global.gc();
      const before = process.memoryUsage().heapUsed;

      for (let j = 0; j < iterations; j++) {
        const api = createApi();
        const source = api.signal(0);
        const left = api.computed(() => source() * 2);
        const right = api.computed(() => source() * 3);
        const bottom = api.computed(() => left() + right());

        // Force evaluation
        bottom();

        // API should be garbage collected after this scope
      }

      if (global.gc) global.gc();
      const after = process.memoryUsage().heapUsed;
      const totalUsed = after - before;
      measurements.push(totalUsed);

      console.log(`Iteration ${i + 1}: ${(totalUsed / 1024).toFixed(0)} KB for ${iterations} API instances`);
    }

    // Later iterations should use similar memory (no accumulation)
    const firstMeasurement = measurements[0] ?? 0;
    const lastMeasurement = measurements[measurements.length - 1] ?? 0;
    const ratio = lastMeasurement / firstMeasurement;

    console.log(`Memory stability ratio: ${ratio.toFixed(2)}`);

    // Should be relatively stable (within 50% variance)
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1.5);
  });
});