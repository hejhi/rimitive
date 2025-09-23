/**
 * Simple Diamond Dependency Benchmarks
 * 
 * Tests diamond-shaped dependency graphs for glitch prevention.
 * The key metric: bottom computed should calculate ONCE per source update,
 * seeing consistent values from both paths (no intermediate states).
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
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createApi } from './helpers/signal-computed';

const ITERATIONS = 100000; // Increased for better precision

group('Simple Diamond', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        // Create a single API instance but track what we create
        const latticeAPI = createApi();
        const latticeSignal = latticeAPI.signal;
        const latticeComputed = latticeAPI.computed;

        // Setup phase - create nodes once
        let source: any;
        let left: any;
        let right: any;
        let bottom: any;

        yield () => {
          // Create fresh nodes for each sample iteration
          source = latticeSignal(0);
          left = latticeComputed(() => {
            const val = source();
            // Simulate non-trivial computation
            let result = val;
            for (let j = 0; j < 5; j++) {
              result = (result * 31 + j) % 1000007;
            }
            return result;
          });
          right = latticeComputed(() => {
            const val = source();
            // Different computation path
            let result = val;
            for (let j = 0; j < 5; j++) {
              result = (result * 37 + j * 2) % 1000007;
            }
            return result;
          });
          bottom = latticeComputed(() => {
            // Should see consistent snapshot - both paths updated
            const l = left();
            const r = right();
            // Additional computation at convergence
            return (l * l + r * r) % 1000007;
          });

          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void bottom();
          }
        };
      });
    
      bench('Preact', function* () {
        const source = preactSignal(0);
        const left = preactComputed(() => {
          const val = source.value;
          let result = val;
          for (let j = 0; j < 5; j++) {
            result = (result * 31 + j) % 1000007;
          }
          return result;
        });
        const right = preactComputed(() => {
          const val = source.value;
          let result = val;
          for (let j = 0; j < 5; j++) {
            result = (result * 37 + j * 2) % 1000007;
          }
          return result;
        });
        const bottom = preactComputed(() => {
          const l = left.value;
          const r = right.value;
          return (l * l + r * r) % 1000007;
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void bottom.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const left = alienComputed(() => {
          const val = source();
          let result = val;
          for (let j = 0; j < 5; j++) {
            result = (result * 31 + j) % 1000007;
          }
          return result;
        });
        const right = alienComputed(() => {
          const val = source();
          let result = val;
          for (let j = 0; j < 5; j++) {
            result = (result * 37 + j * 2) % 1000007;
          }
          return result;
        });
        const bottom = alienComputed(() => {
          const l = left();
          const r = right();
          return (l * l + r * r) % 1000007;
        });
        
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