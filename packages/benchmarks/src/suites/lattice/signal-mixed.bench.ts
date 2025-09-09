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
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import {
  signal as alienSignal,
} from 'alien-signals';

import { createEffectContext } from './helpers/createEffectCtx';

const latticeAPI = createSignalAPI({ signal: createSignalFactory }, createEffectContext());
const latticeSignal = latticeAPI.signal;

const ITERATIONS = 100000;

group('Signal Mixed', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - reads/writes mixed', function* () {
        const signal = latticeSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
            void signal();
          }
        };
      });
    
      bench('Preact - reads/writes mixed', function* () {
        const signal = preactSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
            void signal.value;
          }
        };
      });
    
      bench('Alien - reads/writes mixed', function* () {
        const signal = alienSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
            void signal();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();