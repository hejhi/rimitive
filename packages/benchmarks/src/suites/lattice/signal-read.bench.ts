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
import { createSignalFactory, type SignalFunction } from '@lattice/signals/signal';
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

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalFunction<T>;

const ITERATIONS = 100000;

group('Signal Reads', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - reads', function* () {
        const signal = latticeSignal(42);
  
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal();  // ALIEN-SIGNALS PATTERN: Function call for reads
          }
          return sum;
        };
      });

      bench('Preact - reads', function* () {
        const signal = preactSignal(42);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal.value;
          }
          return sum;
        };
      });
    
      bench('Alien - reads', function* () {
        const signal = alienSignal(42);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal();
          }
          return sum;
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();