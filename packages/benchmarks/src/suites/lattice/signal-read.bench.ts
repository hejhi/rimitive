/**
 * Signal Update Benchmarks
 * 
 * Focused on basic signal read/write operations
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import {
  signal as alienSignal,
} from 'alien-signals';

import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

const latticeAPI = createSignalAPI({ signal: createSignalFactory }, {
  ctx: createBaseContext(),
  graphEdges: createGraphEdges(),
  propagate: createGraphTraversal().propagate
});
const latticeSignal = latticeAPI.signal;

const ITERATIONS = 100000;

group('Signal Reads', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - reads', function* () {
        const signal = latticeSignal(42);
  
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal();  // ALIEN-SIGNALS PATTERN: Function call for reads
          }
          return sum;
        };
      });

      bench('Preact - reads', function* () {
        const signal = preactSignal(42);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal.value;
          }
          return sum;
        };
      });
    
      bench('Alien - reads', function* () {
        const signal = alienSignal(42);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal();
          }
          return sum;
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();