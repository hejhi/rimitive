/**
 * Signal Update Benchmarks
 * 
 * Focused on basic signal read/write operations
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import {
  signal as alienSignal,
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

const ITERATIONS = 100000;

group('Signal Writes', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - writes', function* () {
        const signal = latticeSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
      });

      bench('Preact - writes', function* () {
        const signal = preactSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
    
      bench('Alien - writes', function* () {
        const signal = alienSignal(0);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();