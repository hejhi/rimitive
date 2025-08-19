/**
 * Effect Write Benchmarks
 * 
 * Focused on effects writing to other signals (side effects)
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

const ITERATIONS = 100000;

group('Effect Writes', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - effect writes', function* () {
        const source = preactSignal(0);
        const target = preactSignal(0);
        const dispose = preactEffect(() => {
          target.value = source.value * 2;
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
          }
        };
        
        dispose();
      });
    
      bench('Lattice - effect writes', function* () {
        const source = latticeSignal(0);
        const target = latticeSignal(0);
        const dispose = latticeEffect(() => {
          target.value = source.value * 2;
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
          }
        };
        
        dispose();
      });
    
      bench('Alien - effect writes', function* () {
        const source = alienSignal(0);
        const target = alienSignal(0);
        const dispose = alienEffect(() => {
          target(source() * 2);
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
          }
        };
        
        dispose();
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();