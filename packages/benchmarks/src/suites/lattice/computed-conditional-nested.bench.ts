/**
 * Nested Conditional Dependencies Benchmark
 * 
 * Tests scenarios with nested conditional dependencies (multiple levels of conditions)
 * Important for evaluating how well systems handle complex conditional dependency graphs
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
const nodeScheduler = createNodeScheduler(baseCtx, pullPropagator.pullUpdates);
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

group('Nested Conditional', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const level1 = latticeSignal(true);
        const level2 = latticeSignal(true);
        const a = latticeSignal(1);
        const b = latticeSignal(2);
        const c = latticeSignal(3);
        const d = latticeSignal(4);
        
        const result = latticeComputed(() => {
          if (level1()) {
            return level2() ? a() : b();
          } else {
            return level2() ? c() : d();
          }
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            level1(i % 4 < 2);
            level2(i % 2 === 0);
            // Update all branches
            a(i);
            b(i * 2);
            c(i * 3);
            d(i * 4);
            void result();
          }
        };
      });
    
      bench('Preact', function* () {
        const level1 = preactSignal(true);
        const level2 = preactSignal(true);
        const a = preactSignal(1);
        const b = preactSignal(2);
        const c = preactSignal(3);
        const d = preactSignal(4);
        
        const result = preactComputed(() => {
          if (level1.value) {
            return level2.value ? a.value : b.value;
          } else {
            return level2.value ? c.value : d.value;
          }
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            level1.value = i % 4 < 2;
            level2.value = i % 2 === 0;
            // Update all branches
            a.value = i;
            b.value = i * 2;
            c.value = i * 3;
            d.value = i * 4;
            void result.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const level1 = alienSignal(true);
        const level2 = alienSignal(true);
        const a = alienSignal(1);
        const b = alienSignal(2);
        const c = alienSignal(3);
        const d = alienSignal(4);
        
        const result = alienComputed(() => {
          if (level1()) {
            return level2() ? a() : b();
          } else {
            return level2() ? c() : d();
          }
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            level1(i % 4 < 2);
            level2(i % 2 === 0);
            // Update all branches
            a(i);
            b(i * 2);
            c(i * 3);
            d(i * 4);
            void result();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();