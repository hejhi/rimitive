#!/usr/bin/env tsx
// Simple benchmark to test propagation refactor performance

import { createContext } from '@lattice/signals/api';

console.log('Testing propagation performance on main branch...\n');

// Test 1: Diamond dependency
{
  const ctx = createContext();
  const { signal, computed } = ctx;
  
  const s = signal(0);
  const c1 = computed(() => s.value * 2);
  const c2 = computed(() => s.value * 3);
  const c3 = computed(() => c1.value + c2.value);
  
  // Prime the graph
  c3.value;
  
  const start = performance.now();
  for (let i = 0; i < 100000; i++) {
    s.value = i;
    c3.value;
  }
  const end = performance.now();
  
  console.log(`Diamond dependency: ${(end - start).toFixed(2)}ms`);
}

// Test 2: Wide fanout
{
  const ctx = createContext();
  const { signal, computed } = ctx;
  
  const s = signal(0);
  const computeds = Array.from({ length: 100 }, (_, i) => 
    computed(() => s.value * i)
  );
  const final = computed(() => computeds.reduce((sum, c) => sum + c.value, 0));
  
  // Prime the graph
  final.value;
  
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    s.value = i;
    final.value;
  }
  const end = performance.now();
  
  console.log(`Wide fanout (100): ${(end - start).toFixed(2)}ms`);
}

// Test 3: Deep chain
{
  const ctx = createContext();
  const { signal, computed } = ctx;
  
  const s = signal(0);
  let c = computed(() => s.value * 2);
  for (let i = 0; i < 10; i++) {
    const prev = c;
    c = computed(() => prev.value + 1);
  }
  
  // Prime the graph
  c.value;
  
  const start = performance.now();
  for (let i = 0; i < 100000; i++) {
    s.value = i;
    c.value;
  }
  const end = performance.now();
  
  console.log(`Deep chain (10): ${(end - start).toFixed(2)}ms`);
}

// Test 4: Complex nested graph
{
  const ctx = createContext();
  const { signal, computed } = ctx;
  
  const signals = Array.from({ length: 10 }, (_, i) => signal(i));
  const layer1 = signals.map(s => computed(() => s.value * 2));
  const layer2 = layer1.map((c, i) => 
    computed(() => c.value + (layer1[(i + 1) % layer1.length].value))
  );
  const final = computed(() => layer2.reduce((sum, c) => sum + c.value, 0));
  
  // Prime the graph
  final.value;
  
  const start = performance.now();
  for (let i = 0; i < 10000; i++) {
    signals[i % 10].value = i;
    final.value;
  }
  const end = performance.now();
  
  console.log(`Complex graph: ${(end - start).toFixed(2)}ms`);
}