/**
 * Fan-Out Scaling Benchmark
 *
 * Tests fan-out scalability - single source driving many subscribers.
 * Key metric: O(1) per-edge overhead as subscriber count increases.
 * Tests memory efficiency of intrusive data structures vs allocations.
 *
 * Scaling: Tests fan-out patterns with increasing subscriber counts
 * - 10 subscribers: Small fan-out efficiency test
 * - 25 subscribers: Medium fan-out complexity
 * - 50 subscribers: Large fan-out performance
 * - 100 subscribers: High fan-out stress test
 * - 200 subscribers: Extreme fan-out scalability
 */

import { bench, group, summary, barplot, do_not_optimize } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
} from 'alien-signals';
import { createSvc } from './helpers/signal-computed-effect';

const ITERATIONS_PER_SUBSCRIBER = 1000; // Keep total work constant
const latticeAPI = createSvc();
const {
  signal: latticeSignal,
  computed: latticeComputed,
  effect: latticeEffect,
} = latticeAPI;

type BenchState = {
  get(name: 'sources'): number;
  get(name: string): unknown;
};

group('Fan-out Scaling - Single Source to Many', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Single source driving many subscribers
        const source = latticeSignal(0);

        // Create subscribers with varying computations
        const computeds = Array.from({ length: subscriberCount }, (_, i) =>
          latticeComputed(() => {
            const val = source();
            // Different computation per subscriber to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );

        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({
          value: 0,
        }));
        const disposers = computeds.map((c, i) =>
          latticeEffect(() => {
            counters[i]!.value += c();
          })
        );

        // Warmup
        source(1);

        const iterations =
          ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
        yield () => {
          for (let i = 0; i < iterations; i++) {
            source(i);
          }
          return do_not_optimize(counters[0]!.value);
        };

        disposers.forEach((d) => d());
      }).args('sources', [10, 25, 50, 100, 200]);

      bench('Preact - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Single source driving many subscribers
        const source = preactSignal(0);

        // Create subscribers with varying computations
        const computeds = Array.from({ length: subscriberCount }, (_, i) =>
          preactComputed(() => {
            const val = source.value;
            // Different computation per subscriber to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );

        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({
          value: 0,
        }));
        const disposers = computeds.map((c, i) =>
          preactEffect(() => {
            counters[i]!.value += c.value;
          })
        );

        // Warmup
        source.value = 1;

        const iterations =
          ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
        yield () => {
          for (let i = 0; i < iterations; i++) {
            source.value = i;
          }
          return do_not_optimize(counters[0]!.value);
        };

        disposers.forEach((d) => d());
      }).args('sources', [10, 25, 50, 100, 200]);

      bench('Alien - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Single source driving many subscribers
        const source = alienSignal(0);

        // Create subscribers with varying computations
        const computeds = Array.from({ length: subscriberCount }, (_, i) =>
          alienComputed(() => {
            const val = source();
            // Different computation per subscriber to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );

        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({
          value: 0,
        }));
        const disposers = computeds.map((c, i) =>
          alienEffect(() => {
            counters[i]!.value += c();
          })
        );

        // Warmup
        source(1);

        const iterations =
          ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);

        yield () => {
          for (let i = 0; i < iterations; i++) {
            source(i);
          }
          return do_not_optimize(counters[0]!.value);
        };

        disposers.forEach((d) => d());
      }).args('sources', [10, 25, 50, 100, 200]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();
