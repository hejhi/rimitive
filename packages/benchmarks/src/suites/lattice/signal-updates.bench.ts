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
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';
import { createEffectFactory, type EffectDisposer } from '@lattice/signals/effect';
type LatticeExtension<N extends string, M> = { name: N; method: M };
import {
  signal as alienSignal,
} from 'alien-signals';

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
  batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;

const ITERATIONS = 100000;

group('Signal Updates', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - writes (no subscribers)', function* () {
        const signal = preactSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
    
      bench('Lattice - writes (no subscribers)', function* () {
        const signal = latticeSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
    
      bench('Alien - writes (no subscribers)', function* () {
        const signal = alienSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
      });
    
      bench('Preact - reads only', function* () {
        const signal = preactSignal(42);
        // Warm up
        void signal.value;
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal.value;
          }
          return sum;
        };
      });
    
      bench('Lattice - reads only', function* () {
        const signal = latticeSignal(42);
        // Warm up
        void signal.value;
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal.value;
          }
          return sum;
        };
      });
    
      bench('Alien - reads only', function* () {
        const signal = alienSignal(42);
        // Warm up
        void signal();
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal();
          }
          return sum;
        };
      });
    
      bench('Preact - reads/writes mixed', function* () {
        const signal = preactSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
            void signal.value;
          }
        };
      });
    
      bench('Lattice - reads/writes mixed', function* () {
        const signal = latticeSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
            void signal.value;
          }
        };
      });
    
      bench('Alien - reads/writes mixed', function* () {
        const signal = alienSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
            void signal();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();