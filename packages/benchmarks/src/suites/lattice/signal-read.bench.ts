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

group('Signal Reads', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - reads', function* () {
        const signal = latticeSignal(42);
  
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal.value;
          }
          return sum;
        };
      });

      bench('Preact - reads', function* () {
        const signal = preactSignal(42);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal.value;
          }
          return sum;
        };
      });
    
      bench('Alien - reads', function* () {
        const signal = alienSignal(42);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal();
          }
          return sum;
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();