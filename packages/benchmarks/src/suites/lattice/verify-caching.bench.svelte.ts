/**
 * @fileoverview Quick test to verify if Lattice now has caching
 */

import { describe, it } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

describe('Verify Lattice Caching', () => {
  it('should check if Lattice caches computations', () => {
    console.log('\n=== TESTING LATTICE CACHING ===\n');
    
    let computations = 0;
    
    const createSlice = createLatticeStore(vanillaAdapter({ 
      a: 1,
      b: 2
    }));

    const mySlice = createSlice(select('a', 'b'), ({ a, b }, set) => ({
      multiply: () => {
        computations++;
        console.log(`Computation #${computations}: ${a()} * ${b()} = ${a() * b()}`);
        return a() * b();
      },
      setA: (n: number) => set(() => ({ a: n }))
    }));

    console.log('Call multiply() 3 times without state change:');
    mySlice().multiply();
    mySlice().multiply();
    mySlice().multiply();
    
    console.log(`\nTotal computations: ${computations}`);
    
    if (computations === 1) {
      console.log('✅ LATTICE IS CACHING! Only computed once for 3 calls.');
    } else {
      console.log('❌ LATTICE IS NOT CACHING. Computed every time.');
    }
    
    console.log('\nNow change state and call again:');
    computations = 0;
    mySlice().setA(10);
    
    mySlice().multiply();
    mySlice().multiply();
    
    console.log(`\nComputations after state change: ${computations}`);
    
    if (computations === 1) {
      console.log('✅ Cache was invalidated and recomputed once.');
    }
  });
});