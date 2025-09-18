/**
 * Nested Diamond Dependency Benchmarks
 * 
 * Tests nested diamond patterns where diamonds feed into other diamonds
 *       source
 *       /    \
 *    left1  right1
 *       \    /
 *       middle
 *       /    \
 *    left2  right2
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
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';

const { propagate } = createGraphTraversal();
const graphEdges = createGraphEdges();
const { trackDependency } = graphEdges;
const ctx = createBaseContext();

const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
  },
  {
    ctx,
    trackDependency,
    pullUpdates: createPullPropagator({ ctx, track: graphEdges.track }).pullUpdates,
    propagate,
  }
);

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

const ITERATIONS = 10000;

group('Nested Diamond', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        // First diamond
        const source = latticeSignal(0);
        const left1 = latticeComputed(() => source() * 2);
        const right1 = latticeComputed(() => source() * 3);
        const middle = latticeComputed(() => left1() + right1());
        
        // Second diamond
        const left2 = latticeComputed(() => middle() * 2);
        const right2 = latticeComputed(() => middle() * 3);
        const bottom = latticeComputed(() => left2() + right2());
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 2; i++) {
            source(i);
            void bottom();
          }
        };
      });
      
      bench('Preact', function* () {
        // First diamond
        const source = preactSignal(0);
        const left1 = preactComputed(() => source.value * 2);
        const right1 = preactComputed(() => source.value * 3);
        const middle = preactComputed(() => left1.value + right1.value);
        
        // Second diamond
        const left2 = preactComputed(() => middle.value * 2);
        const right2 = preactComputed(() => middle.value * 3);
        const bottom = preactComputed(() => left2.value + right2.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 2; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Alien', function* () {
        // First diamond
        const source = alienSignal(0);
        const left1 = alienComputed(() => source() * 2);
        const right1 = alienComputed(() => source() * 3);
        const middle = alienComputed(() => left1() + right1());
        
        // Second diamond
        const left2 = alienComputed(() => middle() * 2);
        const right2 = alienComputed(() => middle() * 3);
        const bottom = alienComputed(() => left2() + right2());
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 2; i++) {
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