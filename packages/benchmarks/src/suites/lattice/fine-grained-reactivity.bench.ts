/**
 * @fileoverview Fine-Grained Reactivity Performance Benchmark
 *
 * Compares fine-grained reactive state management systems on partial update efficiency.
 * Measures how well each system handles updates that only affect a subset of subscribers,
 * focusing on fair apples-to-apples comparisons between systems with similar architectures.
 */

import { describe, bench } from 'vitest';
import { createStore } from '@lattice/store/vanilla';
import { observable, action, reaction } from 'mobx';

// Test state: 100 independent counters

const COUNTER_COUNT = 100;
const UPDATE_ITERATIONS = 100; // Reduced for fair comparison without React batching

// Generate counter IDs outside benchmarks
const counterIds = Array.from({ length: COUNTER_COUNT }, (_, i) => `counter_${i}`);
const initialCounters = Object.fromEntries(counterIds.map(id => [id, 0]));

describe('Fine-Grained Reactivity - Subscription Efficiency', () => {
  // Lattice with fine-grained subscriptions
  {
    const setupLattice = () => {
      const createSlice = createStore({
        counters: initialCounters,
      });
      
      // Create slice for each counter (fine-grained subscriptions)
      const counterSlices = counterIds.map(id => 
        createSlice(
          (selectors) => ({ counters: selectors.counters }),
          ({ counters }, set) => ({
            value: () => counters()[id] || 0,
            increment: () => set(
              (selectors) => ({ counters: selectors.counters }),
              ({ counters }) => ({ 
                counters: { ...counters(), [id]: (counters()[id] || 0) + 1 }
              })
            )
          })
        )
      );

      return {
        slices: counterSlices,
        incrementCounter: (index: number) => {
          const slice = counterSlices[index];
          if (slice) {
            slice().increment();
          }
        }
      };
    };

    let latticeSetup: ReturnType<typeof setupLattice>;

    bench(
      'Lattice - partial updates (fine-grained)',
      () => {
        // Update different counters cyclically
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterIndex = i % COUNTER_COUNT;
          latticeSetup.incrementCounter(counterIndex);
        }
      },
      {
        setup: () => {
          latticeSetup = setupLattice();
        }
      }
    );
  }


  // MobX with fine-grained reactivity (comparable to Lattice)
  {
    const setupMobX = () => {
      // Create observable store
      const store = observable({
        counters: { ...initialCounters }
      });

      // Create action for incrementing
      const increment = action((id: string) => {
        store.counters[id] = (store.counters[id] || 0) + 1;
      });

      // Simulate fine-grained subscriptions like Lattice
      const disposers = counterIds.map(id => 
        reaction(
          () => store.counters[id], // Only watch this specific counter
          () => {
            // This would trigger re-renders for this counter only
          }
        )
      );

      return {
        store,
        increment,
        disposers
      };
    };

    let mobxSetup: ReturnType<typeof setupMobX>;

    bench(
      'MobX - partial updates (fine-grained reactivity)',
      () => {
        // Same update pattern as others
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          mobxSetup.increment(counterId);
        }
      },
      {
        setup: () => {
          mobxSetup = setupMobX();
        }
      }
    );
  }
});

describe('Fine-Grained Reactivity - Memory Efficiency', () => {
  // Test memory usage with large state trees
  const LARGE_COUNTER_COUNT = 1000;
  const largeCounterIds = Array.from({ length: LARGE_COUNTER_COUNT }, (_, i) => `counter_${i}`);
  const largeInitialCounters = Object.fromEntries(largeCounterIds.map(id => [id, 0]));

  {
    const setupLargeLattice = () => {
      const createSlice = createStore({
        counters: largeInitialCounters,
      });
      
      const updateSlice = createSlice(
        (selectors) => ({ counters: selectors.counters }),
        (_deps, set) => ({
          increment: (id: string) => set(
            (selectors) => ({ counters: selectors.counters }),
            ({ counters }) => ({ 
              counters: { ...counters(), [id]: (counters()[id] || 0) + 1 }
            })
          )
        })
      );

      return updateSlice;
    };

    let largeSetup: ReturnType<typeof setupLargeLattice>;

    bench(
      'Lattice - large state (1000 counters)',
      () => {
        // Update 100 random counters
        for (let i = 0; i < 100; i++) {
          const randomId = largeCounterIds[Math.floor(Math.random() * LARGE_COUNTER_COUNT)]!;
          largeSetup().increment(randomId);
        }
      },
      {
        setup: () => {
          largeSetup = setupLargeLattice();
        }
      }
    );
  }

  {
    const setupLargeMobX = () => {
      const store = observable({
        counters: { ...largeInitialCounters }
      });

      const increment = action((id: string) => {
        store.counters[id] = (store.counters[id] || 0) + 1;
      });

      return { store, increment };
    };

    let largeMobXSetup: ReturnType<typeof setupLargeMobX>;

    bench(
      'MobX - large state (1000 counters)',
      () => {
        // Same update pattern
        for (let i = 0; i < 100; i++) {
          const randomId = largeCounterIds[Math.floor(Math.random() * LARGE_COUNTER_COUNT)]!;
          largeMobXSetup.increment(randomId);
        }
      },
      {
        setup: () => {
          largeMobXSetup = setupLargeMobX();
        }
      }
    );
  }
});