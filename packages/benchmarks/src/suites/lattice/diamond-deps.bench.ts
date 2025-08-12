/**
 * Diamond Dependency Benchmarks
 * 
 * Tests diamond-shaped dependency graphs where multiple paths converge
 *       source
 *       /    \
 *     left  right
 *       \    /
 *       bottom
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

group('Simple Diamond', () => {
  summary(() => {
    barplot(() => {
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

group('Wide Diamond (10 paths)', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        const branches = Array.from({ length: 10 }, (_, i) => 
          preactComputed(() => source.value * (i + 1))
        );
        const bottom = preactComputed(() => 
          branches.reduce((sum, b) => sum + b.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const branches = Array.from({ length: 10 }, (_, i) => 
          latticeComputed(() => source.value * (i + 1))
        );
        const bottom = latticeComputed(() => 
          branches.reduce((sum, b) => sum + b.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const branches = Array.from({ length: 10 }, (_, i) => 
          alienComputed(() => source() * (i + 1))
        );
        const bottom = alienComputed(() => 
          branches.reduce((sum, b) => sum + b(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source(i);
            void bottom();
          }
        };
      });
    });
  });
});

group('Nested Diamond', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        // First diamond
        const source = preactSignal(0);
        const left1 = preactComputed(() => source.value * 2);
        const right1 = preactComputed(() => source.value * 3);
        const middle = preactComputed(() => left1.value + right1.value);
        
        // Second diamond
        const left2 = preactComputed(() => middle.value * 2);
        const right2 = preactComputed(() => middle.value * 3);
        const bottom = preactComputed(() => left2.value + right2.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 2; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        // First diamond
        const source = latticeSignal(0);
        const left1 = latticeComputed(() => source.value * 2);
        const right1 = latticeComputed(() => source.value * 3);
        const middle = latticeComputed(() => left1.value + right1.value);
        
        // Second diamond
        const left2 = latticeComputed(() => middle.value * 2);
        const right2 = latticeComputed(() => middle.value * 3);
        const bottom = latticeComputed(() => left2.value + right2.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 2; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Alien', function* () {
        // First diamond
        const source = alienSignal(0);
        const left1 = alienComputed(() => source() * 2);
        const right1 = alienComputed(() => source() * 3);
        const middle = alienComputed(() => left1() + right1());
        
        // Second diamond
        const left2 = alienComputed(() => middle() * 2);
        const right2 = alienComputed(() => middle() * 3);
        const bottom = alienComputed(() => left2() + right2());
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 2; i++) {
            source(i);
            void bottom();
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