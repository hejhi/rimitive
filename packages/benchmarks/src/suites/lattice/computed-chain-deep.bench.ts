/**
 * Computed Chain Deep Benchmarks
 * 
 * Tests deep linear chains of computed values (10 levels)
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

group('Computed Chain - Deep (10 levels)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        let last: (() => number) = source;
        for (let i = 0; i < 10; i++) {
          const prev = last;
          last = latticeComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source(i);
            void final();
          }
        };
      });
    
      bench('Preact', function* () {
        const source = preactSignal(0);
        let last = source;
        for (let i = 0; i < 10; i++) {
          const prev = last;
          last = preactComputed(() => prev.value + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        let last = source;
        for (let i = 0; i < 10; i++) {
          const prev = last;
          last = alienComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
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