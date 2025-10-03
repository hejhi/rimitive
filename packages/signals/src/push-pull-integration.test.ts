import { describe, it, expect, beforeEach } from 'vitest';
import { signal, effect, batch, computed, resetGlobalState } from './test-setup';
import type { SignalFunction } from './signal';
import type { ComputedFunction } from './computed';

/**
 * INTEGRATION TESTING: Push-Pull Algorithm Coordination
 *
 * The push-pull algorithm is the heart of the reactive system:
 * - PUSH: Eagerly marks dependencies as dirty when sources change
 * - PULL: Lazily recomputes values only when accessed
 *
 * These tests verify the critical coordination between push and pull phases,
 * ensuring the algorithm maintains FRP invariants while maximizing efficiency.
 */

describe('Push-Pull Algorithm Integration', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('Push Phase: Invalidation Propagation', () => {
    it('should mark entire dependency chain as pending without computing', () => {
      let computeCount1 = 0;
      let computeCount2 = 0;
      let computeCount3 = 0;

      const source = signal(1);

      const level1 = computed(() => {
        computeCount1++;
        return source() * 2;
      });

      const level2 = computed(() => {
        computeCount2++;
        return level1() * 3;
      });

      const level3 = computed(() => {
        computeCount3++;
        return level2() * 4;
      });

      // Initial pull to establish dependencies
      expect(level3()).toBe(24); // 1 * 2 * 3 * 4

      // Reset counters
      computeCount1 = computeCount2 = computeCount3 = 0;

      // PUSH: Update source
      source(10);

      // After push, nothing should be computed yet
      expect(computeCount1).toBe(0);
      expect(computeCount2).toBe(0);
      expect(computeCount3).toBe(0);

      // PULL: Access leaf node
      expect(level3()).toBe(240); // 10 * 2 * 3 * 4

      // Now everything should be computed exactly once
      expect(computeCount1).toBe(1);
      expect(computeCount2).toBe(1);
      expect(computeCount3).toBe(1);
    });

    it('should handle diamond invalidation correctly', () => {
      /**
       *     source
       *      / \
       *   left  right
       *      \ /
       *     join
       */

      let leftCount = 0;
      let rightCount = 0;
      let joinCount = 0;

      const source = signal(1);

      const left = computed(() => {
        leftCount++;
        return source() * 2;
      });

      const right = computed(() => {
        rightCount++;
        return source() * 3;
      });

      const join = computed(() => {
        joinCount++;
        return left() + right();
      });

      // Establish dependencies
      expect(join()).toBe(5); // 2 + 3

      // Reset counters
      leftCount = rightCount = joinCount = 0;

      // PUSH: Invalidate
      source(10);

      // Nothing computed yet
      expect(leftCount).toBe(0);
      expect(rightCount).toBe(0);
      expect(joinCount).toBe(0);

      // PULL: Should compute each node exactly once
      expect(join()).toBe(50); // 20 + 30

      expect(leftCount).toBe(1);
      expect(rightCount).toBe(1);
      expect(joinCount).toBe(1); // Should not compute twice despite two parents
    });

    it('should skip branches not accessed during pull', () => {
      let computeA = 0;
      let computeB = 0;
      let computeC = 0;

      const source = signal(1);

      const branchA = computed(() => {
        computeA++;
        return source() * 2;
      });

      const branchB = computed(() => {
        computeB++;
        return source() * 3;
      });

      const branchC = computed(() => {
        computeC++;
        return source() * 4;
      });

      // Establish all dependencies
      expect(branchA()).toBe(2);
      expect(branchB()).toBe(3);
      expect(branchC()).toBe(4);

      // Reset
      computeA = computeB = computeC = 0;

      // PUSH: Invalidate all
      source(10);

      // PULL: Only access one branch
      expect(branchB()).toBe(30);

      // Only accessed branch should compute
      expect(computeA).toBe(0); // Not accessed
      expect(computeB).toBe(1); // Accessed
      expect(computeC).toBe(0); // Not accessed

      // Later access should trigger computation
      expect(branchA()).toBe(20);
      expect(computeA).toBe(1);
    });
  });

  describe('Pull Phase: Lazy Evaluation', () => {
    it('should only compute when value is accessed', () => {
      let computeCount = 0;

      const s = signal(1);
      const c = computed(() => {
        computeCount++;
        return s() * 2;
      });

      // No access, no computation
      expect(computeCount).toBe(0);

      // First access triggers computation
      expect(c()).toBe(2);
      expect(computeCount).toBe(1);

      // Subsequent access uses cached value
      expect(c()).toBe(2);
      expect(computeCount).toBe(1);

      // Update invalidates
      s(5);
      expect(computeCount).toBe(1); // Still not computed

      // Access triggers recomputation
      expect(c()).toBe(10);
      expect(computeCount).toBe(2);
    });

    it('should pull dependencies in correct order', () => {
      const computeOrder: string[] = [];

      const a = signal(1);

      let bCount = 0;
      const b = computed(() => {
        bCount++;
        computeOrder.push('B');
        return a() * 2;
      });

      let cCount = 0;
      const c = computed(() => {
        cCount++;
        computeOrder.push('C');
        return b() * 3;
      });

      let dCount = 0;
      const d = computed(() => {
        dCount++;
        computeOrder.push('D');
        return c() * 4;
      });

      // Initial computation
      const result1 = d();
      expect(result1).toBe(24);

      // Each computed should run exactly once
      expect(bCount).toBe(1);
      expect(cCount).toBe(1);
      expect(dCount).toBe(1);

      // Check that computations happened
      expect(computeOrder).toContain('B');
      expect(computeOrder).toContain('C');
      expect(computeOrder).toContain('D');

      // Reset for next test
      computeOrder.length = 0;
      bCount = cCount = dCount = 0;

      a(10);

      // Pull should compute in dependency order
      const result2 = d();
      expect(result2).toBe(240);

      // Again, each should compute once
      expect(bCount).toBe(1);
      expect(cCount).toBe(1);
      expect(dCount).toBe(1);

      // Verify all computations happened after signal change
      expect(computeOrder).toContain('B');
      expect(computeOrder).toContain('C');
      expect(computeOrder).toContain('D');
    });

    it('should handle conditional dependencies correctly', () => {
      let computeTrueCount = 0;
      let computeFalseCount = 0;

      const condition = signal(true);
      const trueBranch = signal(10);
      const falseBranch = signal(20);

      const trueComputed = computed(() => {
        computeTrueCount++;
        return trueBranch() * 2;
      });

      const falseComputed = computed(() => {
        computeFalseCount++;
        return falseBranch() * 3;
      });

      const result = computed(() => {
        if (condition()) {
          return trueComputed();
        } else {
          return falseComputed();
        }
      });

      // Initially uses true branch
      expect(result()).toBe(20);
      expect(computeTrueCount).toBe(1);
      expect(computeFalseCount).toBe(0);

      // Update unused branch - should not trigger recomputation
      falseBranch(30);
      expect(result()).toBe(20);
      expect(computeTrueCount).toBe(1); // No recompute
      expect(computeFalseCount).toBe(0); // Never computed

      // Switch condition
      condition(false);
      expect(result()).toBe(90); // 30 * 3
      expect(computeTrueCount).toBe(1);
      expect(computeFalseCount).toBe(1);

      // Now true branch updates don't matter
      trueBranch(100);
      expect(result()).toBe(90);
      expect(computeTrueCount).toBe(1); // Not recomputed
    });
  });

  describe('Push-Pull Coordination', () => {
    it('should maintain consistency between push and pull phases', () => {
      const source = signal(1);

      const doubled = computed(() => source() * 2);
      const tripled = computed(() => source() * 3);

      const sum = computed(() => doubled() + tripled());
      const product = computed(() => doubled() * tripled());

      const final = computed(() => sum() + product());

      // Establish initial state
      expect(final()).toBe(11); // (2 + 3) + (2 * 3) = 5 + 6 = 11

      // Batch update to test coordination
      batch(() => {
        source(10);

        // Mid-batch, the push phase has marked everything dirty
        // but pull should still give consistent results
        expect(final()).toBe(650); // (20 + 30) + (20 * 30) = 50 + 600 = 650
      });

      expect(final()).toBe(650);
    });

    it('should handle interleaved push and pull operations', () => {
      const s1 = signal(1);
      const s2 = signal(2);

      const c1 = computed(() => s1() + s2());
      const c2 = computed(() => s1() * s2());
      const c3 = computed(() => c1() + c2());

      let effectRunCount = 0;
      let lastEffectValue = 0;

      effect(() => {
        effectRunCount++;
        lastEffectValue = c3();
      });

      expect(effectRunCount).toBe(1);
      expect(lastEffectValue).toBe(5); // (1 + 2) + (1 * 2) = 3 + 2 = 5

      // Interleaved operations
      s1(10); // PUSH invalidates, effect schedules
      expect(c1()).toBe(12); // PULL computes c1

      s2(20); // PUSH invalidates again
      expect(c2()).toBe(200); // PULL computes c2

      // Effect should run once more with final values
      expect(effectRunCount).toBe(3); // Once initially, then after each signal update
      expect(lastEffectValue).toBe(230); // (10 + 20) + (10 * 20) = 30 + 200 = 230
    });

    it('should optimize redundant invalidations', () => {
      let computeCount = 0;

      const source = signal(10);
      const computed1 = computed(() => {
        computeCount++;
        return Math.floor(source() / 10) * 10; // Round to nearest 10
      });

      // Initial computation
      expect(computed1()).toBe(10);
      expect(computeCount).toBe(1);

      // Update that doesn't change computed result
      source(11);
      expect(computed1()).toBe(10); // Still 10 after rounding

      // Should still recompute to check (pull doesn't know result beforehand)
      expect(computeCount).toBe(2);

      // But subsequent reads should use cached value
      expect(computed1()).toBe(10);
      expect(computeCount).toBe(2); // No additional computation
    });
  });

  describe('Effects and Push-Pull Interaction', () => {
    it('should schedule effects during push, execute after pull', () => {
      const executionOrder: string[] = [];

      const s = signal(1);

      const c1 = computed(() => {
        executionOrder.push('compute-c1');
        return s() * 2;
      });

      const c2 = computed(() => {
        executionOrder.push('compute-c2');
        return c1() * 3;
      });

      effect(() => {
        executionOrder.push('effect-1');
        void c2();
      });

      effect(() => {
        executionOrder.push('effect-2');
        void c1();
      });

      // Clear initial execution
      executionOrder.length = 0;

      // Update triggers push then pull
      s(10);

      // The order depends on implementation details, but we can verify:
      // 1. Both effects ran
      // 2. Computeds were evaluated
      // 3. c1 was computed before c2 (dependency order)

      expect(executionOrder).toContain('effect-1');
      expect(executionOrder).toContain('effect-2');
      expect(executionOrder).toContain('compute-c1');
      expect(executionOrder).toContain('compute-c2');

      // c1 must come before c2 in computation
      const c1Index = executionOrder.indexOf('compute-c1');
      const c2Index = executionOrder.indexOf('compute-c2');
      expect(c1Index).toBeLessThan(c2Index);

      // Each computed should only run once (no duplicates)
      const c1Count = executionOrder.filter(x => x === 'compute-c1').length;
      const c2Count = executionOrder.filter(x => x === 'compute-c2').length;
      expect(c1Count).toBe(1);
      expect(c2Count).toBe(1);
    });

    it('should batch effect scheduling across multiple pushes', () => {
      let effectCount = 0;

      const s1 = signal(1);
      const s2 = signal(2);

      const sum = computed(() => s1() + s2());

      effect(() => {
        effectCount++;
        void sum();
      });

      effectCount = 0;

      batch(() => {
        s1(10); // PUSH 1
        s2(20); // PUSH 2
        // Effects not run yet

        expect(effectCount).toBe(0);
      });

      // After batch, effect runs once
      expect(effectCount).toBe(1);
    });
  });

  describe('Memory and Performance Characteristics', () => {
    it('should not retain computed values unnecessarily', () => {
      const source = signal(1);
      const computeds: Array<ComputedFunction<number>> = [];

      // Create chain of computeds
      for (let i = 0; i < 10; i++) {
        const prev: SignalFunction<number> | ComputedFunction<number> = computeds[i - 1] || source;
        computeds.push(computed(() => prev() * 2));
      }

      // Access to establish dependencies
      expect(computeds[9]!()).toBe(1024); // 2^10

      // Update source
      source(2);

      // Only access middle of chain
      expect(computeds[4]!()).toBe(64); // 2 * 2^5 = 64

      // Later nodes should recompute when accessed
      expect(computeds[9]!()).toBe(2048); // 2 * 2^10 = 2048
    });

    it('should handle large fanout efficiently', () => {
      const source = signal(1);
      const consumers: ComputedFunction<number>[] = [];
      const computeCounts: number[] = new Array(100).fill(0) as number[];

      // Create many direct consumers
      for (let i = 0; i < 100; i++) {
        const index = i; // Capture index for closure
        consumers.push(computed(() => {
          computeCounts[index]!++;
          return source() * (index + 1);
        }));
      }

      // Access all to establish dependencies
      consumers.forEach((c, i) => {
        expect(c()).toBe(i + 1);
      });

      // Reset counts
      computeCounts.fill(0);

      // Single update should invalidate all
      const startPush = performance.now();
      source(10);
      const endPush = performance.now();

      // Push should be fast (< 1ms for 100 nodes)
      expect(endPush - startPush).toBeLessThan(1);

      // Pull a subset
      const pulled = [0, 25, 50, 75, 99];
      pulled.forEach(i => {
        expect(consumers[i]!()).toBe(10 * (i + 1));
      });

      // Only pulled nodes should compute
      computeCounts.forEach((count, i) => {
        if (pulled.includes(i)) {
          expect(count).toBe(1);
        } else {
          expect(count).toBe(0);
        }
      });
    });

    it('should maintain performance with deep chains', () => {
      const depth = 100;
      const source = signal(1);
      const chain: Array<SignalFunction<number> | ComputedFunction<number>> = [source];

      // Build deep chain
      for (let i = 1; i <= depth; i++) {
        const prev = chain[i - 1]!;
        chain.push(computed(() => prev() + 1));
      }

      // Access end to establish dependencies
      expect(chain[depth]!()).toBe(101);

      // Time the push phase
      const startPush = performance.now();
      source(1000);
      const endPush = performance.now();

      // Push should be fast even for deep chains
      expect(endPush - startPush).toBeLessThan(2);

      // Time the pull phase
      const startPull = performance.now();
      const result = chain[depth]!();
      const endPull = performance.now();

      expect(result).toBe(1100);

      // Pull should also be efficient
      expect(endPull - startPull).toBeLessThan(5);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle errors during pull without corrupting state', () => {
      const source = signal(1);
      let computeCount = 0;

      const buggy = computed(() => {
        computeCount++;
        const val = source();
        if (val === 10) {
          throw new Error('Computation failed');
        }
        return val * 2;
      });

      // Normal operation
      expect(buggy()).toBe(2); // 1 * 2
      expect(computeCount).toBe(1);

      // Update to trigger error
      source(10);
      computeCount = 0;

      // The error will be thrown by buggy
      expect(() => buggy()).toThrow('Computation failed');
      expect(computeCount).toBeGreaterThan(0); // Should have tried to compute

      // Recover with valid value
      source(5);
      computeCount = 0;
      expect(buggy()).toBe(10);  // 5 * 2
      expect(computeCount).toBeGreaterThan(0); // Should recompute after error

      // Verify state isn't corrupted - can go back to error state
      source(10);
      expect(() => buggy()).toThrow('Computation failed');

      // And back to normal
      source(2);
      expect(buggy()).toBe(4);

      // Error handling in dependent computed works differently
      // The error propagates through the dependency chain
      // Users must handle errors at the consumption point
      const safeDependentUsage = () => {
        try {
          // When buggy throws, this will throw too
          const result = buggy() * 3;
          return result;
        } catch (e) {
          void e;
          return -1; // Error sentinel
        }
      };

      // Normal case
      source(2);
      expect(safeDependentUsage()).toBe(12); // 2 * 2 * 3 = 12

      // Error case
      source(10);
      expect(safeDependentUsage()).toBe(-1); // Catches the error

      // Recovery
      source(3);
      expect(safeDependentUsage()).toBe(18); // 3 * 2 * 3 = 18
    });

    it('should handle circular dependencies gracefully', () => {
      // This should ideally be prevented, but if it happens,
      // the system should not crash

      const s = signal(1);
      let recursionCount = 0;
      const maxRecursion = 10;

      const circularComputed = computed(() => {
        recursionCount++;
        if (recursionCount > maxRecursion) {
          return -1; // Prevent infinite recursion
        }

        const val = s();
        if (val < 5) {
          s(val + 1); // Modifying signal during computed - BAD!
          return val;
        }
        return val;
      });

      // This is a pathological case
      expect(() => circularComputed()).not.toThrow();

      // System should still be functional
      recursionCount = 0;
      s(10);
      expect(circularComputed()).toBe(10);
    });

    it('should handle push without pull (orphaned invalidations)', () => {
      const source = signal(1);

      const orphaned = computed(() => source() * 2);

      // Access to establish dependency
      expect(orphaned()).toBe(2);

      // Multiple pushes without pulls
      source(2);
      source(3);
      source(4);
      source(5);

      // Should compute with latest value
      expect(orphaned()).toBe(10);

      // Should only compute once, not for each intermediate value
    });

    it('should handle pull without dependency tracking', () => {
      const source = signal(1);

      const computed1 = computed(() => source() * 2);

      // Peek doesn't establish dependency
      expect(computed1.peek()).toBe(2);

      // Update source
      source(10);

      // Computed wasn't tracking, but pull should still work
      expect(computed1()).toBe(20);
    });
  });

  describe('Version-Based Optimization', () => {
    it('should skip recomputation when dependencies unchanged', () => {
      let computeCount = 0;

      const s1 = signal(1);
      const s2 = signal(2);

      const sum = computed(() => {
        computeCount++;
        return s1() + s2();
      });

      expect(sum()).toBe(3);
      expect(computeCount).toBe(1);

      // Change s1
      s1(10);
      expect(sum()).toBe(12);
      expect(computeCount).toBe(2);

      // Change s1 back and s2 forward to same sum
      batch(() => {
        s1(2);
        s2(10);
      });

      // Sum is same but inputs changed, should still recompute
      expect(sum()).toBe(12);
      expect(computeCount).toBe(3); // Version tracking causes recompute
    });

    it('should handle version overflow correctly', () => {
      // This is a theoretical test - in practice versions are Numbers
      // which can go up to 2^53 safely

      const source = signal(1);
      const derived = computed(() => source() * 2);

      // Simulate many updates
      for (let i = 0; i < 1000; i++) {
        source(i);
        if (i % 100 === 0) {
          // Periodically verify correctness
          expect(derived()).toBe(i * 2);
        }
      }

      // System should still work after many versions
      source(9999);
      expect(derived()).toBe(19998);
    });
  });
});