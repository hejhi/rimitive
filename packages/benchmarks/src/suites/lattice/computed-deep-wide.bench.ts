/**
 * Deep and Wide Computed Benchmarks
 * 
 * Tests tree-like dependency graphs that are both deep and wide
 * Each level has multiple branches that continue to the next level
 * 
 * Example structure (3 wide, 3 deep):
 *          source
 *        /   |   \
 *      c1   c2   c3      (level 1: 3 wide)
 *     /|\  /|\  /|\
 *    c4 c5 c6 c7 c8 c9   (level 2: 9 total)
 *   /|\/|\/|\/|\/|\/|\
 *  ... 27 nodes ...      (level 3: 27 total)
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  ReadonlySignal,
} from '@preact/signals-core';
import { ComputedFunction } from '@lattice/signals/computed';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createApi } from './helpers/signal-computed';

const latticeAPI = createApi();

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

const ITERATIONS = 1000;
const WIDTH = 3; // Each node has 3 children
const DEPTH = 4; // 4 levels deep

group('Computed Deep & Wide (3x4 tree)', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice', function* () {
        const source = latticeSignal(0);
        
        // Build tree structure
        let currentLevel = [source];
        const allLevels = [currentLevel];
        
        for (let depth = 0; depth < DEPTH; depth++) {
          const nextLevel: ComputedFunction<number>[] = [];
          
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
          const nextLevel: ReadonlySignal<number>[] = [];
          
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
        const targetNode = bottomNodes![bottomNodes!.length - 1]!;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            void targetNode.value;
          }
        };
      });
    
      bench('Alien', function* () {
        const source = alienSignal(0);
        
        // Build tree structure
        let currentLevel = [source];
        const allLevels = [currentLevel];
        
        for (let depth = 0; depth < DEPTH; depth++) {
          const nextLevel: (() => number)[] = [];
          
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
        const targetNode = bottomNodes![bottomNodes!.length - 1]!;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void targetNode();
          }
        };
      });
    });
  });
});

await runBenchmark();