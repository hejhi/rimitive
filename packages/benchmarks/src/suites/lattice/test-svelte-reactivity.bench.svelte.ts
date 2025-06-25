/**
 * @vitest-environment jsdom
 * 
 * Test file to verify Svelte reactivity behavior in different contexts
 */

import { test, expect } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

test('Svelte $derived.by behavior - direct access', () => {
  let computations = 0;
  const state = $state({ count: 0 });
  
  const doubled = $derived.by(() => {
    computations++;
    return state.count * 2;
  });
  
  // Reset after initial computation
  computations = 0;
  
  // Test 1: Access without state change
  console.log('Access 1:', doubled);
  console.log('Access 2:', doubled);
  console.log('Computations after 2 accesses, no state change:', computations);
  
  // Test 2: Change state and access
  state.count = 1;
  console.log('Access after state change:', doubled);
  console.log('Computations after state change:', computations);
  
  // Test 3: Multiple accesses after single state change
  console.log('Access 1 after change:', doubled);
  console.log('Access 2 after change:', doubled);
  console.log('Total computations:', computations);
});

test('Svelte $derived behavior - simple expression', () => {
  let accessCount = 0;
  const state = $state({ count: 0 });
  
  // Use getter to track accesses
  const counter = {
    get value() {
      accessCount++;
      return state.count;
    }
  };
  
  const doubled = $derived(counter.value * 2);
  
  // Reset after initial computation
  accessCount = 0;
  
  // Test accesses
  console.log('Simple $derived access 1:', doubled);
  console.log('Simple $derived access 2:', doubled);
  console.log('Access count for simple $derived:', accessCount);
  
  // Change state
  state.count = 1;
  console.log('After state change:', doubled);
  console.log('Total access count:', accessCount);
});

test('Svelte reactivity with $effect.root', () => {
  let computations = 0;
  let effectRuns = 0;
  
  const cleanup = $effect.root(() => {
    const state = $state({ count: 0 });
    
    const doubled = $derived.by(() => {
      computations++;
      return state.count * 2;
    });
    
    $effect(() => {
      effectRuns++;
      console.log('Effect run, doubled value:', doubled);
    });
    
    // Reset counters
    computations = 0;
    effectRuns = 0;
    
    // Test updates
    for (let i = 0; i < 5; i++) {
      state.count = i;
    }
    
    console.log('With $effect.root - computations:', computations);
    console.log('With $effect.root - effect runs:', effectRuns);
  });
  
  cleanup();
});

test('Compare Lattice reactivity', () => {
  let computations = 0;
  
  const createSlice = createLatticeStore(vanillaAdapter({ count: 0 }));
  
  const counterSlice = createSlice(select('count'), ({ count }, set) => ({
    value: () => count(),
    doubled: () => {
      computations++;
      return count() * 2;
    },
    setCount: (n) => set(() => ({ count: n })),
  }));
  
  // Reset after setup
  computations = 0;
  
  // Test multiple accesses without state change
  console.log('Lattice access 1:', counterSlice().doubled());
  console.log('Lattice access 2:', counterSlice().doubled());
  console.log('Lattice computations after 2 accesses:', computations);
  
  // Change state and access
  counterSlice().setCount(1);
  console.log('Lattice after state change:', counterSlice().doubled());
  console.log('Lattice total computations:', computations);
});