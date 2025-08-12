/**
 * Wide Fan-out Benchmarks
 * 
 * Tests scenarios where one signal has many dependent computeds
 */

import { run, bench, group, summary, barplot } from 'mitata';
import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
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
  effect as alienEffect,
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
const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;

const ITERATIONS = 1000;

group('Fan-out 10 Computeds', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        const computeds = Array.from({ length: 10 }, (_, i) => 
          preactComputed(() => source.value * (i + 1))
        );
        const sum = preactComputed(() => 
          computeds.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void sum.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const computeds = Array.from({ length: 10 }, (_, i) => 
          latticeComputed(() => source.value * (i + 1))
        );
        const sum = latticeComputed(() => 
          computeds.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const computeds = Array.from({ length: 10 }, (_, i) => 
          alienComputed(() => source() * (i + 1))
        );
        const sum = alienComputed(() => 
          computeds.reduce((acc, c) => acc + c(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void sum();
          }
        };
      });
    });
  });
});

group('Fan-out 100 Computeds', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        const computeds = Array.from({ length: 100 }, (_, i) => 
          preactComputed(() => source.value * (i + 1))
        );
        const dispose = preactEffect(() => {
          computeds.reduce((acc, c) => acc + c.value, 0);
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source.value = i;
          }
        };
        
        dispose();
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const computeds = Array.from({ length: 100 }, (_, i) => 
          latticeComputed(() => source.value * (i + 1))
        );
        const dispose = latticeEffect(() => {
          computeds.reduce((acc, c) => acc + c.value, 0);
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source.value = i;
          }
        };
        
        dispose();
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const computeds = Array.from({ length: 100 }, (_, i) => 
          alienComputed(() => source() * (i + 1))
        );
        const dispose = alienEffect(() => {
          computeds.reduce((acc, c) => acc + c(), 0);
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source(i);
          }
        };
        
        dispose();
      });
    });
  });
});

group('Mixed Fan-out', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        // 50 direct computeds
        const direct = Array.from({ length: 50 }, (_, i) => 
          preactComputed(() => source.value + i)
        );
        // 50 indirect computeds (depend on direct)
        const indirect = direct.map((d, i) => 
          preactComputed(() => d.value * 2)
        );
        const sum = preactComputed(() => 
          indirect.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source.value = i;
            void sum.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        // 50 direct computeds
        const direct = Array.from({ length: 50 }, (_, i) => 
          latticeComputed(() => source.value + i)
        );
        // 50 indirect computeds (depend on direct)
        const indirect = direct.map((d, i) => 
          latticeComputed(() => d.value * 2)
        );
        const sum = latticeComputed(() => 
          indirect.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source.value = i;
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        // 50 direct computeds
        const direct = Array.from({ length: 50 }, (_, i) => 
          alienComputed(() => source() + i)
        );
        // 50 indirect computeds (depend on direct)
        const indirect = direct.map((d, i) => 
          alienComputed(() => d() * 2)
        );
        const sum = alienComputed(() => 
          indirect.reduce((acc, c) => acc + c(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source(i);
            void sum();
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