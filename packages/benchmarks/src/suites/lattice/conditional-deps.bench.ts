/**
 * Conditional Dependencies Benchmark
 * 
 * Tests scenarios where dependencies change based on conditions
 * Important for push-pull optimization where inactive branches shouldn't compute
 */

import { run, bench, group, summary, barplot } from 'mitata';
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

group('Simple Conditional', () => {
  summary(() => {
    barplot(() => {
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

group('Nested Conditional', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const level1 = preactSignal(true);
        const level2 = preactSignal(true);
        const a = preactSignal(1);
        const b = preactSignal(2);
        const c = preactSignal(3);
        const d = preactSignal(4);
        
        const result = preactComputed(() => {
          if (level1.value) {
            return level2.value ? a.value : b.value;
          } else {
            return level2.value ? c.value : d.value;
          }
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            level1.value = i % 4 < 2;
            level2.value = i % 2 === 0;
            // Update all branches
            a.value = i;
            b.value = i * 2;
            c.value = i * 3;
            d.value = i * 4;
            void result.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const level1 = latticeSignal(true);
        const level2 = latticeSignal(true);
        const a = latticeSignal(1);
        const b = latticeSignal(2);
        const c = latticeSignal(3);
        const d = latticeSignal(4);
        
        const result = latticeComputed(() => {
          if (level1.value) {
            return level2.value ? a.value : b.value;
          } else {
            return level2.value ? c.value : d.value;
          }
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            level1.value = i % 4 < 2;
            level2.value = i % 2 === 0;
            // Update all branches
            a.value = i;
            b.value = i * 2;
            c.value = i * 3;
            d.value = i * 4;
            void result.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const level1 = alienSignal(true);
        const level2 = alienSignal(true);
        const a = alienSignal(1);
        const b = alienSignal(2);
        const c = alienSignal(3);
        const d = alienSignal(4);
        
        const result = alienComputed(() => {
          if (level1()) {
            return level2() ? a() : b();
          } else {
            return level2() ? c() : d();
          }
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            level1(i % 4 < 2);
            level2(i % 2 === 0);
            // Update all branches
            a(i);
            b(i * 2);
            c(i * 3);
            d(i * 4);
            void result();
          }
        };
      });
    });
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