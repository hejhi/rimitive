import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalAPI } from './api';
import { createDefaultContext } from './default-context';
import { createSignalFactory, type SignalInterface } from './signal';
import { createComputedFactory, type ComputedInterface } from './computed';
import { createEffectFactory, type EffectDisposer } from './effect';
import { createBatchFactory } from './batch';
import { createSubscribeFactory } from './subscribe';

describe('Computed - Push-Pull Optimization', () => {
  let signal: <T>(value: T) => SignalInterface<T>;
  let computed: <T>(compute: () => T) => ComputedInterface<T>;
  let effect: (fn: () => void | (() => void)) => EffectDisposer;
  let batch: <T>(fn: () => T) => T;

  beforeEach(() => {
    const api = createSignalAPI({
      signal: createSignalFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
      computed: createComputedFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
      effect: createEffectFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
      batch: createBatchFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'batch', <T>(fn: () => T) => T>,
      subscribe: createSubscribeFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'subscribe', unknown>,
    }, createDefaultContext());
    signal = api.signal;
    computed = api.computed;
    effect = api.effect;
    batch = api.batch;
  });

  describe('Lazy Dirty Checking', () => {
    // Push-pull optimization: When signals change, all dependent computeds are marked as 
    // "notified" but not "outdated". When read, computeds check if their sources actually 
    // changed values. If not, they skip recomputation. This is most beneficial for 
    // downstream computeds - if an upstream computed's value doesn't change, all 
    // downstream computeds can skip recomputation entirely.
    it('should recompute to check values but not increment version when output remains same', () => {
      const source = signal(1);
      let computeCount = 0;
      
      const filtered = computed(() => {
        computeCount++;
        const value = source.value;
        return value > 0 ? 1 : 0; // Always returns 1 for positive values
      });

      expect(filtered.value).toBe(1);
      expect(computeCount).toBe(1);

      // Change source but filtered result should remain the same
      source.value = 2;
      expect(filtered.value).toBe(1);
      expect(computeCount).toBe(2); // Must recompute to check if output changed

      // Change to negative should trigger recompute
      source.value = -1;
      expect(filtered.value).toBe(0);
      expect(computeCount).toBe(3);
    });

    it('should skip downstream recomputation when upstream computed values do not change', () => {
      const source = signal(1);
      let level1Count = 0;
      let level2Count = 0;
      let level3Count = 0;

      const level1 = computed(() => {
        level1Count++;
        const value = source.value;
        return value > 0 ? 'positive' : 'negative';
      });

      const level2 = computed(() => {
        level2Count++;
        const value = level1.value;
        return value === 'positive' ? 1 : -1;
      });

      const level3 = computed(() => {
        level3Count++;
        return level2.value * 2;
      });

      expect(level3.value).toBe(2);
      expect(level1Count).toBe(1);
      expect(level2Count).toBe(1);
      expect(level3Count).toBe(1);

      // Change source but level1 output stays 'positive'
      source.value = 2;
      expect(level3.value).toBe(2);
      expect(level1Count).toBe(2); // Must recompute to check
      expect(level2Count).toBe(1); // Should NOT recompute - level1's value didn't change
      expect(level3Count).toBe(1); // Should NOT recompute - level2's value didn't change

      // Change to negative should cascade
      source.value = -1;
      expect(level3.value).toBe(-2);
      expect(level1Count).toBe(3);
      expect(level2Count).toBe(2); // Only computed twice: initial + when source changed to -1
      expect(level3Count).toBe(2); // Only computed twice: initial + when source changed to -1
    });

    it('should skip recomputation when multiple dependencies have unchanged values (diamond)', () => {
      const source = signal(1);
      let leftCount = 0;
      let rightCount = 0;
      let bottomCount = 0;

      const left = computed(() => {
        leftCount++;
        const value = source.value;
        return value % 2 === 0 ? 'even' : 'odd';
      });

      const right = computed(() => {
        rightCount++;
        const value = source.value;
        return value > 10 ? 'big' : 'small';
      });

      const bottom = computed(() => {
        bottomCount++;
        return `${left.value}-${right.value}`;
      });

      expect(bottom.value).toBe('odd-small');
      expect(leftCount).toBe(1);
      expect(rightCount).toBe(1);
      expect(bottomCount).toBe(1);

      // Change to 3 - left stays 'odd', right stays 'small'
      source.value = 3;
      expect(bottom.value).toBe('odd-small');
      expect(leftCount).toBe(2); // Must recompute to check
      expect(rightCount).toBe(2); // Must recompute to check
      expect(bottomCount).toBe(1); // Should NOT recompute - neither dependency's value changed

      // Change to 12 - left changes to 'even', right changes to 'big'
      source.value = 12;
      expect(bottom.value).toBe('even-big');
      expect(leftCount).toBe(3);
      expect(rightCount).toBe(3);
      expect(bottomCount).toBe(2); // Only computed twice: initial + when dependencies actually changed
    });

    it('should NOT run effects when dependent computed values do not change', () => {
      const source = signal(1);
      let computeCount = 0;
      let effectCount = 0;

      const filtered = computed(() => {
        computeCount++;
        const value = source.value;
        return value > 0 ? 1 : 0;
      });

      effect(() => {
        effectCount++;
        // Subscribe to filtered by reading its value
        void filtered.value;
      });

      expect(computeCount).toBe(1);
      expect(effectCount).toBe(1);

      // Change source - computed filters out change, effect should NOT run
      source.value = 2;
      expect(computeCount).toBe(2); // Must recompute to check if output changed
      expect(effectCount).toBe(1); // Effect should NOT run - dependency didn't change!
      
      // Change to negative - computed value changes, effect should run
      source.value = -1;
      expect(computeCount).toBe(3);
      expect(effectCount).toBe(2);
    });

    it('should recompute once when batch updates result in same value', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      let computeCount = 0;

      const sum = computed(() => {
        computeCount++;
        return s1.value + s2.value;
      });

      expect(sum.value).toBe(3);
      expect(computeCount).toBe(1);

      batch(() => {
        s1.value = 2; // +1
        s2.value = 1; // -1
        // Sum stays 3
      });

      expect(sum.value).toBe(3);
      expect(computeCount).toBe(2); // Must recompute to check, but value stays same
    });

    it('should clear invalidated check cache between flushes', () => {
      const source = signal(1);
      let computeCount = 0;

      const computed1 = computed(() => {
        computeCount++;
        return source.value * 2;
      });

      const computed2 = computed(() => {
        return computed1.value + 1;
      });

      expect(computed2.value).toBe(3);
      expect(computeCount).toBe(1);

      // First update
      source.value = 2;
      expect(computed2.value).toBe(5);
      expect(computeCount).toBe(2);

      // Second update - cache should be cleared
      source.value = 3;
      expect(computed2.value).toBe(7);
      expect(computeCount).toBe(3); // Should recompute, not use stale cache
    });
  });
});
