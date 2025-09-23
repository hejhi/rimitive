/**
 * Signal → Computed Fan-out Benchmark
 *
 * Tests scalability of a single signal driving many computed values.
 * Pattern: 1 signal → N computeds (no effects)
 * Key metric: Memory and performance overhead of computed dependency tracking
 * as the number of computed subscribers increases.
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';

// Type for mitata benchmark state
interface BenchState {
  get(name: 'sources'): number;
  get(name: string): unknown;
}

import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import { signal as alienSignal, computed as alienComputed } from 'alien-signals';
import { createApi } from './helpers/signal-computed-effect';

const latticeAPI = createApi();

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

group('Signal → Computed Fan-out (No Effects)', () => {
  summary(() => {
    const ITERATIONS_PER_SUBSCRIBER = 1000; // Keep total work constant
    
    barplot(() => {
      bench('Preact - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Single source driving many subscribers
        const source = preactSignal(0);

        // Create subscribers with varying computations
        const computed = Array.from({ length: subscriberCount }, (_, i) =>
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

        const computedComputed = computed.map((c, i) =>
          preactComputed(() => {
            const val = c.value;
            // Different computation per subscriber to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );

        // Warmup
        source.value = 1;

        const iterations =
          ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
        yield () => {
          for (let i = 0; i < iterations; i++) {
            source.value = i;
            computedComputed.forEach((c) => void c.value);
          }
        };
      }).args('sources', [10, 25, 50, 100, 200]);
    
      bench('Lattice - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Single source driving many subscribers
        const source = latticeSignal(0);

        // Create subscribers with varying computations
        const computed = Array.from({ length: subscriberCount }, (_, i) =>
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

        const computedComputed = computed.map((c, i) =>
          latticeComputed(() => {
            const val = c();
            // Different computation per subscriber to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );

        // Warmup
        source(1);

        const iterations = ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
        yield () => {
          for (let i = 0; i < iterations; i++) {
            source(i);
            computedComputed.forEach((c) => c());
          }
        };
      }).args('sources', [10, 25, 50, 100, 200]);
    
      bench('Alien - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Single source driving many subscribers
        const source = alienSignal(0);

        // Create subscribers with varying computations
        const computed = Array.from({ length: subscriberCount }, (_, i) =>
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

        const computedComputed = computed.map((c, i) =>
          alienComputed(() => {
            const val = c();
            // Different computation per subscriber to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );

        // Warmup
        source(1);

        const iterations =
          ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
        yield () => {
          for (let i = 0; i < iterations; i++) {
            source(i);
            computedComputed.forEach((c) => c());
          }
        };
      }).args('sources', [10, 25, 50, 100, 200]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();