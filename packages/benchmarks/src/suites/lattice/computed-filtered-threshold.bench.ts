/**
 * Computed Filtered Threshold Benchmarks
 * 
 * Tests push-pull optimization where computeds filter out changes via thresholds
 * Key insight: If a computed's value doesn't change, downstream shouldn't recompute
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
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

const ITERATIONS = 10000;

group('Threshold Filter', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - 90% filtered', function* () {
        const source = latticeSignal(0);
        const filtered = latticeComputed(() => Math.floor(source() / 10));
        const final = latticeComputed(() => filtered() * 100);
        
        // Warm up
        source(1);
        void final();
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      });
    
      bench('Preact - 90% filtered', function* () {
        const source = preactSignal(0);
        const filtered = preactComputed(() => Math.floor(source.value / 10));
        const final = preactComputed(() => filtered.value * 100);
        
        // Warm up
        source.value = 1;
        void final.value;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Alien - 90% filtered', function* () {
        const source = alienSignal(0);
        const filtered = alienComputed(() => Math.floor(source() / 10));
        const final = alienComputed(() => filtered() * 100);
        
        // Warm up
        source(1);
        void final();
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();