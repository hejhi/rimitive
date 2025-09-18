/**
 * Computed Chain Short Benchmarks
 * 
 * Tests short linear chains of computed values (3 levels): a → b → c
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

group('Computed Chain - Short (3 levels)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const a = latticeSignal(0);
        const b = latticeComputed(() => a() * 2);
        const c = latticeComputed(() => b() * 2);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            a(i);
            void c();
          }
        };
      });
    
      bench('Preact', function* () {
        const a = preactSignal(0);
        const b = preactComputed(() => a.value * 2);
        const c = preactComputed(() => b.value * 2);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            a.value = i;
            void c.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const a = alienSignal(0);
        const b = alienComputed(() => a() * 2);
        const c = alienComputed(() => b() * 2);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            a(i);
            void c();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();