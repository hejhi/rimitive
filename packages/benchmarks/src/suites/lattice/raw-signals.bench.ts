/**
 * Raw Signal Benchmarks
 * 
 * Fair comparison of Lattice vs Preact raw signal APIs without component overhead
 */

import { describe, bench } from 'vitest';
import { signal, computed, batch, set } from '@lattice/core';
import { signal as preactSignal, computed as preactComputed, batch as preactBatch } from '@preact/signals-core';

const ITERATIONS = 10000;

describe('Raw Signal Updates', () => {
  // Lattice Raw
  bench('Lattice Raw - single signal', () => {
    const count = signal(0);
    
    for (let i = 0; i < ITERATIONS; i++) {
      set(count, i);
      void count.value; // Read
    }
  });

  // Preact
  bench('Preact - single signal', () => {
    const count = preactSignal(0);
    
    for (let i = 0; i < ITERATIONS; i++) {
      count.value = i;
      void count.value; // Read
    }
  });
});

describe('Raw Computed Chain (a → b → c)', () => {
  // Lattice Raw
  bench('Lattice Raw - computed chain', () => {
    const a = signal(0);
    const b = computed(() => a.value * 2);
    const c = computed(() => b.value * 2);
    
    for (let i = 0; i < ITERATIONS; i++) {
      set(a, i);
      void c.value; // Force evaluation
    }
  });

  // Preact
  bench('Preact - computed chain', () => {
    const a = preactSignal(0);
    const b = preactComputed(() => a.value * 2);
    const c = preactComputed(() => b.value * 2);
    
    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void c.value; // Force evaluation
    }
  });
});

describe('Raw Diamond Pattern', () => {
  // Test:    a
  //         / \
  //        b   c
  //         \ /
  //          d
  
  // Lattice Raw
  bench('Lattice Raw - diamond', () => {
    const a = signal(0);
    const b = computed(() => a.value * 2);
    const c = computed(() => a.value * 3);
    const d = computed(() => b.value + c.value);
    
    for (let i = 0; i < ITERATIONS; i++) {
      set(a, i);
      void d.value; // Should compute b and c once each
    }
  });

  // Preact
  bench('Preact - diamond', () => {
    const a = preactSignal(0);
    const b = preactComputed(() => a.value * 2);
    const c = preactComputed(() => a.value * 3);
    const d = preactComputed(() => b.value + c.value);
    
    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value; // Should compute b and c once each
    }
  });
});

describe('Raw Batch Updates', () => {
  // Lattice Raw
  bench('Lattice Raw - batch updates', () => {
    const s1 = signal(0);
    const s2 = signal(0);
    const s3 = signal(0);
    const sum = computed(() => s1.value + s2.value + s3.value);
    
    for (let i = 0; i < ITERATIONS / 10; i++) {
      batch(() => {
        set(s1, i);
        set(s2, i * 2);
        set(s3, i * 3);
      });
      void sum.value; // Should recompute once per batch
    }
  });

  // Preact
  bench('Preact - batch updates', () => {
    const s1 = preactSignal(0);
    const s2 = preactSignal(0);
    const s3 = preactSignal(0);
    const sum = preactComputed(() => s1.value + s2.value + s3.value);
    
    for (let i = 0; i < ITERATIONS / 10; i++) {
      preactBatch(() => {
        s1.value = i;
        s2.value = i * 2;
        s3.value = i * 3;
      });
      void sum.value; // Should recompute once per batch
    }
  });
});

describe('Raw Deep Computed Tree', () => {
  // Lattice Raw
  bench('Lattice Raw - deep tree', () => {
    const root = signal(0);
    
    // Level 1
    const a1 = computed(() => root.value * 2);
    const a2 = computed(() => root.value * 3);
    
    // Level 2  
    const b1 = computed(() => a1.value + a2.value);
    const b2 = computed(() => a1.value - a2.value);
    
    // Level 3
    const c1 = computed(() => b1.value * b2.value);
    const c2 = computed(() => b1.value / (b2.value || 1));
    
    // Final
    const result = computed(() => c1.value + c2.value);
    
    for (let i = 0; i < ITERATIONS; i++) {
      set(root, i + 1); // Avoid divide by zero
      void result.value;
    }
  });

  // Preact
  bench('Preact - deep tree', () => {
    const root = preactSignal(0);
    
    // Level 1
    const a1 = preactComputed(() => root.value * 2);
    const a2 = preactComputed(() => root.value * 3);
    
    // Level 2
    const b1 = preactComputed(() => a1.value + a2.value);
    const b2 = preactComputed(() => a1.value - a2.value);
    
    // Level 3
    const c1 = preactComputed(() => b1.value * b2.value);
    const c2 = preactComputed(() => b1.value / (b2.value || 1));
    
    // Final
    const result = preactComputed(() => c1.value + c2.value);
    
    for (let i = 0; i < ITERATIONS; i++) {
      root.value = i + 1; // Avoid divide by zero
      void result.value;
    }
  });
});