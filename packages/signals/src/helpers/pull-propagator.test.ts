import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, resetGlobalState } from '../test-setup';

/**
 * Unit tests for pull-propagator.ts
 *
 * The pull propagator implements lazy evaluation in the push-pull algorithm:
 * - Walk dependency trees only when values are read
 * - Recompute only nodes that need updates
 * - Short-circuit when intermediate values don't change
 * - Handle intermediate read staleness
 */

describe('Pull Propagator', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('Lazy Evaluation', () => {
    it('should not compute until value is accessed', () => {
      let computeCount = 0;
      const source = signal(1);
      const derived = computed(() => {
        computeCount++;
        return source() * 2;
      });

      // Nothing computed yet
      expect(computeCount).toBe(0);

      // Trigger push - still no computation
      source(5);
      expect(computeCount).toBe(0);

      // Pull triggers computation
      expect(derived()).toBe(10);
      expect(computeCount).toBe(1);
    });

    it('should only pull accessed branches', () => {
      let countA = 0;
      let countB = 0;

      const source = signal(1);

      computed(() => {
        countA++;
        return source() * 2;
      });

      const branch = computed(() => {
        countB++;
        return source() * 3;
      });

      source(10);

      // Pull branch
      expect(branch()).toBe(30);
      expect(countA).toBe(0); // A not pulled
      expect(countB).toBe(1); // B pulled
    });
  });

  describe('Dirty Checking', () => {
    it('should recompute when dependencies are dirty', () => {
      let computeCount = 0;
      const source = signal(1);
      const derived = computed(() => {
        computeCount++;
        return source() * 2;
      });

      expect(derived()).toBe(2);
      expect(computeCount).toBe(1);

      source(5);
      expect(derived()).toBe(10);
      expect(computeCount).toBe(2);
    });

    it('should not recompute when clean', () => {
      let computeCount = 0;
      const source = signal(1);
      const derived = computed(() => {
        computeCount++;
        return source() * 2;
      });

      expect(derived()).toBe(2);
      expect(computeCount).toBe(1);

      // Read again without changes
      expect(derived()).toBe(2);
      expect(computeCount).toBe(1); // No recomputation
    });
  });

  describe('Short-Circuit Optimization', () => {
    it('should stop pulling when intermediate value unchanged', () => {
      const source = signal(2);

      let countA = 0;
      const a = computed(() => {
        countA++;
        return Math.abs(source()); // abs(2) = 2, abs(-2) = 2
      });

      let countB = 0;
      const b = computed(() => {
        countB++;
        return a() * 3;
      });

      expect(b()).toBe(6);
      expect(countA).toBe(1);
      expect(countB).toBe(1);

      // Change source but A's output stays same
      source(-2);

      expect(b()).toBe(6);
      expect(countA).toBe(2); // A recomputes to check
      expect(countB).toBe(1); // B short-circuits
    });

    it('should short-circuit deep chains', () => {
      const source = signal(5);

      let count1 = 0;
      const level1 = computed(() => {
        count1++;
        return source() > 0 ? 1 : 0; // Always 1 for positive values
      });

      let count2 = 0;
      const level2 = computed(() => {
        count2++;
        return level1() * 2;
      });

      let count3 = 0;
      const level3 = computed(() => {
        count3++;
        return level2() * 3;
      });

      expect(level3()).toBe(6);
      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(1);

      // Change source but level1 output stays same
      source(10);

      expect(level3()).toBe(6);
      expect(count1).toBe(2); // Recomputes
      expect(count2).toBe(1); // Short-circuits
      expect(count3).toBe(1); // Never reached
    });
  });

  describe('Pull Path Optimization', () => {
    it('should only update nodes in pull path', () => {
      const source = signal(1);

      let countA = 0;
      const a = computed(() => {
        countA++;
        return source() * 2;
      });

      let countB = 0;
      const b = computed(() => {
        countB++;
        return a() * 2;
      });

      let countC = 0;
      const c = computed(() => {
        countC++;
        return a() * 3;
      });

      // Initial
      expect(b()).toBe(4);
      expect(c()).toBe(6);
      expect(countA).toBe(1);
      expect(countB).toBe(1);
      expect(countC).toBe(1);

      source(2);

      // Pull only B
      expect(b()).toBe(8);
      expect(countA).toBe(2); // A in path
      expect(countB).toBe(2); // B in path
      expect(countC).toBe(1); // C not in path

      // Now pull C
      expect(c()).toBe(12);
      expect(countA).toBe(2); // A already updated
      expect(countC).toBe(2); // C updates now
    });
  });

  describe('Diamond Dependencies', () => {
    it('should pull through diamonds correctly', () => {
      const source = signal(1);

      let countB = 0;
      const b = computed(() => {
        countB++;
        return source() + 1;
      });

      let countC = 0;
      const c = computed(() => {
        countC++;
        return source() + 2;
      });

      let countD = 0;
      const d = computed(() => {
        countD++;
        return b() + c();
      });

      expect(d()).toBe(5); // (1+1) + (1+2)
      expect(countB).toBe(1);
      expect(countC).toBe(1);
      expect(countD).toBe(1);

      source(10);

      expect(d()).toBe(23); // (10+1) + (10+2)
      expect(countB).toBe(2);
      expect(countC).toBe(2);
      expect(countD).toBe(2);
    });
  });

  describe('Shallow Propagation', () => {
    it('should upgrade pending siblings to dirty', () => {
      const source = signal(1);

      const mid = computed(() => source() * 2);

      let count1 = 0;
      const child1 = computed(() => {
        count1++;
        return mid() + 1;
      });

      let count2 = 0;
      const child2 = computed(() => {
        count2++;
        return mid() + 2;
      });

      // Initial
      expect(child1()).toBe(3);
      expect(child2()).toBe(4);

      source(5);

      // Both children should pull through mid
      expect(child1()).toBe(11);
      expect(count1).toBe(2);

      expect(child2()).toBe(12);
      expect(count2).toBe(2);
    });
  });

  describe('Deep Chains', () => {
    it('should handle deep dependency chains', () => {
      const source = signal(1);
      const counts = new Array(10).fill(0);

      // Create chain: source -> c0 -> c1 -> ... -> c9
      const computeds: Array<ReturnType<typeof computed<number>>> = [];

      for (let i = 0; i < 10; i++) {
        const index = i;
        const prev = i === 0 ? source : computeds[i - 1]!;
        const c = computed(() => {
          counts[index]++;
          return prev() + 1;
        });
        computeds.push(c);
      }

      const result = computeds[9]!;

      // Initial pull
      expect(result()).toBe(11); // 1 + 10
      expect(counts.every(c => c === 1)).toBe(true);

      // Update source
      source(5);

      // Pull through chain
      expect(result()).toBe(15); // 5 + 10
      expect(counts.every(c => c === 2)).toBe(true);
    });
  });

  describe('Conditional Dependencies', () => {
    it('should pull only active dependencies', () => {
      const condition = signal(true);
      const a = signal(1);
      const b = signal(2);

      let countA = 0;
      const compA = computed(() => {
        countA++;
        return a() * 2;
      });

      let countB = 0;
      const compB = computed(() => {
        countB++;
        return b() * 3;
      });

      const result = computed(() => {
        return condition() ? compA() : compB();
      });

      expect(result()).toBe(2);
      expect(countA).toBe(1);
      expect(countB).toBe(0);

      // Switch condition
      condition(false);
      expect(result()).toBe(6);
      expect(countA).toBe(1); // Not pulled
      expect(countB).toBe(1); // Pulled

      // Update unused branch
      a(10);
      expect(result()).toBe(6);
      expect(countA).toBe(1); // Still not pulled
    });
  });
});
