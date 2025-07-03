/**
 * @fileoverview Comparison of original Lattice vs Fast-Signals implementation
 * 
 * This benchmark compares the performance of the current Lattice implementation
 * against the new fast-signals based implementation.
 */

import { describe, bench } from 'vitest';
import { createComponent, createComponentFast } from '@lattice/core';
import type { ComponentContext } from '@lattice/core';
import {
  initMemoryTracking,
  measureMemory,
} from '../../utils/memory-reporter.js';

// Force garbage collection if available
function forceGC() {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
}

// Benchmark configuration
const COUNTER_COUNT = 100;
const UPDATE_ITERATIONS = 100;

// Generate counter IDs
const counterIds = Array.from(
  { length: COUNTER_COUNT },
  (_, i) => `counter_${i}`
);

describe('Lattice Implementation Comparison - Direct Signal Access', () => {
  // Original Lattice implementation
  {
    const setupOriginal = () => {
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

    let setup: ReturnType<typeof setupOriginal> | undefined;
    const benchmarkName = 'Lattice (original) - direct signal access';

    bench(
      benchmarkName,
      () => {
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          setup?.incrementCounter(counterId);
          setup?.getCounter(counterId);
          
          const adjacentId = counterIds[(i + 1) % COUNTER_COUNT]!;
          setup?.getCounter(adjacentId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            setup = setupOriginal();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            setup = undefined;
          });
        },
      }
    );
  }

  // Fast-signals implementation
  {
    const setupFast = () => {
      const counters: Record<string, number> = {};
      counterIds.forEach(id => counters[id] = 0);
      
      const store = createComponentFast({ counters });

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

    let setup: ReturnType<typeof setupFast> | undefined;
    const benchmarkName = 'Lattice (fast-signals) - direct signal access';

    bench(
      benchmarkName,
      () => {
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const counterId = counterIds[i % COUNTER_COUNT]!;
          setup?.incrementCounter(counterId);
          setup?.getCounter(counterId);
          
          const adjacentId = counterIds[(i + 1) % COUNTER_COUNT]!;
          setup?.getCounter(adjacentId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            setup = setupFast();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            setup = undefined;
          });
        },
      }
    );
  }
});

describe('Large State Memory Usage - Implementation Comparison', () => {
  const LARGE_COUNTER_COUNT = 1000;

  // Original implementation
  {
    const setupOriginal = () => {
      const counters: Record<string, number> = {};
      for (let i = 0; i < LARGE_COUNTER_COUNT; i++) {
        counters[`counter_${i}`] = 0;
      }
      
      const store = createComponent({ counters });

      const Component = ({ store, set }: ComponentContext<{ counters: Record<string, number> }>) => ({
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

      return Component(store);
    };

    let setup: ReturnType<typeof setupOriginal> | undefined;
    const benchmarkName = 'Lattice (original) - large state (1000 counters)';

    bench(
      benchmarkName,
      () => {
        for (let i = 0; i < 100; i++) {
          const randomId = `counter_${Math.floor(Math.random() * LARGE_COUNTER_COUNT)}`;
          setup?.increment(randomId);
          setup?.getCounter(randomId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            setup = setupOriginal();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            setup = undefined;
          });
        },
      }
    );
  }

  // Fast-signals implementation
  {
    const setupFast = () => {
      const counters: Record<string, number> = {};
      for (let i = 0; i < LARGE_COUNTER_COUNT; i++) {
        counters[`counter_${i}`] = 0;
      }
      
      const store = createComponentFast({ counters });

      const Component = ({ store, set }: ComponentContext<{ counters: Record<string, number> }>) => ({
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

      return Component(store);
    };

    let setup: ReturnType<typeof setupFast> | undefined;
    const benchmarkName = 'Lattice (fast-signals) - large state (1000 counters)';

    bench(
      benchmarkName,
      () => {
        for (let i = 0; i < 100; i++) {
          const randomId = `counter_${Math.floor(Math.random() * LARGE_COUNTER_COUNT)}`;
          setup?.increment(randomId);
          setup?.getCounter(randomId);
        }
      },
      {
        setup: () => {
          initMemoryTracking(benchmarkName);
          forceGC();
          measureMemory('setup', benchmarkName, () => {
            setup = setupFast();
          });
        },
        teardown: () => {
          measureMemory('teardown', benchmarkName, () => {
            setup = undefined;
          });
        },
      }
    );
  }
});