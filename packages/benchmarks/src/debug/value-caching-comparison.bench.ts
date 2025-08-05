/**
 * Value Caching Comparison Benchmark
 * 
 * This benchmark compares the current Lattice implementation with a modified version
 * that caches signal values during invalidation propagation. The hypothesis is that
 * caching values can reduce redundant property accesses and improve performance
 * in scenarios with filtered computations.
 * 
 * The value-caching optimization:
 * 1. Caches dependency values after each computation
 * 2. Before recomputing, checks if any dependency VALUES changed (not just versions)
 * 3. Skips recomputation if all dependency values are the same
 */

import { describe, bench } from 'vitest';
import {
  createSignalFactory,
  createComputedFactory,
  createBatchFactory,
  createSignalAPI,
} from '@lattice/signals';

const ITERATIONS = 10000;

// Create standard Lattice API instance
const standardAPI = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  batch: createBatchFactory,
});

// For the value-caching version, we'll use a modified computed factory
// that caches dependency values to avoid redundant recomputation
function createCachedComputedFactory(ctx: any) {
  const standardComputed = createComputedFactory(ctx);
  
  return {
    name: 'computed',
    method: <T>(compute: () => T) => {
      const comp = standardComputed.method(compute) as any;
      
      // Add value caching capability
      comp._cachedDependencyValues = new Map();
      
      // Override _recompute to cache dependency values
      const originalRecompute = comp._recompute;
      comp._recompute = function() {
        // Clear old cached values
        this._cachedDependencyValues.clear();
        
        // Call original recompute
        originalRecompute.call(this);
        
        // Cache current dependency values after recomputation
        let source = this._sources;
        while (source) {
          const sourceNode = source.source;
          if ('_value' in sourceNode) {
            // For signals and computeds, use _value directly (avoid getter)
            this._cachedDependencyValues.set(sourceNode, sourceNode._value);
          }
          source = source.nextSource;
        }
      };
      
      // Add method to check if values changed without recomputing
      comp._checkValuesChanged = function() {
        if (this._cachedDependencyValues.size === 0) {
          return true; // No cache, assume changed
        }
        
        let source = this._sources;
        while (source) {
          const sourceNode = source.source;
          const cachedValue = this._cachedDependencyValues.get(sourceNode);
          
          if (cachedValue !== undefined && '_value' in sourceNode) {
            // For computeds, ensure they're up to date first
            if ('_update' in sourceNode && typeof sourceNode._update === 'function') {
              sourceNode._update();
            }
            
            if (sourceNode._value !== cachedValue) {
              return true; // Value changed
            }
          } else {
            return true; // No cached value or can't check
          }
          
          source = source.nextSource;
        }
        
        return false; // No values changed
      };
      
      // Override _update to use value checking
      const originalUpdate = comp._update;
      comp._update = function() {
        // Fast path: if global version matches, nothing changed
        if (this._globalVersion === ctx.version) {
          return;
        }
        
        // Check if we're clean without needing to check values
        const OUTDATED = 1 << 3;
        const NOTIFIED = 1 << 4;
        
        if (!(this._flags & (OUTDATED | NOTIFIED))) {
          // Not marked as needing update, just update global version
          this._globalVersion = ctx.version;
          return;
        }
        
        // If we have cached values and version > 0, check if any values actually changed
        if (this._version > 0 && !this._checkValuesChanged()) {
          // No values changed - skip recomputation
          this._globalVersion = ctx.version;
          this._flags &= ~(OUTDATED | NOTIFIED); // Clear flags
          return;
        }
        
        // Values changed or first run - use original update logic
        originalUpdate.call(this);
      };
      
      return comp;
    }
  };
}

// Create value-caching Lattice API instance
const cachedAPI = createSignalAPI({
  signal: createSignalFactory,
  computed: createCachedComputedFactory,
  batch: createBatchFactory,
});

describe('Value Caching: Filtered Diamond Pattern', () => {
  /**
   * Diamond pattern with filtering:
   *        source
   *        /    \
   *    filterA  filterB  (only pass values > 50)
   *        \    /
   *      expensive
   * 
   * Tests if caching values during propagation improves performance
   * when filters prevent downstream computation.
   */

  // Standard Lattice setup
  const standardSource = standardAPI.signal(0);
  const standardFilterA = standardAPI.computed(() => {
    const val = standardSource.value;
    return val > 50 ? val * 2 : 0;
  });
  const standardFilterB = standardAPI.computed(() => {
    const val = standardSource.value;
    return val > 50 ? val * 3 : 0;
  });
  const standardExpensive = standardAPI.computed(() => {
    const a = standardFilterA.value;
    const b = standardFilterB.value;
    // Simulate expensive computation
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += i;
    }
    return a + b + sum;
  });

  // Cached Lattice setup
  const cachedSource = cachedAPI.signal(0);
  const cachedFilterA = cachedAPI.computed(() => {
    const val = cachedSource.value;
    return val > 50 ? val * 2 : 0;
  });
  const cachedFilterB = cachedAPI.computed(() => {
    const val = cachedSource.value;
    return val > 50 ? val * 3 : 0;
  });
  const cachedExpensive = cachedAPI.computed(() => {
    const a = cachedFilterA.value;
    const b = cachedFilterB.value;
    // Simulate expensive computation
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += i;
    }
    return a + b + sum;
  });

  // Warm-up both implementations
  // Test with filtered values
  standardSource.value = 25;
  void standardExpensive.value;
  cachedSource.value = 25;
  void cachedExpensive.value;

  // Test with unfiltered values
  standardSource.value = 75;
  void standardExpensive.value;
  cachedSource.value = 75;
  void cachedExpensive.value;

  // Reset to initial state
  standardSource.value = 0;
  cachedSource.value = 0;

  bench('Standard Lattice - mostly filtered (90% filtered out)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // 90% values are 0-44 (filtered), 10% are 90-99 (pass through)
      standardSource.value = i % 50 < 45 ? i % 50 : 90 + (i % 10);
      void standardExpensive.value;
    }
  });

  bench('Cached Lattice - mostly filtered (90% filtered out)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // 90% values are 0-44 (filtered), 10% are 90-99 (pass through)
      cachedSource.value = i % 50 < 45 ? i % 50 : 90 + (i % 10);
      void cachedExpensive.value;
    }
  });

  bench('Standard Lattice - mixed changes (50/50 filtered)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // Alternate between filtered (0-49) and unfiltered (51-100) values
      standardSource.value = i % 100;
      void standardExpensive.value;
    }
  });

  bench('Cached Lattice - mixed changes (50/50 filtered)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // Alternate between filtered (0-49) and unfiltered (51-100) values
      cachedSource.value = i % 100;
      void cachedExpensive.value;
    }
  });
});

describe('Value Caching: Multi-Level Filtering', () => {
  /**
   * Multi-level filtering chain:
   * source -> filter1 (>30) -> filter2 (even) -> filter3 (<80) -> result
   * 
   * Many changes get filtered out at different levels.
   */

  // Standard setup
  const standardMLSource = standardAPI.signal(0);
  const standardMLFilter1 = standardAPI.computed(() => {
    const val = standardMLSource.value;
    return val > 30 ? val : 0;
  });
  const standardMLFilter2 = standardAPI.computed(() => {
    const val = standardMLFilter1.value;
    return val % 2 === 0 ? val : 0;
  });
  const standardMLFilter3 = standardAPI.computed(() => {
    const val = standardMLFilter2.value;
    return val < 80 && val > 0 ? val : 0;
  });
  const standardMLResult = standardAPI.computed(() => {
    const val = standardMLFilter3.value;
    return val > 0 ? Math.sqrt(val) * Math.log(val) : 0;
  });

  // Cached setup
  const cachedMLSource = cachedAPI.signal(0);
  const cachedMLFilter1 = cachedAPI.computed(() => {
    const val = cachedMLSource.value;
    return val > 30 ? val : 0;
  });
  const cachedMLFilter2 = cachedAPI.computed(() => {
    const val = cachedMLFilter1.value;
    return val % 2 === 0 ? val : 0;
  });
  const cachedMLFilter3 = cachedAPI.computed(() => {
    const val = cachedMLFilter2.value;
    return val < 80 && val > 0 ? val : 0;
  });
  const cachedMLResult = cachedAPI.computed(() => {
    const val = cachedMLFilter3.value;
    return val > 0 ? Math.sqrt(val) * Math.log(val) : 0;
  });

  // Warm-up
  standardMLSource.value = 50;
  void standardMLResult.value;
  cachedMLSource.value = 50;
  void cachedMLResult.value;

  bench('Standard Lattice - multi-level filtering', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      standardMLSource.value = i % 100;
      void standardMLResult.value;
    }
  });

  bench('Cached Lattice - multi-level filtering', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      cachedMLSource.value = i % 100;
      void cachedMLResult.value;
    }
  });
});

describe('Value Caching: Boolean Computeds', () => {
  /**
   * Boolean computeds that change less frequently than their inputs.
   * Tests the optimization when outputs are stable despite input changes.
   */

  // Standard setup
  const standardNum = standardAPI.signal(1);
  const standardIsEven = standardAPI.computed(() => standardNum.value % 2 === 0);
  const standardIsPositive = standardAPI.computed(() => standardNum.value > 0);
  const standardIsDivisibleBy5 = standardAPI.computed(() => standardNum.value % 5 === 0);
  const standardAllConditions = standardAPI.computed(() => {
    return standardIsEven.value && standardIsPositive.value && standardIsDivisibleBy5.value;
  });

  // Cached setup  
  const cachedNum = cachedAPI.signal(1);
  const cachedIsEven = cachedAPI.computed(() => cachedNum.value % 2 === 0);
  const cachedIsPositive = cachedAPI.computed(() => cachedNum.value > 0);
  const cachedIsDivisibleBy5 = cachedAPI.computed(() => cachedNum.value % 5 === 0);
  const cachedAllConditions = cachedAPI.computed(() => {
    return cachedIsEven.value && cachedIsPositive.value && cachedIsDivisibleBy5.value;
  });

  // Warm-up
  standardNum.value = 10;
  void standardAllConditions.value;
  cachedNum.value = 10;
  void cachedAllConditions.value;

  bench('Standard Lattice - boolean computeds', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // Most numbers won't satisfy all conditions
      standardNum.value = i % 100 + 1; // 1-100, always positive
      void standardAllConditions.value;
    }
  });

  bench('Cached Lattice - boolean computeds', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      // Most numbers won't satisfy all conditions
      cachedNum.value = i % 100 + 1; // 1-100, always positive
      void cachedAllConditions.value;
    }
  });
});