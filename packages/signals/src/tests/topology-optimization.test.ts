import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, resetGlobalState } from '../test-setup';

/**
 * Lazy evaluation and short-circuit optimization tests
 *
 * Tests the push-pull algorithm optimizations:
 * - Lazy evaluation: computeds don't recompute until accessed
 * - Selective pull: only nodes in the access path update
 * - Short-circuit: stops propagation when intermediate values don't change
 * - Batching: multiple pushes before a pull use only the latest value
 *
 * From alien-signals topology suite + our additions.
 */

describe('Lazy Evaluation', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should not compute until accessed (lazy evaluation)', () => {
    let count1 = 0;
    let count2 = 0;

    const source = signal(1);
    const level1 = computed(() => {
      count1++;
      return source() * 2;
    });
    const level2 = computed(() => {
      count2++;
      return level1() * 2;
    });

    // Read initial value
    expect(level2()).toBe(4);
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    count1 = count2 = 0;

    // Update source - nothing computes yet
    source(10);
    expect(count1).toBe(0);
    expect(count2).toBe(0);

    // Access triggers lazy computation
    expect(level2()).toBe(40);
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  it('should skip unaccessed branches', () => {
    let countA = 0;
    let countB = 0;

    const source = signal(1);
    const branchA = computed(() => {
      countA++;
      return source() * 2;
    });
    const branchB = computed(() => {
      countB++;
      return source() * 3;
    });

    expect(branchA()).toBe(2);
    expect(branchB()).toBe(3);

    countA = countB = 0;
    source(10);

    // Only access B
    expect(branchB()).toBe(30);

    expect(countA).toBe(0); // Not accessed
    expect(countB).toBe(1); // Accessed
  });

  it('should only update nodes in pull path', () => {
    const s = signal(1);

    let countA = 0;
    const a = computed(() => {
      countA++;
      return s() * 2;
    });

    let countB = 0;
    const b = computed(() => {
      countB++;
      return a() * 2;
    });

    let countC = 0;
    const c = computed(() => {
      countC++;
      return a() * 3; // Also depends on A
    });

    // Initial
    expect(b()).toBe(4);
    expect(c()).toBe(6);
    expect(countA).toBe(1);
    expect(countB).toBe(1);
    expect(countC).toBe(1);

    // Change signal
    s(2);

    // Read only B - should update A and B, but NOT C
    expect(b()).toBe(8);
    expect(countA).toBe(2);
    expect(countB).toBe(2);
    expect(countC).toBe(1); // C not in pull path

    // Now read C - A is already updated, so only C computes
    expect(c()).toBe(12);
    expect(countA).toBe(2); // A already updated
    expect(countC).toBe(2); // C updates now
  });

  it('should handle multiple pushes before pull', () => {
    const source = signal(1);
    const derived = computed(() => source() * 2);

    expect(derived()).toBe(2);

    // Multiple updates
    source(2);
    source(3);
    source(4);
    source(5);

    // Computes with latest value only
    expect(derived()).toBe(10);
  });
});

describe('Short-Circuit Optimization', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('must recompute to detect value changes', () => {
    const s = signal(2);

    let countA = 0;
    const a = computed(() => {
      countA++;
      return Math.abs(s()); // abs(2) = 2, abs(-2) = 2
    });

    let countB = 0;
    const b = computed(() => {
      countB++;
      return a() * 3;
    });

    // Initial
    expect(b()).toBe(6);
    expect(countA).toBe(1);
    expect(countB).toBe(1);

    // Change signal - A's output stays same
    s(-2);

    // Read b - A MUST recompute to know its value didn't change
    expect(b()).toBe(6);
    expect(countA).toBe(2); // A recomputed
    expect(countB).toBe(1); // B skipped (A's value didn't change)
  });
});
