/**
 * Memory Pressure Benchmark
 * 
 * Tests if Lattice degrades under sustained load.
 * Measures performance over time to detect memory/cache issues.
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createApi } from './helpers/signal-computed';

const latticeAPI = createApi();

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

// Test different iteration counts to see degradation
const SMALL_ITERATIONS = 1000;
const MEDIUM_ITERATIONS = 100000;
const LARGE_ITERATIONS = 1000000;

group('Memory Pressure - Fixed Chain, Varying Iterations', () => {
  // 5-level chain to show realistic propagation
  const CHAIN_DEPTH = 5;
  
  summary(() => {
    barplot(() => {
      // Small iterations (cold cache)
      bench('Lattice - 1K iterations', function* () {
        const s = latticeSignal(0);
        let last = s;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = latticeComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < SMALL_ITERATIONS; i++) {
            s(i);
            final();
          }
        };
      });
      
      bench('Lattice - 100K iterations', function* () {
        const s = latticeSignal(0);
        let last = s;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = latticeComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < MEDIUM_ITERATIONS; i++) {
            s(i);
            final();
          }
        };
      });
      
      bench('Lattice - 1M iterations', function* () {
        const s = latticeSignal(0);
        let last = s;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = latticeComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < LARGE_ITERATIONS; i++) {
            s(i);
            final();
          }
        };
      });
      
      // Compare with Alien
      bench('Alien - 1K iterations', function* () {
        const s = alienSignal(0);
        let last = s;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = alienComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < SMALL_ITERATIONS; i++) {
            s(i);
            final();
          }
        };
      });
      
      bench('Alien - 100K iterations', function* () {
        const s = alienSignal(0);
        let last = s;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = alienComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < MEDIUM_ITERATIONS; i++) {
            s(i);
            final();
          }
        };
      });
      
      bench('Alien - 1M iterations', function* () {
        const s = alienSignal(0);
        let last = s;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = alienComputed(() => prev() + 1);
        }
        const final = last;
        
        yield () => {
          for (let i = 0; i < LARGE_ITERATIONS; i++) {
            s(i);
            final();
          }
        };
      });
    });
  });
});

group('Cache Thrashing Test - Interleaved Updates', () => {
  summary(() => {
    barplot(() => {
      // Test if switching between multiple chains causes cache issues
      bench('Lattice - single chain repeated', function* () {
        const s = latticeSignal(0);
        const c1 = latticeComputed(() => s() * 2);
        const c2 = latticeComputed(() => c1() + 1);
        
        yield () => {
          for (let i = 0; i < 100000; i++) {
            s(i);
            c2();
          }
        };
      });
      
      bench('Lattice - 10 chains interleaved', function* () {
        // Create 10 independent chains
        const chains = Array.from({ length: 10 }, (_, idx) => {
          const s = latticeSignal(idx);
          const c1 = latticeComputed(() => s() * 2);
          const c2 = latticeComputed(() => c1() + 1);
          return { s, final: c2 };
        });
        
        yield () => {
          // Update chains in round-robin fashion
          for (let i = 0; i < 10000; i++) {
            for (let j = 0; j < 10; j++) {
              chains[j]!.s(i);
              chains[j]!.final();
            }
          }
        };
      });
      
      bench('Alien - single chain repeated', function* () {
        const s = alienSignal(0);
        const c1 = alienComputed(() => s() * 2);
        const c2 = alienComputed(() => c1() + 1);
        
        yield () => {
          for (let i = 0; i < 100000; i++) {
            s(i);
            c2();
          }
        };
      });
      
      bench('Alien - 10 chains interleaved', function* () {
        const chains = Array.from({ length: 10 }, (_, idx) => {
          const s = alienSignal(idx);
          const c1 = alienComputed(() => s() * 2);
          const c2 = alienComputed(() => c1() + 1);
          return { s, final: c2 };
        });
        
        yield () => {
          for (let i = 0; i < 10000; i++) {
            for (let j = 0; j < 10; j++) {
              chains[j]!.s(i);
              chains[j]!.final();
            }
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();