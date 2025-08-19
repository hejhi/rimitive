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
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';

type LatticeExtension<N extends string, M> = { name: N; method: M };

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(fn: () => T) => ComputedInterface<T>>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(fn: () => T) => ComputedInterface<T>;

const ITERATIONS = 100000;

group('Computed Writes (underlying signals)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - writes to signal with computed', function* () {
        const signal = latticeSignal(0);
        const computed = latticeComputed(() => signal.value * 2);
        // Touch computed to establish dependency
        void computed.value;

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
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