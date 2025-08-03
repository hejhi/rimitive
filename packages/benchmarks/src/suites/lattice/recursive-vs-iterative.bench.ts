/**
 * Recursive vs Iterative Benchmark
 * 
 * This benchmark specifically tests the performance impact of recursive
 * dependency checking algorithms versus iterative approaches. It focuses on:
 * 
 * 1. Deep conditional dependency chains (10+ levels)
 * 2. Multiple branches where only one is active
 * 3. Updates to non-active branches that trigger checking overhead
 * 
 * The key insight: In conditional dependencies, updating an inactive branch
 * still requires checking the dependency graph, which can be expensive with
 * deep recursion due to stack frame overhead.
 */

import { describe, bench } from 'vitest';
import {
  createSignalFactory,
  createComputedFactory,
  createBatchFactory,
  createSignalAPI,
} from '@lattice/signals';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';

describe('Recursive vs Iterative - Deep Conditional Dependencies', () => {
  describe('Lattice Signals', () => {
    const {
      signal,
      computed,
    } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      batch: createBatchFactory,
    });

    // Create deep conditional dependency chains
    const createDeepChain = (depth = 10) => {
      const signals: Array<ReturnType<typeof signal<number>> | ReturnType<typeof computed<number>>> = [];
      
      // Base signal
      signals[0] = signal(0);
      
      // Create computed chain
      for (let i = 1; i <= depth; i++) {
        const prevSignal = signals[i - 1]!;
        signals[i] = computed(() => {
          // Add computation to make it realistic
          const value = prevSignal.value;
          return value + 1;
        });
      }
      
      return signals;
    };

    // Test different depths
    [10, 20, 30].forEach(depth => {
      bench(`depth ${depth} - read after inactive branch update`, () => {
        const cond = signal(true);
        
        // Create two chains
        const chainA = createDeepChain(depth);
        const chainB = createDeepChain(depth);
        
        // Create conditional computed
        const result = computed(() => {
          if (cond.value) {
            return chainA[chainA.length - 1]!.value;
          } else {
            return chainB[chainB.length - 1]!.value;
          }
        });
        
        // Initial read to establish dependencies
        result.value;
        
        // Update inactive branch
        (chainB[0] as ReturnType<typeof signal<number>>).value++;
        
        // Read result - triggers recursive checking
        result.value;
      });
    });
  });

  describe('Alien Signals (Iterative Reference)', () => {
    // Create deep conditional dependency chains
    const createDeepChain = (depth = 10) => {
      const signals: Array<ReturnType<typeof alienSignal<number>> | ReturnType<typeof alienComputed<number>>> = [];
      
      // Base signal
      signals[0] = alienSignal(0);
      
      // Create computed chain
      for (let i = 1; i <= depth; i++) {
        const prevSignal = signals[i - 1]!;
        signals[i] = alienComputed(() => {
          // Add computation to make it realistic
          const value = prevSignal() as number;
          return value + 1;
        });
      }
      
      return signals;
    };

    // Test different depths
    [10, 20, 30].forEach(depth => {
      bench(`depth ${depth} - read after inactive branch update`, () => {
        const cond = alienSignal(true);
        
        // Create two chains
        const chainA = createDeepChain(depth);
        const chainB = createDeepChain(depth);
        
        // Create conditional computed
        const result = alienComputed(() => {
          if (cond()) {
            return chainA[chainA.length - 1]!();
          } else {
            return chainB[chainB.length - 1]!();
          }
        });
        
        // Initial read to establish dependencies
        result();
        
        // Update inactive branch
        const firstSignal = chainB[0] as ReturnType<typeof alienSignal<number>>;
        firstSignal(firstSignal() + 1);
        
        // Read result - triggers checking
        result();
      });
    });
  });
});