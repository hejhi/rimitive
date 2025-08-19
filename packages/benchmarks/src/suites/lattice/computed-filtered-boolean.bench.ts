/**
 * Computed Filtered Boolean Benchmarks
 * 
 * Tests filtering via boolean toggles where values alternate between states
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
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

const ITERATIONS = 10000;

group('Boolean Filter', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - toggle filter', function* () {
        const source = latticeSignal(0);
        const isEven = latticeComputed(() => source.value % 2 === 0);
        const message = latticeComputed(() => isEven.value ? 'even' : 'odd');
        const final = latticeComputed(() => message.value.toUpperCase());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Preact - toggle filter', function* () {
        const source = preactSignal(0);
        const isEven = preactComputed(() => source.value % 2 === 0);
        const message = preactComputed(() => isEven.value ? 'even' : 'odd');
        const final = preactComputed(() => message.value.toUpperCase());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Alien - toggle filter', function* () {
        const source = alienSignal(0);
        const isEven = alienComputed(() => source() % 2 === 0);
        const message = alienComputed(() => isEven() ? 'even' : 'odd');
        const final = alienComputed(() => message().toUpperCase());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();