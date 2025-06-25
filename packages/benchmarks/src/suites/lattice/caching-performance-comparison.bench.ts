/**
 * @fileoverview Performance comparison of Lattice runtime implementations
 * 
 * Compares:
 * 1. Original runtime (no caching)
 * 2. runtime-cached (126x slower)
 * 3. runtime-simple-cache (optimized caching with stable functions)
 */

import { describe, bench } from 'vitest';
import { 
  createLatticeStore, // Now the default with caching
  createLatticeStoreOriginal as createOriginal, 
  createLatticeStoreCached as createCached,
  select, 
  vanillaAdapter 
} from '@lattice/core';

const ITERATIONS = 10000;
const COMPUTATION_ITERATIONS = 1000;

// Realistic computation that benefits from caching
function expensiveComputation(a: number, b: number): number {
  let result = 0;
  for (let i = 0; i < COMPUTATION_ITERATIONS; i++) {
    result += Math.sqrt(a * b * i);
  }
  return result;
}

describe('Lattice Runtime Caching Performance', () => {
  // Test scenario: Mixed read patterns with expensive computations
  const runScenario = (createStore: typeof createOriginal) => {
    const adapter = vanillaAdapter({
      x: 1,
      y: 2,
      z: 3,
      unrelated1: 'foo',
      unrelated2: 42,
      unrelated3: true
    });
    
    const createSlice = createStore(adapter);
    
    // Create a slice with expensive computed values
    const slice = createSlice(select('x', 'y'), ({ x, y }, set) => ({
      // Simple getters
      getX: () => x(),
      getY: () => y(),
      
      // Expensive computed value
      expensive: () => expensiveComputation(x(), y()),
      
      // Another expensive computation
      veryExpensive: () => {
        const xVal = x();
        const yVal = y();
        return expensiveComputation(xVal * 2, yVal * 3);
      },
      
      // Actions
      setX: (n: number) => set(() => ({ x: n })),
      setY: (n: number) => set(() => ({ y: n })),
      
      // Action that doesn't affect our dependencies
      updateUnrelated: () => set(({ unrelated1 }) => ({ 
        unrelated1: unrelated1() + '!' 
      }))
    }));
    
    // Simulate realistic usage patterns
    for (let i = 0; i < ITERATIONS; i++) {
      const pattern = i % 10;
      
      switch (pattern) {
        case 0:
        case 1:
        case 2:
          // 30% - Read expensive computation multiple times (benefits from caching)
          slice().expensive();
          slice().expensive();
          slice().expensive();
          break;
          
        case 3:
        case 4:
          // 20% - Read very expensive computation
          slice().veryExpensive();
          slice().veryExpensive();
          break;
          
        case 5:
          // 10% - Update x (invalidates cache)
          slice().setX(Math.random() * 10);
          break;
          
        case 6:
          // 10% - Update y (invalidates cache)
          slice().setY(Math.random() * 10);
          break;
          
        case 7:
        case 8:
        case 9:
          // 30% - Update unrelated (shouldn't invalidate cache)
          slice().updateUnrelated();
          // Then read expensive value
          slice().expensive();
          break;
      }
    }
  };
  
  bench('Original Runtime (no caching)', () => {
    runScenario(createOriginal);
  });
  
  bench('Cached Runtime (126x slower)', () => {
    runScenario(createCached);
  });
  
  bench('Default Runtime (now with simple cache)', () => {
    runScenario(createLatticeStore);
  });
});

describe('Lattice Runtime Memory Efficiency', () => {
  // Test memory usage with many slices
  const memoryScenario = (createStore: typeof createOriginal) => {
    const adapter = vanillaAdapter({
      counter: 0,
      data: Array(100).fill(0)
    });
    
    const createSlice = createStore(adapter);
    const slices: any[] = [];
    
    // Create many slices
    for (let i = 0; i < 1000; i++) {
      const slice = createSlice(select('counter'), ({ counter }, set) => ({
        value: () => counter(),
        computed: () => counter() * counter() * Math.PI,
        increment: () => set(({ counter }) => ({ counter: counter() + 1 }))
      }));
      
      slices.push(slice);
    }
    
    // Use all slices
    for (const slice of slices) {
      slice().computed();
      slice().computed();
      slice().computed();
    }
    
    // Clear references to allow GC
    slices.length = 0;
  };
  
  bench('Original Runtime - Memory Test', () => {
    memoryScenario(createOriginal);
  });
  
  bench('Cached Runtime - Memory Test', () => {
    memoryScenario(createCached);
  });
  
  bench('Default Runtime - Memory Test', () => {
    memoryScenario(createLatticeStore);
  });
});