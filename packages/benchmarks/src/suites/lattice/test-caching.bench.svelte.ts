/**
 * @fileoverview Test to verify Lattice now caches computed values
 */

import { describe, it, expect } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

describe('Lattice Caching Behavior', () => {
  it('should cache computed values until dependencies change', () => {
    console.log('\n=== LATTICE CACHING TEST ===\n');
    
    // Track all function calls
    const calls = {
      storeReads: 0,
      computations: 0
    };
    
    // Create a store with tracking
    const store = vanillaAdapter({ a: 1, b: 2, c: 3 });
    const createSlice = createLatticeStore(store);
    
    const mySlice = createSlice(select('a', 'b'), ({ a, b }, set) => ({
      // Computation that tracks calls
      multiply: () => {
        calls.computations++;
        console.log(`  Computation #${calls.computations}: ${a()} * ${b()} = ${a() * b()}`);
        return a() * b();
      },
      
      // Setter
      setA: (n: number) => set(() => ({ a: n }))
    }));

    console.log('=== TEST 1: Call multiply() three times (no state change) ===');
    const result1 = mySlice().multiply();
    const result2 = mySlice().multiply();
    const result3 = mySlice().multiply();
    
    console.log(`Results: ${result1}, ${result2}, ${result3}`);
    console.log(`Computations so far: ${calls.computations}`);
    
    // With caching, should only compute once
    expect(calls.computations).toBe(1);
    expect(result1).toBe(2);
    expect(result2).toBe(2);
    expect(result3).toBe(2);
    
    console.log('\n=== TEST 2: After state change ===');
    console.log('Setting a = 10...');
    mySlice().setA(10);
    
    const result4 = mySlice().multiply();
    const result5 = mySlice().multiply();
    
    console.log(`Results after change: ${result4}, ${result5}`);
    console.log(`Total computations: ${calls.computations}`);
    
    // Should have computed once more after state change
    expect(calls.computations).toBe(2);
    expect(result4).toBe(20);
    expect(result5).toBe(20);
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total computations: ${calls.computations}`);
    console.log('Key findings:');
    console.log('1. First 3 calls used cached value (only 1 computation)');
    console.log('2. After state change, cache was invalidated');
    console.log('3. Next 2 calls used new cached value (only 1 more computation)');
    console.log('4. Total: 2 computations for 5 calls - CACHING WORKS! 🎉');
  });
  
  it('should only invalidate cache when actual dependencies change', () => {
    console.log('\n=== SELECTIVE CACHE INVALIDATION TEST ===\n');
    
    let computations = 0;
    
    const store = vanillaAdapter({ x: 1, y: 2, z: 3 });
    const createSlice = createLatticeStore(store);
    
    const mySlice = createSlice(select('x', 'y', 'z'), ({ x, y, z }, set) => ({
      // Only depends on x and y
      xyProduct: () => {
        computations++;
        console.log(`  Computing x * y: ${x()} * ${y()} = ${x() * y()}`);
        return x() * y();
      },
      
      setX: (n: number) => set(() => ({ x: n })),
      setZ: (n: number) => set(() => ({ z: n }))
    }));
    
    console.log('Initial computation:');
    mySlice().xyProduct();
    expect(computations).toBe(1);
    
    console.log('\nChanging z (not a dependency of xyProduct):');
    mySlice().setZ(100);
    mySlice().xyProduct();
    
    // Should still use cache since z is not a dependency
    expect(computations).toBe(1);
    console.log(`Computations after z change: ${computations} (cached!)`);
    
    console.log('\nChanging x (IS a dependency):');
    mySlice().setX(10);
    mySlice().xyProduct();
    
    // Should recompute since x changed
    expect(computations).toBe(2);
    console.log(`Computations after x change: ${computations} (recomputed!)`);
  });
});