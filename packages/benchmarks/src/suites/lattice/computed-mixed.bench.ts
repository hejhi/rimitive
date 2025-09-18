/**
 * Computed Mixed Benchmarks
 * 
 * Focused on mixed read/write operations with computeds
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

const latticeAPI = createApi();

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

const ITERATIONS = 100000;

group('Computed Mixed', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - mixed computed operations', function* () {
        const signal = latticeSignal(0);
        const computed = latticeComputed(() => signal() * 2);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
            void computed();
          }
        };
      });
    
      bench('Preact - mixed computed operations', function* () {
        const signal = preactSignal(0);
        const computed = preactComputed(() => signal.value * 2);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
            void computed.value;
          }
        };
      });
    
      bench('Alien - mixed computed operations', function* () {
        const signal = alienSignal(0);
        const computed = alienComputed(() => signal() * 2);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
            void computed();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();