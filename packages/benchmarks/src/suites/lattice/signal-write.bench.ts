/**
 * Signal Update Benchmarks
 * 
 * Focused on basic signal read/write operations
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
} from '@preact/signals-core';
import {
  signal as alienSignal,
} from 'alien-signals';
import { createApi } from './helpers/signal';

const latticeAPI = createApi();

const latticeSignal = latticeAPI.signal;

const ITERATIONS = 100000;

group('Signal Writes', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - writes', function* () {
        const signal = latticeSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
      });

      bench('Preact - writes', function* () {
        const signal = preactSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
    
      bench('Alien - writes', function* () {
        const signal = alienSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();