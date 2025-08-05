/**
 * Filtered Diamond Warmup Benchmark
 * 
 * This is a debug version of the push-pull-optimization benchmark that adds
 * proper warm-up to ensure dependency graphs are initialized before timing.
 * 
 * The hypothesis is that Lattice might have different cold-start behavior than
 * Preact, and the original benchmark might be measuring initialization overhead
 * rather than steady-state performance.
 */

import { describe, bench } from 'vitest';
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
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

describe('Filtered Diamond with Warm-up', () => {
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

  // WARM-UP: Initialize all dependency graphs by reading values with different scenarios
  // This ensures all implementations have discovered their dependencies before timing
  
  // Warm up with filtered values (0-50)
  preactSource.value = 25;
  void preactExpensive.value;
  latticeSource.value = 25;
  void latticeExpensive.value;
  alienSource(25);
  void alienExpensive();
  
  // Warm up with unfiltered values (>50)
  preactSource.value = 75;
  void preactExpensive.value;
  latticeSource.value = 75;
  void latticeExpensive.value;
  alienSource(75);
  void alienExpensive();
  
  // Reset to initial state
  preactSource.value = 0;
  latticeSource.value = 0;
  alienSource(0);

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

describe('Filtered Diamond - Cold Start Comparison', () => {
  /**
   * This test explicitly measures cold start behavior by creating
   * fresh signal/computed instances for each benchmark run.
   */

  bench('Preact - cold start', () => {
    // Create fresh instances
    const source = preactSignal(0);
    const filterA = preactComputed(() => {
      const val = source.value;
      return val > 50 ? val * 2 : 0;
    });
    const filterB = preactComputed(() => {
      const val = source.value;
      return val > 50 ? val * 3 : 0;
    });
    const expensive = preactComputed(() => {
      const a = filterA.value;
      const b = filterB.value;
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += i;
      }
      return a + b + sum;
    });

    // Single iteration to measure cold start
    source.value = 75;
    void expensive.value;
  });

  bench('Lattice - cold start', () => {
    // Create fresh instances
    const source = latticeSignal(0);
    const filterA = latticeComputed(() => {
      const val = source.value;
      return val > 50 ? val * 2 : 0;
    });
    const filterB = latticeComputed(() => {
      const val = source.value;
      return val > 50 ? val * 3 : 0;
    });
    const expensive = latticeComputed(() => {
      const a = filterA.value;
      const b = filterB.value;
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += i;
      }
      return a + b + sum;
    });

    // Single iteration to measure cold start
    source.value = 75;
    void expensive.value;
  });

  bench('Alien - cold start', () => {
    // Create fresh instances
    const source = alienSignal(0);
    const filterA = alienComputed(() => {
      const val = source();
      return val > 50 ? val * 2 : 0;
    });
    const filterB = alienComputed(() => {
      const val = source();
      return val > 50 ? val * 3 : 0;
    });
    const expensive = alienComputed(() => {
      const a = filterA();
      const b = filterB();
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += i;
      }
      return a + b + sum;
    });

    // Single iteration to measure cold start
    source(75);
    void expensive();
  });
});