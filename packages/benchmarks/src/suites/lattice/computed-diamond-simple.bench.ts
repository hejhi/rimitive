/**
 * Simple Diamond Dependency Benchmarks
 * 
 * Tests simple diamond-shaped dependency graphs where two paths converge
 *       source
 *       /    \
 *     left  right
 *       \    /
 *       bottom
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

group('Simple Diamond', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const left = latticeComputed(() => source.value * 2);
        const right = latticeComputed(() => source.value * 3);
        const bottom = latticeComputed(() => left.value + right.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Preact', function* () {
        const source = preactSignal(0);
        const left = preactComputed(() => source.value * 2);
        const right = preactComputed(() => source.value * 3);
        const bottom = preactComputed(() => left.value + right.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const left = alienComputed(() => source() * 2);
        const right = alienComputed(() => source() * 3);
        const bottom = alienComputed(() => left() + right());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void bottom();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();