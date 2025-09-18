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
import {
  signal as alienSignal,
} from 'alien-signals';
import { createApi } from './helpers/signal';

const latticeAPI = createApi();
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