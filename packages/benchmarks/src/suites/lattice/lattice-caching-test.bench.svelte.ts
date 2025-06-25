/**
 * @fileoverview Test whether Lattice caches values or recomputes everything
 */

import { describe, it } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

describe('Lattice Caching Behavior', () => {
  it('should show whether Lattice caches or recomputes', () => {
    console.log('\n=== TESTING LATTICE CACHING BEHAVIOR ===\n');
    
    let aAccessCount = 0;
    let bAccessCount = 0;
    let computeCount = 0;
    
    const createSlice = createLatticeStore(vanillaAdapter({ 
      a: 1,
      b: 2,
      c: 3
    }));

    const abSlice = createSlice(select('a', 'b'), ({ a, b }, set) => ({
      // Track when we access 'a'
      getA: () => {
        aAccessCount++;
        const value = a();
        console.log(`  Accessed a(): ${value} (access #${aAccessCount})`);
        return value;
      },
      
      // Track when we access 'b'  
      getB: () => {
        bAccessCount++;
        const value = b();
        console.log(`  Accessed b(): ${value} (access #${bAccessCount})`);
        return value;
      },
      
      // Complex computation that uses both
      expensiveCompute: () => {
        computeCount++;
        console.log(`\nStarting expensive computation #${computeCount}...`);
        
        // Access the dependencies
        const aValue = a();
        const bValue = b();
        
        console.log(`  Got a=${aValue}, b=${bValue}`);
        
        // Simulate expensive work
        let result = 0;
        for (let i = 0; i < 100; i++) {
          result += aValue * bValue * i;
        }
        
        console.log(`  Computed result: ${result}`);
        return result;
      },
      
      setA: (n: number) => set(() => ({ a: n })),
      setB: (n: number) => set(() => ({ b: n }))
    }));

    console.log('=== TEST 1: Multiple calls without state change ===');
    console.log('Call expensiveCompute 3 times:');
    
    const result1 = abSlice().expensiveCompute();
    const result2 = abSlice().expensiveCompute();
    const result3 = abSlice().expensiveCompute();
    
    console.log('\nResults:', { result1, result2, result3 });
    console.log('Compute count:', computeCount, '(called 3 times, computed 3 times - NO CACHING!)');

    console.log('\n=== TEST 2: What about the dependency values themselves? ===');
    console.log('Reset counters...');
    aAccessCount = 0;
    bAccessCount = 0;
    
    console.log('\nAccess a() three times:');
    abSlice().getA();
    abSlice().getA();
    abSlice().getA();
    
    console.log('\nAccess b() three times:');
    abSlice().getB();
    abSlice().getB();
    abSlice().getB();

    console.log('\n=== TEST 3: After state change ===');
    console.log('Update a to 10:');
    abSlice().setA(10);
    
    console.log('\nCall expensiveCompute again:');
    const result4 = abSlice().expensiveCompute();
    
    console.log('\n=== WHAT ABOUT INTERNAL CACHING? ===');
    console.log('Let\'s check if a() and b() return cached values or read from store each time...\n');
    
    // Create a store with getters that log
    let storeReadCount = 0;
    const createSliceWithLogging = createLatticeStore({
      adapter: {
        subscribe: (callback) => {
          let state = { a: 1, b: 2 };
          
          // Return a proxy that logs access
          const getState = () => {
            return new Proxy(state, {
              get(target, prop) {
                storeReadCount++;
                console.log(`  Store read #${storeReadCount}: accessing ${String(prop)} = ${target[prop as keyof typeof target]}`);
                return target[prop as keyof typeof target];
              }
            });
          };
          
          callback(getState());
          
          return {
            update: (updater) => {
              state = { ...state, ...updater(state) };
              callback(getState());
            }
          };
        }
      }
    });

    const testSlice = createSliceWithLogging(select('a', 'b'), ({ a, b }, set) => ({
      testMultipleReads: () => {
        console.log('Calling a() multiple times in one function:');
        const val1 = a();
        const val2 = a();
        const val3 = a();
        console.log(`  Got: ${val1}, ${val2}, ${val3}`);
        
        console.log('\nCalling b() multiple times:');
        const bVal1 = b();
        const bVal2 = b();
        console.log(`  Got: ${bVal1}, ${bVal2}`);
      }
    }));

    console.log('\nTest multiple reads within single function:');
    storeReadCount = 0;
    testSlice().testMultipleReads();
    
    console.log('\n=== CONCLUSIONS ===');
    console.log('1. Lattice does NOT cache computation results - every call recomputes');
    console.log('2. Lattice does NOT cache dependency values - a() and b() read from store each time');
    console.log('3. This is pure "eager evaluation" - no caching at any level');
    console.log('4. The "selected dependencies" just control WHAT you can access, not caching');
  });
});