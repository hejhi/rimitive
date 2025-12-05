/**
 * Diamond Dependency Scaling Benchmark
 *
 * Tests diamond-shaped dependency graphs for glitch prevention with varying complexity.
 * Key metric: Bottom computed should calculate ONCE per source update,
 * seeing consistent values from both paths (no intermediate states).
 *
 * Scaling: Tests diamond patterns of increasing complexity
 * - 1 diamond: Simple source→left,right→bottom
 * - 2 diamonds: Source→l1,r1→l2,r2→bottom
 * - 3 diamonds: Source→...→l3,r3→bottom
 * - 4 diamonds: Source→...→l4,r4→bottom
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
import { createSvc } from './helpers/signal-computed';

const ITERATIONS = 50000;
const latticeSvc = createSvc();
const { signal: latticeSignal, computed: latticeComputed } = latticeSvc;

type BenchState = {
  get(name: 'diamonds'): number;
  get(name: string): unknown;
};

group('Diamond Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - $diamonds diamonds', function* (state: BenchState) {
        const diamondCount = state.get('diamonds');

        // Build diamond chain of specified complexity
        const source = latticeSignal(0);
        let currentLeft = source;
        let currentRight = source;

        // Create diamondCount levels of diamond patterns
        for (let level = 0; level < diamondCount; level++) {
          const prevLeft = currentLeft;
          const prevRight = currentRight;

          currentLeft = latticeComputed(() => {
            const val = prevLeft();
            // Simulate computation with level-specific work
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * 31 + level + j) % 1000007;
            }
            return result;
          });

          currentRight = latticeComputed(() => {
            const val = prevRight();
            // Different computation path
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * 37 + level * 2 + j) % 1000007;
            }
            return result;
          });
        }

        // Final convergence node
        const bottom = latticeComputed(() => {
          const l = currentLeft();
          const r = currentRight();
          return (l * l + r * r) % 1000007;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void bottom();
          }
        };
      }).args('diamonds', [1, 2, 3, 4]);

      bench('Preact - $diamonds diamonds', function* (state: BenchState) {
        const diamondCount = state.get('diamonds');

        // Build diamond chain of specified complexity
        const source = preactSignal(0);
        let currentLeft = source;
        let currentRight = source;

        // Create diamondCount levels of diamond patterns
        for (let level = 0; level < diamondCount; level++) {
          const prevLeft = currentLeft;
          const prevRight = currentRight;

          currentLeft = preactComputed(() => {
            const val = prevLeft.value;
            // Simulate computation with level-specific work
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * 31 + level + j) % 1000007;
            }
            return result;
          });

          currentRight = preactComputed(() => {
            const val = prevRight.value;
            // Different computation path
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * 37 + level * 2 + j) % 1000007;
            }
            return result;
          });
        }

        // Final convergence node
        const bottom = preactComputed(() => {
          const l = currentLeft.value;
          const r = currentRight.value;
          return (l * l + r * r) % 1000007;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      }).args('diamonds', [1, 2, 3, 4]);

      bench('Alien - $diamonds diamonds', function* (state: BenchState) {
        const diamondCount = state.get('diamonds');

        // Build diamond chain of specified complexity
        const source = alienSignal(0);
        let currentLeft = source;
        let currentRight = source;

        // Create diamondCount levels of diamond patterns
        for (let level = 0; level < diamondCount; level++) {
          const prevLeft = currentLeft;
          const prevRight = currentRight;

          currentLeft = alienComputed(() => {
            const val = prevLeft();
            // Simulate computation with level-specific work
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * 31 + level + j) % 1000007;
            }
            return result;
          });

          currentRight = alienComputed(() => {
            const val = prevRight();
            // Different computation path
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * 37 + level * 2 + j) % 1000007;
            }
            return result;
          });
        }

        // Final convergence node
        const bottom = alienComputed(() => {
          const l = currentLeft();
          const r = currentRight();
          return (l * l + r * r) % 1000007;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void bottom();
          }
        };
      }).args('diamonds', [1, 2, 3, 4]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();
