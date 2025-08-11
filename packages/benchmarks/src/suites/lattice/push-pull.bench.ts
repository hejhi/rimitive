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

    bench('Preact - filtered diamond: $filterRatio% filtered', function* (state: BenchState) {
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
      
      // Warm up the graph
      source.value = 1;
      void expensive.value;
      
      let counter = 0;
      yield () => {
        // Single update - value based on filter ratio
        source.value = counter % 100;
        void expensive.value;
        counter++;
      };
    })
    .args('filterRatio', [50, 70, 90]);

    bench('Lattice - filtered diamond: $filterRatio% filtered', function* (state: BenchState) {
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
      
      // Warm up the graph
      source.value = 1;
      void expensive.value;
      
      let counter = 0;
      yield () => {
        // Single update - value based on filter ratio
        source.value = counter % 100;
        void expensive.value;
        counter++;
      };
    })
    .args('filterRatio', [50, 70, 90]);

    bench('Alien - filtered diamond: $filterRatio% filtered', function* (state: BenchState) {
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
      
      // Warm up the graph
      source(1);
      void expensive();
      
      let counter = 0;
      yield () => {
        // Single update - value based on filter ratio
        source(counter % 100);
        void expensive();
        counter++;
      };
    })
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

    bench('Preact - multi-level filtering: $filterLevels levels', function* (state: BenchState) {
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
      
      // Warm up the graph
      source.value = 1;
      void result.value;
      
      let counter = 0;
      yield () => {
        source.value = counter % 100;
        void result.value;
        counter++;
      };
    })
    .args('filterLevels', [1, 2, 3]);

    bench('Lattice - multi-level filtering: $filterLevels levels', function* (state: BenchState) {
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
      
      // Warm up the graph
      source.value = 1;
      void result.value;
      
      let counter = 0;
      yield () => {
        source.value = counter % 100;
        void result.value;
        counter++;
      };
    })
    .args('filterLevels', [1, 2, 3]);

    bench('Alien - multi-level filtering: $filterLevels levels', function* (state: BenchState) {
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
      
      // Warm up the graph
      source(1);
      void result();
      
      let counter = 0;
      yield () => {
        source(counter % 100);
        void result();
        counter++;
      };
    })
    .args('filterLevels', [1, 2, 3]);
  });
});

boxplot(() => {
  group('Push-Pull: Conditional Dependencies', () => {
  /**
   * Test case: Computeds with conditional dependencies
   * The computed only depends on certain signals based on a condition
   */

    bench('Preact - conditional deps: $branchSwitchRatio% switching', function* (state: BenchState) {
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
      
      // Warm up the graph
      void condResult.value;
      
      let counter = 0;
      yield () => {
        // Switch branch based on ratio parameter
        if (counter % 100 < branchSwitchRatio) {
          condSwitch.value = !condSwitch.value;
        }
        // Update both branches to test conditional logic
        condA.value = counter;
        condB.value = counter + 100;
        void condResult.value;
        counter++;
      };
    })
    .args('branchSwitchRatio', [0, 10, 50]);

    bench('Lattice - conditional deps: $branchSwitchRatio% switching', function* (state: BenchState) {
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
      
      // Warm up the graph
      void condResult.value;
      
      let counter = 0;
      yield () => {
        // Switch branch based on ratio parameter
        if (counter % 100 < branchSwitchRatio) {
          condSwitch.value = !condSwitch.value;
        }
        // Update both branches to test conditional logic
        condA.value = counter;
        condB.value = counter + 100;
        void condResult.value;
        counter++;
      };
    })
    .args('branchSwitchRatio', [0, 10, 50]);

    bench('Alien - conditional deps: $branchSwitchRatio% switching', function* (state: BenchState) {
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
      
      // Warm up the graph
      void condResult();
      
      let counter = 0;
      yield () => {
        // Switch branch based on ratio parameter
        if (counter % 100 < branchSwitchRatio) {
          condSwitch(!condSwitch());
        }
        // Update both branches to test conditional logic
        condA(counter);
        condB(counter + 100);
        void condResult();
        counter++;
      };
    })
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
    bench('Preact - sparse graph: $graphSize nodes', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      
      const signals = Array.from({ length: graphSize }, (_, i) => 
        preactSignal(i)
      );
      const filtered = signals.map((s, i) => 
        preactComputed(() => i % 2 === 0 ? s.value : 0)
      );
      const final = preactComputed(() => 
        filtered.reduce((sum, f) => sum + f.value, 0)
      );
      
      // Warm up the graph
      void final.value;
      
      let counter = 0;
      yield () => {
        // Update odd indices (which get filtered out)
        const idx = (counter * 2 + 1) % graphSize;
        signals[idx]!.value = counter;
        void final.value;
        counter++;
      };
    })
    .args('graphSize', [50, 100, 200]);

    bench('Lattice - sparse graph: $graphSize nodes', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      
      const signals = Array.from({ length: graphSize }, (_, i) => 
        latticeSignal(i)
      );
      const filtered = signals.map((s, i) => 
        latticeComputed(() => i % 2 === 0 ? s.value : 0)
      );
      const final = latticeComputed(() => 
        filtered.reduce((sum, f) => sum + f.value, 0)
      );
      
      // Warm up the graph
      void final.value;
      
      let counter = 0;
      yield () => {
        // Update odd indices (which get filtered out)
        const idx = (counter * 2 + 1) % graphSize;
        signals[idx]!.value = counter;
        void final.value;
        counter++;
      };
    })
    .args('graphSize', [50, 100, 200]);

    bench('Alien - sparse graph: $graphSize nodes', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      
      const signals = Array.from({ length: graphSize }, (_, i) => 
        alienSignal(i)
      );
      const filtered = signals.map((s, i) => 
        alienComputed(() => i % 2 === 0 ? s() : 0)
      );
      const final = alienComputed(() => 
        filtered.reduce((sum, f) => sum + f(), 0)
      );
      
      // Warm up the graph
      void final();
      
      let counter = 0;
      yield () => {
        // Update odd indices (which get filtered out)
        const idx = (counter * 2 + 1) % graphSize;
        signals[idx]!(counter);
        void final();
        counter++;
      };
    })
    .args('graphSize', [50, 100, 200]);
  });
});

boxplot(() => {
  group('Push-Pull: Write-Heavy vs Read-Heavy Patterns', () => {
  /**
   * Test case: Many writes with few reads
   * Push-pull should defer computation until read
   */

    bench('Preact - write-heavy pattern: $writeReadRatio writes per read', function* (state: BenchState) {
      const writeReadRatio = state.get('writeReadRatio');
      
      const source = preactSignal(0);
      const computed1 = preactComputed(() => source.value * 2);
      const computed2 = preactComputed(() => computed1.value + 10);
      const computed3 = preactComputed(() => computed2.value * computed2.value);
      
      // Warm up the graph
      source.value = 1;
      void computed3.value;
      
      let counter = 0;
      yield () => {
        // Multiple writes
        for (let i = 0; i < writeReadRatio; i++) {
          source.value = counter * writeReadRatio + i;
        }
        // Single read
        void computed3.value;
        counter++;
      };
    })
    .args('writeReadRatio', [10, 50, 100]);

    bench('Lattice - write-heavy pattern: $writeReadRatio writes per read', function* (state: BenchState) {
      const writeReadRatio = state.get('writeReadRatio');
      
      const source = latticeSignal(0);
      const computed1 = latticeComputed(() => source.value * 2);
      const computed2 = latticeComputed(() => computed1.value + 10);
      const computed3 = latticeComputed(() => computed2.value * computed2.value);
      
      // Warm up the graph
      source.value = 1;
      void computed3.value;
      
      let counter = 0;
      yield () => {
        // Multiple writes
        for (let i = 0; i < writeReadRatio; i++) {
          source.value = counter * writeReadRatio + i;
        }
        // Single read
        void computed3.value;
        counter++;
      };
    })
    .args('writeReadRatio', [10, 50, 100]);

    bench('Alien - write-heavy pattern: $writeReadRatio writes per read', function* (state: BenchState) {
      const writeReadRatio = state.get('writeReadRatio');
      
      const source = alienSignal(0);
      const computed1 = alienComputed(() => source() * 2);
      const computed2 = alienComputed(() => computed1() + 10);
      const computed3 = alienComputed(() => computed2() * computed2());
      
      // Warm up the graph
      source(1);
      void computed3();
      
      let counter = 0;
      yield () => {
        // Multiple writes
        for (let i = 0; i < writeReadRatio; i++) {
          source(counter * writeReadRatio + i);
        }
        // Single read
        void computed3();
        counter++;
      };
    })
    .args('writeReadRatio', [10, 50, 100]);
  });
});

// Run all benchmarks with markdown output for better visualization
await run({ format: 'markdown' });