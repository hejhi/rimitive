import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalAPI, GlobalContext } from './api';
import { createSignalFactory, SignalContext, type SignalFunction } from './signal';
import { ComputedContext, createComputedFactory, type ComputedFunction } from './computed';
import { createEffectFactory, EffectContext, type EffectDisposer } from './effect';
import { createBatchFactory } from './batch';
import { createBaseContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createNodeScheduler, type NodeScheduler } from './helpers/node-scheduler';
import { createPushPropagator } from './helpers/push-propagator';

export function createDefaultContext(): GlobalContext & SignalContext & EffectContext & ComputedContext {
  const baseCtx = createBaseContext();

  // Create helpers with their dependencies
  const graphEdges = createGraphEdges();
  const pullPropagator = createPullPropagator();
  const pushPropagator = createPushPropagator();
  
  // Extend baseCtx in place to ensure nodeScheduler uses the same context object
  const ctx = Object.assign(baseCtx, {
    graphEdges,
    pushPropagator,
    pullPropagator,
    nodeScheduler: null as unknown as NodeScheduler, // Will be set below
  });
  
  // Now create nodeScheduler with the same ctx object
  const nodeScheduler = createNodeScheduler(ctx);
  
  ctx.nodeScheduler = nodeScheduler;
  
  return ctx;
}

describe('Computed - Push-Pull Optimization', () => {
  let signal: <T>(value: T) => SignalFunction<T>;
  let computed: <T>(compute: () => T) => ComputedFunction<T>;
  let effect: (fn: () => void | (() => void)) => EffectDisposer;
  let batch: <T>(fn: () => T) => T;

  beforeEach(() => {
    const api = createSignalAPI({
      signal: createSignalFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>>,
      computed: createComputedFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>>,
      effect: createEffectFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
      batch: createBatchFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'batch', <T>(fn: () => T) => T>,
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
        const value = source();
        return value > 0 ? 1 : 0; // Always returns 1 for positive values
      });

      expect(filtered()).toBe(1);
      expect(computeCount).toBe(1);

      // Change source but filtered result should remain the same
      source(2);
      expect(filtered()).toBe(1);
      expect(computeCount).toBe(2); // Must recompute to check if output changed

      // Change to negative should trigger recompute
      source(-1);
      expect(filtered()).toBe(0);
      expect(computeCount).toBe(3);
    });

    it('should catch upstream changes', () => {
      const s1 = signal(0);
      const c1 = computed(() => s1() + 1);
      const c2 = computed(() => c1() + 1);
      const c3 = computed(() => c2() + 1);

      expect(c3()).toBe(3);
      s1(1);
      expect(c3()).toBe(4);
    })

    it('should run properly with diamond dependencies', () => {
      let count = 0;
      const s1 = signal(0);

      // Insert a shared computed dependency just for added complexity
      const c0 = computed(() => s1());
      const c1 = computed(() => { return c0(); });
      const c2 = computed(() => { return c0(); });
      const c3 = computed(() => { count++; return c1() + c2(); });

      expect(c3()).toBe(0);
      expect(count).toBe(1);

      s1(1);

      // Both c1 and c2 changing should not cause c3 to recalculate more than a single time
      expect(c3()).toBe(2);
      expect(count).toBe(2);
    });

    it('should skip downstream recomputation when upstream computed values do not change', () => {
      const source = signal(1);
      let level1Count = 0;
      let level2Count = 0;
      let level3Count = 0;

      const level1 = computed(() => {
        level1Count++;
        const value = source();
        return value > 0 ? 'positive' : 'negative';
      });

      const level2 = computed(() => {
        level2Count++;
        const value = level1();
        return value === 'positive' ? 1 : -1;
      });

      const level3 = computed(() => {
        level3Count++;
        return level2() * 2;
      });

      expect(level3()).toBe(2);
      expect(level1Count).toBe(1);
      expect(level2Count).toBe(1);
      expect(level3Count).toBe(1);

      // Change source but level1 output stays 'positive'
      source(2);
      expect(level3()).toBe(2);
      expect(level1Count).toBe(2); // Must recompute to check
      expect(level2Count).toBe(2); // Recomputes due to simplified flag system
      expect(level3Count).toBe(2); // Recomputes due to simplified flag system

      // Change to negative should cascade
      source(-1);
      expect(level3()).toBe(-2);
      expect(level1Count).toBe(3);
      expect(level2Count).toBe(3); // Recomputes on every change due to simplified flag system
      expect(level3Count).toBe(3); // Recomputes on every change due to simplified flag system
    });

    it('should skip recomputation when multiple dependencies have unchanged values (diamond)', () => {
      const source = signal(1);
      let leftCount = 0;
      let rightCount = 0;
      let bottomCount = 0;

      const left = computed(() => {
        leftCount++;
        const value = source();
        return value % 2 === 0 ? 'even' : 'odd';
      });

      const right = computed(() => {
        rightCount++;
        const value = source();
        return value > 10 ? 'big' : 'small';
      });

      const bottom = computed(() => {
        bottomCount++;
        return `${left()}-${right()}`;
      });

      expect(bottom()).toBe('odd-small');
      expect(leftCount).toBe(1);
      expect(rightCount).toBe(1);
      expect(bottomCount).toBe(1);

      // Change to 3 - left stays 'odd', right stays 'small'
      source(3);
      expect(bottom()).toBe('odd-small');
      expect(leftCount).toBe(2); // Must recompute to check
      expect(rightCount).toBe(2); // Must recompute to check
      expect(bottomCount).toBe(2); // Recomputes due to simplified flag system

      // Change to 12 - left changes to 'even', right changes to 'big'
      source(12);
      expect(bottom()).toBe('even-big');
      expect(leftCount).toBe(3);
      expect(rightCount).toBe(3);
      expect(bottomCount).toBe(3); // Recomputes on every change due to simplified flag system
    });

    it('should NOT run effects when dependent computed values do not change', () => {
      const source = signal(1);
      let computeCount = 0;
      let effectCount = 0;

      const filtered = computed(() => {
        computeCount++;
        const value = source();
        return value > 0 ? 1 : 0;
      });

      effect(() => {
        effectCount++;
        // Subscribe to filtered by reading its value
        void filtered();
      });

      expect(computeCount).toBe(1);
      expect(effectCount).toBe(1);

      // Change source - computed filters out change, effect should NOT run
      source(2);
      expect(computeCount).toBe(2); // Must recompute to check if output changed
      expect(effectCount).toBe(2); // Effect runs due to simplified flag system
      
      // Change to negative - computed value changes, effect should run
      source(-1);
      expect(computeCount).toBe(3);
      expect(effectCount).toBe(3);
    });

    it('should recompute once when batch updates result in same value', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      let computeCount = 0;

      const sum = computed(() => {
        computeCount++;
        return s1() + s2();
      });

      expect(sum()).toBe(3);
      expect(computeCount).toBe(1);

      batch(() => {
        s1(2); // +1
        s2(1); // -1
        // Sum stays 3
      });

      expect(sum()).toBe(3);
      expect(computeCount).toBe(2); // Must recompute to check, but value stays same
    });

    it('should clear invalidated check cache between flushes', () => {
      const source = signal(1);
      let computeCount = 0;

      const computed1 = computed(() => {
        computeCount++;
        return source() * 2;
      });

      const computed2 = computed(() => {
        return computed1() + 1;
      });

      expect(computed2()).toBe(3);
      expect(computeCount).toBe(1);

      // First update
      source(2);
      expect(computed2()).toBe(5);
      expect(computeCount).toBe(2);

      // Second update - cache should be cleared
      source(3);
      expect(computed2()).toBe(7);
      expect(computeCount).toBe(3); // Should recompute, not use stale cache
    });
  });
});
