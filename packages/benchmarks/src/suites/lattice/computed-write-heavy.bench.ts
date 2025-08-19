/**
 * Write-Heavy Pattern Benchmark
 * 
 * Tests scenarios with many writes but few reads
 * Important for understanding lazy evaluation benefits
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

type LatticeExtension<N extends string, M> = { name: N; method: M };
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

const ITERATIONS = 10000;

group('100 Writes, 1 Read', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        const c1 = preactComputed(() => source.value * 2);
        const c2 = preactComputed(() => c1.value * 2);
        const c3 = preactComputed(() => c2.value * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // 100 writes
            for (let i = 0; i < 100; i++) {
              source.value = batch * 100 + i;
            }
            // 1 read
            void c3.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const c1 = latticeComputed(() => source.value * 2);
        const c2 = latticeComputed(() => c1.value * 2);
        const c3 = latticeComputed(() => c2.value * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // 100 writes
            for (let i = 0; i < 100; i++) {
              source.value = batch * 100 + i;
            }
            // 1 read
            void c3.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const c1 = alienComputed(() => source() * 2);
        const c2 = alienComputed(() => c1() * 2);
        const c3 = alienComputed(() => c2() * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // 100 writes
            for (let i = 0; i < 100; i++) {
              source(batch * 100 + i);
            }
            // 1 read
            void c3();
          }
        };
      });
    });
  });
});

group('1000 Writes, 1 Read', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        const c1 = preactComputed(() => source.value * 2);
        const c2 = preactComputed(() => c1.value * 2);
        const c3 = preactComputed(() => c2.value * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 1000; batch++) {
            // 1000 writes
            for (let i = 0; i < 1000; i++) {
              source.value = batch * 1000 + i;
            }
            // 1 read
            void c3.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const c1 = latticeComputed(() => source.value * 2);
        const c2 = latticeComputed(() => c1.value * 2);
        const c3 = latticeComputed(() => c2.value * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 1000; batch++) {
            // 1000 writes
            for (let i = 0; i < 1000; i++) {
              source.value = batch * 1000 + i;
            }
            // 1 read
            void c3.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const c1 = alienComputed(() => source() * 2);
        const c2 = alienComputed(() => c1() * 2);
        const c3 = alienComputed(() => c2() * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 1000; batch++) {
            // 1000 writes
            for (let i = 0; i < 1000; i++) {
              source(batch * 1000 + i);
            }
            // 1 read
            void c3();
          }
        };
      });
    });
  });
});

group('Wide Graph Write-Heavy', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const sources = Array.from({ length: 10 }, () => preactSignal(0));
        const computeds = sources.map(s => preactComputed(() => s.value * 2));
        const sum = preactComputed(() => 
          computeds.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // Many writes to different signals
            for (let i = 0; i < 100; i++) {
              sources[i % sources.length]!.value = batch * 100 + i;
            }
            // Single read
            void sum.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const sources = Array.from({ length: 10 }, () => latticeSignal(0));
        const computeds = sources.map(s => latticeComputed(() => s.value * 2));
        const sum = latticeComputed(() => 
          computeds.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // Many writes to different signals
            for (let i = 0; i < 100; i++) {
              sources[i % sources.length]!.value = batch * 100 + i;
            }
            // Single read
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const sources = Array.from({ length: 10 }, () => alienSignal(0));
        const computeds = sources.map(s => alienComputed(() => s() * 2));
        const sum = alienComputed(() => 
          computeds.reduce((acc, c) => acc + c(), 0)
        );
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // Many writes to different signals
            for (let i = 0; i < 100; i++) {
              sources[i % sources.length]!(batch * 100 + i);
            }
            // Single read
            void sum();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();