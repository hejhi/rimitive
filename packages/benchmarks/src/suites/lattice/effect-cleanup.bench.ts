/**
 * Effect Cleanup Benchmarks
 * 
 * Tests the cost of creating and disposing effects repeatedly (lifecycle overhead)
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createEffectFactory, type EffectDisposer } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  effect as alienEffect,
} from 'alien-signals';

type LatticeExtension<N extends string, M> = { name: N; method: M };

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;

const ITERATIONS = 10000;

group('Effect Cleanup', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const signal = preactSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = preactEffect(() => {
              void signal.value;
            });
            signal.value = i;
            dispose();
          }
        };
      });
    
      bench('Lattice', function* () {
        const signal = latticeSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = latticeEffect(() => {
              void signal();
            });
            signal(i);
            dispose();
          }
        };
      });
    
      bench('Alien', function* () {
        const signal = alienSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = alienEffect(() => {
              void signal();
            });
            signal(i);
            dispose();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();