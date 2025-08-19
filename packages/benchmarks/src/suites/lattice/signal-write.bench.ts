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
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import {
  signal as alienSignal,
} from 'alien-signals';

type LatticeExtension<N extends string, M> = { name: N; method: M };

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;

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