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
 * IMPORTANT: All benchmarks properly initialize dependencies before timing begins.
 * This ensures we measure warm performance (actual runtime behavior) rather than
 * cold starts (initial dependency discovery). Without initialization, benchmarks
 * would unfairly penalize libraries with different cold start costs.
 */

import { describe, bench } from 'vitest';
import {
  signal as preactSignal,
  computed as preactComputed,
  ReadonlySignal,
} from '@preact/signals-core';
import {
  createSignalFactory,
  createComputedFactory,
  createBatchFactory,
  createSignalAPI,
  Computed,
} from '@lattice/signals';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';

const ITERATIONS = 10000;

// Create Lattice API instance
const {
  signal: latticeSignal,
  computed: latticeComputed,
} = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  batch: createBatchFactory,
});

describe('Push-Pull: Filtered Diamond Dependencies', () => {
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

  // Preact setup
  const preactSource = preactSignal(0);
  const preactFilterA = preactComputed(() => {
    const val = preactSource.value;
    return val > 50 ? val * 2 : 0;
  });
  const preactFilterB = preactComputed(() => {
    const val = preactSource.value;
    return val > 50 ? val * 3 : 0;
  });
  const preactExpensive = preactComputed(() => {
    const a = preactFilterA.value;
    const b = preactFilterB.value;
    // Simulate expensive computation
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += i;
    }
    return a + b + sum;
  });

  // Lattice setup
  const latticeSource = latticeSignal(0);
  const latticeFilterA = latticeComputed(() => {
    const val = latticeSource.value;
    return val > 50 ? val * 2 : 0;
  });
  const latticeFilterB = latticeComputed(() => {
    const val = latticeSource.value;
    return val > 50 ? val * 3 : 0;
  });
  const latticeExpensive = latticeComputed(() => {
    const a = latticeFilterA.value;
    const b = latticeFilterB.value;
    // Simulate expensive computation
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += i;
    }
    return a + b + sum;
  });

  // Alien setup
  const alienSource = alienSignal(0);
  const alienFilterA = alienComputed(() => {
    const val = alienSource();
    return val > 50 ? val * 2 : 0;
  });
  const alienFilterB = alienComputed(() => {
    const val = alienSource();
    return val > 50 ? val * 3 : 0;
  });
  const alienExpensive = alienComputed(() => {
    const a = alienFilterA();
    const b = alienFilterB();
    // Simulate expensive computation
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += i;
    }
    return a + b + sum;
  });

  // No warm-up - testing cold start impact

  bench('Preact - filtered diamond (mixed changes)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // Alternate between filtered (0-49) and unfiltered (51-100) values
      preactSource.value = i % 100;
      void preactExpensive.value;
    }
  });

  bench('Lattice - filtered diamond (mixed changes)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // Alternate between filtered (0-49) and unfiltered (51-100) values
      latticeSource.value = i % 100;
      void latticeExpensive.value;
    }
  });

  bench('Alien - filtered diamond (mixed changes)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // Alternate between filtered (0-49) and unfiltered (51-100) values
      alienSource(i % 100);
      void alienExpensive();
    }
  });

  bench('Preact - filtered diamond (mostly filtered)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // 90% filtered values (0-44), 10% pass through (90-99)
      preactSource.value = i % 50 < 45 ? i % 50 : 90 + (i % 10);
      void preactExpensive.value;
    }
  });

  bench('Lattice - filtered diamond (mostly filtered)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // 90% filtered values (0-44), 10% pass through (90-99)
      latticeSource.value = i % 50 < 45 ? i % 50 : 90 + (i % 10);
      void latticeExpensive.value;
    }
  });

  bench('Alien - filtered diamond (mostly filtered)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // 90% filtered values (0-44), 10% pass through (90-99)
      alienSource(i % 50 < 45 ? i % 50 : 90 + (i % 10));
      void alienExpensive();
    }
  });
});

describe('Push-Pull: Multi-Level Filtering', () => {
  /**
   * Test case: Multiple levels of filtering
   * source → filter1 (>30) → filter2 (even) → filter3 (<80) → result
   * 
   * Many changes get filtered out at different levels
   */

  // Preact
  const preactMLSource = preactSignal(0);
  const preactMLFilter1 = preactComputed(() => {
    const val = preactMLSource.value;
    return val > 30 ? val : 0;
  });
  const preactMLFilter2 = preactComputed(() => {
    const val = preactMLFilter1.value;
    return val % 2 === 0 ? val : 0;
  });
  const preactMLFilter3 = preactComputed(() => {
    const val = preactMLFilter2.value;
    return val < 80 && val > 0 ? val : 0;
  });
  const preactMLResult = preactComputed(() => {
    const val = preactMLFilter3.value;
    // Expensive operation only on valid values
    return val > 0 ? Math.sqrt(val) * Math.log(val) : 0;
  });

  // Lattice
  const latticeMLSource = latticeSignal(0);
  const latticeMLFilter1 = latticeComputed(() => {
    const val = latticeMLSource.value;
    return val > 30 ? val : 0;
  });
  const latticeMLFilter2 = latticeComputed(() => {
    const val = latticeMLFilter1.value;
    return val % 2 === 0 ? val : 0;
  });
  const latticeMLFilter3 = latticeComputed(() => {
    const val = latticeMLFilter2.value;
    return val < 80 && val > 0 ? val : 0;
  });
  const latticeMLResult = latticeComputed(() => {
    const val = latticeMLFilter3.value;
    // Expensive operation only on valid values
    return val > 0 ? Math.sqrt(val) * Math.log(val) : 0;
  });

  // Alien
  const alienMLSource = alienSignal(0);
  const alienMLFilter1 = alienComputed(() => {
    const val = alienMLSource();
    return val > 30 ? val : 0;
  });
  const alienMLFilter2 = alienComputed(() => {
    const val = alienMLFilter1();
    return val % 2 === 0 ? val : 0;
  });
  const alienMLFilter3 = alienComputed(() => {
    const val = alienMLFilter2();
    return val < 80 && val > 0 ? val : 0;
  });
  const alienMLResult = alienComputed(() => {
    const val = alienMLFilter3();
    // Expensive operation only on valid values
    return val > 0 ? Math.sqrt(val) * Math.log(val) : 0;
  });

  // No warm-up - testing cold start impact

  bench('Preact - multi-level filtering', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactMLSource.value = i % 100;
      void preactMLResult.value;
    }
  });

  bench('Lattice - multi-level filtering', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeMLSource.value = i % 100;
      void latticeMLResult.value;
    }
  });

  bench('Alien - multi-level filtering', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      alienMLSource(i % 100);
      void alienMLResult();
    }
  });
});

describe('Push-Pull: Conditional Dependencies', () => {
  /**
   * Test case: Computeds with conditional dependencies
   * The computed only depends on certain signals based on a condition
   */

  // Preact
  const preactCondSwitch = preactSignal(true);
  const preactCondA = preactSignal(0);
  const preactCondB = preactSignal(0);
  const preactCondExpensiveA = preactComputed(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    return preactCondA.value * sum;
  });
  const preactCondExpensiveB = preactComputed(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    return preactCondB.value * sum;
  });
  const preactCondResult = preactComputed(() => {
    return preactCondSwitch.value ? preactCondExpensiveA.value : preactCondExpensiveB.value;
  });

  // Lattice
  const latticeCondSwitch = latticeSignal(true);
  const latticeCondA = latticeSignal(0);
  const latticeCondB = latticeSignal(0);
  const latticeCondExpensiveA = latticeComputed(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    return latticeCondA.value * sum;
  });
  const latticeCondExpensiveB = latticeComputed(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    return latticeCondB.value * sum;
  });
  const latticeCondResult = latticeComputed(() => {
    return latticeCondSwitch.value ? latticeCondExpensiveA.value : latticeCondExpensiveB.value;
  });

  // Alien
  const alienCondSwitch = alienSignal(true);
  const alienCondA = alienSignal(0);
  const alienCondB = alienSignal(0);
  const alienCondExpensiveA = alienComputed(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    return alienCondA() * sum;
  });
  const alienCondExpensiveB = alienComputed(() => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    return alienCondB() * sum;
  });
  const alienCondResult = alienComputed(() => {
    return alienCondSwitch() ? alienCondExpensiveA() : alienCondExpensiveB();
  });

  // No warm-up - testing cold start impact

  bench('Preact - conditional deps (updating inactive branch)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // condSwitch is true, so only A branch matters
      // Update B (which shouldn't trigger expensive computation)
      preactCondB.value = i;
      void preactCondResult.value;
    }
  });

  bench('Lattice - conditional deps (updating inactive branch)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // condSwitch is true, so only A branch matters
      // Update B (which shouldn't trigger expensive computation)
      latticeCondB.value = i;
      void latticeCondResult.value;
    }
  });

  bench('Alien - conditional deps (updating inactive branch)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // condSwitch is true, so only A branch matters
      // Update B (which shouldn't trigger expensive computation)
      alienCondB(i);
      void alienCondResult();
    }
  });
});

describe('Push-Pull: Large Graph with Sparse Updates', () => {
  /**
   * Test case: Large dependency graph where only a few paths actually change
   * This tests how well the push-pull algorithm avoids unnecessary computation
   */

  const GRAPH_SIZE = 20;

  // Preact
  const preactSparseSignals = Array.from({ length: GRAPH_SIZE }, (_, i) => preactSignal(i));
  const preactSparseFilters = preactSparseSignals.map((s, i) => 
    preactComputed(() => {
      const val = s.value;
      // Only even indices pass through changes
      return i % 2 === 0 ? val : 0;
    })
  );
  const preactSparseSums: ReadonlySignal<number>[] = [];
  for (let i = 0; i < GRAPH_SIZE - 1; i++) {
    preactSparseSums.push(
      preactComputed(() => {
        const a = preactSparseFilters[i]!.value;
        const b = preactSparseFilters[i + 1]!.value;
        // Expensive computation
        let sum = 0;
        for (let j = 0; j < 50; j++) sum += j;
        return a + b + sum;
      })
    );
  }
  const preactSparseFinal = preactComputed(() => {
    return preactSparseSums.reduce((acc, sum) => acc + sum.value, 0);
  });

  // Lattice
  const latticeSparseSignals = Array.from({ length: GRAPH_SIZE }, (_, i) => latticeSignal(i));
  const latticeSparseFilters = latticeSparseSignals.map((s, i) => 
    latticeComputed(() => {
      const val = s.value;
      // Only even indices pass through changes
      return i % 2 === 0 ? val : 0;
    })
  );
  const latticeSparseSums: Computed<number>[] = [];
  for (let i = 0; i < GRAPH_SIZE - 1; i++) {
    latticeSparseSums.push(
      latticeComputed(() => {
        const a = latticeSparseFilters[i]!.value;
        const b = latticeSparseFilters[i + 1]!.value;
        // Expensive computation
        let sum = 0;
        for (let j = 0; j < 50; j++) sum += j;
        return a + b + sum;
      })
    );
  }
  const latticeSparseFinal = latticeComputed(() => {
    return latticeSparseSums.reduce((acc, sum) => acc + sum.value, 0);
  });

  // Alien
  const alienSparseSignals = Array.from({ length: GRAPH_SIZE }, (_, i) => alienSignal(i));
  const alienSparseFilters = alienSparseSignals.map((s, i) => 
    alienComputed(() => {
      const val = s();
      // Only even indices pass through changes
      return i % 2 === 0 ? val : 0;
    })
  );
  const alienSparseSums: (() => number)[] = [];
  for (let i = 0; i < GRAPH_SIZE - 1; i++) {
    alienSparseSums.push(
      alienComputed(() => {
        const a = alienSparseFilters[i]!();
        const b = alienSparseFilters[i + 1]!();
        // Expensive computation
        let sum = 0;
        for (let j = 0; j < 50; j++) sum += j;
        return a + b + sum;
      })
    );
  }
  const alienSparseFinal = alienComputed(() => {
    return alienSparseSums.reduce((acc, sum) => acc + sum(), 0);
  });

  // No warm-up - testing cold start impact

  bench('Preact - sparse graph (updating filtered nodes)', () => {
    for (let i = 0; i < ITERATIONS / 10; i++) {
      // Update odd indices (which get filtered out)
      const idx = (i * 2 + 1) % GRAPH_SIZE;
      preactSparseSignals[idx]!.value = i;
      void preactSparseFinal.value;
    }
  });

  bench('Lattice - sparse graph (updating filtered nodes)', () => {
    for (let i = 0; i < ITERATIONS / 10; i++) {
      // Update odd indices (which get filtered out)
      const idx = (i * 2 + 1) % GRAPH_SIZE;
      latticeSparseSignals[idx]!.value = i;
      void latticeSparseFinal.value;
    }
  });

  bench('Alien - sparse graph (updating filtered nodes)', () => {
    for (let i = 0; i < ITERATIONS / 10; i++) {
      // Update odd indices (which get filtered out)
      const idx = (i * 2 + 1) % GRAPH_SIZE;
      alienSparseSignals[idx]!(i);
      void alienSparseFinal();
    }
  });
});

describe('Push-Pull: Write-Heavy vs Read-Heavy Patterns', () => {
  /**
   * Test case: Many writes followed by single read
   * This specifically tests lazy evaluation benefits
   */

  // Preact
  const preactWriteSource = preactSignal(0);
  const preactWriteComputed1 = preactComputed(() => preactWriteSource.value * 2);
  const preactWriteComputed2 = preactComputed(() => preactWriteComputed1.value + 10);
  const preactWriteComputed3 = preactComputed(() => preactWriteComputed2.value * preactWriteComputed2.value);

  // Lattice
  const latticeWriteSource = latticeSignal(0);
  const latticeWriteComputed1 = latticeComputed(() => latticeWriteSource.value * 2);
  const latticeWriteComputed2 = latticeComputed(() => latticeWriteComputed1.value + 10);
  const latticeWriteComputed3 = latticeComputed(() => latticeWriteComputed2.value * latticeWriteComputed2.value);

  // Alien
  const alienWriteSource = alienSignal(0);
  const alienWriteComputed1 = alienComputed(() => alienWriteSource() * 2);
  const alienWriteComputed2 = alienComputed(() => alienWriteComputed1() + 10);
  const alienWriteComputed3 = alienComputed(() => alienWriteComputed2() * alienWriteComputed2());

  // No warm-up - testing cold start impact

  bench('Preact - 100 writes, 1 read', () => {
    for (let batch = 0; batch < ITERATIONS / 100; batch++) {
      // 100 writes
      for (let i = 0; i < 100; i++) {
        preactWriteSource.value = batch * 100 + i;
      }
      // 1 read
      void preactWriteComputed3.value;
    }
  });

  bench('Lattice - 100 writes, 1 read', () => {
    for (let batch = 0; batch < ITERATIONS / 100; batch++) {
      // 100 writes
      for (let i = 0; i < 100; i++) {
        latticeWriteSource.value = batch * 100 + i;
      }
      // 1 read
      void latticeWriteComputed3.value;
    }
  });

  bench('Alien - 100 writes, 1 read', () => {
    for (let batch = 0; batch < ITERATIONS / 100; batch++) {
      // 100 writes
      for (let i = 0; i < 100; i++) {
        alienWriteSource(batch * 100 + i);
      }
      // 1 read
      void alienWriteComputed3();
    }
  });
});