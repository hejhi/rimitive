/**
 * @fileoverview Fine-Grained Reactivity Performance Benchmark
 *
 * Fair comparison of reactive state management systems with two benchmark suites:
 * 
 * 1. Direct Signal Access - Measures raw signal read/write performance
 * 2. Computed Values - Measures derived state performance with dependencies
 * 
 * Each benchmark ensures:
 * - Identical data structures across all systems
 * - Equivalent access patterns and abstractions
 * - Same number of operations and complexity
 * - Fair memory measurement methodology
 */

import { describe, bench } from 'vitest';
import { createComponent } from '@lattice/core';
import type { ComponentContext } from '@lattice/core';
import { observable, action, computed as mobxComputed } from 'mobx';
import { signal, computed as preactComputed } from '@preact/signals-core';
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

// Benchmark configuration
const COUNTER_COUNT = 100;
const UPDATE_ITERATIONS = 100;
const COMPUTED_DEPENDENCIES = 3; // Each computed depends on 3 signals

// Generate counter IDs outside benchmarks
const counterIds = Array.from(
  { length: COUNTER_COUNT },
  (_, i) => `counter_${i}`
);

describe('Direct Signal Access - Performance & Memory', () => {
  // This benchmark compares raw signal read/write performance
  // All systems use flat objects with direct property access
  // No computed values are created to ensure fair comparison
  // Lattice - Direct signal access
  {
    const setupLattice = () => {
      // Create flat object structure (same as MobX/Preact)
      const counters: Record<string, number> = {};
      counterIds.forEach(id => counters[id] = 0);
      
      const store = createComponent({ counters });

      const CountersComponent = ({ store, set }: ComponentContext<{ counters: Record<string, number> }>) => {
        return {
          getCounter: (id: string) => {
            return store.counters()[id] || 0;
          },
          incrementCounter: (id: string) => {
            set(store.counters, prev => ({
              ...prev,
              [id]: (prev[id] || 0) + 1
            }));
          },
        };
      };

      return CountersComponent(store);
    };

    let latticeSetup: ReturnType<typeof setupLattice> | undefined;
    const benchmarkName = 'Lattice - direct signal access';

    bench(
      benchmarkName,
      () => {
        // Update different counters cyclically
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          latticeSetup?.incrementCounter(counterId);

          // Access the updated counter
          latticeSetup?.getCounter(counterId);

          // Access adjacent counter
          const adjacentId = counterIds[(i + 1) % COUNTER_COUNT]!;
          latticeSetup?.getCounter(adjacentId);
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
            latticeSetup = undefined;
          });
        },
      }
    );
  }

  // MobX - Direct signal access
  {
    const setupMobX = () => {
      // Create observable store with same structure as Lattice
      const counters: Record<string, number> = {};
      counterIds.forEach(id => counters[id] = 0);
      
      const store = observable({ counters });

      const incrementCounter = action((id: string) => {
        store.counters[id] = (store.counters[id] || 0) + 1;
      });

      const getCounter = (id: string) => {
        return store.counters[id] || 0;
      };

      return {
        getCounter,
        incrementCounter,
      };
    };

    let mobxSetup: ReturnType<typeof setupMobX> | undefined;
    const mobxBenchmarkName = 'MobX - direct signal access';

    bench(
      mobxBenchmarkName,
      () => {
        // Same update pattern as Lattice
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          mobxSetup?.incrementCounter(counterId);

          // Access the updated counter
          mobxSetup?.getCounter(counterId);

          // Access adjacent counter
          const adjacentId = counterIds[(i + 1) % COUNTER_COUNT]!;
          mobxSetup?.getCounter(adjacentId);
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
            mobxSetup = undefined;
          });
        },
      }
    );
  }

  // Preact Signals - Direct signal access
  {
    const setupPreact = () => {
      // Use same immutable pattern as Lattice
      const counters: Record<string, number> = {};
      counterIds.forEach(id => counters[id] = 0);
      
      const store = signal({ counters });

      return {
        getCounter: (id: string) => {
          return store.value.counters[id] || 0;
        },
        incrementCounter: (id: string) => {
          // Use immutable update like Lattice
          store.value = {
            counters: {
              ...store.value.counters,
              [id]: (store.value.counters[id] || 0) + 1
            }
          };
        },
      };
    };

    let preactSetup: ReturnType<typeof setupPreact> | undefined;
    const preactBenchmarkName = 'Preact Signals - direct signal access';

    bench(
      preactBenchmarkName,
      () => {
        // Same update pattern as others
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          preactSetup?.incrementCounter(counterId);

          // Access the updated counter
          preactSetup?.getCounter(counterId);

          // Access adjacent counter
          const adjacentId = counterIds[(i + 1) % COUNTER_COUNT]!;
          preactSetup?.getCounter(adjacentId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(preactBenchmarkName);
          forceGC();

          measureMemory('setup', preactBenchmarkName, () => {
            preactSetup = setupPreact();
          });
        },
        teardown: () => {
          measureMemory('teardown', preactBenchmarkName, () => {
            preactSetup = undefined;
          });
        },
      }
    );
  }
});

describe('Computed Values - Performance & Memory', () => {
  // This benchmark compares computed/derived value performance
  // All systems create the same number of computed values with identical dependency patterns

  // Lattice - Computed values
  {
    const setupLattice = () => {
      // Create signals
      const counters: Record<string, number> = {};
      counterIds.forEach(id => counters[id] = 0);
      const store = createComponent({ counters });

      const CountersComponent = ({ store, set, computed }: ComponentContext<{ counters: Record<string, number> }>) => {
        // Create computed values that depend on multiple signals
        const computeds = counterIds.map((id, index) => 
          computed(() => {
            let sum = 0;
            for (let i = 0; i < COMPUTED_DEPENDENCIES; i++) {
              const depIndex = (index + i) % COUNTER_COUNT;
              const depId = counterIds[depIndex]!;
              sum += store.counters()[depId] || 0;
            }
            return sum;
          })
        );

        return {
          getComputed: (index: number) => computeds[index]?.(),
          incrementCounter: (id: string) => {
            set(store.counters, prev => ({
              ...prev,
              [id]: (prev[id] || 0) + 1
            }));
          },
        };
      };

      return CountersComponent(store);
    };

    let latticeSetup: ReturnType<typeof setupLattice> | undefined;
    const benchmarkName = 'Lattice - computed values';

    bench(
      benchmarkName,
      () => {
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          latticeSetup?.incrementCounter(counterId);

          // Access affected computed values
          for (let j = 0; j < COMPUTED_DEPENDENCIES; j++) {
            const affectedIndex = (i - j + COUNTER_COUNT) % COUNTER_COUNT;
            latticeSetup?.getComputed(affectedIndex);
          }
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            latticeSetup = setupLattice();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            latticeSetup = undefined;
          });
        },
      }
    );
  }

  // MobX - Computed values
  {
    const setupMobX = () => {
      const counters: Record<string, number> = {};
      counterIds.forEach(id => counters[id] = 0);
      const store = observable({ counters });

      // Create computed values with same dependency pattern
      const computeds = counterIds.map((id, index) =>
        mobxComputed(() => {
          let sum = 0;
          for (let i = 0; i < COMPUTED_DEPENDENCIES; i++) {
            const depIndex = (index + i) % COUNTER_COUNT;
            const depId = counterIds[depIndex]!;
            sum += store.counters[depId] || 0;
          }
          return sum;
        })
      );

      const incrementCounter = action((id: string) => {
        store.counters[id] = (store.counters[id] || 0) + 1;
      });

      return {
        getComputed: (index: number) => computeds[index]?.get(),
        incrementCounter,
      };
    };

    let mobxSetup: ReturnType<typeof setupMobX> | undefined;
    const benchmarkName = 'MobX - computed values';

    bench(
      benchmarkName,
      () => {
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          mobxSetup?.incrementCounter(counterId);

          // Access affected computed values
          for (let j = 0; j < COMPUTED_DEPENDENCIES; j++) {
            const affectedIndex = (i - j + COUNTER_COUNT) % COUNTER_COUNT;
            mobxSetup?.getComputed(affectedIndex);
          }
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            mobxSetup = setupMobX();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            mobxSetup = undefined;
          });
        },
      }
    );
  }

  // Preact Signals - Computed values
  {
    const setupPreact = () => {
      // Use immutable pattern matching Lattice
      const counters: Record<string, number> = {};
      counterIds.forEach(id => counters[id] = 0);
      const store = signal({ counters });

      // Create computed values with same dependency pattern
      const computeds = counterIds.map((id, index) =>
        preactComputed(() => {
          let sum = 0;
          for (let i = 0; i < COMPUTED_DEPENDENCIES; i++) {
            const depIndex = (index + i) % COUNTER_COUNT;
            const depId = counterIds[depIndex]!;
            sum += store.value.counters[depId] || 0;
          }
          return sum;
        })
      );

      return {
        getComputed: (index: number) => computeds[index]?.value,
        incrementCounter: (id: string) => {
          // Use immutable update
          store.value = {
            counters: {
              ...store.value.counters,
              [id]: (store.value.counters[id] || 0) + 1
            }
          };
        },
      };
    };

    let preactSetup: ReturnType<typeof setupPreact> | undefined;
    const benchmarkName = 'Preact Signals - computed values';

    bench(
      benchmarkName,
      () => {
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          preactSetup?.incrementCounter(counterId);

          // Access affected computed values
          for (let j = 0; j < COMPUTED_DEPENDENCIES; j++) {
            const affectedIndex = (i - j + COUNTER_COUNT) % COUNTER_COUNT;
            preactSetup?.getComputed(affectedIndex);
          }
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            preactSetup = setupPreact();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            preactSetup = undefined;
          });
        },
      }
    );
  }
});

describe('Large State Memory Usage', () => {
  const LARGE_COUNTER_COUNT = 1000;

  // Lattice - Large state
  {
    const setupLargeLattice = () => {
      const counters: Record<string, number> = {};
      for (let i = 0; i < LARGE_COUNTER_COUNT; i++) {
        counters[`counter_${i}`] = 0;
      }
      
      const store = createComponent({ counters });

      const LargeCountersComponent = ({ store, set }: ComponentContext<{ counters: Record<string, number> }>) => ({
        increment: (id: string) => {
          set(store.counters, prev => ({
            ...prev,
            [id]: (prev[id] || 0) + 1
          }));
        },
        getCounter: (id: string) => {
          return store.counters()[id] || 0;
        },
      });

      return LargeCountersComponent(store);
    };

    let largeSetup: ReturnType<typeof setupLargeLattice> | undefined;
    const benchmarkName = 'Lattice - large state (1000 counters)';

    bench(
      benchmarkName,
      () => {
        // Update 100 random counters
        for (let i = 0; i < 100; i++) {
          const randomId = `counter_${Math.floor(Math.random() * LARGE_COUNTER_COUNT)}`;
          largeSetup?.increment(randomId);
          largeSetup?.getCounter(randomId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            largeSetup = setupLargeLattice();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            largeSetup = undefined;
          });
        },
      }
    );
  }

  // MobX - Large state
  {
    const setupLargeMobX = () => {
      const counters: Record<string, number> = {};
      for (let i = 0; i < LARGE_COUNTER_COUNT; i++) {
        counters[`counter_${i}`] = 0;
      }
      
      const store = observable({ counters });

      const increment = action((id: string) => {
        store.counters[id] = (store.counters[id] || 0) + 1;
      });

      const getCounter = (id: string) => {
        return store.counters[id] || 0;
      };

      return { increment, getCounter };
    };

    let largeMobXSetup: ReturnType<typeof setupLargeMobX> | undefined;
    const benchmarkName = 'MobX - large state (1000 counters)';

    bench(
      benchmarkName,
      () => {
        // Same update pattern as Lattice
        for (let i = 0; i < 100; i++) {
          const randomId = `counter_${Math.floor(Math.random() * LARGE_COUNTER_COUNT)}`;
          largeMobXSetup?.increment(randomId);
          largeMobXSetup?.getCounter(randomId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            largeMobXSetup = setupLargeMobX();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            largeMobXSetup = undefined;
          });
        },
      }
    );
  }

  // Preact Signals - Large state
  {
    const setupLargePreact = () => {
      // Use immutable pattern with 1000 counters
      const counters: Record<string, number> = {};
      for (let i = 0; i < LARGE_COUNTER_COUNT; i++) {
        counters[`counter_${i}`] = 0;
      }
      
      const store = signal({ counters });

      return {
        increment: (id: string) => {
          // Immutable update with object spread
          store.value = {
            counters: {
              ...store.value.counters,
              [id]: (store.value.counters[id] || 0) + 1
            }
          };
        },
        getCounter: (id: string) => {
          return store.value.counters[id] || 0;
        },
      };
    };

    let largePreactSetup: ReturnType<typeof setupLargePreact> | undefined;
    const benchmarkName = 'Preact Signals - large state (1000 counters)';

    bench(
      benchmarkName,
      () => {
        // Same update pattern as others
        for (let i = 0; i < 100; i++) {
          const randomId = `counter_${Math.floor(Math.random() * LARGE_COUNTER_COUNT)}`;
          largePreactSetup?.increment(randomId);
          largePreactSetup?.getCounter(randomId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            largePreactSetup = setupLargePreact();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            largePreactSetup = undefined;
          });
        },
      }
    );
  }
});
