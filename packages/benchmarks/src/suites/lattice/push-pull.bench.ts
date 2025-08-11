/**
 * Push-Pull Optimization Benchmark
 * 
 * This benchmark specifically tests the performance benefits of push-pull
 * lazy evaluation in computed values. It focuses on scenarios where:
 * 
 * 1. Intermediate computeds filter out changes (avoiding unnecessary downstream computation)
 * 2. Diamond dependencies where multiple paths converge
 * 3. Conditional dependencies that may not always be evaluated
 * 
 * The key insight: With push-pull, if an intermediate computed's value doesn't
 * change (e.g., due to filtering), downstream computeds won't recompute.
 * 
 * NOTE: Most scenarios initialize dependencies before timing (warm performance),
 * but some explicitly measure cold-init impact and are marked accordingly.
 */

import { run, bench, group, boxplot } from 'mitata';

// Type for mitata benchmark state
interface BenchState {
  get(name: string): any;
}
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
type LatticeExtension<N extends string, M> = { name: N; method: M };
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';


// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

boxplot(() => {
  group('Push-Pull: Filtered Diamond Dependencies', () => {
  /**
   * Test case: Diamond with filtering
   *        source
   *        /    \
   *    filterA  filterB  (only pass values > 50)
   *        \    /
   *      expensive
   * 
   * When source changes from 10 to 20 (both filtered out),
   * the expensive computation should not run with push-pull.
   */

    bench('Preact - filtered diamond: $iterations iterations, $filterRatio% filtered', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const filterRatio = state.get('filterRatio');
      const threshold = 100 - filterRatio; // threshold for filtering
      
      const source = preactSignal(0);
      const filterA = preactComputed(() => {
        const val = source.value;
        return val > threshold ? val * 2 : 0;
      });
      const filterB = preactComputed(() => {
        const val = source.value;
        return val > threshold ? val * 3 : 0;
      });
      const expensive = preactComputed(() => {
        const a = filterA.value;
        const b = filterB.value;
        // Simulate expensive computation
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return a + b + sum;
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Values based on filter ratio
          source.value = i % 100;
          void expensive.value;
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('filterRatio', [50, 70, 90]);

    bench('Lattice - filtered diamond: $iterations iterations, $filterRatio% filtered', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const filterRatio = state.get('filterRatio');
      const threshold = 100 - filterRatio; // threshold for filtering
      
      const source = latticeSignal(0);
      const filterA = latticeComputed(() => {
        const val = source.value;
        return val > threshold ? val * 2 : 0;
      });
      const filterB = latticeComputed(() => {
        const val = source.value;
        return val > threshold ? val * 3 : 0;
      });
      const expensive = latticeComputed(() => {
        const a = filterA.value;
        const b = filterB.value;
        // Simulate expensive computation
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return a + b + sum;
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Values based on filter ratio
          source.value = i % 100;
          void expensive.value;
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('filterRatio', [50, 70, 90]);

    bench('Alien - filtered diamond: $iterations iterations, $filterRatio% filtered', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const filterRatio = state.get('filterRatio');
      const threshold = 100 - filterRatio; // threshold for filtering
      
      const source = alienSignal(0);
      const filterA = alienComputed(() => {
        const val = source();
        return val > threshold ? val * 2 : 0;
      });
      const filterB = alienComputed(() => {
        const val = source();
        return val > threshold ? val * 3 : 0;
      });
      const expensive = alienComputed(() => {
        const a = filterA();
        const b = filterB();
        // Simulate expensive computation
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return a + b + sum;
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Values based on filter ratio
          source(i % 100);
          void expensive();
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('filterRatio', [50, 70, 90]);



  });
});

boxplot(() => {
  group('Push-Pull: Multi-Level Filtering', () => {
  /**
   * Test case: Multiple levels of filtering
   * source → filter1 (>30) → filter2 (even) → filter3 (<80) → result
   * 
   * Many changes get filtered out at different levels
   */

    bench('Preact - multi-level filtering: $iterations iterations, $filterLevels levels', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const filterLevels = state.get('filterLevels');
      
      const source = preactSignal(0);
      const filter1 = preactComputed(() => {
        const val = source.value;
        return val > 30 ? val : 0;
      });
      const filter2 = preactComputed(() => {
        const val = filter1.value;
        return val % 2 === 0 ? val : 0;
      });
      const filter3 = preactComputed(() => {
        const val = filter2.value;
        return val < 80 && val > 0 ? val : 0;
      });
      const result = preactComputed(() => {
        const val = filterLevels >= 3 ? filter3.value : filterLevels >= 2 ? filter2.value : filter1.value;
        // Expensive operation only on valid values
        return val > 0 ? Math.sqrt(val) * Math.log(val) : 0;
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          source.value = i % 100;
          void result.value;
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('filterLevels', [1, 2, 3]);

    bench('Lattice - multi-level filtering: $iterations iterations, $filterLevels levels', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const filterLevels = state.get('filterLevels');
      
      const source = latticeSignal(0);
      const filter1 = latticeComputed(() => {
        const val = source.value;
        return val > 30 ? val : 0;
      });
      const filter2 = latticeComputed(() => {
        const val = filter1.value;
        return val % 2 === 0 ? val : 0;
      });
      const filter3 = latticeComputed(() => {
        const val = filter2.value;
        return val < 80 && val > 0 ? val : 0;
      });
      const result = latticeComputed(() => {
        const val = filterLevels >= 3 ? filter3.value : filterLevels >= 2 ? filter2.value : filter1.value;
        // Expensive operation only on valid values
        return val > 0 ? Math.sqrt(val) * Math.log(val) : 0;
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          source.value = i % 100;
          void result.value;
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('filterLevels', [1, 2, 3]);

    bench('Alien - multi-level filtering: $iterations iterations, $filterLevels levels', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const filterLevels = state.get('filterLevels');
      
      const source = alienSignal(0);
      const filter1 = alienComputed(() => {
        const val = source();
        return val > 30 ? val : 0;
      });
      const filter2 = alienComputed(() => {
        const val = filter1();
        return val % 2 === 0 ? val : 0;
      });
      const filter3 = alienComputed(() => {
        const val = filter2();
        return val < 80 && val > 0 ? val : 0;
      });
      const result = alienComputed(() => {
        const val = filterLevels >= 3 ? filter3() : filterLevels >= 2 ? filter2() : filter1();
        // Expensive operation only on valid values
        return val > 0 ? Math.sqrt(val) * Math.log(val) : 0;
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          source(i % 100);
          void result();
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('filterLevels', [1, 2, 3]);
  });
});

boxplot(() => {
  group('Push-Pull: Conditional Dependencies', () => {
  /**
   * Test case: Computeds with conditional dependencies
   * The computed only depends on certain signals based on a condition
   */

    bench('Preact - conditional deps: $iterations iterations, $branchSwitchRatio% switching', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const branchSwitchRatio = state.get('branchSwitchRatio');
      
      const condSwitch = preactSignal(true);
      const condA = preactSignal(10);
      const condB = preactSignal(20);
      const condResult = preactComputed(() => {
        // Conditional dependency - only uses one branch
        if (condSwitch.value) {
          return condA.value * 2;
        } else {
          return condB.value * 3;
        }
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Switch branch based on ratio parameter
          if (i % 100 < branchSwitchRatio) {
            condSwitch.value = !condSwitch.value;
          }
          // Update both branches to test conditional logic
          condA.value = i;
          condB.value = i + 100;
          void condResult.value;
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('branchSwitchRatio', [0, 10, 50]);

    bench('Lattice - conditional deps: $iterations iterations, $branchSwitchRatio% switching', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const branchSwitchRatio = state.get('branchSwitchRatio');
      
      const condSwitch = latticeSignal(true);
      const condA = latticeSignal(10);
      const condB = latticeSignal(20);
      const condResult = latticeComputed(() => {
        // Conditional dependency - only uses one branch
        if (condSwitch.value) {
          return condA.value * 2;
        } else {
          return condB.value * 3;
        }
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Switch branch based on ratio parameter
          if (i % 100 < branchSwitchRatio) {
            condSwitch.value = !condSwitch.value;
          }
          // Update both branches to test conditional logic
          condA.value = i;
          condB.value = i + 100;
          void condResult.value;
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('branchSwitchRatio', [0, 10, 50]);

    bench('Alien - conditional deps: $iterations iterations, $branchSwitchRatio% switching', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const branchSwitchRatio = state.get('branchSwitchRatio');
      
      const condSwitch = alienSignal(true);
      const condA = alienSignal(10);
      const condB = alienSignal(20);
      const condResult = alienComputed(() => {
        // Conditional dependency - only uses one branch
        if (condSwitch()) {
          return condA() * 2;
        } else {
          return condB() * 3;
        }
      });
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Switch branch based on ratio parameter
          if (i % 100 < branchSwitchRatio) {
            condSwitch(!condSwitch());
          }
          // Update both branches to test conditional logic
          condA(i);
          condB(i + 100);
          void condResult();
        }
      };
    })
    .args('iterations', [1000, 5000, 10000])
    .args('branchSwitchRatio', [0, 10, 50]);
  });
});

boxplot(() => {
  group('Push-Pull: Large Graph with Sparse Updates', () => {
  /**
   * Test case: Large dependency graph where only a small subset changes
   * Many signals → filtered computeds → aggregation
   * 
   * Only signals with even indices pass through the filter
   */
    bench('Preact - sparse graph: $graphSize nodes, $iterations iterations', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const iterations = state.get('iterations');
      
      const signals = Array.from({ length: graphSize }, (_, i) => 
        preactSignal(i)
      );
      const filtered = signals.map((s, i) => 
        preactComputed(() => i % 2 === 0 ? s.value : 0)
      );
      const final = preactComputed(() => 
        filtered.reduce((sum, f) => sum + f.value, 0)
      );
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Update odd indices (which get filtered out)
          const idx = (i * 2 + 1) % graphSize;
          signals[idx]!.value = i;
          void final.value;
        }
      };
    })
    .args('graphSize', [50, 100, 200])
    .args('iterations', [100, 500, 1000]);

    bench('Lattice - sparse graph: $graphSize nodes, $iterations iterations', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const iterations = state.get('iterations');
      
      const signals = Array.from({ length: graphSize }, (_, i) => 
        latticeSignal(i)
      );
      const filtered = signals.map((s, i) => 
        latticeComputed(() => i % 2 === 0 ? s.value : 0)
      );
      const final = latticeComputed(() => 
        filtered.reduce((sum, f) => sum + f.value, 0)
      );
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Update odd indices (which get filtered out)
          const idx = (i * 2 + 1) % graphSize;
          signals[idx]!.value = i;
          void final.value;
        }
      };
    })
    .args('graphSize', [50, 100, 200])
    .args('iterations', [100, 500, 1000]);

    bench('Alien - sparse graph: $graphSize nodes, $iterations iterations', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const iterations = state.get('iterations');
      
      const signals = Array.from({ length: graphSize }, (_, i) => 
        alienSignal(i)
      );
      const filtered = signals.map((s, i) => 
        alienComputed(() => i % 2 === 0 ? s() : 0)
      );
      const final = alienComputed(() => 
        filtered.reduce((sum, f) => sum + f(), 0)
      );
      
      yield () => {
        for (let i = 0; i < iterations; i++) {
          // Update odd indices (which get filtered out)
          const idx = (i * 2 + 1) % graphSize;
          signals[idx]!(i);
          void final();
        }
      };
    })
    .args('graphSize', [50, 100, 200])
    .args('iterations', [100, 500, 1000]);
  });
});

boxplot(() => {
  group('Push-Pull: Write-Heavy vs Read-Heavy Patterns', () => {
  /**
   * Test case: Many writes with few reads
   * Push-pull should defer computation until read
   */

    bench('Preact - write-heavy pattern: $writeReadRatio writes per read, $batches batches', function* (state: BenchState) {
      const writeReadRatio = state.get('writeReadRatio');
      const batches = state.get('batches');
      
      const source = preactSignal(0);
      const computed1 = preactComputed(() => source.value * 2);
      const computed2 = preactComputed(() => computed1.value + 10);
      const computed3 = preactComputed(() => computed2.value * computed2.value);
      
      yield () => {
        for (let batch = 0; batch < batches; batch++) {
          // Multiple writes
          for (let i = 0; i < writeReadRatio; i++) {
            source.value = batch * writeReadRatio + i;
          }
          // Single read
          void computed3.value;
        }
      };
    })
    .args('writeReadRatio', [10, 50, 100])
    .args('batches', [50, 100, 200]);

    bench('Lattice - write-heavy pattern: $writeReadRatio writes per read, $batches batches', function* (state: BenchState) {
      const writeReadRatio = state.get('writeReadRatio');
      const batches = state.get('batches');
      
      const source = latticeSignal(0);
      const computed1 = latticeComputed(() => source.value * 2);
      const computed2 = latticeComputed(() => computed1.value + 10);
      const computed3 = latticeComputed(() => computed2.value * computed2.value);
      
      yield () => {
        for (let batch = 0; batch < batches; batch++) {
          // Multiple writes
          for (let i = 0; i < writeReadRatio; i++) {
            source.value = batch * writeReadRatio + i;
          }
          // Single read
          void computed3.value;
        }
      };
    })
    .args('writeReadRatio', [10, 50, 100])
    .args('batches', [50, 100, 200]);

    bench('Alien - write-heavy pattern: $writeReadRatio writes per read, $batches batches', function* (state: BenchState) {
      const writeReadRatio = state.get('writeReadRatio');
      const batches = state.get('batches');
      
      const source = alienSignal(0);
      const computed1 = alienComputed(() => source() * 2);
      const computed2 = alienComputed(() => computed1() + 10);
      const computed3 = alienComputed(() => computed2() * computed2());
      
      yield () => {
        for (let batch = 0; batch < batches; batch++) {
          // Multiple writes
          for (let i = 0; i < writeReadRatio; i++) {
            source(batch * writeReadRatio + i);
          }
          // Single read
          void computed3();
        }
      };
    })
    .args('writeReadRatio', [10, 50, 100])
    .args('batches', [50, 100, 200]);
  });
});

// Run all benchmarks with markdown output for better visualization
await run({ format: 'markdown' });