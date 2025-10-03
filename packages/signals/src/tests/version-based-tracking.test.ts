import { describe, it, expect } from 'vitest';
import { createSignalAPI } from '../api';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createBaseContext } from '../context';
import { createGraphEdges } from '../helpers/graph-edges';
import { createGraphTraversal } from '../helpers/graph-traversal';
import { createPullPropagator } from '../helpers/pull-propagator';

describe('Version-Based Dependency Tracking', () => {
  const createApi = () => {
    const ctx = createBaseContext();
    const { propagate } = createGraphTraversal();
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

  it('should handle dependencies accessed in different orders without creating duplicates', () => {
    const api = createApi();
    const { signal, computed } = api;

    const a = signal('A');
    const b = signal('B');
    const c = signal('C');

    let order = 'ABC';

    const dynamic = computed(() => {
      if (order === 'ABC') {
        return a() + b() + c();
      } else if (order === 'CBA') {
        return c() + b() + a();
      } else {
        return b() + a() + c();
      }
    });

    // Initial evaluation with ABC order
    expect(dynamic()).toBe('ABC');

    // Change order to CBA - dependencies accessed in reverse
    order = 'CBA';
    a('A2');
    expect(dynamic()).toBe('CBA2');

    // Change order to BAC - different order again
    order = 'BAC';
    b('B2');
    expect(dynamic()).toBe('B2A2C');

    // Verify all signals still properly tracked
    a('A3');
    expect(dynamic()).toBe('B2A3C');

    b('B3');
    expect(dynamic()).toBe('B3A3C');

    c('C2');
    expect(dynamic()).toBe('B3A3C2');
  });

  it('should properly prune old dependencies with version-based tracking', () => {
    const api = createApi();
    const { signal, computed } = api;

    const signals: ReturnType<typeof signal<number>>[] = [];
    for (let i = 0; i < 10; i++) {
      signals.push(signal(i));
    }

    // Use a signal to control which subset is accessed
    const subsetSignal = signal([0, 1, 2]); // Track first 3 signals initially

    const dynamic = computed(() => {
      const subset = subsetSignal();
      return subset.reduce((sum, idx) => sum + (signals[idx]?.() ?? 0), 0);
    });

    // Initial evaluation
    expect(dynamic()).toBe(0 + 1 + 2); // 3

    // Change to different subset - this triggers re-evaluation
    subsetSignal([5, 6, 7]);
    expect(dynamic()).toBe(5 + 6 + 7); // 18

    // Old dependencies should be pruned - changing them shouldn't trigger
    signals[0]?.(100);
    signals[1]?.(100);
    signals[2]?.(100);
    // Value shouldn't change since these aren't tracked anymore
    expect(dynamic.peek()).toBe(18);

    // But new dependencies should work
    signals[6]?.(20);
    expect(dynamic()).toBe(5 + 20 + 7); // 32

    // Update one of the tracked signals
    signals[5]?.(10);
    expect(dynamic()).toBe(10 + 20 + 7); // 37
  });

  it('should efficiently handle many dependency changes (O(n) not O(n²))', () => {
    const api = createApi();
    const { signal, computed } = api;

    // Create many signals
    const signalCount = 100;
    const signals: ReturnType<typeof signal<number>>[] = [];
    for (let i = 0; i < signalCount; i++) {
      signals.push(signal(i));
    }

    // Create a computed that accesses all signals in varying orders
    let accessPattern = 'forward';
    const dynamic = computed(() => {
      let sum = 0;
      if (accessPattern === 'forward') {
        for (let i = 0; i < signalCount; i++) {
          sum += signals[i]?.() ?? 0;
        }
      } else if (accessPattern === 'reverse') {
        for (let i = signalCount - 1; i >= 0; i--) {
          sum += signals[i]?.() ?? 0;
        }
      } else {
        // Random access pattern
        for (let i = 0; i < signalCount; i++) {
          const idx = (i * 37) % signalCount; // Pseudo-random but deterministic
          sum += signals[idx]?.() ?? 0;
        }
      }
      return sum;
    });

    // Initial evaluation
    const initialSum = (signalCount * (signalCount - 1)) / 2; // Sum of 0..99
    expect(dynamic()).toBe(initialSum);

    // Change access pattern multiple times
    // With old O(n²) algorithm, this would be slow with 100 dependencies
    const startTime = performance.now();

    accessPattern = 'reverse';
    signals[0]?.(1000);
    expect(dynamic()).toBe(initialSum - 0 + 1000);

    accessPattern = 'random';
    signals[50]?.(2000);
    expect(dynamic()).toBe(initialSum - 0 + 1000 - 50 + 2000);

    accessPattern = 'forward';
    signals[99]?.(3000);
    expect(dynamic()).toBe(initialSum - 0 + 1000 - 50 + 2000 - 99 + 3000);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // With version-based tracking, this should be very fast
    // Even with 100 dependencies being reordered multiple times
    expect(duration).toBeLessThan(50); // Should complete in < 50ms
  });

  it('should handle conditional dependencies that appear and disappear', () => {
    const api = createApi();
    const { signal, computed } = api;

    const a = signal('A');
    const b = signal('B');
    const c = signal('C');
    const d = signal('D');
    const e = signal('E');

    let includeB = true;
    let includeD = false;

    const dynamic = computed(() => {
      let result = a();
      if (includeB) result += b();
      result += c();
      if (includeD) result += d();
      result += e();
      return result;
    });

    // Initial: A, B, C, E
    expect(dynamic()).toBe('ABCE');

    // Remove B, add D: A, C, D, E
    includeB = false;
    includeD = true;
    a('A2');
    expect(dynamic()).toBe('A2CDE');

    // B should no longer be tracked
    b('B2');
    expect(dynamic.peek()).toBe('A2CDE');

    // D should now be tracked
    d('D2');
    expect(dynamic()).toBe('A2CD2E');

    // Add B back, keep D: A, B, C, D, E
    includeB = true;
    c('C2');
    expect(dynamic()).toBe('A2B2C2D2E');

    // All should be tracked now
    a('A3');
    expect(dynamic()).toBe('A3B2C2D2E');
    b('B3');
    expect(dynamic()).toBe('A3B3C2D2E');
    c('C3');
    expect(dynamic()).toBe('A3B3C3D2E');
    d('D3');
    expect(dynamic()).toBe('A3B3C3D3E');
    e('E2');
    expect(dynamic()).toBe('A3B3C3D3E2');
  });
});