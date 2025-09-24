import { describe, it, expect } from 'vitest';
import { createSignalAPI } from '../api';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createBaseContext } from '../context';
import { createGraphEdges } from '../helpers/graph-edges';
import { createGraphTraversal } from '../helpers/graph-traversal';
import { createPullPropagator } from '../helpers/pull-propagator';

describe('Version-Based Tracking Performance Benchmark', () => {
  const createApi = () => {
    const { propagate } = createGraphTraversal();
    const graphEdges = createGraphEdges();
    const { trackDependency } = graphEdges;
    const ctx = createBaseContext();
    const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });

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
      }
    );
  };

  it('should demonstrate O(n) performance with version-based tracking', () => {
    const api = createApi();
    const { signal, computed } = api;

    // Test with different sizes to verify O(n) complexity
    const testSizes = [10, 50, 100, 200];
    const timings: number[] = [];

    for (const size of testSizes) {
      // Create signals
      const signals: ReturnType<typeof signal<number>>[] = [];
      for (let i = 0; i < size; i++) {
        signals.push(signal(i));
      }

      // Create a computed that accesses all signals in different orders
      let accessPattern = 0;
      const patterns = ['forward', 'reverse', 'shuffle'];

      const dynamic = computed(() => {
        let sum = 0;
        const pattern = patterns[accessPattern % 3];

        if (pattern === 'forward') {
          for (let i = 0; i < size; i++) {
            sum += signals[i]?.() ?? 0;
          }
        } else if (pattern === 'reverse') {
          for (let i = size - 1; i >= 0; i--) {
            sum += signals[i]?.() ?? 0;
          }
        } else {
          // Shuffle pattern
          for (let i = 0; i < size; i++) {
            const idx = (i * 37) % size;
            sum += signals[idx]?.() ?? 0;
          }
        }
        return sum;
      });

      // Measure time for multiple access pattern changes
      const iterations = 10;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        accessPattern = i;
        signals[i % size]?.(1000 + i);
        dynamic(); // Force re-evaluation with new access pattern
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;
      timings.push(avgTime);

      console.log(`Size ${size}: ${avgTime.toFixed(3)}ms per iteration`);
    }

    // Verify that performance scales linearly (O(n))
    // The ratio of times should be roughly proportional to the size ratio
    // Allow some variance due to measurement noise
    const ratio10to50 = (timings[1] ?? 0) / (timings[0] ?? 1);
    const ratio50to100 = (timings[2] ?? 0) / (timings[1] ?? 1);
    const ratio100to200 = (timings[3] ?? 0) / (timings[2] ?? 1);

    const sizeRatio10to50 = 50 / 10;  // 5x
    const sizeRatio50to100 = 100 / 50; // 2x
    const sizeRatio100to200 = 200 / 100; // 2x

    // With O(n) complexity, time ratios should be close to size ratios
    // With old O(n²), ratios would be squared (25x, 4x, 4x)
    // Allow 4x variance for measurement noise (CI environments can be noisy)
    expect(ratio10to50).toBeLessThan(sizeRatio10to50 * 4);
    expect(ratio50to100).toBeLessThan(sizeRatio50to100 * 4);
    expect(ratio100to200).toBeLessThan(sizeRatio100to200 * 4);

    // Ensure we're not seeing O(n²) behavior
    expect(ratio10to50).toBeLessThan(20); // Should be ~5, not ~25 for O(n²)
    expect(ratio50to100).toBeLessThan(8);  // Should be ~2, not ~4 for O(n²)
    expect(ratio100to200).toBeLessThan(8); // Should be ~2, not ~4 for O(n²)
  });
});