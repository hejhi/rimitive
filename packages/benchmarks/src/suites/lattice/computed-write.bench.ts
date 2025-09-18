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