/**
 * Computed Write Benchmarks
 * 
 * Focused on writing to signals that computeds depend on
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

group('Computed Writes (underlying signals)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - writes to signal with computed', function* () {
        const signal = latticeSignal(0);
        const computed = latticeComputed(() => signal() * 2);
        // Touch computed to establish dependency
        void computed();

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
      });
    
      bench('Preact - writes to signal with computed', function* () {
        const signal = preactSignal(0);
        const computed = preactComputed(() => signal.value * 2);
        // Touch computed to establish dependency
        void computed.value;

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
    
      bench('Alien - writes to signal with computed', function* () {
        const signal = alienSignal(0);
        const computed = alienComputed(() => signal() * 2);
        // Touch computed to establish dependency
        void computed();

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