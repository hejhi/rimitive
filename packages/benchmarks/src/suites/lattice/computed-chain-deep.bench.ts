/**
 * Computed Chain Deep Benchmarks
 * 
 * Tests deep linear chains to validate O(1) propagation complexity.
 * Key metric: Propagation time should be linear with chain depth, not exponential.
 * Tests topological ordering and push-pull optimization.
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
const { trackDependency } = graphEdges
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
    propagate
  }
);

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

const ITERATIONS = 10000;

// Type for mitata benchmark state
interface BenchState {
  get(name: 'depth'): number;
  get(name: string): unknown;
}

group('Computed Chain - Variable Depth', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - $depth levels', function* (state: BenchState) {
        const depth = state.get('depth');
        const source = latticeSignal(0);
        let last: (() => number) = source;
        
        // Build chain with non-trivial computations
        for (let i = 0; i < depth; i++) {
          const prev = last;
          const level = i; // Capture for closure
          last = latticeComputed(() => {
            const val = prev();
            // Non-trivial computation at each level
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = ((result * 31) + level + j) % 1000007;
            }
            return result;
          });
        }
        const final = last;
        
        // Warmup to establish dependencies
        source(1);
        void final();
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      })
      .args('depth', [10, 20, 50, 100]);
    
      bench('Preact - $depth levels', function* (state: BenchState) {
        const depth = state.get('depth');
        const source = preactSignal(0);
        let last = source;
        
        for (let i = 0; i < depth; i++) {
          const prev = last;
          const level = i;
          last = preactComputed(() => {
            const val = prev.value;
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = ((result * 31) + level + j) % 1000007;
            }
            return result;
          });
        }
        const final = last;
        
        // Warmup
        source.value = 1;
        void final.value;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void final.value;
          }
        };
      })
      .args('depth', [10, 20, 50, 100]);
    
      bench('Alien - $depth levels', function* (state: BenchState) {
        const depth = state.get('depth');
        const source = alienSignal(0);
        let last = source;
        
        for (let i = 0; i < depth; i++) {
          const prev = last;
          const level = i;
          last = alienComputed(() => {
            const val = prev();
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = ((result * 31) + level + j) % 1000007;
            }
            return result;
          });
        }
        const final = last;
        
        // Warmup
        source(1);
        void final();
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      })
      .args('depth', [10, 20, 50, 100]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();