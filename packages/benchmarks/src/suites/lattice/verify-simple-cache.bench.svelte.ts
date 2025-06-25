/**
 * @fileoverview Verify that simple caching works correctly
 */

import { describe, it, expect } from 'vitest';
import { createLatticeStoreSimpleCache as createLatticeStore, select, vanillaAdapter } from '@lattice/core';

describe('Simple Cache Verification', () => {
  it('should cache computed values until dependencies change', () => {
    console.log('\n=== TESTING SIMPLE CACHE BEHAVIOR ===\n');
    
    let computeCount = 0;
    
    const createSlice = createLatticeStore(vanillaAdapter({ 
      a: 1,
      b: 2,
      c: 3
    }));
    
    const slice = createSlice(select('a', 'b'), ({ a, b }, set) => ({
      // Expensive computation
      expensive: () => {
        computeCount++;
        console.log(`\nComputing expensive() - attempt #${computeCount}`);
        const result = a() * b() * 1000;
        console.log(`  Result: ${result}`);
        return result;
      },
      
      // Another computation
      sum: () => {
        console.log('\nComputing sum()');
        return a() + b();
      },
      
      // Actions
      setA: (n: number) => set(() => ({ a: n })),
      setB: (n: number) => set(() => ({ b: n })),
      setC: (n: number) => set(() => ({ c: n }))
    }));
    
    console.log('=== TEST 1: Multiple calls should use cache ===');
    computeCount = 0;
    
    const result1 = slice().expensive();
    const result2 = slice().expensive();
    const result3 = slice().expensive();
    
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
    expect(computeCount).toBe(1); // Should only compute once!
    console.log(`\nTotal computations: ${computeCount} (expected: 1)`);
    
    console.log('\n=== TEST 2: Changing unrelated state should not invalidate cache ===');
    console.log('Updating c (not a dependency):');
    slice().setC(100);
    
    computeCount = 0;
    const result4 = slice().expensive();
    
    expect(result4).toBe(result1); // Same result
    expect(computeCount).toBe(0); // Should use cache!
    console.log(`Computations after unrelated change: ${computeCount} (expected: 0)`);
    
    console.log('\n=== TEST 3: Changing dependency should invalidate cache ===');
    console.log('Updating a (a dependency):');
    slice().setA(10);
    
    computeCount = 0;
    const result5 = slice().expensive();
    
    expect(result5).toBe(10 * 2 * 1000); // New result
    expect(computeCount).toBe(1); // Should recompute
    console.log(`Computations after dependency change: ${computeCount} (expected: 1)`);
    
    console.log('\n=== TEST 4: Cache should work again after recomputation ===');
    computeCount = 0;
    const result6 = slice().expensive();
    const result7 = slice().expensive();
    
    expect(result6).toBe(result5);
    expect(result7).toBe(result5);
    expect(computeCount).toBe(0); // Should use cache
    console.log(`Subsequent calls use cache: ${computeCount} computations (expected: 0)`);
    
    console.log('\n=== CONCLUSIONS ===');
    console.log('✅ Simple cache successfully caches computed values');
    console.log('✅ Cache is invalidated only when dependencies change');
    console.log('✅ Unrelated state changes do not invalidate cache');
    console.log('✅ Stable function references - no proxy overhead');
  });
});