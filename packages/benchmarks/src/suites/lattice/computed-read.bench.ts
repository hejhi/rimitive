/**
 * Computed Read Benchmarks
 * 
 * Focused on basic computed read operations
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

group('Computed Reads', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - computed reads', function* () {
        const one = latticeSignal(10);
        const two = latticeSignal(10);
        const computed = latticeComputed(() => one() * two() * 10);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += computed();
          }
          return sum;
        };
      });
    
      bench('Preact - computed reads', function* () {
        const one = preactSignal(10);
        const two = preactSignal(10);
        const computed = preactComputed(() => one.value * two.value * 10);

        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += computed.value;
          }
          return sum;
        };
      });
    
      bench('Alien - computed reads', function* () {
        const one = alienSignal(10);
        const two = alienSignal(10);
        const computed = alienComputed(() => one() * two() * 10);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += computed();
          }
          return sum;
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();