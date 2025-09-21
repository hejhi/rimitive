import { describe, it, expect } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createBaseContext } from './context';
import { createScheduler } from './helpers/scheduler';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createGraphTraversal } from './helpers/graph-traversal';

describe('Detached Dependencies Memory Leak', () => {
  function createTestContext() {
    const ctx = createBaseContext();
    const graphEdges = createGraphEdges();
    const { traverseGraph } = createGraphTraversal();

    return {
      ctx,
      ...graphEdges,
      ...createPullPropagator({ ctx, track: graphEdges.track }),
      ...createScheduler({ propagate: traverseGraph }),
    };
  }

  it('should detect if detached dependencies are retained in memory', () => {
    const testCtx = createTestContext();

    // Track all dependency objects ever created
    const allDependencies = new Set<any>();
    let detachCalls = 0;

    // Monitor dependency creation
    const originalTrackDependency = testCtx.trackDependency;
    testCtx.trackDependency = function(producer: any, consumer: any) {
      originalTrackDependency.call(this, producer, consumer);

      // Track all dependencies
      let dep = consumer.dependencies;
      while (dep) {
        allDependencies.add(dep);
        dep = dep.nextDependency;
      }
    };

    // Monitor dependency detachment
    const originalDetachAll = testCtx.detachAll;
    testCtx.detachAll = function(dep: any) {
      detachCalls++;
      console.log(`detachAll called (count: ${detachCalls})`);
      originalDetachAll.call(this, dep);
    };

    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    }, testCtx);

    // Scenario that changes dependencies
    const signal1 = api.signal(1);
    const signal2 = api.signal(2);
    let useFirst = true;

    // Computed that switches dependencies
    const computed = api.computed(() => {
      console.log(`Computed evaluating, useFirst: ${useFirst}`);
      return useFirst ? signal1() : signal2();
    });

    const dispose = api.effect(() => {
      computed();
    });

    const initialDeps = allDependencies.size;
    console.log(`Initial dependencies: ${initialDeps}`);

    // Switch dependencies multiple times
    for (let i = 0; i < 5; i++) {
      console.log(`\n--- Iteration ${i} ---`);
      useFirst = !useFirst;
      console.log(`Switching to use ${useFirst ? 'signal1' : 'signal2'}`);
      signal1(i);
      signal2(i);
      console.log(`Dependencies after switch: ${allDependencies.size}`);
    }

    console.log(`Total dependencies created: ${allDependencies.size}`);
    console.log(`detachAll calls: ${detachCalls}`);

    // Check if we're accumulating dependencies
    const growth = allDependencies.size - initialDeps;
    console.log(`Dependency growth: ${growth}`);

    // We should not be accumulating dependencies
    // If detached dependencies aren't being GC'd, this will fail
    expect(growth).toBe(0);

    dispose();
  });

  it('should show memory retention with many computeds switching deps', () => {
    const testCtx = createTestContext();
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    }, testCtx);

    // Create many signals
    const signals = Array.from({ length: 10 }, (_, i) => api.signal(i));
    let currentIndex = 0;

    // Create many computeds that switch between signals
    const computeds = Array.from({ length: 200 }, () =>
      api.computed(() => signals[currentIndex]!())
    );

    const disposers = computeds.map(c =>
      api.effect(() => { c(); })
    );

    // Force GC
    if (global.gc) {
      global.gc();
    }

    const memBefore = process.memoryUsage().heapUsed;

    // Switch dependencies many times
    for (let i = 0; i < 100; i++) {
      currentIndex = (currentIndex + 1) % signals.length;

      // Update all signals to trigger recomputation
      signals.forEach((s, idx) => s(idx + i));
    }

    // Force GC
    if (global.gc) {
      global.gc();
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memGrowth = (memAfter - memBefore) / 1024 / 1024;

    console.log(`Memory growth with dependency switching: ${memGrowth.toFixed(2)} MB`);

    disposers.forEach(d => d());

    // Should not leak memory even when switching dependencies
    expect(memGrowth).toBeLessThan(1.0);
  });
});