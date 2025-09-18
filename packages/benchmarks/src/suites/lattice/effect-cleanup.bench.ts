/**
 * Effect Cleanup Benchmarks
 * 
 * Tests the cost of creating and disposing effects repeatedly (lifecycle overhead)
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createEffectFactory } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  effect as alienEffect,
} from 'alien-signals';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

const { traverseGraph } = createGraphTraversal();
const { dispose, propagate } = createScheduler({ propagate: traverseGraph });
const { trackDependency, track, detachAll } = createGraphEdges();
const ctx = createBaseContext();

const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    effect: createEffectFactory,
  },
  {
    ctx,
    dispose,
    propagate,
    trackDependency,
    track,
    detachAll
  }
);

const latticeSignal = latticeAPI.signal;
const latticeEffect = latticeAPI.effect;

const ITERATIONS = 10000;

group('Effect Cleanup', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const signal = preactSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = preactEffect(() => {
              void signal.value;
            });
            signal.value = i;
            dispose();
          }
        };
      });
    
      bench('Lattice', function* () {
        const signal = latticeSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = latticeEffect(() => {
              void signal();
            });
            signal(i);
            dispose();
          }
        };
      });
    
      bench('Alien', function* () {
        const signal = alienSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = alienEffect(() => {
              void signal();
            });
            signal(i);
            dispose();
          }
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();