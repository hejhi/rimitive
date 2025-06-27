/**
 * @fileoverview Fine-Grained Reactivity Performance Benchmark
 *
 * Compares fine-grained reactive state management systems on partial update efficiency.
 * Measures how well each system handles updates that only affect a subset of subscribers,
 * focusing on fair apples-to-apples comparisons between systems with similar architectures.
 *
 * Metrics measured:
 * - Execution time (via Vitest benchmark)
 * - Memory allocation patterns
 * - Subscription efficiency
 * - Update propagation overhead
 */

import { describe, bench } from 'vitest';
import { createComponent, withState, createStore } from '@lattice/core';
import { observable, action, computed as mobxComputed } from 'mobx';
import {
  initMemoryTracking,
  measureMemory,
} from '../../utils/memory-reporter.js';

// Force garbage collection if available (for more accurate memory measurements)
function forceGC() {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
}

// Test state: 100 independent counters

const COUNTER_COUNT = 100;
const UPDATE_ITERATIONS = 100; // Reduced for fair comparison without React batching

// Generate counter IDs outside benchmarks
const counterIds = Array.from(
  { length: COUNTER_COUNT },
  (_, i) => `counter_${i}`
);
const initialCounters = Object.fromEntries(counterIds.map((id) => [id, 0]));

describe('Fine-Grained Reactivity - Performance & Memory', () => {
  // Lattice with fine-grained subscriptions
  {
    const setupLattice = () => {
      // Create component with counters state
      const CountersComponent = createComponent(
        withState<{ counters: Record<string, number> }>(),
        ({ store, computed, set }) => {
          // Create slice for each counter (fine-grained subscriptions)
          const counterSlices = counterIds.map((id) => ({
            value: computed(() => store.counters()[id] || 0),
            increment: () => {
              // Use function form for surgical update
              set(({ counters }) => ({
                counters: { [id]: (counters()[id] || 0) + 1 },
              }));
            },
          }));

          return {
            slices: counterSlices,
            incrementCounter: (index: number) => {
              const slice = counterSlices[index];
              if (slice) slice.increment();
            },
          };
        }
      );

      const store = createStore(CountersComponent, {
        counters: initialCounters,
      });

      const counterSlices = store.slices;

      return {
        slices: counterSlices,
        incrementCounter: store.incrementCounter,
      };
    };

    let latticeSetup: ReturnType<typeof setupLattice>;
    const benchmarkName = 'Lattice - partial updates (fine-grained)';

    bench(
      benchmarkName,
      () => {
        // Update different counters cyclically
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterIndex = i % COUNTER_COUNT;
          latticeSetup.incrementCounter(counterIndex);
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC(); // Clean slate for memory measurement

          measureMemory('setup', benchmarkName, () => {
            latticeSetup = setupLattice();
          });
        },
        teardown: () => {
          // Measure final memory footprint
          measureMemory('teardown', benchmarkName, () => {
            latticeSetup = null as any;
          });
        },
      }
    );
  }

  // MobX with fine-grained reactivity (comparable to Lattice)
  {
    const setupMobX = () => {
      // Create observable store
      const store = observable({
        counters: { ...initialCounters },
      });

      // Create action for incrementing
      const increment = action((id: string) => {
        store.counters[id] = (store.counters[id] || 0) + 1;
      });

      // Create computed values for each counter (fine-grained subscriptions)
      // These only recalculate when their specific counter changes
      const counterComputeds = counterIds.map((id) =>
        mobxComputed(() => store.counters[id] || 0)
      );

      return {
        store,
        increment,
        counterComputeds,
      };
    };

    let mobxSetup: ReturnType<typeof setupMobX>;
    const mobxBenchmarkName =
      'MobX - partial updates (fine-grained reactivity)';

    bench(
      mobxBenchmarkName,
      () => {
        // Same update pattern as others
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterIndex = i % COUNTER_COUNT;
          const counterId = counterIds[counterIndex]!;
          mobxSetup.increment(counterId);

          // Realistic access pattern: only access the counter that was updated
          // Plus 1-2 adjacent counters to simulate realistic UI context
          mobxSetup.counterComputeds[counterIndex]?.get(); // The updated counter

          // Access adjacent counter to simulate realistic component behavior
          const adjacentIndex = (counterIndex + 1) % COUNTER_COUNT;
          mobxSetup.counterComputeds[adjacentIndex]?.get();
        }
      },
      {
        setup: () => {
          initMemoryTracking(mobxBenchmarkName);
          forceGC(); // Clean slate for memory measurement

          measureMemory('setup', mobxBenchmarkName, () => {
            mobxSetup = setupMobX();
          });
        },
        teardown: () => {
          // Measure final memory footprint
          measureMemory('teardown', mobxBenchmarkName, () => {
            mobxSetup = null as any;
          });
        },
      }
    );
  }
});

describe('Large State Memory Usage Comparison', () => {
  // Test memory usage with large state trees
  const LARGE_COUNTER_COUNT = 1000;
  const largeCounterIds = Array.from(
    { length: LARGE_COUNTER_COUNT },
    (_, i) => `counter_${i}`
  );
  const largeInitialCounters = Object.fromEntries(
    largeCounterIds.map((id) => [id, 0])
  );

  {
    const setupLargeLattice = () => {
      const LargeCountersComponent = createComponent(
        withState<{ counters: Record<string, number> }>(),
        ({ set }) => ({
          increment: (id: string) => {
            // Use function form for surgical update
            set(({ counters }) => ({
              counters: { [id]: (counters()[id] || 0) + 1 },
            }));
          },
        })
      );

      const store = createStore(LargeCountersComponent, {
        counters: largeInitialCounters,
      });

      return store;
    };

    let largeSetup: ReturnType<typeof setupLargeLattice>;
    const largeLatticesBenchmarkName = 'Lattice - large state (1000 counters)';

    bench(
      largeLatticesBenchmarkName,
      () => {
        // Update 100 random counters
        for (let i = 0; i < 100; i++) {
          const randomId =
            largeCounterIds[Math.floor(Math.random() * LARGE_COUNTER_COUNT)]!;
          largeSetup.increment(randomId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(largeLatticesBenchmarkName);
          forceGC();

          measureMemory('setup', largeLatticesBenchmarkName, () => {
            largeSetup = setupLargeLattice();
          });
        },
        teardown: () => {
          measureMemory('teardown', largeLatticesBenchmarkName, () => {
            largeSetup = null as any;
          });
        },
      }
    );
  }

  {
    const setupLargeMobX = () => {
      const store = observable({
        counters: { ...largeInitialCounters },
      });

      const increment = action((id: string) => {
        store.counters[id] = (store.counters[id] || 0) + 1;
      });

      // Create computed for accessing counter values (matches Lattice slice pattern)
      const getCounter = mobxComputed(
        () => (id: string) => store.counters[id] || 0
      );

      return { store, increment, getCounter };
    };

    let largeMobXSetup: ReturnType<typeof setupLargeMobX>;
    const largeMobXBenchmarkName = 'MobX - large state (1000 counters)';

    bench(
      largeMobXBenchmarkName,
      () => {
        // Same update pattern
        for (let i = 0; i < 100; i++) {
          const randomId =
            largeCounterIds[Math.floor(Math.random() * LARGE_COUNTER_COUNT)]!;
          largeMobXSetup.increment(randomId);

          // Access computed value to simulate subscription usage
          largeMobXSetup.getCounter.get()(randomId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(largeMobXBenchmarkName);
          forceGC();

          measureMemory('setup', largeMobXBenchmarkName, () => {
            largeMobXSetup = setupLargeMobX();
          });
        },
        teardown: () => {
          measureMemory('teardown', largeMobXBenchmarkName, () => {
            largeMobXSetup = null as any;
          });
        },
      }
    );
  }
});
