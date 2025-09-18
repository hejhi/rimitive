/**
 * Computed Filtered Boolean Benchmarks
 * 
 * Tests filtering via boolean toggles where values alternate between states
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

group('Boolean Filter', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - toggle filter', function* () {
        const source = latticeSignal(0);
        const isEven = latticeComputed(() => source() % 2 === 0);
        const message = latticeComputed(() => isEven() ? 'even' : 'odd');
        const final = latticeComputed(() => message().toUpperCase());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      });
    
      bench('Preact - toggle filter', function* () {
        const source = preactSignal(0);
        const isEven = preactComputed(() => source.value % 2 === 0);
        const message = preactComputed(() => isEven.value ? 'even' : 'odd');
        const final = preactComputed(() => message.value.toUpperCase());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void final.value;
          }
        };
      });
    
      bench('Alien - toggle filter', function* () {
        const source = alienSignal(0);
        const isEven = alienComputed(() => source() % 2 === 0);
        const message = alienComputed(() => isEven() ? 'even' : 'odd');
        const final = alienComputed(() => message().toUpperCase());
        
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