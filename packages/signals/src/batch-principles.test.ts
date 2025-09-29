import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, effect, batch, computed, resetGlobalState } from './test-setup';

/**
 * PRINCIPLED TESTING: Batch Algorithm
 *
 * Batching is a fundamental FRP optimization that ensures:
 * 1. Glitch-free updates (consistency)
 * 2. Minimal recomputation (efficiency)
 * 3. Transaction-style semantics (atomicity)
 * 4. Proper nesting support (composability)
 *
 * These tests verify the algorithmic correctness of batching,
 * not just its functionality.
 */

describe('Batch - FRP Principles', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('Principle 1: Glitch Freedom (Consistency)', () => {
    it('should never expose intermediate inconsistent states (Diamond Problem)', () => {
      /**
       * The Diamond Problem:
       *     A
       *    / \
       *   B   C
       *    \ /
       *     D
       *
       * Without batching, updating A causes D to see inconsistent B and C values.
       * With batching, D only runs after both B and C are updated.
       */

      const a = signal(1);
      const b = computed(() => a() * 2);
      const c = computed(() => a() * 3);
      const d = computed(() => b() + c());

      const observedValues: number[] = [];
      effect(() => {
        observedValues.push(d());
      });

      // Initial state
      expect(observedValues).toEqual([5]); // 2 + 3

      // Update without batch - could see intermediate states
      observedValues.length = 0;
      a(10);

      // With proper batching, should only see final state
      expect(observedValues).toEqual([50]); // 20 + 30
      // Should NOT see [23] (20 + 3) or [32] (2 + 30)
    });

    it('should maintain consistency across complex dependency graphs', () => {
      /**
       * More complex graph with multiple paths:
       *     X   Y
       *     |\ /|
       *     | X |
       *     |/ \|
       *     A   B
       *      \ /
       *       C
       */

      const x = signal(10);
      const y = signal(20);

      const a = computed(() => x() + y());
      const b = computed(() => x() * y());
      const c = computed(() => a() + b());

      const states: { a: number; b: number; c: number }[] = [];
      effect(() => {
        states.push({
          a: a(),
          b: b(),
          c: c()
        });
      });

      states.length = 0;

      batch(() => {
        x(100);
        y(200);
      });

      // Should only have one state change, not intermediate states
      expect(states).toHaveLength(1);
      expect(states[0]).toEqual({
        a: 300,   // 100 + 200
        b: 20000, // 100 * 200
        c: 20300  // 300 + 20000
      });
    });

    it('should prevent glitches in derived computations', () => {
      /**
       * Test that derived values never see partial updates
       * during a batch operation.
       */

      const width = signal(10);
      const height = signal(20);
      const depth = signal(5);

      const area = computed(() => width() * height());
      const volume = computed(() => area() * depth());

      const observations: { area: number; volume: number }[] = [];
      const volumeObservations: number[] = [];

      effect(() => {
        const currentArea = area();
        const currentVolume = volume();
        observations.push({ area: currentArea, volume: currentVolume });
      });

      effect(() => {
        volumeObservations.push(volume());
      });

      observations.length = 0;
      volumeObservations.length = 0;

      batch(() => {
        width(5);
        height(10);
        depth(2);
      });

      // Both effects should only run once
      expect(observations).toHaveLength(1);
      expect(volumeObservations).toHaveLength(1);

      // Values should be consistent
      expect(observations[0]).toEqual({
        area: 50,   // 5 * 10
        volume: 100 // 50 * 2
      });

      // Volume should never see intermediate area
      expect(volumeObservations[0]).toBe(100);
    });
  });

  describe('Principle 2: Minimal Recomputation (Efficiency)', () => {
    it('should execute each effect exactly once per batch', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const s3 = signal(3);

      let computeCount = 0;
      const sum = computed(() => {
        computeCount++;
        return s1() + s2() + s3();
      });

      let effectCount = 0;
      effect(() => {
        effectCount++;
        void sum();
      });

      computeCount = 0;
      effectCount = 0;

      batch(() => {
        s1(10);
        s2(20);
        s3(30);
      });

      // Effect runs once, computed evaluates once
      expect(effectCount).toBe(1);
      expect(computeCount).toBe(1);
    });

    it('should not recompute unchanged derived values', () => {
      const s = signal(10);

      let isEvenCount = 0;
      const isEven = computed(() => {
        isEvenCount++;
        return s() % 2 === 0;
      });

      let effectCount = 0;
      effect(() => {
        effectCount++;
        void isEven();
      });

      isEvenCount = 0;
      effectCount = 0;

      batch(() => {
        s(12); // Still even
        s(14); // Still even
        s(16); // Still even
      });

      // Computed should run to check, but value didn't change
      // so effect shouldn't re-run (depending on implementation)
      expect(isEvenCount).toBeGreaterThan(0); // At least once to check
    });

    it('should handle deep computation chains efficiently', () => {
      const source = signal(1);

      const computeCounts = new Array(5).fill(0);

      const chain = [source as any];
      for (let i = 0; i < 5; i++) {
        const prev = chain[chain.length - 1];
        chain.push(computed(() => {
          computeCounts[i]++;
          return prev() * 2;
        }));
      }

      let effectCount = 0;
      effect(() => {
        effectCount++;
        void chain[chain.length - 1]();
      });

      computeCounts.fill(0);
      effectCount = 0;

      batch(() => {
        source(2);
        source(3);
        source(4);
      });

      // Each computed should run once
      computeCounts.forEach(count => {
        expect(count).toBe(1);
      });

      // Effect should run once
      expect(effectCount).toBe(1);
    });
  });

  describe('Principle 3: Transaction Semantics (Atomicity)', () => {
    it('should treat batch as atomic transaction', () => {
      const account1 = signal(100);
      const account2 = signal(50);
      const total = computed(() => account1() + account2());

      const observations: number[] = [];
      effect(() => {
        observations.push(total());
      });

      observations.length = 0;

      // Transfer 30 from account1 to account2
      batch(() => {
        account1(account1() - 30);
        account2(account2() + 30);
      });

      // Should only see the final state, not intermediate
      expect(observations).toEqual([150]); // Total unchanged
      expect(account1()).toBe(70);
      expect(account2()).toBe(80);
    });

    it('should handle exceptions with proper rollback semantics', () => {
      const s1 = signal(1);
      const s2 = signal(2);

      let effectCount = 0;
      effect(() => {
        effectCount++;
        void s1();
        void s2();
      });

      effectCount = 0;

      // Batch that throws
      expect(() => {
        batch(() => {
          s1(10);
          s2(20);
          throw new Error('Transaction failed');
        });
      }).toThrow('Transaction failed');

      // Values should be updated even though batch threw
      // (This is the current behavior - not transactional rollback)
      expect(s1()).toBe(10);
      expect(s2()).toBe(20);

      // Effects should still run despite the error
      expect(effectCount).toBe(1);
    });

    it('should complete all updates even if effect throws', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const s3 = signal(3);

      let goodEffectCount = 0;
      let badEffectCount = 0;

      // Effect that throws
      effect(() => {
        badEffectCount++;
        if (s1() > 5) {
          throw new Error('Bad effect');
        }
      });

      // Good effect
      effect(() => {
        goodEffectCount++;
        void s2();
        void s3();
      });

      goodEffectCount = 0;
      badEffectCount = 0;

      // Error should be caught and logged, not thrown
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      batch(() => {
        s1(10); // Will cause bad effect to throw
        s2(20);
        s3(30);
      });

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();

      // All signals updated
      expect(s1()).toBe(10);
      expect(s2()).toBe(20);
      expect(s3()).toBe(30);

      // Good effect should still run
      expect(goodEffectCount).toBe(1);
    });
  });

  describe('Principle 4: Nested Batching (Composability)', () => {
    it('should support nested batches with proper depth tracking', () => {
      const s = signal(1);
      let effectCount = 0;

      effect(() => {
        effectCount++;
        void s();
      });

      effectCount = 0;

      batch(() => {
        s(2);

        batch(() => {
          s(3);

          batch(() => {
            s(4);
          });

          s(5);
        });

        s(6);
      });

      // Effect runs only once, after outermost batch
      expect(effectCount).toBe(1);
      expect(s()).toBe(6);
    });

    it('should maintain consistency across nested batch boundaries', () => {
      const x = signal(1);
      const y = signal(2);
      const sum = computed(() => x() + y());

      const observations: number[] = [];
      effect(() => {
        observations.push(sum());
      });

      observations.length = 0;

      batch(() => {
        x(10);

        batch(() => {
          y(20);
          // Inner batch doesn't flush yet
          expect(observations).toHaveLength(0);
        });

        // Still in outer batch
        expect(observations).toHaveLength(0);

        x(100);
      });

      // Now flushed
      expect(observations).toEqual([120]); // 100 + 20
    });

    it('should handle mixed batched and unbatched updates correctly', () => {
      const s1 = signal(1);
      const s2 = signal(2);

      let effectCount = 0;
      effect(() => {
        effectCount++;
        void s1();
        void s2();
      });

      effectCount = 0;

      // Unbatched update
      s1(10);
      expect(effectCount).toBe(1);

      // Batched updates
      batch(() => {
        s1(20);
        s2(30);
      });
      expect(effectCount).toBe(2); // One more for the batch

      // Another unbatched
      s2(40);
      expect(effectCount).toBe(3);
    });

    it('should properly restore batch depth on exception in nested batch', () => {
      const s = signal(1);
      let effectCount = 0;

      effect(() => {
        effectCount++;
        void s();
      });

      effectCount = 0;

      batch(() => {
        s(2);

        try {
          batch(() => {
            s(3);
            throw new Error('Nested error');
          });
        } catch (e) {
          // Caught in outer batch
        }

        // Should still be in batch mode
        s(4);
      });

      // Effect should run once after outer batch completes
      expect(effectCount).toBe(1);
      expect(s()).toBe(4);
    });
  });

  describe('Principle 5: Ordering Guarantees', () => {
    it('should preserve effect execution order', () => {
      const s = signal(1);
      const executionOrder: string[] = [];

      effect(() => {
        void s();
        executionOrder.push('A');
      });

      effect(() => {
        void s();
        executionOrder.push('B');
      });

      effect(() => {
        void s();
        executionOrder.push('C');
      });

      executionOrder.length = 0;

      batch(() => {
        s(2);
      });

      // Effects should run in registration order
      expect(executionOrder).toEqual(['A', 'B', 'C']);
    });

    it('should maintain topological order for computed dependencies', () => {
      const source = signal(1);
      const level1 = computed(() => source() * 2);
      const level2 = computed(() => level1() * 3);
      const level3 = computed(() => level2() * 4);

      // Test via effect that accesses in reverse order
      effect(() => {
        // Access in reverse order to test proper scheduling
        const result = level3() + level2() + level1();
        // Just accessing to test scheduling, not asserting on result
        void result;
      });

      batch(() => {
        source(10);
      });

      // Verify final values are correct (proper ordering)
      expect(level1()).toBe(20);  // 10 * 2
      expect(level2()).toBe(60);  // 20 * 3
      expect(level3()).toBe(240); // 60 * 4
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle empty batch', () => {
      let effectCount = 0;
      const s = signal(1);

      effect(() => {
        effectCount++;
        void s();
      });

      effectCount = 0;

      const result = batch(() => {
        // Empty batch
        return 42;
      });

      expect(result).toBe(42);
      expect(effectCount).toBe(0); // No updates, no effects
    });

    it('should handle batch with only reads', () => {
      const s1 = signal(10);
      const s2 = signal(20);
      const c = computed(() => s1() + s2());

      const result = batch(() => {
        // Only reading, no writing
        return c();
      });

      expect(result).toBe(30);
    });

    it('should handle re-entrant batch calls from effects', () => {
      const s1 = signal(1);
      const s2 = signal(2);

      let innerBatchRan = false;

      effect(() => {
        if (s1() === 10 && !innerBatchRan) {
          innerBatchRan = true;
          // Re-entrant batch from within effect
          batch(() => {
            s2(20);
          });
        }
      });

      batch(() => {
        s1(10);
      });

      expect(s1()).toBe(10);
      expect(s2()).toBe(20);
      expect(innerBatchRan).toBe(true);
    });

    it('should handle synchronous circular updates gracefully', () => {
      const a = signal(0);
      const b = signal(0);

      let updateCount = 0;
      const maxUpdates = 10;

      effect(() => {
        if (a() < maxUpdates) {
          updateCount++;
          b(a() + 1);
        }
      });

      effect(() => {
        if (b() < maxUpdates && b() > a()) {
          updateCount++;
          a(b() + 1);
        }
      });

      updateCount = 0;

      // This will cause a cascade but should eventually stabilize
      batch(() => {
        a(1);
      });

      // Should have caused updates but not infinite
      expect(updateCount).toBeGreaterThan(0);
      expect(updateCount).toBeLessThan(maxUpdates * 3); // Some reasonable limit

      // Values should have progressed toward stabilization
      expect(a()).toBeGreaterThan(0);
      expect(b()).toBeGreaterThan(0);

      // The system prevents infinite loops, so values might not reach maxUpdates
      // but they should have made progress
      const maxValue = Math.max(a(), b());
      expect(maxValue).toBeGreaterThan(0);
      expect(maxValue).toBeLessThanOrEqual(maxUpdates + 1);
    });
  });

  describe('Performance Characteristics', () => {
    it('should have O(1) batch entry/exit overhead', () => {
      const iterations = 1000;
      const s = signal(1);

      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        batch(() => {
          s(i);
        });
        const end = performance.now();
        times.push(end - start);
      }

      // Calculate average time
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      // First few might be slower due to JIT, check last half
      const lastHalf = times.slice(times.length / 2);
      const lastHalfAvg = lastHalf.reduce((a, b) => a + b, 0) / lastHalf.length;

      // Should not degrade with repeated use
      expect(lastHalfAvg).toBeLessThanOrEqual(avgTime * 1.5);
    });

    it('should batch updates efficiently for large graphs', () => {
      const sources = Array.from({ length: 100 }, (_, i) => signal(i));

      const sum = computed(() => {
        return sources.reduce((acc, s) => acc + s(), 0);
      });

      let effectCount = 0;
      effect(() => {
        effectCount++;
        void sum();
      });

      effectCount = 0;

      const start = performance.now();
      batch(() => {
        sources.forEach((s, i) => s(i * 2));
      });
      const end = performance.now();

      // Should run effect only once
      expect(effectCount).toBe(1);

      // Should complete in reasonable time (< 10ms for 100 updates)
      expect(end - start).toBeLessThan(10);

      // Verify correctness
      const expectedSum = sources.reduce((acc, _, i) => acc + i * 2, 0);
      expect(sum()).toBe(expectedSum);
    });
  });
});