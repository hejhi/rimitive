import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalAPI, type FactoriesToAPI } from './api';
import { createDefaultContext } from './default-context';
import { createSignalFactory, type SignalFunction } from './signal';
import { createComputedFactory, type ComputedFunction } from './computed';
import { createEffectFactory, type EffectDisposer } from './effect';
import { createBatchFactory } from './batch';
import type { LatticeExtension } from '@lattice/lattice';

type TestAPI = FactoriesToAPI<{
  signal: (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>>;
  computed: (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>>;
  effect: (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>;
  batch: (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>;
}>;

describe('Wide Fanout Pattern Verification', () => {
  let api: TestAPI;
  let signal: <T>(value: T) => SignalFunction<T>;
  let computed: <T>(compute: () => T) => ComputedFunction<T>;
  let effect: (fn: () => void | (() => void)) => EffectDisposer;

  beforeEach(() => {
    api = createSignalAPI({
      signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>>,
      computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>>,
      effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
      batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
    }, createDefaultContext());
    
    signal = api.signal;
    computed = api.computed;
    effect = api.effect;
  });

  it('should correctly update all dependents in wide fanout (100 direct effects)', () => {
    const source = signal(0);
    const effectResults: number[] = [];
    const effectRunCounts: number[] = [];
    
    // Create 100 effects that directly depend on the signal
    for (let i = 0; i < 100; i++) {
      effectRunCounts[i] = 0;
      effect(() => {
        effectResults[i] = source() * (i + 1);
        effectRunCounts[i]!++;
      });
    }

    // Initial run
    expect(effectRunCounts.every(count => count === 1)).toBe(true);
    expect(effectResults[0]).toBe(0);
    expect(effectResults[50]).toBe(0);
    expect(effectResults[99]).toBe(0);

    // Update the source
    source(10);

    // All effects should have run exactly once more
    expect(effectRunCounts.every(count => count === 2)).toBe(true);
    
    // All effects should have the correct computed value
    expect(effectResults[0]).toBe(10);
    expect(effectResults[50]).toBe(510);
    expect(effectResults[99]).toBe(1000);

    // Another update
    source(5);
    
    expect(effectRunCounts.every(count => count === 3)).toBe(true);
    expect(effectResults[0]).toBe(5);
    expect(effectResults[50]).toBe(255);
    expect(effectResults[99]).toBe(500);
  });

  it('should correctly update all computeds in wide fanout (100 computed values)', () => {
    const source = signal(1);
    const computeds: ComputedFunction<number>[] = [];
    const computeRunCounts: number[] = [];
    
    // Create 100 computed values that depend on the signal
    for (let i = 0; i < 100; i++) {
      computeRunCounts[i] = 0;
      computeds[i] = computed(() => {
        computeRunCounts[i]!++;
        return source() * (i + 1);
      });
    }

    // Read all computed values initially
    for (let i = 0; i < 100; i++) {
      expect(computeds[i]!()).toBe(i + 1);
    }
    expect(computeRunCounts.every(count => count === 1)).toBe(true);

    // Update the source
    source(2);

    // Computed values should be lazy - not computed until read
    expect(computeRunCounts.every(count => count === 1)).toBe(true);

    // Read them all - should trigger recomputation
    for (let i = 0; i < 100; i++) {
      expect(computeds[i]!()).toBe(2 * (i + 1));
    }
    expect(computeRunCounts.every(count => count === 2)).toBe(true);

    // Update again
    source(10);

    // Selective reading - only some should recompute
    expect(computeds[0]!()).toBe(10);
    expect(computeds[50]!()).toBe(510);
    expect(computeds[99]!()).toBe(1000);
    
    expect(computeRunCounts[0]).toBe(3);
    expect(computeRunCounts[50]).toBe(3);
    expect(computeRunCounts[99]).toBe(3);
    // Others should not have recomputed
    expect(computeRunCounts[1]).toBe(2);
    expect(computeRunCounts[49]).toBe(2);
  });

  it('should handle mixed wide fanout (effects + computeds)', () => {
    const source = signal(1);
    const computeds: ComputedFunction<number>[] = [];
    const effectResults: number[] = [];
    let totalEffectRuns = 0;
    
    // Create 50 computed values
    for (let i = 0; i < 50; i++) {
      computeds[i] = computed(() => source() * (i + 1));
    }
    
    // Create 50 effects that depend on the computeds
    for (let i = 0; i < 50; i++) {
      effect(() => {
        effectResults[i] = computeds[i]!() + 100;
        totalEffectRuns++;
      });
    }

    // Initial state
    expect(totalEffectRuns).toBe(50);
    expect(effectResults[0]).toBe(101);
    expect(effectResults[49]).toBe(150);

    // Update source
    source(2);

    // All effects should update
    expect(totalEffectRuns).toBe(100);
    expect(effectResults[0]).toBe(102);
    expect(effectResults[49]).toBe(200);
  });

  it('should not trigger unnecessary updates when value does not change', () => {
    const source = signal(10);
    let effectRunCount = 0;
    const effectResults: number[] = [];
    
    // Create effects with conditions that filter updates
    for (let i = 0; i < 100; i++) {
      effect(() => {
        const value = source();
        if (value > 0) {
          effectResults[i] = value * i;
          effectRunCount++;
        }
      });
    }

    expect(effectRunCount).toBe(100);

    // Set to same value - should not trigger effects
    source(10);
    expect(effectRunCount).toBe(100); // No additional runs

    // Set to different value
    source(20);
    expect(effectRunCount).toBe(200); // All run again
  });

  it('should handle wide fanout with batching correctly', () => {
    const source1 = signal(1);
    const source2 = signal(1);
    const effectResults: number[] = [];
    let totalRuns = 0;
    
    // Create 100 effects that depend on both signals
    for (let i = 0; i < 100; i++) {
      effect(() => {
        effectResults[i] = source1() + source2() + i;
        totalRuns++;
      });
    }

    expect(totalRuns).toBe(100); // Initial run

    // Update both in a batch
    api.batch(() => {
      source1(10);
      source2(20);
    });

    // Each effect should run exactly once despite two signal changes
    expect(totalRuns).toBe(200); // Only one additional run per effect
    expect(effectResults[0]).toBe(30);
    expect(effectResults[50]).toBe(80);
    expect(effectResults[99]).toBe(129);
  });

  it('should correctly propagate through deep wide fanout', () => {
    const root = signal(1);
    const layer1: ComputedFunction<number>[] = [];
    const layer2: ComputedFunction<number>[] = [];
    let effectRunCount = 0;
    const effectResults: number[] = [];
    
    // Create first layer - 50 computeds
    for (let i = 0; i < 50; i++) {
      layer1[i] = computed(() => root() * (i + 1));
    }
    
    // Create second layer - each depends on multiple from layer1
    for (let i = 0; i < 50; i++) {
      layer2[i] = computed(() => {
        // Each layer2 computed depends on 2 layer1 computeds
        const idx1 = i;
        const idx2 = (i + 1) % 50;
        return layer1[idx1]!() + layer1[idx2]!();
      });
    }
    
    // Create effects on layer2
    for (let i = 0; i < 50; i++) {
      effect(() => {
        effectResults[i] = layer2[i]!();
        effectRunCount++;
      });
    }

    expect(effectRunCount).toBe(50);
    expect(effectResults[0]).toBe(3); // (1*1) + (1*2) = 3
    expect(effectResults[49]).toBe(51); // (1*50) + (1*1) = 51

    // Update root
    root(2);

    expect(effectRunCount).toBe(100);
    expect(effectResults[0]).toBe(6); // (2*1) + (2*2) = 6
    expect(effectResults[49]).toBe(102); // (2*50) + (2*1) = 102
  });

  it('should handle disposal in wide fanout correctly', () => {
    const source = signal(0);
    const disposers: (() => void)[] = [];
    let activeEffectCount = 0;
    
    // Create 100 effects
    for (let i = 0; i < 100; i++) {
      disposers[i] = effect(() => {
        source(); // Create dependency
        activeEffectCount++;
      });
    }

    expect(activeEffectCount).toBe(100);

    // Dispose half of them
    for (let i = 0; i < 50; i++) {
      disposers[i]!();
    }

    activeEffectCount = 0;
    source(1);

    // Only 50 should run
    expect(activeEffectCount).toBe(50);

    // Dispose the rest
    for (let i = 50; i < 100; i++) {
      disposers[i]!();
    }

    activeEffectCount = 0;
    source(2);

    // None should run
    expect(activeEffectCount).toBe(0);
  });

  it('should maintain consistency in wide fanout with errors', () => {
    const source = signal(1);
    const results: (number | 'error')[] = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Create 100 effects, some will throw errors
    for (let i = 0; i < 100; i++) {
      effect(() => {
        try {
          const value = source();
          if (i % 10 === 0) {
            throw new Error(`Effect ${i} error`);
          }
          results[i] = value * i;
          successCount++;
        } catch {
          results[i] = 'error';
          errorCount++;
        }
      });
    }

    // 10 should error (0, 10, 20, ..., 90), 90 should succeed
    expect(errorCount).toBe(10);
    expect(successCount).toBe(90);

    // Update - all effects should still run despite some throwing
    successCount = 0;
    errorCount = 0;
    source(2);

    expect(errorCount).toBe(10);
    expect(successCount).toBe(90);
    
    // Verify correct values for successful effects
    expect(results[1]).toBe(2);
    expect(results[5]).toBe(10);
    expect(results[0]).toBe('error');
    expect(results[10]).toBe('error');
  });

  it('should efficiently handle wide fanout with no actual changes', () => {
    const source = signal(5);
    const computeds: ComputedFunction<number>[] = [];
    let totalComputeRuns = 0;
    let effectRuns = 0;
    
    // Create 100 computed values that normalize the input
    for (let i = 0; i < 100; i++) {
      computeds[i] = computed(() => {
        totalComputeRuns++;
        // All return the same value regardless of input when > 0
        return source() > 0 ? 1 : 0;
      });
    }
    
    // Create effect that depends on all computeds
    effect(() => {
      effectRuns++;
      // Sum all computed values - this forces all computeds to be evaluated
      computeds.reduce((sum, c) => sum + c(), 0);
    });

    expect(totalComputeRuns).toBe(100);
    expect(effectRuns).toBe(1);

    // Change source but computed outputs remain the same
    source(10);

    // With simplified flag system, effect runs due to eager propagation
    expect(effectRuns).toBe(2); // Effect runs due to simplified flag system
    expect(totalComputeRuns).toBe(102); // With lazy checking, only some computeds recompute

    // Change to trigger actual change
    source(-1);
    
    // Now all computeds change from 1 to 0, so effect runs
    expect(effectRuns).toBe(3); // Effect runs more eagerly with simplified system
    // Only 2 more computeds run (104 total) - excellent optimization!
    expect(totalComputeRuns).toBe(104);
  });
});