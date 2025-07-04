/**
 * Preact vs Local Preact Signal Implementation Benchmarks
 * 
 * Compares performance between the official Preact signals package
 * and our local copy to ensure we haven't introduced any performance regressions
 */

import { describe, bench } from 'vitest';
import { signal as preactSignal, computed as preactComputed, batch as preactBatch } from '@preact/signals-core';
import { signal as localSignal, computed as localComputed, batch as localBatch } from '../../../../core/src/primitives/preact-signal/preact-signal';

const ITERATIONS = 10000;

describe('Single Signal Updates', () => {
  bench('Preact (npm) - single signal', () => {
    const count = preactSignal(0);
    
    for (let i = 0; i < ITERATIONS; i++) {
      count.value = i;
      void count.value; // Read
    }
  });

  bench('Preact (local) - single signal', () => {
    const count = localSignal(0);
    
    for (let i = 0; i < ITERATIONS; i++) {
      count.value = i;
      void count.value; // Read
    }
  });
});

describe('Computed Chain (a → b → c)', () => {
  bench('Preact (npm) - computed chain', () => {
    const a = preactSignal(0);
    const b = preactComputed(() => a.value * 2);
    const c = preactComputed(() => b.value * 2);
    
    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void c.value; // Force evaluation
    }
  });

  bench('Preact (local) - computed chain', () => {
    const a = localSignal(0);
    const b = localComputed(() => a.value * 2);
    const c = localComputed(() => b.value * 2);
    
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
  
  bench('Preact (npm) - diamond', () => {
    const a = preactSignal(0);
    const b = preactComputed(() => a.value * 2);
    const c = preactComputed(() => a.value * 3);
    const d = preactComputed(() => b.value + c.value);
    
    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value; // Should compute b and c once each
    }
  });

  bench('Preact (local) - diamond', () => {
    const a = localSignal(0);
    const b = localComputed(() => a.value * 2);
    const c = localComputed(() => a.value * 3);
    const d = localComputed(() => b.value + c.value);
    
    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value; // Should compute b and c once each
    }
  });
});

describe('Batch Updates', () => {
  bench('Preact (npm) - batch updates', () => {
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

  bench('Preact (local) - batch updates', () => {
    const s1 = localSignal(0);
    const s2 = localSignal(0);
    const s3 = localSignal(0);
    const sum = localComputed(() => s1.value + s2.value + s3.value);
    
    for (let i = 0; i < ITERATIONS / 10; i++) {
      localBatch(() => {
        s1.value = i;
        s2.value = i * 2;
        s3.value = i * 3;
      });
      void sum.value; // Should recompute once per batch
    }
  });
});

describe('Large Dependency Graph', () => {
  bench('Preact (npm) - large graph', () => {
    const signals = Array.from({ length: 10 }, (_, i) => preactSignal(i));
    const computed1 = preactComputed(() => signals.reduce((sum, s) => sum + s.value, 0));
    const computed2 = preactComputed(() => computed1.value * 2);
    const computed3 = preactComputed(() => computed2.value + computed1.value);
    
    for (let i = 0; i < ITERATIONS / 100; i++) {
      preactBatch(() => {
        signals.forEach((s, idx) => {
          s.value = i * (idx + 1);
        });
      });
      void computed3.value;
    }
  });

  bench('Preact (local) - large graph', () => {
    const signals = Array.from({ length: 10 }, (_, i) => localSignal(i));
    const computed1 = localComputed(() => signals.reduce((sum, s) => sum + s.value, 0));
    const computed2 = localComputed(() => computed1.value * 2);
    const computed3 = localComputed(() => computed2.value + computed1.value);
    
    for (let i = 0; i < ITERATIONS / 100; i++) {
      localBatch(() => {
        signals.forEach((s, idx) => {
          s.value = i * (idx + 1);
        });
      });
      void computed3.value;
    }
  });
});

describe('Rapid Updates Without Reads', () => {
  bench('Preact (npm) - rapid updates', () => {
    const count = preactSignal(0);
    
    for (let i = 0; i < ITERATIONS * 2; i++) {
      count.value = i;
    }
  });

  bench('Preact (local) - rapid updates', () => {
    const count = localSignal(0);
    
    for (let i = 0; i < ITERATIONS * 2; i++) {
      count.value = i;
    }
  });
});

describe('Read-heavy Workload', () => {
  bench('Preact (npm) - many reads', () => {
    const count = preactSignal(42);
    let sum = 0;
    
    for (let i = 0; i < ITERATIONS * 2; i++) {
      sum += count.value;
    }
    
    // Prevent optimization
    if (sum === 0) throw new Error('Unexpected');
  });

  bench('Preact (local) - many reads', () => {
    const count = localSignal(42);
    let sum = 0;
    
    for (let i = 0; i < ITERATIONS * 2; i++) {
      sum += count.value;
    }
    
    // Prevent optimization
    if (sum === 0) throw new Error('Unexpected');
  });
});