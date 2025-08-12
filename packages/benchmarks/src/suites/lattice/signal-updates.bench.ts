/**
 * Signal Update Benchmarks
 * 
 * Focused on basic signal read/write operations
 */

import { run, bench, group } from 'mitata';
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
  bench('Preact - write only', function* () {
    const signal = preactSignal(0);
    yield () => {
      for (let i = 0; i < ITERATIONS; i++) {
        signal.value = i;
      }
    };
  });

  bench('Lattice - write only', function* () {
    const signal = latticeSignal(0);
    yield () => {
      for (let i = 0; i < ITERATIONS; i++) {
        signal.value = i;
      }
    };
  });

  bench('Alien - write only', function* () {
    const signal = alienSignal(0);
    yield () => {
      for (let i = 0; i < ITERATIONS; i++) {
        signal(i);
      }
    };
  });

  bench('Preact - read only', function* () {
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

  bench('Lattice - read only', function* () {
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

  bench('Alien - read only', function* () {
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

  bench('Preact - read/write mixed', function* () {
    const signal = preactSignal(0);
    yield () => {
      for (let i = 0; i < ITERATIONS; i++) {
        signal.value = i;
        void signal.value;
      }
    };
  });

  bench('Lattice - read/write mixed', function* () {
    const signal = latticeSignal(0);
    yield () => {
      for (let i = 0; i < ITERATIONS; i++) {
        signal.value = i;
        void signal.value;
      }
    };
  });

  bench('Alien - read/write mixed', function* () {
    const signal = alienSignal(0);
    yield () => {
      for (let i = 0; i < ITERATIONS; i++) {
        signal(i);
        void signal();
      }
    };
  });
});

// Run benchmarks
const format = process.env.BENCHMARK_FORMAT === 'json' 
  ? { json: { debug: false, samples: false } }
  : undefined;

const results = await run({ format });

if (process.env.BENCHMARK_FORMAT === 'json') {
  console.log(JSON.stringify(results, null, 2));
}