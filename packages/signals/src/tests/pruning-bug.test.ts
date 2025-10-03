import { describe, it, expect } from 'vitest';
import { createSignalAPI } from '../api';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createBaseContext } from '../context';
import { createGraphEdges } from '../helpers/graph-edges';
import { createGraphTraversal } from '../helpers/graph-traversal';
import { createPullPropagator } from '../helpers/pull-propagator';

describe('Pruning Bug - Dynamic Dependencies', () => {
  const createApi = () => {
    const { propagate } = createGraphTraversal();
    const ctx = createBaseContext();
    const graphEdges = createGraphEdges({ ctx });
    const { trackDependency, track } = graphEdges;
    const { pullUpdates, shallowPropagate } = createPullPropagator({ track: graphEdges.track });

    return createSignalAPI(
      {
        signal: createSignalFactory,
        computed: createComputedFactory,
      },
      {
        ctx,
        trackDependency,
        propagate,
        pullUpdates,
        track,
        shallowPropagate,
      }
    );
  };

  it('FAILS: should not react to pruned dependencies', () => {
    const api = createApi();
    const { signal, computed } = api;

    const A = signal('A');
    const B = signal('B');
    const C = signal('C');

    let condition = true;
    let evaluationCount = 0;

    // Computed that changes dependencies based on condition
    const dynamic = computed(() => {
      evaluationCount++;
      const a = A();
      let middle = '';
      if (condition) {
        middle = B(); // Access B only when condition is true
      }
      const c = C();
      return a + middle + c;
    });

    // Initial evaluation: dependencies are [A, B, C]
    expect(dynamic()).toBe('ABC');
    expect(evaluationCount).toBe(1);

    // Change condition to false and trigger re-evaluation
    // Dependencies should become [A, C] only
    condition = false;
    A('A2');
    expect(dynamic()).toBe('A2C');
    expect(evaluationCount).toBe(2);

    // NOW THE BUG: Change B - it should NOT trigger re-evaluation
    // because B should have been pruned from dependencies
    B('B2');
    dynamic(); // Force evaluation

    // This FAILS with current implementation - B still triggers updates!
    expect(evaluationCount).toBe(2); // Should still be 2, but will be 3
  });

  it('FAILS: should handle dependency reordering correctly', () => {
    const api = createApi();
    const { signal, computed } = api;

    const A = signal(1);
    const B = signal(2);
    const C = signal(3);

    let accessOrder = 'ABC';

    const dynamic = computed(() => {
      if (accessOrder === 'ABC') {
        return A() + B() + C();
      } else if (accessOrder === 'ACB') {
        return A() + C() + B();
      } else {
        return B() + C() + A();
      }
    });

    // Initial: [A, B, C]
    expect(dynamic()).toBe(6);

    // Change to [A, C, B] - different order
    accessOrder = 'ACB';
    A(10);
    expect(dynamic()).toBe(15); // 10 + 3 + 2

    // The bug: B is now in the wrong position in the dependency list
    // The pruning logic assumes dependencies after tail are stale,
    // but B is still active, just in a different position

    // Change back to [A, B, C]
    accessOrder = 'ABC';
    A(100);
    dynamic();

    // Now B might be duplicated or in wrong position
    // This can cause memory leaks or incorrect behavior
  });

  it('FAILS: should prune middle dependencies correctly', () => {
    const api = createApi();
    const { signal, computed } = api;

    const signals = [signal(0), signal(1), signal(2), signal(3), signal(4)];
    let mask = 0b11111; // Binary mask for which signals to access

    const dynamic = computed(() => {
      let sum = 0;
      for (let i = 0; i < signals.length; i++) {
        if (mask & (1 << i)) {
          sum += signals[i]!();
        }
      }
      return sum;
    });

    // Access all: [0, 1, 2, 3, 4]
    expect(dynamic()).toBe(10);

    // Remove middle ones: [0, 4] only (mask = 0b10001)
    mask = 0b10001;
    signals[0]!(10);
    expect(dynamic()).toBe(14); // 10 + 4

    // BUG: Signals 1, 2, 3 should be pruned but aren't
    // because they're in the middle of the list

    // This should NOT trigger recomputation
    signals[2]!(100);
    const before = dynamic();

    // But it does! The middle dependency wasn't pruned correctly
    expect(before).toBe(14); // This will fail, it will be 114
  });
});