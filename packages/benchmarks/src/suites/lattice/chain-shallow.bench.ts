/**
 * Computed Chain Shallow (Wide) Scaling Benchmark
 *
 * Tests wide shallow patterns to isolate depth vs width effects.
 * Structure: signal -> N computeds -> 1 final computed reading all N
 *
 * This tests whether memory issues are related to:
 * - Depth of chains (vertical)
 * - Number of computeds (horizontal)
 * - Total track calls
 *
 * Scaling: Tests patterns with increasing width
 * - 10 wide: Small fan-out test
 * - 20 wide: Medium fan-out
 * - 50 wide: Large fan-out
 * - 100 wide: Stress test
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  ReadonlySignal,
} from '@preact/signals-core';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createSvc } from './deps/signal-computed';

const ITERATIONS = 10000;
const latticeSvc = createSvc();
const { signal: latticeSignal, computed: latticeComputed } = latticeSvc;

type BenchState = {
  get(name: 'width'): number;
  get(name: string): unknown;
};

group('Computed Chain - Shallow (Wide)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - $width wide', function* (state: BenchState) {
        const width = state.get('width');
        const source = latticeSignal(0);

        // Level 1: Create N computeds reading from signal
        const intermediates: (() => number)[] = [];
        for (let i = 0; i < width; i++) {
          const index = i;
          intermediates.push(
            latticeComputed(() => {
              const val = source();
              // Non-trivial computation
              let result = val;
              for (let j = 0; j < 3; j++) {
                result = (result * 31 + index + j) % 1000007;
              }
              return result;
            })
          );
        }

        // Level 2: Single computed reading all intermediates
        const final = latticeComputed(() => {
          let sum = 0;
          for (let i = 0; i < width; i++) {
            sum += intermediates[i]!();
          }
          return sum % 1000007;
        });

        // Warmup to establish dependencies
        source(1);
        void final();

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      }).args('width', [10, 20, 50, 100]);

      bench('Preact - $width wide', function* (state: BenchState) {
        const width = state.get('width');
        const source = preactSignal(0);

        const intermediates: ReadonlySignal<number>[] = [];
        for (let i = 0; i < width; i++) {
          const index = i;
          intermediates.push(
            preactComputed(() => {
              const val = source.value;
              let result = val;
              for (let j = 0; j < 3; j++) {
                result = (result * 31 + index + j) % 1000007;
              }
              return result;
            })
          );
        }

        const final = preactComputed(() => {
          let sum = 0;
          for (let i = 0; i < width; i++) {
            sum += intermediates[i]!.value;
          }
          return sum % 1000007;
        });

        // Warmup
        source.value = 1;
        void final.value;

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void final.value;
          }
        };
      }).args('width', [10, 20, 50, 100]);

      bench('Alien - $width wide', function* (state: BenchState) {
        const width = state.get('width');
        const source = alienSignal(0);

        const intermediates: (() => number)[] = [];
        for (let i = 0; i < width; i++) {
          const index = i;
          intermediates.push(
            alienComputed(() => {
              const val = source();
              let result = val;
              for (let j = 0; j < 3; j++) {
                result = (result * 31 + index + j) % 1000007;
              }
              return result;
            })
          );
        }

        const final = alienComputed(() => {
          let sum = 0;
          for (let i = 0; i < width; i++) {
            sum += intermediates[i]!();
          }
          return sum % 1000007;
        });

        // Warmup
        source(1);
        void final();

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      }).args('width', [10, 20, 50, 100]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();
