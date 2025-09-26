/**
 * Computed Chain Deep Scaling Benchmark
 *
 * Tests deep linear chains to validate O(1) propagation complexity.
 * Key metric: Propagation time should be linear with chain depth, not exponential.
 * Tests topological ordering and push-pull optimization.
 *
 * Scaling: Tests chain patterns with increasing depth
 * - 10 levels: Short chain efficiency test
 * - 20 levels: Medium chain complexity
 * - 50 levels: Long chain performance
 * - 100 levels: Deep chain stress test
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createApi } from './helpers/signal-computed';

const ITERATIONS = 10000;
const latticeAPI = createApi();
const { signal: latticeSignal, computed: latticeComputed } = latticeAPI;

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