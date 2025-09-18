/**
 * Minimal Propagation Benchmark
 * 
 * Tests the absolute minimum propagation overhead.
 * Single signal -> single computed -> read
 * This isolates per-hop propagation cost without graph complexity.
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
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

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
    pullUpdates: createPullPropagator(ctx, graphEdges).pullUpdates,
    propagate,
  }
);

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

const ITERATIONS = 1000000; // 1M for high precision

group('Minimal Propagation - Single Hop', () => {
  summary(() => {
    barplot(() => {
      // Test 1: Single computed (s -> c -> read)
      bench('Lattice - single hop', function* () {
        const s = latticeSignal(0);
        const c = latticeComputed(() => s() + 1);
        
        // Warmup
        s(1);
        c();
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s(i);
            c(); // Force propagation and read
          }
        };
      });
    
      bench('Preact - single hop', function* () {
        const s = preactSignal(0);
        const c = preactComputed(() => s.value + 1);
        
        // Warmup
        s.value = 1;
        void c.value;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s.value = i;
            void c.value;
          }
        };
      });
    
      bench('Alien - single hop', function* () {
        const s = alienSignal(0);
        const c = alienComputed(() => s() + 1);
        
        // Warmup
        s(1);
        c();
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s(i);
            c();
          }
        };
      });
    });
  });
});

group('Minimal Propagation - Two Hops', () => {
  summary(() => {
    barplot(() => {
      // Test 2: Two computed (s -> c1 -> c2 -> read)
      bench('Lattice - two hops', function* () {
        const s = latticeSignal(0);
        const c1 = latticeComputed(() => s() + 1);
        const c2 = latticeComputed(() => c1() + 1);
        
        // Warmup
        s(1);
        c2();
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s(i);
            c2(); // Force propagation through chain
          }
        };
      });
    
      bench('Preact - two hops', function* () {
        const s = preactSignal(0);
        const c1 = preactComputed(() => s.value + 1);
        const c2 = preactComputed(() => c1.value + 1);
        
        // Warmup
        s.value = 1;
        void c2.value;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s.value = i;
            void c2.value;
          }
        };
      });
    
      bench('Alien - two hops', function* () {
        const s = alienSignal(0);
        const c1 = alienComputed(() => s() + 1);
        const c2 = alienComputed(() => c1() + 1);
        
        // Warmup
        s(1);
        c2();
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s(i);
            c2();
          }
        };
      });
    });
  });
});

group('Pure Signal Operations - No Propagation', () => {
  summary(() => {
    barplot(() => {
      // Test 3: Just signal write and read (no computed)
      bench('Lattice - signal only', function* () {
        const s = latticeSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s(i);
            s(); // Read back
          }
        };
      });
    
      bench('Preact - signal only', function* () {
        const s = preactSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s.value = i;
            void s.value;
          }
        };
      });
    
      bench('Alien - signal only', function* () {
        const s = alienSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            s(i);
            s();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();