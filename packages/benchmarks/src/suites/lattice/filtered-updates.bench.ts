/**
 * Filtered Updates Benchmark
 * 
 * Tests push-pull optimization where intermediate computeds filter out changes
 * Key insight: If a computed's value doesn't change, downstream shouldn't recompute
 */

import { run, bench, group } from 'mitata';
import {
  signal as preactSignal,
  computed as preactComputed,
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
  computed as alienComputed,
} from 'alien-signals';

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
  batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

const ITERATIONS = 10000;

group('Threshold Filter', () => {
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

group('Boolean Filter', () => {
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

group('Multi-Level Filter', () => {
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

  bench('Lattice', function* () {
    const source = latticeSignal(0);
    const level1 = latticeComputed(() => Math.floor(source.value / 5));
    const level2 = latticeComputed(() => Math.floor(level1.value / 2));
    const level3 = latticeComputed(() => level2.value * 1000);
    
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

// Run benchmarks
const format = process.env.BENCHMARK_FORMAT === 'json' 
  ? { json: { debug: false, samples: false } }
  : undefined;

const results = await run({ format });

if (process.env.BENCHMARK_FORMAT === 'json') {
  console.log(JSON.stringify(results, null, 2));
}