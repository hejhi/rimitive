/**
 * Computed Filtered Threshold Benchmarks
 * 
 * Tests push-pull optimization where computeds filter out changes via thresholds
 * Key insight: If a computed's value doesn't change, downstream shouldn't recompute
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

group('Threshold Filter', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - 90% filtered', function* () {
        const source = latticeSignal(0);
        const filtered = latticeComputed(() => Math.floor(source.value / 10));
        const final = latticeComputed(() => filtered.value * 100);
        
        // Warm up
        source.value = 1;
        void final.value;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Preact - 90% filtered', function* () {
        const source = preactSignal(0);
        const filtered = preactComputed(() => Math.floor(source.value / 10));
        const final = preactComputed(() => filtered.value * 100);
        
        // Warm up
        source.value = 1;
        void final.value;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Alien - 90% filtered', function* () {
        const source = alienSignal(0);
        const filtered = alienComputed(() => Math.floor(source() / 10));
        const final = alienComputed(() => filtered() * 100);
        
        // Warm up
        source(1);
        void final();
        
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