/**
 * Fan-In Pattern Scaling Benchmark
 *
 * Tests many-to-one dependency convergence with varying source counts.
 * Key metric: Single consumer should efficiently aggregate many producers.
 * Validates convergence efficiency and batching behavior.
 *
 * Scaling: Tests fan-in patterns with increasing source counts
 * - 10 sources: Small fan-in convergence
 * - 25 sources: Medium fan-in complexity
 * - 50 sources: Large fan-in aggregation
 * - 100 sources: High fan-in stress test
 *
 * Pattern:
 * source1 → computed1 ↘
 * source2 → computed2 → fanIn (aggregates all)
 * source3 → computed3 ↗
 * ...
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createApi } from './helpers/signal-computed';

const ITERATIONS = 25000; // Adjusted for fan-in complexity
const latticeAPI = createApi();
const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

// Type for mitata benchmark state
interface BenchState {
  get(name: 'sources'): number;
  get(name: string): unknown;
}

group('Fan-In Convergence Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - $sources sources', function* (state: BenchState) {
        const sourceCount = state.get('sources');

        // Create many independent sources
        const sources = Array.from({ length: sourceCount }, (_, i) =>
          latticeSignal(i)
        );

        // Each source has its own computed with unique work
        const computeds = sources.map((source, i) =>
          latticeComputed(() => {
            const val = source();
            // Different computation per source to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i * 7 + 31) + j) % 1000007;
            }
            return result;
          })
        );

        // Single fan-in point that aggregates all computeds
        const fanIn = latticeComputed(() => {
          // Aggregate all computed values
          let total = 0;
          for (const computed of computeds) {
            total += computed();
          }
          // Additional work at convergence point
          return (total * 17 + sourceCount) % 1000007;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Update all sources simultaneously (tests batching)
            sources.forEach((source, idx) => {
              source(i * (idx + 1));
            });
            void fanIn();
          }
        };
      })
      .args('sources', [10, 25, 50, 100]);

      bench('Preact - $sources sources', function* (state: BenchState) {
        const sourceCount = state.get('sources');

        // Create many independent sources
        const sources = Array.from({ length: sourceCount }, (_, i) =>
          preactSignal(i)
        );

        // Each source has its own computed with unique work
        const computeds = sources.map((source, i) =>
          preactComputed(() => {
            const val = source.value;
            // Different computation per source to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i * 7 + 31) + j) % 1000007;
            }
            return result;
          })
        );

        // Single fan-in point that aggregates all computeds
        const fanIn = preactComputed(() => {
          // Aggregate all computed values
          let total = 0;
          for (const computed of computeds) {
            total += computed.value;
          }
          // Additional work at convergence point
          return (total * 17 + sourceCount) % 1000007;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Update all sources simultaneously (tests batching)
            sources.forEach((source, idx) => {
              source.value = i * (idx + 1);
            });
            void fanIn.value;
          }
        };
      })
      .args('sources', [10, 25, 50, 100]);

      bench('Alien - $sources sources', function* (state: BenchState) {
        const sourceCount = state.get('sources');

        // Create many independent sources
        const sources = Array.from({ length: sourceCount }, (_, i) =>
          alienSignal(i)
        );

        // Each source has its own computed with unique work
        const computeds = sources.map((source, i) =>
          alienComputed(() => {
            const val = source();
            // Different computation per source to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i * 7 + 31) + j) % 1000007;
            }
            return result;
          })
        );

        // Single fan-in point that aggregates all computeds
        const fanIn = alienComputed(() => {
          // Aggregate all computed values
          let total = 0;
          for (const computed of computeds) {
            total += computed();
          }
          // Additional work at convergence point
          return (total * 17 + sourceCount) % 1000007;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Update all sources simultaneously (tests batching)
            sources.forEach((source, idx) => {
              source(i * (idx + 1));
            });
            void fanIn();
          }
        };
      })
      .args('sources', [10, 25, 50, 100]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();