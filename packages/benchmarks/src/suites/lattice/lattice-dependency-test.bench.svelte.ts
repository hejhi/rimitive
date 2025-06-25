/**
 * @fileoverview Test to verify Lattice's dependency tracking behavior
 */

import { describe, bench, it, expect } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

describe('Lattice Dependency Tracking Verification', () => {
  it('should only invalidate slices when their selected dependencies change', () => {
    let sliceCreations = 0;
    let computations = 0;

    const createSlice = createLatticeStore(vanillaAdapter({ 
      a: 1, 
      b: 2, 
      c: 3,
      unrelated: 'data' 
    }));

    // Track when the slice factory is called (invalidation)
    const abSlice = createSlice(select('a', 'b'), ({ a, b }, set) => {
      sliceCreations++;
      console.log(`Slice factory called ${sliceCreations} times`);
      
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

    // Initial access
    console.log('Initial access:', abSlice().computed());
    
    // Update 'a' (should invalidate abSlice)
    console.log('\nUpdating a...');
    abSlice().setA(10);
    console.log('After updating a:', abSlice().computed());
    
    // Update 'b' (should invalidate abSlice)
    console.log('\nUpdating b...');
    abSlice().setB(20);
    console.log('After updating b:', abSlice().computed());
    
    // Update 'c' (should NOT invalidate abSlice)
    console.log('\nUpdating c...');
    cSlice().setC(30);
    console.log('After updating c:', abSlice().computed());
    
    // Update 'unrelated' (should NOT invalidate abSlice)
    console.log('\nUpdating unrelated...');
    unrelatedSlice().setData('new data');
    console.log('After updating unrelated:', abSlice().computed());
    
    // Multiple accesses without state change
    console.log('\nMultiple accesses without state change:');
    console.log('Access 1:', abSlice().computed());
    console.log('Access 2:', abSlice().computed());
    console.log('Access 3:', abSlice().computed());
    
    console.log('\n=== FINAL STATS ===');
    console.log(`Slice factory calls (invalidations): ${sliceCreations}`);
    console.log(`Computed function calls: ${computations}`);
    console.log(`Expected: ~3 invalidations (initial + 2 updates to a/b)`);
    
    // Verify behavior
    expect(sliceCreations).toBe(3); // Initial + update a + update b
    expect(computations).toBe(8); // One computation per access
  });
});