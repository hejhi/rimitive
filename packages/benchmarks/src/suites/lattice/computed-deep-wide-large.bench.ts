/**
 * Large Deep and Wide Computed Benchmarks
 * 
 * Tests larger tree-like dependency graphs with different width/depth ratios
 * to understand performance characteristics
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

const ITERATIONS = 500;

group('Computed Deep & Wide (5x3 tree - wider)', () => {
  const WIDTH = 5; // Each node has 5 children (wider)
  const DEPTH = 3; // 3 levels deep (shallower)
  
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        
        // Build tree structure
        let currentLevel = [source];
        const allLevels = [currentLevel];
        
        for (let depth = 0; depth < DEPTH; depth++) {
          const nextLevel: any[] = [];
          
          for (const parent of currentLevel) {
            for (let w = 0; w < WIDTH; w++) {
              const child = latticeComputed(() => {
                // Sum parent value + index for uniqueness
                return parent() + w + 1;
              });
              nextLevel.push(child);
            }
          }
          
          currentLevel = nextLevel;
          allLevels.push(currentLevel);
        }
        
        // Access the bottom-right node (forces traversal through the tree)
        const bottomNodes = allLevels[allLevels.length - 1];
        const targetNode = bottomNodes![bottomNodes!.length - 1]!;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void targetNode();
          }
        };
      });
    
      bench('Preact', function* () {
        const source = preactSignal(0);
        
        // Build tree structure
        let currentLevel = [source];
        const allLevels = [currentLevel];
        
        for (let depth = 0; depth < DEPTH; depth++) {
          const nextLevel: any[] = [];
          
          for (const parent of currentLevel) {
            for (let w = 0; w < WIDTH; w++) {
              const child = preactComputed(() => {
                // Sum parent value + index for uniqueness
                return parent.value + w + 1;
              });
              nextLevel.push(child);
            }
          }
          
          currentLevel = nextLevel;
          allLevels.push(currentLevel);
        }
        
        // Access the bottom-right node (forces traversal through the tree)
        const bottomNodes = allLevels[allLevels.length - 1];
        const targetNode = bottomNodes![bottomNodes!.length - 1];
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void targetNode!.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        
        // Build tree structure
        let currentLevel = [source];
        const allLevels = [currentLevel];
        
        for (let depth = 0; depth < DEPTH; depth++) {
          const nextLevel: any[] = [];
          
          for (const parent of currentLevel) {
            for (let w = 0; w < WIDTH; w++) {
              const child = alienComputed(() => {
                // Sum parent value + index for uniqueness
                return parent() + w + 1;
              });
              nextLevel.push(child);
            }
          }
          
          currentLevel = nextLevel;
          allLevels.push(currentLevel);
        }
        
        // Access the bottom-right node (forces traversal through the tree)
        const bottomNodes = allLevels[allLevels.length - 1];
        const targetNode = bottomNodes![bottomNodes!.length - 1];
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void targetNode!();
          }
        };
      });
    });
  });
});

runBenchmark();