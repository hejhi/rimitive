/**
 * Effect Multiple Benchmarks
 * 
 * Tests multiple effects subscribing to the same signal (fanout pattern)
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

group('Multiple Effects (10 effects)', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - 10 effects', function* () {
        const signal = preactSignal(0);
        const counters = Array(10).fill(0);
        const disposers = counters.map((_, i) => 
          preactEffect(() => {
            counters[i] += signal.value;
          })
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            signal.value = i;
          }
        };
        
        disposers.forEach(d => d());
      });
    
      bench('Lattice - 10 effects', function* () {
        const signal = latticeSignal(0);
        const counters = Array(10).fill(0);
        const disposers = counters.map((_, i) => 
          latticeEffect(() => {
            counters[i] += signal.value;
          })
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            signal.value = i;
          }
        };
        
        disposers.forEach(d => d());
      });
    
      bench('Alien - 10 effects', function* () {
        const signal = alienSignal(0);
        const counters = Array(10).fill(0);
        const disposers = counters.map((_, i) => 
          alienEffect(() => {
            counters[i] += signal();
          })
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            signal(i);
          }
        };
        
        disposers.forEach(d => d());
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();