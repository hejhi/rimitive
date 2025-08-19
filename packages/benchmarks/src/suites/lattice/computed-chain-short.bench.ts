/**
 * Computed Chain Short Benchmarks
 * 
 * Tests short linear chains of computed values (3 levels): a → b → c
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

group('Computed Chain - Short (3 levels)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const a = latticeSignal(0);
        const b = latticeComputed(() => a.value * 2);
        const c = latticeComputed(() => b.value * 2);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            a.value = i;
            void c.value;
          }
        };
      });
    
      bench('Preact', function* () {
        const a = preactSignal(0);
        const b = preactComputed(() => a.value * 2);
        const c = preactComputed(() => b.value * 2);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            a.value = i;
            void c.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const a = alienSignal(0);
        const b = alienComputed(() => a() * 2);
        const c = alienComputed(() => b() * 2);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            a(i);
            void c();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();