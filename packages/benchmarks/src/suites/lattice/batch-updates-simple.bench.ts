/**
 * Batch Updates Simple Benchmarks
 * 
 * Tests batching a small number of signal updates to minimize recomputations
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
import {
  signal as alienSignal,
  computed as alienComputed,
  startBatch as alienStartBatch,
  endBatch as alienEndBatch,
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

group('Batch 3 Signal Updates', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const s1 = latticeSignal(0);
        const s2 = latticeSignal(0);
        const s3 = latticeSignal(0);
        const sum = latticeComputed(() => s1() + s2() + s3());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            latticeBatch(() => {
              s1(i);
              s2(i * 2);
              s3(i * 3);
            });
            void sum();
          }
        };
      });
    
      bench('Preact', function* () {
        const s1 = preactSignal(0);
        const s2 = preactSignal(0);
        const s3 = preactSignal(0);
        const sum = preactComputed(() => s1.value + s2.value + s3.value);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            preactBatch(() => {
              s1.value = i;
              s2.value = i * 2;
              s3.value = i * 3;
            });
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const s1 = alienSignal(0);
        const s2 = alienSignal(0);
        const s3 = alienSignal(0);
        const sum = alienComputed(() => s1() + s2() + s3());
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            alienStartBatch();
            s1(i);
            s2(i * 2);
            s3(i * 3);
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