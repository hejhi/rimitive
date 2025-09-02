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