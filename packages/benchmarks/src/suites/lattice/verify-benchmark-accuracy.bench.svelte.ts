/**
 * @vitest-environment jsdom
 * 
 * Verify the accuracy of our minimal-reactivity benchmark
 */

import { test, bench } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

const ITERATIONS = 10;

test('CRITICAL: Verify $derived.by() behavior in benchmark context', () => {
  console.log('\n=== TESTING $derived.by() BEHAVIOR ===\n');
  
  // Test 1: In a loop like our benchmark
  console.log('TEST 1: Benchmark-style loop');
  let computations = 0;
  const state = $state({ count: 0 });
  
  const doubled = $derived.by(() => {
    computations++;
    return state.count * 2;
  });
  
  computations = 0; // Reset after initial
  
  for (let i = 0; i < ITERATIONS; i++) {
    state.count = i;
    const value = doubled; // Direct access
    console.log(`  Iteration ${i}: value=${value}, computations=${computations}`);
  }
  
  console.log(`\nBenchmark-style result: ${computations} computations for ${ITERATIONS} iterations`);
  
  // Test 2: Multiple accesses per state change
  console.log('\nTEST 2: Multiple accesses per state change');
  computations = 0;
  const state2 = $state({ count: 0 });
  
  const doubled2 = $derived.by(() => {
    computations++;
    return state2.count * 2;
  });
  
  computations = 0;
  
  for (let i = 0; i < 3; i++) {
    state2.count = i;
    console.log(`  State=${i}, Access 1: ${doubled2}, comps=${computations}`);
    console.log(`  State=${i}, Access 2: ${doubled2}, comps=${computations}`);
    console.log(`  State=${i}, Access 3: ${doubled2}, comps=${computations}`);
  }
  
  console.log(`\nMultiple access result: ${computations} computations for 3 states × 3 accesses`);
});

test('CRITICAL: Test closure behavior', () => {
  console.log('\n=== TESTING CLOSURE BEHAVIOR ===\n');
  
  // Test if accessing in closure matters
  let computations = 0;
  const state = $state({ count: 0 });
  
  const doubled = $derived.by(() => {
    computations++;
    return state.count * 2;
  });
  
  computations = 0;
  
  // Access in a closure/function
  function accessDoubled() {
    return doubled;
  }
  
  for (let i = 0; i < 5; i++) {
    state.count = i;
    const value = accessDoubled(); // Access through function
    console.log(`  Iteration ${i}: value=${value}, computations=${computations}`);
  }
  
  console.log(`\nClosure access result: ${computations} computations`);
});

bench('Actual benchmark test - Svelte', () => {
  let computations = 0;
  const state = $state({ count: 0 });
  
  const doubled = $derived.by(() => {
    computations++;
    return state.count * 2;
  });
  
  computations = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    state.count = i;
    const value = doubled;
    void value;
  }
  
  if (computations !== ITERATIONS) {
    console.warn(`Benchmark: Expected ${ITERATIONS}, got ${computations} computations`);
  }
});

bench('Actual benchmark test - Lattice', () => {
  let computations = 0;
  
  const createSlice = createLatticeStore(vanillaAdapter({ count: 0 }));
  
  const counterSlice = createSlice(select('count'), ({ count }, set) => ({
    value: () => count(),
    doubled: () => {
      computations++;
      return count() * 2;
    },
    setCount: (n: number) => set(() => ({ count: n })),
  }));
  
  computations = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    counterSlice().setCount(i);
    const value = counterSlice().doubled();
    void value;
  }
  
  if (computations !== ITERATIONS) {
    console.warn(`Lattice: Expected ${ITERATIONS}, got ${computations} computations`);
  }
});