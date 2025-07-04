/**
 * Fine-Grained Reactivity Benchmarks
 * 
 * Focused tests comparing equivalent operations between Lattice and Preact Signals
 */

import { describe, bench } from 'vitest';
import { createComponent } from '@lattice/core';
import type { ComponentContext } from '@lattice/core';
import { signal, computed } from '@preact/signals-core';

const ITERATIONS = 10000;

describe('Single Signal Updates', () => {
  // Lattice
  bench('Lattice - single signal', () => {
    const store = createComponent({ count: 0 });
    
    const Counter = ({ store, set }: ComponentContext<{ count: number }>) => {
      for (let i = 0; i < ITERATIONS; i++) {
        set(store.count, i);
        store.count(); // Read
      }
    };
    
    Counter(store);
  });

  // Preact
  bench('Preact - single signal', () => {
    const count = signal(0);
    
    for (let i = 0; i < ITERATIONS; i++) {
      count.value = i;
      void count.value; // Read
    }
  });
});

describe('Computed Chain (a → b → c)', () => {
  // Lattice
  bench('Lattice - computed chain', () => {
    const store = createComponent({ a: 0 });
    
    const Chain = ({ store, set, computed }: ComponentContext<{ a: number }>) => {
      const b = computed(() => store.a() * 2);
      const c = computed(() => b() * 2);
      
      for (let i = 0; i < ITERATIONS; i++) {
        set(store.a, i);
        c(); // Force evaluation
      }
    };
    
    Chain(store);
  });

  // Preact
  bench('Preact - computed chain', () => {
    const a = signal(0);
    const b = computed(() => a.value * 2);
    const c = computed(() => b.value * 2);
    
    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void c.value; // Force evaluation
    }
  });
});

describe('Diamond Pattern', () => {
  // Test:    a
  //         / \
  //        b   c
  //         \ /
  //          d
  
  // Lattice
  bench('Lattice - diamond', () => {
    const store = createComponent({ a: 0 });
    
    const Diamond = ({ store, set, computed }: ComponentContext<{ a: number }>) => {
      const b = computed(() => store.a() * 2);
      const c = computed(() => store.a() * 3);
      const d = computed(() => b() + c());
      
      for (let i = 0; i < ITERATIONS; i++) {
        set(store.a, i);
        d(); // Should compute b and c once each
      }
    };
    
    Diamond(store);
  });

  // Preact
  bench('Preact - diamond', () => {
    const a = signal(0);
    const b = computed(() => a.value * 2);
    const c = computed(() => a.value * 3);
    const d = computed(() => b.value + c.value);
    
    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value; // Should compute b and c once each
    }
  });
});

describe('Multiple Signal Dependencies', () => {
  // One computed depends on 5 signals
  
  // Lattice
  bench('Lattice - multi deps', () => {
    const store = createComponent({ s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 });
    
    const MultiDeps = ({ store, set, computed }: ComponentContext<{ 
      s1: number; s2: number; s3: number; s4: number; s5: number;
    }>) => {
      const sum = computed(() => 
        store.s1() + store.s2() + store.s3() + store.s4() + store.s5()
      );
      
      for (let i = 0; i < ITERATIONS; i++) {
        // Update different signal each iteration
        switch (i % 5) {
          case 0: set(store.s1, i); break;
          case 1: set(store.s2, i); break;
          case 2: set(store.s3, i); break;
          case 3: set(store.s4, i); break;
          case 4: set(store.s5, i); break;
        }
        sum(); // Recompute
      }
    };
    
    MultiDeps(store);
  });

  // Preact
  bench('Preact - multi deps', () => {
    const s1 = signal(0);
    const s2 = signal(0);
    const s3 = signal(0);
    const s4 = signal(0);
    const s5 = signal(0);
    
    const sum = computed(() => 
      s1.value + s2.value + s3.value + s4.value + s5.value
    );
    
    for (let i = 0; i < ITERATIONS; i++) {
      // Update different signal each iteration
      switch (i % 5) {
        case 0: s1.value = i; break;
        case 1: s2.value = i; break;
        case 2: s3.value = i; break;
        case 3: s4.value = i; break;
        case 4: s5.value = i; break;
      }
      void sum.value; // Recompute
    }
  });
});

describe('Deep Computed Tree', () => {
  // Create a tree of computeds, each depending on 2 others
  // Tests how well the system handles many interdependent computeds
  
  // Lattice
  bench('Lattice - deep tree', () => {
    const store = createComponent({ root: 0 });
    
    const DeepTree = ({ store, set, computed }: ComponentContext<{ root: number }>) => {
      // Level 1
      const a1 = computed(() => store.root() * 2);
      const a2 = computed(() => store.root() * 3);
      
      // Level 2  
      const b1 = computed(() => a1() + a2());
      const b2 = computed(() => a1() - a2());
      
      // Level 3
      const c1 = computed(() => b1() * b2());
      const c2 = computed(() => b1() / (b2() || 1));
      
      // Final
      const result = computed(() => c1() + c2());
      
      for (let i = 0; i < ITERATIONS; i++) {
        set(store.root, i + 1); // Avoid divide by zero
        result();
      }
    };
    
    DeepTree(store);
  });

  // Preact
  bench('Preact - deep tree', () => {
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
      root.value = i + 1; // Avoid divide by zero
      void result.value;
    }
  });
});