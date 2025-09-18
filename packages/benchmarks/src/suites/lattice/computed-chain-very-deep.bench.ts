/**
 * Computed Chain Very Deep Benchmarks
 * 
 * Tests very deep linear chains of computed values (50 levels)
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
const ctx = createBaseContext();

const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
  },
  {
    ctx,
    graphEdges,
    propagate,
    pull: createPullPropagator(ctx, graphEdges),
  }
);

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

group('Computed Chain - Very Deep (50 levels)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        let last: (() => number) = source;
        for (let i = 0; i < 50; i++) {
          const prev = last;
          last = latticeComputed(() => prev() + 1);
        }
        const final = last;

        source(1);
        yield () => {
          void final();
        };
      });
    
      bench('Preact', function* () {
        const source = preactSignal(0);
        let last = source;
        for (let i = 0; i < 50; i++) {
          const prev = last;
          last = preactComputed(() => prev.value + 1);
        }
        const final = last;

        source.value = 1;
        yield () => {
          void final.value;
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        let last = source;
        for (let i = 0; i < 50; i++) {
          const prev = last;
          last = alienComputed(() => prev() + 1);
        }
        const final = last;

        source(1);
        yield () => {
          void final();
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();