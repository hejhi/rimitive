/**
 * @fileoverview TRUE REACTIVITY benchmark comparing Svelte's lazy evaluation with Lattice
 *
 * This benchmark uses $effect.root() to create proper reactive contexts for Svelte,
 * allowing us to test the actual performance characteristics of both systems:
 * - Svelte: Lazy evaluation, only recomputes when dependencies change AND value is accessed
 * - Lattice: Eager evaluation on every access
 */

import { describe, bench } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

const ITERATIONS = 100;

describe('True Reactivity Comparison - Lazy vs Eager Evaluation', () => {
  // TEST 1: Svelte with proper reactive context - testing lazy evaluation
  bench('Svelte Runes with $effect.root - lazy evaluation', () => {
    let computations = 0;
    let accesses = 0;
    let finalValue = 0;

    // Create reactive context
    const cleanup = $effect.root(() => {
      const state = $state({ count: 0, unrelated: 'data' });
      
      const doubled = $derived.by(() => {
        computations++;
        return state.count * 2;
      });

      // Simulate realistic access pattern
      for (let i = 0; i < ITERATIONS; i++) {
        if (i % 4 === 0) {
          // 25% of iterations: update count and access
          state.count = i;
          finalValue = doubled;
          accesses++;
        } else if (i % 4 === 1) {
          // 25% of iterations: just access without state change
          finalValue = doubled;
          accesses++;
        } else if (i % 4 === 2) {
          // 25% of iterations: update unrelated state
          state.unrelated = `data-${i}`;
        } else {
          // 25% of iterations: update count but don't access
          state.count = i;
        }
      }
    });

    cleanup();

    // With lazy evaluation, computations should be less than accesses
    console.log(`[SVELTE LAZY] Computations: ${computations}, Accesses: ${accesses}, Ratio: ${(computations/accesses).toFixed(2)}`);
  });

  // TEST 2: Lattice - always computes on access
  bench('Lattice Runtime - eager evaluation on access', () => {
    let computations = 0;
    let accesses = 0;

    const createSlice = createLatticeStore(vanillaAdapter({ count: 0, unrelated: 'data' }));

    const counterSlice = createSlice(select('count'), ({ count }, set) => ({
      doubled: () => {
        computations++;
        return count() * 2;
      },
      setCount: (n: number) => set(() => ({ count: n })),
    }));

    const unrelatedSlice = createSlice(select('unrelated'), ({ unrelated }, set) => ({
      setData: (data: string) => set(() => ({ unrelated: data })),
    }));

    let finalValue = 0;

    // Same access pattern as Svelte test
    for (let i = 0; i < ITERATIONS; i++) {
      if (i % 4 === 0) {
        // 25% of iterations: update count and access
        counterSlice().setCount(i);
        finalValue = counterSlice().doubled();
        accesses++;
      } else if (i % 4 === 1) {
        // 25% of iterations: just access without state change
        finalValue = counterSlice().doubled();
        accesses++;
      } else if (i % 4 === 2) {
        // 25% of iterations: update unrelated state
        unrelatedSlice().setData(`data-${i}`);
      } else {
        // 25% of iterations: update count but don't access
        counterSlice().setCount(i);
      }
    }

    // With eager evaluation, computations should equal accesses
    console.log(`[LATTICE EAGER] Computations: ${computations}, Accesses: ${accesses}, Ratio: ${(computations/accesses).toFixed(2)}`);
  });
});

describe('Multiple Dependencies - Testing Selective Recomputation', () => {
  // TEST 3: Svelte with multiple dependencies
  bench('Svelte - selective recomputation with multiple deps', () => {
    let computations = 0;

    const cleanup = $effect.root(() => {
      const state = $state({ 
        a: 1, 
        b: 2, 
        c: 3,
        unrelated: 'data' 
      });
      
      // Derived depends on a and b, but not c or unrelated
      const computed = $derived.by(() => {
        computations++;
        return state.a * state.b;
      });

      // Update pattern testing selective recomputation
      for (let i = 0; i < ITERATIONS; i++) {
        const updateType = i % 5;
        
        switch (updateType) {
          case 0: // Update a (should trigger)
            state.a = i;
            void computed;
            break;
          case 1: // Update b (should trigger)
            state.b = i;
            void computed;
            break;
          case 2: // Update c (should NOT trigger)
            state.c = i;
            void computed;
            break;
          case 3: // Update unrelated (should NOT trigger)
            state.unrelated = `data-${i}`;
            void computed;
            break;
          case 4: // Just access (no update)
            void computed;
            break;
        }
      }
    });

    cleanup();

    // Should only recompute when a or b change (40% of iterations)
    console.log(`[SVELTE MULTI-DEP] Computations: ${computations}, Expected ~${Math.floor(ITERATIONS * 0.4)}`);
  });

  // TEST 4: Lattice with multiple dependencies
  bench('Lattice - computes on every access (not on unrelated changes)', () => {
    let computations = 0;
    let sliceInvalidations = 0;

    const createSlice = createLatticeStore(vanillaAdapter({ 
      a: 1, 
      b: 2, 
      c: 3,
      unrelated: 'data' 
    }));

    // Track when the slice is invalidated
    const abSlice = createSlice(select('a', 'b'), ({ a, b }, set) => {
      sliceInvalidations++;
      return {
        computed: () => {
          computations++;
          return a() * b();
        },
        setA: (n: number) => set(() => ({ a: n })),
        setB: (n: number) => set(() => ({ b: n })),
      };
    });

    const cSlice = createSlice(select('c'), ({ c }, set) => ({
      setC: (n: number) => set(() => ({ c: n })),
    }));

    const unrelatedSlice = createSlice(select('unrelated'), ({ unrelated }, set) => ({
      setData: (data: string) => set(() => ({ unrelated: data })),
    }));

    // Same update pattern
    for (let i = 0; i < ITERATIONS; i++) {
      const updateType = i % 5;
      
      switch (updateType) {
        case 0: // Update a (should invalidate abSlice)
          abSlice().setA(i);
          void abSlice().computed();
          break;
        case 1: // Update b (should invalidate abSlice)
          abSlice().setB(i);
          void abSlice().computed();
          break;
        case 2: // Update c (should NOT invalidate abSlice)
          cSlice().setC(i);
          void abSlice().computed();
          break;
        case 3: // Update unrelated (should NOT invalidate abSlice)
          unrelatedSlice().setData(`data-${i}`);
          void abSlice().computed();
          break;
        case 4: // Just access (no state change)
          void abSlice().computed();
          break;
      }
    }

    // Computations happen on every access, but slice only invalidates when a or b change
    console.log(`[LATTICE MULTI-DEP] Computations: ${computations} (on every access), Slice invalidations: ${sliceInvalidations} (only on a/b changes)`);
  });
});

describe('Heavy Computation - Where Lazy Evaluation Shines', () => {
  // Expensive computation function
  function expensiveComputation(a: number, b: number): number {
    let result = 0;
    for (let i = 0; i < 1000; i++) {
      result += Math.sqrt(a * b * i);
    }
    return result;
  }

  // TEST 5: Svelte with expensive computation
  bench('Svelte - expensive computation with lazy evaluation', () => {
    let computations = 0;

    const cleanup = $effect.root(() => {
      const state = $state({ a: 1, b: 2 });
      
      const expensive = $derived.by(() => {
        computations++;
        return expensiveComputation(state.a, state.b);
      });

      // Realistic pattern: many accesses, few updates
      for (let i = 0; i < ITERATIONS; i++) {
        if (i % 10 === 0) {
          // Only update every 10th iteration
          state.a = i + 1;
        }
        
        // Access the expensive computation
        void expensive;
      }
    });

    cleanup();

    console.log(`[SVELTE EXPENSIVE] Computations: ${computations} (saved ${ITERATIONS - computations} expensive operations)`);
  });

  // TEST 6: Lattice with expensive computation
  bench('Lattice - expensive computation always runs', () => {
    let computations = 0;

    const createSlice = createLatticeStore(vanillaAdapter({ a: 1, b: 2 }));

    const expensiveSlice = createSlice(select('a', 'b'), ({ a, b }, set) => ({
      expensive: () => {
        computations++;
        return expensiveComputation(a(), b());
      },
      setA: (n: number) => set(() => ({ a: n })),
    }));

    // Same pattern: many accesses, few updates
    for (let i = 0; i < ITERATIONS; i++) {
      if (i % 10 === 0) {
        // Only update every 10th iteration
        expensiveSlice().setA(i + 1);
      }
      
      // Access the expensive computation
      void expensiveSlice().expensive();
    }

    console.log(`[LATTICE EXPENSIVE] Computations: ${computations} (no operations saved)`);
  });
});

describe('Chained Derivations - Testing Propagation Efficiency', () => {
  // TEST 7: Svelte with chained derivations
  bench('Svelte - chained derivations with lazy propagation', () => {
    let computations = { level1: 0, level2: 0, level3: 0 };

    const cleanup = $effect.root(() => {
      const state = $state({ base: 1 });
      
      const level1 = $derived.by(() => {
        computations.level1++;
        return state.base * 2;
      });

      const level2 = $derived.by(() => {
        computations.level2++;
        return level1 * 3;
      });

      const level3 = $derived.by(() => {
        computations.level3++;
        return level2 * 4;
      });

      // Test propagation
      for (let i = 0; i < ITERATIONS; i++) {
        if (i % 4 === 0) {
          // Update base and access all levels
          state.base = i + 1;
          void level1;
          void level2;
          void level3;
        } else if (i % 4 === 1) {
          // Just access level3 (should not recompute if base hasn't changed)
          void level3;
        } else if (i % 4 === 2) {
          // Access level1 and level2
          void level1;
          void level2;
        } else {
          // Update base but don't access anything
          state.base = i + 1;
        }
      }
    });

    cleanup();

    console.log(`[SVELTE CHAIN] L1: ${computations.level1}, L2: ${computations.level2}, L3: ${computations.level3}`);
  });

  // TEST 8: Lattice with chained computations
  bench('Lattice - chained computations always run', () => {
    let computations = { level1: 0, level2: 0, level3: 0 };

    const createSlice = createLatticeStore(vanillaAdapter({ base: 1 }));

    const baseSlice = createSlice(select('base'), ({ base }, set) => ({
      value: () => base(),
      level1: () => {
        computations.level1++;
        return base() * 2;
      },
      setBase: (n: number) => set(() => ({ base: n })),
    }));

    // Create dependent slices
    const level2Slice = () => {
      computations.level2++;
      return baseSlice().level1() * 3;
    };

    const level3Slice = () => {
      computations.level3++;
      return level2Slice() * 4;
    };

    // Same test pattern
    for (let i = 0; i < ITERATIONS; i++) {
      if (i % 4 === 0) {
        // Update base and access all levels
        baseSlice().setBase(i + 1);
        void baseSlice().level1();
        void level2Slice();
        void level3Slice();
      } else if (i % 4 === 1) {
        // Just access level3
        void level3Slice();
      } else if (i % 4 === 2) {
        // Access level1 and level2
        void baseSlice().level1();
        void level2Slice();
      } else {
        // Update base but don't access anything
        baseSlice().setBase(i + 1);
      }
    }

    console.log(`[LATTICE CHAIN] L1: ${computations.level1}, L2: ${computations.level2}, L3: ${computations.level3}`);
  });
});