/**
 * Batch Updates Multiple Scaling Benchmark
 *
 * Tests batching efficiency with many signals and varying complexity.
 * Key metric: Batched updates should coalesce into single propagation.
 * Compares batched vs unbatched to show O(n) vs O(n²) difference.
 *
 * Scaling: Tests batch patterns with increasing signal counts
 * - 10 signals: Small batch efficiency test
 * - 20 signals: Medium batch complexity
 * - 40 signals: Large batch stress test
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  batch as preactBatch,
} from '@preact/signals-core';
import {
  signal as alienSignal,
  computed as alienComputed,
  startBatch as alienStartBatch,
  endBatch as alienEndBatch,
} from 'alien-signals';
import { createApi } from './helpers/signal-computed-batch';
import { Readable } from '@lattice/signals/types';

const ITERATIONS = 10000;
const latticeAPI = createApi();
const {
  signal: latticeSignal,
  computed: latticeComputed,
  batch: latticeBatch,
} = latticeAPI;

type BenchState = {
  get(name: 'signals'): number;
  get(name: string): unknown;
};

group('Batch Multiple Updates - Scaling', () => {
  summary(() => {
    barplot(() => {
      bench(
        'Lattice BATCHED - $signals signals',
        function* (state: BenchState) {
          const signalCount = state.get('signals');
          const signals = Array.from({ length: signalCount }, () =>
            latticeSignal(0)
          );

          // Multiple layers of computeds to show cascade effects
          const partialSums: Readable<number>[] = [];
          for (let i = 0; i < signalCount; i += 2) {
            const s1 = signals[i]!;
            const s2 = signals[i + 1] || signals[i]!;
            partialSums.push(latticeComputed(() => s1() + s2()));
          }

          const totalSum = latticeComputed(() =>
            partialSums.reduce((acc, ps) => acc + ps(), 0)
          );

          const final = latticeComputed(() => totalSum() * 2);

          yield () => {
            for (let i = 0; i < ITERATIONS / signalCount; i++) {
              latticeBatch(() => {
                signals.forEach((s, idx) => {
                  s(i * (idx + 1));
                });
              });
              void final();
            }
          };
        }
      ).args('signals', [10, 20, 40]);

      bench(
        'Lattice UNBATCHED - $signals signals',
        function* (state: BenchState) {
          const signalCount = state.get('signals');
          const signals = Array.from({ length: signalCount }, () =>
            latticeSignal(0)
          );

          const partialSums: Readable<number>[] = [];
          for (let i = 0; i < signalCount; i += 2) {
            const s1 = signals[i]!;
            const s2 = signals[i + 1] || signals[i]!;
            partialSums.push(latticeComputed(() => s1() + s2()));
          }

          const totalSum = latticeComputed(() =>
            partialSums.reduce((acc, ps) => acc + ps(), 0)
          );

          const final = latticeComputed(() => totalSum() * 2);

          yield () => {
            for (let i = 0; i < ITERATIONS / signalCount; i++) {
              // NO BATCHING - cascade of recomputations
              signals.forEach((s, idx) => {
                s(i * (idx + 1));
              });
              void final();
            }
          };
        }
      ).args('signals', [10, 20, 40]);

      bench('Preact BATCHED - $signals signals', function* (state: BenchState) {
        const signalCount = state.get('signals');
        const signals = Array.from({ length: signalCount }, () =>
          preactSignal(0)
        );

        const partialSums: ReturnType<typeof preactComputed<number>>[] = [];
        for (let i = 0; i < signalCount; i += 2) {
          const s1 = signals[i]!;
          const s2 = signals[i + 1] || signals[i]!;
          partialSums.push(preactComputed(() => s1.value + s2.value));
        }

        const totalSum = preactComputed(() =>
          partialSums.reduce((acc, ps) => acc + ps.value, 0)
        );

        const final = preactComputed(() => totalSum.value * 2);

        yield () => {
          for (let i = 0; i < ITERATIONS / signalCount; i++) {
            preactBatch(() => {
              signals.forEach((s, idx) => {
                s.value = i * (idx + 1);
              });
            });
            void final.value;
          }
        };
      }).args('signals', [10, 20, 40]);

      bench(
        'Preact UNBATCHED - $signals signals',
        function* (state: BenchState) {
          const signalCount = state.get('signals');
          const signals = Array.from({ length: signalCount }, () =>
            preactSignal(0)
          );

          const partialSums: ReturnType<typeof preactComputed<number>>[] = [];
          for (let i = 0; i < signalCount; i += 2) {
            const s1 = signals[i]!;
            const s2 = signals[i + 1] || signals[i]!;
            partialSums.push(preactComputed(() => s1.value + s2.value));
          }

          const totalSum = preactComputed(() =>
            partialSums.reduce((acc, ps) => acc + ps.value, 0)
          );

          const final = preactComputed(() => totalSum.value * 2);

          yield () => {
            for (let i = 0; i < ITERATIONS / signalCount; i++) {
              signals.forEach((s, idx) => {
                s.value = i * (idx + 1);
              });
              void final.value;
            }
          };
        }
      ).args('signals', [10, 20, 40]);

      bench('Alien BATCHED - $signals signals', function* (state: BenchState) {
        const signalCount = state.get('signals');
        const signals = Array.from({ length: signalCount }, () =>
          alienSignal(0)
        );

        const partialSums: ReturnType<typeof alienComputed<number>>[] = [];
        for (let i = 0; i < signalCount; i += 2) {
          const s1 = signals[i]!;
          const s2 = signals[i + 1] || signals[i]!;
          partialSums.push(alienComputed(() => s1() + s2()));
        }

        const totalSum = alienComputed(() =>
          partialSums.reduce((acc, ps) => acc + ps(), 0)
        );

        const final = alienComputed(() => totalSum() * 2);

        yield () => {
          for (let i = 0; i < ITERATIONS / signalCount; i++) {
            alienStartBatch();
            signals.forEach((s, idx) => {
              s(i * (idx + 1));
            });
            alienEndBatch();
            void final();
          }
        };
      }).args('signals', [10, 20, 40]);

      bench(
        'Alien UNBATCHED - $signals signals',
        function* (state: BenchState) {
          const signalCount = state.get('signals');
          const signals = Array.from({ length: signalCount }, () =>
            alienSignal(0)
          );

          const partialSums: ReturnType<typeof alienComputed<number>>[] = [];
          for (let i = 0; i < signalCount; i += 2) {
            const s1 = signals[i]!;
            const s2 = signals[i + 1] || signals[i]!;
            partialSums.push(alienComputed(() => s1() + s2()));
          }

          const totalSum = alienComputed(() =>
            partialSums.reduce((acc, ps) => acc + ps(), 0)
          );

          const final = alienComputed(() => totalSum() * 2);

          yield () => {
            for (let i = 0; i < ITERATIONS / signalCount; i++) {
              signals.forEach((s, idx) => {
                s(i * (idx + 1));
              });
              void final();
            }
          };
        }
      ).args('signals', [10, 20, 40]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();
