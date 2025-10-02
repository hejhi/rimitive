import { describe, it, expect } from 'vitest';
import { createSignalAPI } from '../api';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createBaseContext } from '../context';
import { createGraphEdges } from '../helpers/graph-edges';
import { createGraphTraversal } from '../helpers/graph-traversal';
import { createPullPropagator } from '../helpers/pull-propagator';

describe('Dynamic Dependencies - Pruning Bug Fix', () => {
  const createApi = () => {
    const { propagate } = createGraphTraversal();
    const graphEdges = createGraphEdges();
    const { trackDependency, track } = graphEdges;
    const ctx = createBaseContext();
    const { pullUpdates, shallowPropagate } = createPullPropagator({ ctx, track: graphEdges.track });

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

  it('should correctly prune dependencies when access pattern changes', () => {
    const api = createApi();
    const { signal, computed } = api;

    const A = signal('A');
    const B = signal('B');
    const C = signal('C');

    let condition = true;
    let bAccessCount = 0;

    // Track when B is accessed
    const trackedB = computed(() => {
      bAccessCount++;
      return B();
    });

    // Dynamic computed that changes its dependencies
    const dynamic = computed(() => {
      const a = A();
      let middle = '';
      if (condition) {
        middle = trackedB(); // Access B only when condition is true
      }
      const c = C();
      return a + middle + c;
    });

    // Initial evaluation with [A, B, C]
    expect(dynamic()).toBe('ABC');
    expect(bAccessCount).toBe(1);

    // Change condition to remove B dependency
    condition = false;
    A('A2'); // Trigger re-evaluation
    expect(dynamic()).toBe('A2C');
    expect(bAccessCount).toBe(1); // B should not be accessed

    // Change B - should NOT trigger dynamic re-evaluation
    B('B2');
    expect(dynamic()).toBe('A2C'); // Should not change
    expect(bAccessCount).toBe(1); // B still not accessed

    // Re-enable condition
    condition = true;
    A('A3'); // Trigger re-evaluation
    expect(dynamic()).toBe('A3B2C');
    expect(bAccessCount).toBe(2); // B accessed again
  });

  it('should handle reordering of dependencies', () => {
    const api = createApi();
    const { signal, computed } = api;

    const A = signal('A');
    const B = signal('B');
    const C = signal('C');

    let order = 'ABC';

    const dynamic = computed(() => {
      if (order === 'ABC') {
        return A() + B() + C();
      } else if (order === 'ACB') {
        return A() + C() + B();
      } else {
        return C() + B() + A();
      }
    });

    // Initial evaluation [A, B, C]
    expect(dynamic()).toBe('ABC');

    // Reorder to [A, C, B]
    order = 'ACB';
    A('A2'); // Trigger re-evaluation
    expect(dynamic()).toBe('A2CB');

    // Reorder to [C, B, A]
    order = 'CBA';
    C('C2'); // Trigger re-evaluation
    expect(dynamic()).toBe('C2BA2');

    // All signals should still trigger updates
    A('A3');
    expect(dynamic()).toBe('C2BA3');
    B('B3');
    expect(dynamic()).toBe('C2B3A3');
    C('C3');
    expect(dynamic()).toBe('C3B3A3');
  });

  it('should not leak memory with frequently changing dependencies', () => {
    const api = createApi();
    const { signal, computed } = api;

    const signals = Array.from({ length: 10 }, (_, i) => signal(i));
    let pattern = 0;

    const dynamic = computed(() => {
      let sum = 0;
      // Access different subsets based on pattern
      if (pattern === 0) {
        // Access even indices
        for (let i = 0; i < signals.length; i += 2) {
          sum += (signals[i] as any)() as number;
        }
      } else if (pattern === 1) {
        // Access odd indices
        for (let i = 1; i < signals.length; i += 2) {
          sum += (signals[i] as any)() as number;
        }
      } else {
        // Access first half
        for (let i = 0; i < signals.length / 2; i++) {
          sum += (signals[i] as any)() as number;
        }
      }
      return sum;
    });

    // Run many iterations with changing patterns
    for (let i = 0; i < 100; i++) {
      pattern = i % 3;
      (signals[0] as any)(i); // Trigger re-evaluation
      dynamic(); // Evaluate
    }

    // Verify pruning worked by checking reactions to signals
    // First, ensure we're in pattern 0 (even indices)
    pattern = 0;

    // Reset all signals to known values and evaluate
    signals.forEach((s, i) => (s as any)(i * 10));
    const baseline = dynamic(); // Should be 0+20+40+60+80 = 200

    // Try changing an odd signal (should NOT be a dependency anymore)
    (signals[1] as any)(9999);
    expect(dynamic()).toBe(baseline); // Should not change

    // Try changing an even signal (should still be a dependency)
    (signals[0] as any)(9999);
    expect(dynamic()).not.toBe(baseline); // Should change
  });
});