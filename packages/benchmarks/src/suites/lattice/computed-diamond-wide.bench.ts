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