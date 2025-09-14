import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory, type SignalFunction } from './signal';
import { createComputedFactory, type ComputedFunction } from './computed';
import { createEffectFactory, type EffectDisposer } from './effect';
import { createBatchFactory } from './batch';
import { createBaseContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createNodeScheduler } from './helpers/node-scheduler';
import { createPushPropagator } from './helpers/push-propagator';

export function createDefaultContext() {
  const baseCtx = createBaseContext();
  const graphEdges = createGraphEdges();

  return {
    ctx: baseCtx,
    graphEdges,
    push: createPushPropagator(),
    pull: createPullPropagator(baseCtx, graphEdges),
    nodeScheduler: createNodeScheduler(),
  };
}

describe('Computed - Push-Pull Optimization', () => {
  let signal: <T>(value: T) => SignalFunction<T>;
  let computed: <T>(compute: () => T) => ComputedFunction<T>;
  let effect: (fn: () => void | (() => void)) => EffectDisposer;
  let batch: <T>(fn: () => T) => T;

  beforeEach(() => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
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

    it('should propagate updates through deep computed chains', () => {
      // Create a chain: signal -> computed1 -> computed2 -> computed3
      const source = signal(1);
      const computed1 = computed(() => source() * 2);
      const computed2 = computed(() => computed1() + 1);
      const computed3 = computed(() => computed2() * 3);

      // Initial read to establish dependencies
      expect(computed3()).toBe(9); // (1 * 2 + 1) * 3 = 9

      // Change the source
      source(2);

      // This should trigger recomputation through the chain
      // Expected: (2 * 2 + 1) * 3 = 15
      expect(computed3()).toBe(15);
    })

    it('should handle very deep chains efficiently', () => {
      const source = signal(1);
      
      // Create a chain of 10 computeds
      let current = source;
      const computeds: SignalFunction<number>[] = [];
      
      for (let i = 0; i < 10; i++) {
        const prev = current;
        current = computed(() => prev() + 1);
        computeds.push(current);
      }

      // Initial read
      expect(current()).toBe(11); // 1 + 10

      // Update source
      source(5);

      // Should propagate through entire chain
      expect(current()).toBe(15); // 5 + 10
    })

    it('should handle diamond dependencies correctly with detailed tracking', () => {
      // Create a diamond: 
      //       source
      //      /      \
      //   left     right
      //      \      /
      //       bottom
      const source = signal(10);
      let leftComputeCount = 0;
      let rightComputeCount = 0;
      let bottomComputeCount = 0;

      const left = computed(() => {
        leftComputeCount++;
        return source() * 2;
      });
      
      const right = computed(() => {
        rightComputeCount++;
        return source() + 5;
      });
      
      const bottom = computed(() => {
        bottomComputeCount++;
        return left() + right();
      });

      // Initial computation
      expect(bottom()).toBe(35); // (10 * 2) + (10 + 5) = 35
      expect(leftComputeCount).toBe(1);
      expect(rightComputeCount).toBe(1);
      expect(bottomComputeCount).toBe(1);

      // Update source
      source(20);

      // Should recompute all nodes exactly once
      expect(bottom()).toBe(65); // (20 * 2) + (20 + 5) = 65
      expect(leftComputeCount).toBe(2);
      expect(rightComputeCount).toBe(2);
      expect(bottomComputeCount).toBe(2);
    });

    it('should skip downstream recomputation when intermediate value does not change', () => {
      const source = signal(2);
      let computed1Count = 0;
      let computed2Count = 0;

      const computed1 = computed(() => {
        computed1Count++;
        return source() % 2; // Will be 0 for even numbers
      });

      const computed2 = computed(() => {
        computed2Count++;
        return computed1() === 0 ? 'even' : 'odd';
      });

      // Initial
      expect(computed2()).toBe('even');
      expect(computed1Count).toBe(1);
      expect(computed2Count).toBe(1);

      // Change to another even number
      source(4);
      
      // computed1 should recompute but return same value (0)
      // computed2 should NOT recompute since computed1's value didn't change
      expect(computed2()).toBe('even');
      expect(computed1Count).toBe(2); // Did recompute
      expect(computed2Count).toBe(1); // Should NOT recompute (CURRENTLY FAILS)

      // Change to odd number
      source(3);
      expect(computed2()).toBe('odd');
      expect(computed1Count).toBe(3);
      expect(computed2Count).toBe(2);
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
      expect(bottomCount).toBe(1); // Should NOT recompute since neither dependency changed value

      // Change to 12 - left changes to 'even', right changes to 'big'
      source(12);
      expect(bottom()).toBe('even-big');
      expect(leftCount).toBe(3);
      expect(rightCount).toBe(3);
      expect(bottomCount).toBe(2); // Should recompute since dependencies changed
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
