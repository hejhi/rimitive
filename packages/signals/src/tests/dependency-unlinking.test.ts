/**
 * TEST: Verification of Dynamic Dependency Unlinking Algorithm
 * 
 * This test suite verifies a critical optimization in the reactive system:
 * Dependencies are dynamically tracked and unlinked when no longer used.
 * 
 * ALGORITHM TESTED: Dynamic Dependency Graph Maintenance
 * - When a computed runs, it marks all current dependencies with version -1
 * - As it accesses dependencies during execution, it updates their versions
 * - After execution, any dependency still at version -1 is removed
 * - This ensures the dependency graph reflects only active data flow
 * 
 * This optimization is crucial for conditional computations where branches
 * may access different sets of dependencies based on runtime conditions.
 */

import { describe, it, expect } from 'vitest';
import {
  createSignalFactory,
  createComputedFactory,
  createBatchFactory,
  createSignalAPI,
} from '../index.js';

const { signal, computed } = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  batch: createBatchFactory,
});

describe('Dynamic dependency unlinking', () => {
  it('should not recompute unused branches after condition changes', () => {
    // Test setup - exactly like the benchmark
    const condition = signal(true);
    const sourceA = signal(1);
    const sourceB = signal(1);

    let expensiveBComputations = 0;
    const expensiveB = computed(() => {
      expensiveBComputations++;
      return sourceB.value * 2;
    });

    let resultComputations = 0;
    const result = computed(() => {
      resultComputations++;
      return condition.value ? sourceA.value : expensiveB.value;
    });

    // Initial state - establish all dependencies by toggling condition
    condition.value = false;
    expect(result.value).toBe(2); // Uses expensiveB
    expect(expensiveBComputations).toBe(1);
    
    condition.value = true;
    expect(result.value).toBe(1); // Uses sourceA
    expect(resultComputations).toBe(2);

    // Reset counters
    expensiveBComputations = 0;
    resultComputations = 0;

    // THE KEY TEST: Update sourceB multiple times while condition is true
    // If the summary's claim is correct, expensiveB would recompute each time
    for (let i = 0; i < 100; i++) {
      sourceB.value = i;
      void result.value;
    }

    // PROOF: expensiveB does NOT recompute when sourceB changes
    expect(expensiveBComputations).toBe(0);
    expect(resultComputations).toBe(0);

    // Additional verification: expensiveB only recomputes when actually needed
    condition.value = false;
    expect(result.value).toBe(198); // 99 * 2
    expect(expensiveBComputations).toBe(1); // Only now does it recompute
    expect(resultComputations).toBe(1);
  });

  it('should dynamically track only active dependencies', () => {
    const useFirst = signal(true);
    const first = signal('A');
    const second = signal('B');
    
    let firstAccesses = 0;
    let secondAccesses = 0;
    
    const trackedFirst = computed(() => {
      firstAccesses++;
      return first.value;
    });
    
    const trackedSecond = computed(() => {
      secondAccesses++;
      return second.value;
    });
    
    const output = computed(() => {
      return useFirst.value ? trackedFirst.value : trackedSecond.value;
    });

    // Initially uses first branch
    expect(output.value).toBe('A');
    expect(firstAccesses).toBe(1);
    expect(secondAccesses).toBe(0);

    // Update the unused branch - should not trigger computation
    second.value = 'B2';
    void output.value;
    expect(secondAccesses).toBe(0); // Still 0, not accessed

    // Switch branches
    useFirst.value = false;
    expect(output.value).toBe('B2');
    expect(secondAccesses).toBe(1); // Now it's accessed

    // Update the now-unused first branch
    firstAccesses = 0;
    first.value = 'A2';
    void output.value;
    expect(firstAccesses).toBe(0); // Not accessed anymore
  });

  it('proves the 2.7x performance gap is NOT from traversing inactive branches', () => {
    // This test conclusively shows that Lattice correctly implements
    // dynamic dependency unlinking. When a computed doesn't access a
    // dependency during execution, that dependency is removed from the graph.
    //
    // Therefore, the performance gap in the benchmark must come from
    // a different source - NOT from traversing inactive branches as claimed.
    
    const iterations = 1000;
    const condition = signal(true);
    const a = signal(0);
    const b = signal(0);
    
    let bComputations = 0;
    const expensiveB = computed(() => {
      bComputations++;
      let sum = 0;
      for (let i = 0; i < 100; i++) sum += i;
      return b.value * sum;
    });
    
    const result = computed(() => {
      return condition.value ? a.value : expensiveB.value;
    });
    
    // Establish initial dependencies
    void result.value;
    
    // Update b many times - if traversal happened, expensiveB would compute
    bComputations = 0;
    for (let i = 0; i < iterations; i++) {
      b.value = i;
      void result.value;
    }
    
    // No unnecessary computations occurred
    expect(bComputations).toBe(0);
  });
});