/**
 * Batch Operations Benchmark
 * 
 * Tests batching multiple signal updates to minimize recomputations
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  batch as preactBatch,
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
  startBatch as alienStartBatch,
  endBatch as alienEndBatch,
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
const latticeBatch = latticeAPI.batch as <T>(fn: () => T) => T;

const ITERATIONS = 10000;

group('Batch 3 Signal Updates', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const s1 = preactSignal(0);
        const s2 = preactSignal(0);
        const s3 = preactSignal(0);
        const sum = preactComputed(() => s1.value + s2.value + s3.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            preactBatch(() => {
              s1.value = i;
              s2.value = i * 2;
              s3.value = i * 3;
            });
            void sum.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const s1 = latticeSignal(0);
        const s2 = latticeSignal(0);
        const s3 = latticeSignal(0);
        const sum = latticeComputed(() => s1.value + s2.value + s3.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            latticeBatch(() => {
              s1.value = i;
              s2.value = i * 2;
              s3.value = i * 3;
            });
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const s1 = alienSignal(0);
        const s2 = alienSignal(0);
        const s3 = alienSignal(0);
        const sum = alienComputed(() => s1() + s2() + s3());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            alienStartBatch();
            s1(i);
            s2(i * 2);
            s3(i * 3);
            alienEndBatch();
            void sum();
          }
        };
      });
    });
  });
});

group('Batch 10 Signal Updates', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const signals = Array.from({ length: 10 }, () => preactSignal(0));
        const sum = preactComputed(() => 
          signals.reduce((acc, s) => acc + s.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            preactBatch(() => {
              signals.forEach((s, idx) => {
                s.value = i * (idx + 1);
              });
            });
            void sum.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const signals = Array.from({ length: 10 }, () => latticeSignal(0));
        const sum = latticeComputed(() => 
          signals.reduce((acc, s) => acc + s.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            latticeBatch(() => {
              signals.forEach((s, idx) => {
                s.value = i * (idx + 1);
              });
            });
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const signals = Array.from({ length: 10 }, () => alienSignal(0));
        const sum = alienComputed(() => 
          signals.reduce((acc, s) => acc + s(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            alienStartBatch();
            signals.forEach((s, idx) => {
              s(i * (idx + 1));
            });
            alienEndBatch();
            void sum();
          }
        };
      });
    });
  });
});

group('Nested Batch Operations', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const signals = Array.from({ length: 5 }, () => preactSignal(0));
        const computeds = signals.map((s, i) => 
          preactComputed(() => s.value * (i + 1))
        );
        const sum = preactComputed(() => 
          computeds.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 5; i++) {
            preactBatch(() => {
              preactBatch(() => {
                signals[0]!.value = i;
                signals[1]!.value = i * 2;
              });
              preactBatch(() => {
                signals[2]!.value = i * 3;
                signals[3]!.value = i * 4;
                signals[4]!.value = i * 5;
              });
            });
            void sum.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const signals = Array.from({ length: 5 }, () => latticeSignal(0));
        const computeds = signals.map((s, i) => 
          latticeComputed(() => s.value * (i + 1))
        );
        const sum = latticeComputed(() => 
          computeds.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 5; i++) {
            latticeBatch(() => {
              latticeBatch(() => {
                signals[0]!.value = i;
                signals[1]!.value = i * 2;
              });
              latticeBatch(() => {
                signals[2]!.value = i * 3;
                signals[3]!.value = i * 4;
                signals[4]!.value = i * 5;
              });
            });
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const signals = Array.from({ length: 5 }, () => alienSignal(0));
        const computeds = signals.map((s, i) => 
          alienComputed(() => s() * (i + 1))
        );
        const sum = alienComputed(() => 
          computeds.reduce((acc, c) => acc + c(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 5; i++) {
            alienStartBatch();
            alienStartBatch();
            signals[0]!(i);
            signals[1]!(i * 2);
            alienEndBatch();
            alienStartBatch();
            signals[2]!(i * 3);
            signals[3]!(i * 4);
            signals[4]!(i * 5);
            alienEndBatch();
            alienEndBatch();
            void sum();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();