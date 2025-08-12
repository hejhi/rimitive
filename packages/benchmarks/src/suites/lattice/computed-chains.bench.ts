/**
 * Computed Chain Benchmarks
 * 
 * Tests linear chains of computed values: a → b → c → d
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

group('Computed Chain - Short (3 levels)', () => {
  summary(() => {
    barplot(() => {
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

group('Computed Chain - Deep (10 levels)', () => {
  summary(() => {
    barplot(() => {
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
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        let last: { value: number } = source;
        for (let i = 0; i < 10; i++) {
          const prev = last;
          last = latticeComputed(() => prev.value + 1);
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

group('Computed Chain - Very Deep (50 levels)', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        let last = source;
        for (let i = 0; i < 50; i++) {
          const prev = last;
          last = preactComputed(() => prev.value + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        let last: { value: number } = source;
        for (let i = 0; i < 50; i++) {
          const prev = last;
          last = latticeComputed(() => prev.value + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        let last = source;
        for (let i = 0; i < 50; i++) {
          const prev = last;
          last = alienComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
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