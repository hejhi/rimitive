/**
 * Write-Heavy Pattern Benchmark
 * 
 * Tests scenarios with many writes but few reads
 * Important for understanding lazy evaluation benefits
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createBaseContext } from '@lattice/signals/context';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createNodeScheduler } from '@lattice/signals/helpers/node-scheduler';
import { createPushPropagator } from '@lattice/signals/helpers/push-propagator';

// Create Lattice API instance
const baseCtx = createBaseContext();
const pullPropagator = createPullPropagator();
const graphEdges = createGraphEdges();
const nodeScheduler = createNodeScheduler(baseCtx);
const pushPropagator = createPushPropagator();

// Create Lattice API instance
const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
  },
  {
    ...createBaseContext(),
    nodeScheduler,
    graphEdges,
    pushPropagator,
    pullPropagator,
  }
);

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

const ITERATIONS = 10000;

group('100 Writes, 1 Read', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        const c1 = preactComputed(() => source.value * 2);
        const c2 = preactComputed(() => c1.value * 2);
        const c3 = preactComputed(() => c2.value * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // 100 writes
            for (let i = 0; i < 100; i++) {
              source.value = batch * 100 + i;
            }
            // 1 read
            void c3.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const c1 = latticeComputed(() => source() * 2);
        const c2 = latticeComputed(() => c1() * 2);
        const c3 = latticeComputed(() => c2() * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // 100 writes
            for (let i = 0; i < 100; i++) {
              source(batch * 100 + i);
            }
            // 1 read
            void c3();
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const c1 = alienComputed(() => source() * 2);
        const c2 = alienComputed(() => c1() * 2);
        const c3 = alienComputed(() => c2() * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // 100 writes
            for (let i = 0; i < 100; i++) {
              source(batch * 100 + i);
            }
            // 1 read
            void c3();
          }
        };
      });
    });
  });
});

group('1000 Writes, 1 Read', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const source = preactSignal(0);
        const c1 = preactComputed(() => source.value * 2);
        const c2 = preactComputed(() => c1.value * 2);
        const c3 = preactComputed(() => c2.value * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 1000; batch++) {
            // 1000 writes
            for (let i = 0; i < 1000; i++) {
              source.value = batch * 1000 + i;
            }
            // 1 read
            void c3.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        const c1 = latticeComputed(() => source() * 2);
        const c2 = latticeComputed(() => c1() * 2);
        const c3 = latticeComputed(() => c2() * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 1000; batch++) {
            // 1000 writes
            for (let i = 0; i < 1000; i++) {
              source(batch * 1000 + i);
            }
            // 1 read
            void c3();
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        const c1 = alienComputed(() => source() * 2);
        const c2 = alienComputed(() => c1() * 2);
        const c3 = alienComputed(() => c2() * 2);
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 1000; batch++) {
            // 1000 writes
            for (let i = 0; i < 1000; i++) {
              source(batch * 1000 + i);
            }
            // 1 read
            void c3();
          }
        };
      });
    });
  });
});

group('Wide Graph Write-Heavy', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const sources = Array.from({ length: 10 }, () => preactSignal(0));
        const computeds = sources.map(s => preactComputed(() => s.value * 2));
        const sum = preactComputed(() => 
          computeds.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // Many writes to different signals
            for (let i = 0; i < 100; i++) {
              sources[i % sources.length]!.value = batch * 100 + i;
            }
            // Single read
            void sum.value;
          }
        };
      });
    
      bench('Lattice', function* () {
        const sources = Array.from({ length: 10 }, () => latticeSignal(0));
        const computeds = sources.map(s => latticeComputed(() => s() * 2));
        const sum = latticeComputed(() => 
          computeds.reduce((acc, c) => acc + c(), 0)
        );
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // Many writes to different signals
            for (let i = 0; i < 100; i++) {
              sources[i % sources.length]!(batch * 100 + i);
            }
            // Single read
            void sum();
          }
        };
      });
    
      bench('Alien', function* () {
        const sources = Array.from({ length: 10 }, () => alienSignal(0));
        const computeds = sources.map(s => alienComputed(() => s() * 2));
        const sum = alienComputed(() => 
          computeds.reduce((acc, c) => acc + c(), 0)
        );
        
        yield () => {
          for (let batch = 0; batch < ITERATIONS / 100; batch++) {
            // Many writes to different signals
            for (let i = 0; i < 100; i++) {
              sources[i % sources.length]!(batch * 100 + i);
            }
            // Single read
            void sum();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();