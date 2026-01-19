import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, resetGlobalState } from '../test-setup';

/**
 * Dynamic dependency management tests
 *
 * Tests how the reactive graph handles dependencies that change at runtime:
 * - Conditional branches (if/else)
 * - Dependency pruning when branches switch
 * - Dependency reordering
 * - Selective dependency activation based on runtime conditions
 *
 * Key property: inactive dependencies should not trigger recomputation.
 */

describe('Dynamic Dependencies', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should prune dependencies when branches change', () => {
    const condition = signal(true);
    const a = signal(1);
    const b = signal(1);

    let bComputations = 0;
    const expensiveB = computed(() => {
      bComputations++;
      return b() * 2;
    });

    let resultComputations = 0;
    const result = computed(() => {
      resultComputations++;
      return condition() ? a() : expensiveB();
    });

    // Initial: uses a
    expect(result()).toBe(1);
    expect(bComputations).toBe(0);
    expect(resultComputations).toBe(1);

    // Switch to b
    condition(false);
    expect(result()).toBe(2);
    expect(bComputations).toBe(1);

    // Switch back to a
    condition(true);
    expect(result()).toBe(1);
    expect(resultComputations).toBe(3);

    // Update b multiple times - should NOT recompute
    bComputations = 0;
    resultComputations = 0;
    for (let i = 0; i < 10; i++) {
      b(i);
      void result();
    }
    expect(bComputations).toBe(0); // Not accessed
    expect(resultComputations).toBe(0); // Not recomputed
  });

  it('should handle conditional dependencies correctly', () => {
    const show = signal(true);
    const name = signal('Alice');
    const details = signal('Engineer');

    let computeCount = 0;
    const display = computed(() => {
      computeCount++;
      return show() ? `${name()}: ${details()}` : name();
    });

    // Initial: depends on all three
    expect(display()).toBe('Alice: Engineer');
    expect(computeCount).toBe(1);

    // Hide details - prunes details dependency
    show(false);
    expect(display()).toBe('Alice');
    expect(computeCount).toBe(2);

    // Update details - should NOT trigger
    details('Senior Engineer');
    expect(display()).toBe('Alice');
    expect(computeCount).toBe(2);

    // Show details again - re-establishes dependency
    show(true);
    expect(display()).toBe('Alice: Senior Engineer');
    expect(computeCount).toBe(3);

    // Now details should trigger
    details('Principal');
    expect(display()).toBe('Alice: Principal');
    expect(computeCount).toBe(4);
  });

  it('should handle dependency reordering', () => {
    const a = signal('A');
    const b = signal('B');
    const c = signal('C');

    let order = 'ABC';
    const dynamic = computed(() => {
      if (order === 'ABC') return a() + b() + c();
      if (order === 'CBA') return c() + b() + a();
      return b() + a() + c();
    });

    expect(dynamic()).toBe('ABC');

    order = 'CBA';
    a('A2');
    expect(dynamic()).toBe('CBA2');

    order = 'BAC';
    b('B2');
    expect(dynamic()).toBe('B2A2C');

    // All signals should still work
    a('A3');
    expect(dynamic()).toBe('B2A3C');
    c('C2');
    expect(dynamic()).toBe('B2A3C2');
  });

  it('should prune middle dependencies', () => {
    const signals = [signal(0), signal(1), signal(2), signal(3), signal(4)];
    let mask = 0b11111; // All enabled

    const sum = computed(() => {
      let total = 0;
      for (let i = 0; i < signals.length; i++) {
        if (mask & (1 << i)) total += signals[i]!();
      }
      return total;
    });

    expect(sum()).toBe(10); // 0+1+2+3+4

    // Keep only first and last
    mask = 0b10001;
    signals[0]!(10);
    expect(sum()).toBe(14); // 10+4

    // Middle signals should not trigger
    signals[1]!(100);
    signals[2]!(100);
    signals[3]!(100);
    expect(sum()).toBe(14); // Unchanged
  });

  it('should handle many dependency changes efficiently', () => {
    const signals = Array.from({ length: 10 }, (_, i) => signal(i));

    let pattern = 'all';
    const sum = computed(() => {
      let total = 0;
      if (pattern === 'all') {
        for (let i = 0; i < 10; i++) total += signals[i]!();
      } else {
        for (let i = 0; i < 10; i += 2) total += signals[i]!(); // Even only
      }
      return total;
    });

    expect(sum()).toBe(45); // 0+1+2+3+4+5+6+7+8+9

    // Switch to even-only
    pattern = 'even';
    signals[0]!(10);
    expect(sum()).toBe(30); // 10+2+4+6+8

    // Odd signals should not trigger in 'even' mode
    signals[1]!(100);
    signals[3]!(100);
    expect(sum()).toBe(30); // Unchanged
  });
});
