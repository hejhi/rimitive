/**
 * Batch Updates Multiple Benchmarks
 * 
 * Tests batching many signal updates to minimize recomputations
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  batch as preactBatch,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createNodeScheduler } from '@lattice/signals/helpers/node-scheduler';

import {
  signal as alienSignal,
  computed as alienComputed,
  startBatch as alienStartBatch,
  endBatch as alienEndBatch,
} from 'alien-signals';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createPushPropagator } from '@lattice/signals/helpers/push-propagator';

const baseCtx = createBaseContext();
const pullPropagator = createPullPropagator();
const graphEdges = createGraphEdges();
const nodeScheduler = createNodeScheduler(baseCtx, pullPropagator.pullUpdates);
const pushPropagator = createPushPropagator(nodeScheduler.enqueue);

// Create Lattice API instance
const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
    batch: createBatchFactory,
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
const latticeBatch = latticeAPI.batch as <T>(fn: () => T) => T;

const ITERATIONS = 10000;

group('Batch 10 Signal Updates', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const signals = Array.from({ length: 10 }, () => latticeSignal(0));
        const sum = latticeComputed(() => 
          signals.reduce((acc, s) => acc + s(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            latticeBatch(() => {
              signals.forEach((s, idx) => {
                s(i * (idx + 1));
              });
            });
            void sum();
          }
        };
      });
    
      bench('Preact', function* () {
        const signals = Array.from({ length: 10 }, () => preactSignal(0));
        const sum = preactComputed(() => 
          signals.reduce((acc, s) => acc + s.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            preactBatch(() => {
              signals.forEach((s, idx) => {
                s.value = i * (idx + 1);
              });
            });
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const signals = Array.from({ length: 10 }, () => alienSignal(0));
        const sum = alienComputed(() => 
          signals.reduce((acc, s) => acc + s(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            alienStartBatch();
            signals.forEach((s, idx) => {
              s(i * (idx + 1));
            });
            alienEndBatch();
            void sum();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();