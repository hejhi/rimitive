/**
 * Simple Diamond Dependency Benchmarks
 * 
 * Tests simple diamond-shaped dependency graphs where two paths converge
 *       source
 *       /    \
 *     left  right
 *       \    /
 *       bottom
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

group('Simple Diamond', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const left = latticeComputed(() => source() * 2);
        const right = latticeComputed(() => source() * 3);
        const bottom = latticeComputed(() => left() + right());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void bottom();
          }
        };
      });
    
      bench('Preact', function* () {
        const source = preactSignal(0);
        const left = preactComputed(() => source.value * 2);
        const right = preactComputed(() => source.value * 3);
        const bottom = preactComputed(() => left.value + right.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const left = alienComputed(() => source() * 2);
        const right = alienComputed(() => source() * 3);
        const bottom = alienComputed(() => left() + right());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void bottom();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();