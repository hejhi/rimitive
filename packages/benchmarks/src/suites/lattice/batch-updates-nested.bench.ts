/**
 * Batch Updates Nested Benchmarks
 * 
 * Tests nested batch operations to verify proper batch flattening
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  batch as preactBatch,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';
import {
  signal as alienSignal,
  computed as alienComputed,
  startBatch as alienStartBatch,
  endBatch as alienEndBatch,
} from 'alien-signals';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createScheduler } from '@lattice/signals/helpers/scheduler';

const { traverseGraph } = createGraphTraversal();
const graphEdges = createGraphEdges();
const ctx = createBaseContext();
const { startBatch, endBatch, propagate } = createScheduler({
  propagate: traverseGraph,
});

const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
    batch: createBatchFactory,
  },
  {
    ctx,
    graphEdges,
    propagate,
    pull: createPullPropagator(ctx, graphEdges),
    startBatch,
    endBatch,
  }
);

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;
const latticeBatch = latticeAPI.batch;

const ITERATIONS = 10000;

group('Nested Batch Operations', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const signals = Array.from({ length: 5 }, () => latticeSignal(0));
        const computeds = signals.map((s, i) => 
          latticeComputed(() => s() * (i + 1))
        );
        const sum = latticeComputed(() => 
          computeds.reduce((acc, c) => acc + c(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 5; i++) {
            latticeBatch(() => {
              latticeBatch(() => {
                signals[0]!(i);
                signals[1]!(i * 2);
              });
              latticeBatch(() => {
                signals[2]!(i * 3);
                signals[3]!(i * 4);
                signals[4]!(i * 5);
              });
            });
            void sum();
          }
        };
      });
    
      bench('Preact', function* () {
        const signals = Array.from({ length: 5 }, () => preactSignal(0));
        const computeds = signals.map((s, i) => 
          preactComputed(() => s.value * (i + 1))
        );
        const sum = preactComputed(() => 
          computeds.reduce((acc, c) => acc + c.value, 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 5; i++) {
            preactBatch(() => {
              preactBatch(() => {
                signals[0]!.value = i;
                signals[1]!.value = i * 2;
              });
              preactBatch(() => {
                signals[2]!.value = i * 3;
                signals[3]!.value = i * 4;
                signals[4]!.value = i * 5;
              });
            });
            void sum.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const signals = Array.from({ length: 5 }, () => alienSignal(0));
        const computeds = signals.map((s, i) => 
          alienComputed(() => s() * (i + 1))
        );
        const sum = alienComputed(() => 
          computeds.reduce((acc, c) => acc + c(), 0)
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 5; i++) {
            alienStartBatch();
            alienStartBatch();
            signals[0]!(i);
            signals[1]!(i * 2);
            alienEndBatch();
            alienStartBatch();
            signals[2]!(i * 3);
            signals[3]!(i * 4);
            signals[4]!(i * 5);
            alienEndBatch();
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