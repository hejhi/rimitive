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
import { createSignalFactory } from '@lattice/signals/signal';
import { createEffectFactory } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  effect as alienEffect,
} from 'alien-signals';
import { createEffectContext } from './helpers/createEffectCtx';

const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    effect: createEffectFactory,
  },
  createEffectContext()
);

const latticeSignal = latticeAPI.signal;
const latticeEffect = latticeAPI.effect;

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
          target(source() * 2);
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
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