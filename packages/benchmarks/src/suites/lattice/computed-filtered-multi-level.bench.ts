/**
 * Computed Filtered Multi-Level Benchmarks
 * 
 * Tests cascading filters through multiple computation levels
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

group('Multi-Level Filter', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const level1 = latticeComputed(() => Math.floor(source() / 5));
        const level2 = latticeComputed(() => Math.floor(level1() / 2));
        const level3 = latticeComputed(() => level2() * 1000);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void level3();
          }
        };
      });
    
      bench('Preact', function* () {
        const source = preactSignal(0);
        const level1 = preactComputed(() => Math.floor(source.value / 5));
        const level2 = preactComputed(() => Math.floor(level1.value / 2));
        const level3 = preactComputed(() => level2.value * 1000);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void level3.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const level1 = alienComputed(() => Math.floor(source() / 5));
        const level2 = alienComputed(() => Math.floor(level1() / 2));
        const level3 = alienComputed(() => level2() * 1000);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void level3();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();