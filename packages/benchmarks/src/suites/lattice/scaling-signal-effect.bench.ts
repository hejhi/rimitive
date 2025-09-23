/**
 * Signal → Effect Direct Subscription Benchmark
 *
 * Tests scalability of multiple signals with direct effect subscriptions.
 * Pattern: N signals → N effects (1:1 mapping, no computed layer)
 * Key metric: Memory and performance overhead of direct signal→effect edges
 * without intermediate computed values.
 */

import { bench, group, summary, barplot, do_not_optimize } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';

// Type for mitata benchmark state
interface BenchState {
  get(name: 'sources'): number;
  get(name: string): unknown;
}

import {
  signal as preactSignal,
  effect as preactEffect,
} from '@preact/signals-core';
import { signal as alienSignal, effect as alienEffect } from 'alien-signals';
import { createApi } from './helpers/signal-computed-effect';

const latticeAPI = createApi();

const latticeSignal = latticeAPI.signal;
const latticeEffect = latticeAPI.effect;

group('Signal → Effect Direct Subscription', () => {
  summary(() => {
    const ITERATIONS_PER_SUBSCRIBER = 1000; // Keep total work constant
    
    barplot(() => {
      bench('Preact - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Create subscribers with varying computations
        const signals = Array.from({ length: subscriberCount }, (_, i) =>
          preactSignal(i)
        );

        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({
          value: 0,
        }));
        const disposers = signals.map((s, i) =>
          preactEffect(() => {
            counters[i]!.value += s.value;
          })
        );

        // Warmup
        signals[0]!.value = 1;

        const iterations =
          ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
        yield () => {
          for (let i = 0; i < iterations; i++) {
            signals.forEach((s) => void s.value);
          }
          return do_not_optimize(counters[0]!.value);
        };

        disposers.forEach((d) => d());
      }).args('sources', [10, 25, 50, 100, 200]);
    
      bench('Lattice - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Create subscribers with varying computations
        const signals = Array.from({ length: subscriberCount }, (_, i) =>
          latticeSignal(i)
        );

        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({
          value: 0,
        }));
        const disposers = signals.map((s, i) =>
          latticeEffect(() => {
            counters[i]!.value += s();
          })
        );

        // Warmup
        signals[0]!(1);

        const iterations = ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
        yield () => {
          for (let i = 0; i < iterations; i++) {
            signals.forEach((s) => s(i));
          }
          return do_not_optimize(counters[0]!.value);
        };

        disposers.forEach((d) => d());
      }).args('sources', [10, 25, 50, 100, 200]);
    
      bench('Alien - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');

        // Create subscribers with varying computations
        const signals = Array.from({ length: subscriberCount }, (_, i) =>
          alienSignal(i)
        );

        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({
          value: 0,
        }));
        const disposers = signals.map((s, i) =>
          alienEffect(() => {
            counters[i]!.value += s();
          })
        );

        // Warmup
        signals[0]!(1);

        const iterations =
          ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
        yield () => {
          for (let i = 0; i < iterations; i++) {
            signals.forEach((s) => s(i));
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