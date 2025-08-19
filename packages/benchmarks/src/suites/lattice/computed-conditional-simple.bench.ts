/**
 * Simple Conditional Dependencies Benchmark
 * 
 * Tests scenarios where computed dependencies change based on a simple condition
 * Important for push-pull optimization where inactive branches shouldn't compute
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

group('Simple Conditional', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const condition = latticeSignal(true);
        const whenTrue = latticeSignal(1);
        const whenFalse = latticeSignal(2);
        const result = latticeComputed(() => 
          condition.value ? whenTrue.value : whenFalse.value
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Toggle condition
            condition.value = i % 2 === 0;
            // Update the inactive branch
            if (condition.value) {
              whenFalse.value = i;
            } else {
              whenTrue.value = i;
            }
            void result.value;
          }
        };
      });
    
      bench('Preact', function* () {
        const condition = preactSignal(true);
        const whenTrue = preactSignal(1);
        const whenFalse = preactSignal(2);
        const result = preactComputed(() => 
          condition.value ? whenTrue.value : whenFalse.value
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Toggle condition
            condition.value = i % 2 === 0;
            // Update the inactive branch
            if (condition.value) {
              whenFalse.value = i;
            } else {
              whenTrue.value = i;
            }
            void result.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const condition = alienSignal(true);
        const whenTrue = alienSignal(1);
        const whenFalse = alienSignal(2);
        const result = alienComputed(() => 
          condition() ? whenTrue() : whenFalse()
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Toggle condition
            condition(i % 2 === 0);
            // Update the inactive branch
            if (condition()) {
              whenFalse(i);
            } else {
              whenTrue(i);
            }
            void result();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();