/**
 * Preact vs Lattice Signal Implementation Benchmarks
 *
 * Compares performance between Preact signals and our Lattice signal implementation
 * to identify performance gaps and optimization opportunities
 */

import { describe, bench } from 'vitest';
import {
  signal as preactSignal,
  computed as preactComputed,
  batch as preactBatch,
} from '@preact/signals-core';
import {
  signal as latticeSignal,
  computed as latticeComputed,
  batch as latticeBatch,
  set as latticeSet,
} from '@lattice/core';

const ITERATIONS = 10000;

describe('Single Signal Updates', () => {
  bench('Preact - single signal', () => {
    const count = preactSignal(0);

    for (let i = 0; i < ITERATIONS; i++) {
      count.value = i;
      void count.value; // Read
    }
  });

  bench('Lattice - single signal', () => {
    const count = latticeSignal(0);

    for (let i = 0; i < ITERATIONS; i++) {
      count.value = i;
      void count.value; // Read
    }
  });

  bench('Lattice - single signal (set)', () => {
    const count = latticeSignal(0);

    for (let i = 0; i < ITERATIONS; i++) {
      latticeSet(count, i);
      void count.value; // Read
    }
  });
});

describe('Computed Chain (a → b → c)', () => {
  bench('Preact - computed chain', () => {
    const a = preactSignal(0);
    const b = preactComputed(() => a.value * 2);
    const c = preactComputed(() => b.value * 2);

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void c.value; // Force evaluation
    }
  });

  bench('Lattice - computed chain', () => {
    const a = latticeSignal(0);
    const b = latticeComputed(() => a.value * 2);
    const c = latticeComputed(() => b.value * 2);

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void c.value; // Force evaluation
    }
  });

  bench('Lattice - computed chain (set)', () => {
    const a = latticeSignal(0);
    const b = latticeComputed(() => a.value * 2);
    const c = latticeComputed(() => b.value * 2);

    for (let i = 0; i < ITERATIONS; i++) {
      latticeSet(a, i);
      void c.value; // Force evaluation
    }
  });
});

describe('Deep Computed Tree', () => {
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

  bench('Lattice - deep tree', () => {
    const root = latticeSignal(0);

    // Level 1
    const a1 = latticeComputed(() => root.value * 2);
    const a2 = latticeComputed(() => root.value * 3);

    // Level 2
    const b1 = latticeComputed(() => a1.value + a2.value);
    const b2 = latticeComputed(() => a1.value - a2.value);

    // Level 3
    const c1 = latticeComputed(() => b1.value * b2.value);
    const c2 = latticeComputed(() => b1.value / (b2.value || 1));

    // Final
    const result = latticeComputed(() => c1.value + c2.value);

    for (let i = 0; i < ITERATIONS; i++) {
      root.value = i + 1;
      void result.value;
    }
  });

  bench('Lattice - deep tree (set)', () => {
    const root = latticeSignal(0);

    // Level 1
    const a1 = latticeComputed(() => root.value * 2);
    const a2 = latticeComputed(() => root.value * 3);

    // Level 2
    const b1 = latticeComputed(() => a1.value + a2.value);
    const b2 = latticeComputed(() => a1.value - a2.value);

    // Level 3
    const c1 = latticeComputed(() => b1.value * b2.value);
    const c2 = latticeComputed(() => b1.value / (b2.value || 1));

    // Final
    const result = latticeComputed(() => c1.value + c2.value);

    for (let i = 0; i < ITERATIONS; i++) {
      latticeSet(root, i + 1); // Avoid divide by zero
      void result.value;
    }
  });
});

describe('Diamond Pattern', () => {
  // Test:    a
  //         / \
  //        b   c
  //         \ /
  //          d

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

  bench('Lattice - diamond', () => {
    const a = latticeSignal(0);
    const b = latticeComputed(() => a.value * 2);
    const c = latticeComputed(() => a.value * 3);
    const d = latticeComputed(() => b.value + c.value);

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value; // Should compute b and c once each
    }
  });

  bench('Lattice - diamond (set)', () => {
    const a = latticeSignal(0);
    const b = latticeComputed(() => a.value * 2);
    const c = latticeComputed(() => a.value * 3);
    const d = latticeComputed(() => b.value + c.value);

    for (let i = 0; i < ITERATIONS; i++) {
      latticeSet(a, i);
      void d.value; // Should compute b and c once each
    }
  });
});

describe('Batch Updates', () => {
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

  bench('Lattice - batch updates', () => {
    const s1 = latticeSignal(0);
    const s2 = latticeSignal(0);
    const s3 = latticeSignal(0);
    const sum = latticeComputed(() => s1.value + s2.value + s3.value);

    for (let i = 0; i < ITERATIONS / 10; i++) {
      latticeBatch(() => {
        s1.value = i;
        s2.value = i * 2;
        s3.value = i * 3;
      });
      void sum.value; // Should recompute once per batch
    }
  });

  bench('Lattice - batch updates (set)', () => {
    const s1 = latticeSignal(0);
    const s2 = latticeSignal(0);
    const s3 = latticeSignal(0);
    const sum = latticeComputed(() => s1.value + s2.value + s3.value);

    for (let i = 0; i < ITERATIONS / 10; i++) {
      latticeBatch(() => {
        latticeSet(s1, i);
        latticeSet(s2, i * 2);
        latticeSet(s1, i * 3);
      });
      void sum.value; // Should recompute once per batch
    }
  });
});

describe('Large Dependency Graph', () => {
  bench('Preact - large graph', () => {
    const signals = Array.from({ length: 10 }, (_, i) => preactSignal(i));
    const computed1 = preactComputed(() =>
      signals.reduce((sum, s) => sum + s.value, 0)
    );
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

  bench('Lattice - large graph', () => {
    const sigs = Array.from({ length: 10 }, (_, i) => latticeSignal(i));
    const computed1 = latticeComputed(() =>
      sigs.reduce((sum, s) => sum + s.value, 0)
    );
    const computed2 = latticeComputed(() => computed1.value * 2);
    const computed3 = latticeComputed(() => computed2.value + computed1.value);

    for (let i = 0; i < ITERATIONS / 100; i++) {
      latticeBatch(() => {
        sigs.forEach((s, idx) => {
          s.value = i * (idx + 1);
        });
      });
      void computed3.value;
    }
  });

  bench('Lattice - large graph (set)', () => {
    const sigs = Array.from({ length: 10 }, (_, i) => latticeSignal(i));
    const computed1 = latticeComputed(() =>
      sigs.reduce((sum, s) => sum + s.value, 0)
    );
    const computed2 = latticeComputed(() => computed1.value * 2);
    const computed3 = latticeComputed(() => computed2.value + computed1.value);

    for (let i = 0; i < ITERATIONS / 100; i++) {
      latticeBatch(() => {
        sigs.forEach((s, idx) => {
          latticeSet(s, i * (idx + 1));
        });
      });
      void computed3.value;
    }
  });
});

describe('Rapid Updates Without Reads', () => {
  bench('Preact - rapid updates', () => {
    const count = preactSignal(0);

    for (let i = 0; i < ITERATIONS * 2; i++) {
      count.value = i;
    }
  });

  bench('Lattice - rapid updates', () => {
    const count = latticeSignal(0);

    for (let i = 0; i < ITERATIONS * 2; i++) {
      count.value = i;
    }
  });

  bench('Lattice - rapid updates (set)', () => {
    const count = latticeSignal(0);

    for (let i = 0; i < ITERATIONS * 2; i++) {
      latticeSet(count, i);
    }
  });
});

describe('Read-heavy Workload', () => {
  bench('Preact - many reads', () => {
    const count = preactSignal(42);
    let sum = 0;

    for (let i = 0; i < ITERATIONS * 2; i++) {
      sum += count.value;
    }

    // Prevent optimization
    if (sum === 0) throw new Error('Unexpected');
  });

  bench('Lattice - many reads', () => {
    const count = latticeSignal(42);
    let sum = 0;

    for (let i = 0; i < ITERATIONS * 2; i++) {
      sum += count.value;
    }

    // Prevent optimization
    if (sum === 0) throw new Error('Unexpected');
  });
});
