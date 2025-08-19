/**
 * Effect Mixed Benchmarks
 * 
 * Focused on effects both reading and writing signals
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

group('Effect Mixed', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - mixed effect operations', function* () {
        const source1 = preactSignal(0);
        const source2 = preactSignal(0);
        const output = preactSignal(0);
        const dispose = preactEffect(() => {
          // Read from multiple sources and write to output
          output.value = source1.value + source2.value;
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            if (i % 2 === 0) {
              source1.value = i;
            } else {
              source2.value = i;
            }
          }
        };
        
        dispose();
      });
    
      bench('Lattice - mixed effect operations', function* () {
        const source1 = latticeSignal(0);
        const source2 = latticeSignal(0);
        const output = latticeSignal(0);
        const dispose = latticeEffect(() => {
          // Read from multiple sources and write to output
          output.value = source1.value + source2.value;
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            if (i % 2 === 0) {
              source1.value = i;
            } else {
              source2.value = i;
            }
          }
        };
        
        dispose();
      });
    
      bench('Alien - mixed effect operations', function* () {
        const source1 = alienSignal(0);
        const source2 = alienSignal(0);
        const output = alienSignal(0);
        const dispose = alienEffect(() => {
          // Read from multiple sources and write to output
          output(source1() + source2());
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            if (i % 2 === 0) {
              source1(i);
            } else {
              source2(i);
            }
          }
        };
        
        dispose();
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();