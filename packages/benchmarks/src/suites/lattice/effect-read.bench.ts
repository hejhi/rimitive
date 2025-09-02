/**
 * Effect Read Benchmarks
 * 
 * Focused on effects reading from signals
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createEffectFactory, type EffectDisposer } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  effect as alienEffect,
} from 'alien-signals';
import { createBaseContext } from '@lattice/signals/context';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createNodeScheduler } from '@lattice/signals/helpers/node-scheduler';
import { createPushPropagator } from '@lattice/signals/helpers/push-propagator';

// Create Lattice API instance
const baseCtx = createBaseContext();
const pullPropagator = createPullPropagator();
const graphEdges = createGraphEdges();
const nodeScheduler = createNodeScheduler(baseCtx, pullPropagator.pullUpdates);
const pushPropagator = createPushPropagator();

// Create Lattice API instance
const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    effect: createEffectFactory,
  },
  {
    ...createBaseContext(),
    nodeScheduler,
    graphEdges,
    pushPropagator,
    pullPropagator,
  }
);

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;

const ITERATIONS = 100000;

group('Effect Reads', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - effect reads', function* () {
        const signal = preactSignal(42);
        let sum = 0;
        const dispose = preactEffect(() => {
          sum += signal.value;
        });
        
        // Initial read to establish dependency
        void signal.value;
        
        yield () => {
          // Just read signal value in effect multiple times
          // by repeatedly running the effect
          sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            // Trigger effect re-run by incrementing signal
            signal.value = i;
          }
          return sum;
        };
        
        dispose();
      });
    
      bench('Lattice - effect reads', function* () {
        const signal = latticeSignal(42);
        let sum = 0;
        const dispose = latticeEffect(() => {
          sum += signal();
        });
        
        // Initial read to establish dependency
        void signal();
        
        yield () => {
          sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            // Trigger effect re-run by incrementing signal
            signal(i);
          }
          return sum;
        };
        
        dispose();
      });
    
      bench('Alien - effect reads', function* () {
        const signal = alienSignal(42);
        let sum = 0;
        const dispose = alienEffect(() => {
          sum += signal();
        });
        
        // Initial read to establish dependency
        void signal();
        
        yield () => {
          sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            // Trigger effect re-run by incrementing signal
            signal(i);
          }
          return sum;
        };
        
        dispose();
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();