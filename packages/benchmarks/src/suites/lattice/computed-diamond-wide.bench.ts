/**
 * Wide Diamond Dependency Benchmarks
 * 
 * Tests wide diamond-shaped dependency graphs with many parallel paths
 *          source
 *        /   |   \
 *      /     |     \
 *    b1  b2  ...  b10
 *      \     |     /
 *        \   |   /
 *         bottom
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
const pushPropagator = createPushPropagator(nodeScheduler.enqueue);

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

group('Wide Diamond (10 paths)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const branches = Array.from({ length: 10 }, (_, i) => 
          latticeComputed(() => source() * (i + 1))
        );
        const bottom = latticeComputed(() => 
          branches.reduce((sum, b) => sum + b(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source(i);
            void bottom();
          }
        };
      });
    
      bench('Preact', function* () {
        const source = preactSignal(0);
        const branches = Array.from({ length: 10 }, (_, i) => 
          preactComputed(() => source.value * (i + 1))
        );
        const bottom = preactComputed(() => 
          branches.reduce((sum, b) => sum + b.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const branches = Array.from({ length: 10 }, (_, i) => 
          alienComputed(() => source() * (i + 1))
        );
        const bottom = alienComputed(() => 
          branches.reduce((sum, b) => sum + b(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
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