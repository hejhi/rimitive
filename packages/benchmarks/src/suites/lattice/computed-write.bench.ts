/**
 * Computed Write Benchmarks
 * 
 * Focused on writing to signals that computeds depend on
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import {
  signal as alienSignal,
  computed as alienComputed,
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
    computed: createComputedFactory,
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
const latticeComputed = latticeAPI.computed as <T>(fn: () => T) => ComputedInterface<T>;

const ITERATIONS = 100000;

group('Computed Writes (underlying signals)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - writes to signal with computed', function* () {
        const signal = latticeSignal(0);
        const computed = latticeComputed(() => signal() * 2);
        // Touch computed to establish dependency
        void computed();

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
      });
    
      bench('Preact - writes to signal with computed', function* () {
        const signal = preactSignal(0);
        const computed = preactComputed(() => signal.value * 2);
        // Touch computed to establish dependency
        void computed.value;

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
    
      bench('Alien - writes to signal with computed', function* () {
        const signal = alienSignal(0);
        const computed = alienComputed(() => signal() * 2);
        // Touch computed to establish dependency
        void computed();

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