/**
 * @vitest-environment jsdom
 * 
 * CRITICAL TEST: Verify true reactivity behavior
 */

// Run this file directly to see the real behavior
console.log('\n🔍 CRITICAL REACTIVITY TEST\n');

// Test 1: Svelte $derived.by behavior
console.log('=== TEST 1: Svelte $derived.by ===');
(() => {
  let computations = 0;
  const state = $state({ count: 0 });
  
  const doubled = $derived.by(() => {
    computations++;
    console.log(`  Computing: ${state.count} * 2 = ${state.count * 2}`);
    return state.count * 2;
  });
  
  console.log('Initial computation done, resetting counter...');
  computations = 0;
  
  // Test pattern 1: Multiple accesses without state change
  console.log('\nPattern 1: 3 accesses, no state change');
  console.log(`  Access 1: ${doubled} (comps: ${computations})`);
  console.log(`  Access 2: ${doubled} (comps: ${computations})`);
  console.log(`  Access 3: ${doubled} (comps: ${computations})`);
  
  // Test pattern 2: State change then multiple accesses
  console.log('\nPattern 2: Change state to 5, then 3 accesses');
  state.count = 5;
  console.log(`  Access 1: ${doubled} (comps: ${computations})`);
  console.log(`  Access 2: ${doubled} (comps: ${computations})`);
  console.log(`  Access 3: ${doubled} (comps: ${computations})`);
  
  // Test pattern 3: Benchmark pattern
  console.log('\nPattern 3: Benchmark pattern (state change + 1 access per iteration)');
  computations = 0;
  for (let i = 0; i < 5; i++) {
    state.count = i;
    const value = doubled;
    console.log(`  Iter ${i}: state=${i}, value=${value}, comps=${computations}`);
  }
  
  console.log(`\nFINAL: ${computations} computations for 5 iterations`);
  console.log(`BEHAVIOR: ${computations === 5 ? 'Recomputes on EVERY access' : 'Lazy evaluation (only on state change)'}`);
})();

// Test 2: Simple $derived
console.log('\n\n=== TEST 2: Svelte simple $derived ===');
(() => {
  let accessCount = 0;
  const state = $state({ count: 0 });
  
  // Track access through getter
  const tracker = {
    get value() {
      accessCount++;
      return state.count;
    }
  };
  
  const doubled = $derived(tracker.value * 2);
  
  console.log('Initial computation done, resetting counter...');
  accessCount = 0;
  
  // Test accesses
  console.log('\nMultiple accesses without state change:');
  console.log(`  Access 1: ${doubled} (accesses: ${accessCount})`);
  console.log(`  Access 2: ${doubled} (accesses: ${accessCount})`);
  console.log(`  Access 3: ${doubled} (accesses: ${accessCount})`);
  
  console.log('\nChange state and access:');
  state.count = 10;
  console.log(`  After state change: ${doubled} (accesses: ${accessCount})`);
  console.log(`  Second access: ${doubled} (accesses: ${accessCount})`);
})();

// Test 3: Lattice behavior
console.log('\n\n=== TEST 3: Lattice Behavior ===');
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

(() => {
  let computations = 0;
  
  const createSlice = createLatticeStore(vanillaAdapter({ count: 0 }));
  
  const counterSlice = createSlice(select('count'), ({ count }, set) => ({
    value: () => count(),
    doubled: () => {
      computations++;
      console.log(`  Computing: ${count()} * 2 = ${count() * 2}`);
      return count() * 2;
    },
    setCount: (n: number) => set(() => ({ count: n })),
  }));
  
  console.log('Initial setup done, resetting counter...');
  computations = 0;
  
  // Test pattern
  console.log('\nBenchmark pattern:');
  for (let i = 0; i < 5; i++) {
    counterSlice().setCount(i);
    const value = counterSlice().doubled();
    console.log(`  Iter ${i}: state=${i}, value=${value}, comps=${computations}`);
  }
  
  console.log(`\nFINAL: ${computations} computations for 5 iterations`);
  console.log(`BEHAVIOR: Always recomputes on access`);
})();

console.log('\n✅ TEST COMPLETE\n');