/**
 * Diamond Pattern Debug - Understanding the performance issue
 */

import { describe, bench } from 'vitest';
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import {
  signal as latticeSignal,
  computed as latticeComputed,
} from '@lattice/core';

const ITERATIONS = 1000;

describe('Diamond Pattern Debug', () => {
  // Test notification order and computation count
  bench('Preact - diamond with tracking', () => {
    let computeCountB = 0;
    let computeCountC = 0;
    let computeCountD = 0;
    
    const a = preactSignal(0);
    const b = preactComputed(() => {
      computeCountB++;
      return a.value * 2;
    });
    const c = preactComputed(() => {
      computeCountC++;
      return a.value * 3;
    });
    const d = preactComputed(() => {
      computeCountD++;
      return b.value + c.value;
    });

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value;
    }
    
    // Verify computation counts
    if (computeCountB !== ITERATIONS || computeCountC !== ITERATIONS || computeCountD !== ITERATIONS) {
      throw new Error(`Unexpected compute counts: B=${computeCountB}, C=${computeCountC}, D=${computeCountD}`);
    }
  });

  bench('Lattice - diamond with tracking', () => {
    let computeCountB = 0;
    let computeCountC = 0;
    let computeCountD = 0;
    
    const a = latticeSignal(0);
    const b = latticeComputed(() => {
      computeCountB++;
      return a.value * 2;
    });
    const c = latticeComputed(() => {
      computeCountC++;
      return a.value * 3;
    });
    const d = latticeComputed(() => {
      computeCountD++;
      return b.value + c.value;
    });

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value;
    }
    
    // Verify computation counts
    if (computeCountB !== ITERATIONS || computeCountC !== ITERATIONS || computeCountD !== ITERATIONS) {
      throw new Error(`Unexpected compute counts: B=${computeCountB}, C=${computeCountC}, D=${computeCountD}`);
    }
  });

  // Test with pre-read to warm up dependencies
  bench('Preact - diamond warmed up', () => {
    const a = preactSignal(0);
    const b = preactComputed(() => a.value * 2);
    const c = preactComputed(() => a.value * 3);
    const d = preactComputed(() => b.value + c.value);
    
    // Warm up - establish all dependencies
    void d.value;

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value;
    }
  });

  bench('Lattice - diamond warmed up', () => {
    const a = latticeSignal(0);
    const b = latticeComputed(() => a.value * 2);
    const c = latticeComputed(() => a.value * 3);
    const d = latticeComputed(() => b.value + c.value);
    
    // Warm up - establish all dependencies
    void d.value;

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      void d.value;
    }
  });
  
  // Test notification without read
  bench('Preact - diamond notify only', () => {
    const a = preactSignal(0);
    const b = preactComputed(() => a.value * 2);
    const c = preactComputed(() => a.value * 3);
    const d = preactComputed(() => b.value + c.value);
    
    // Establish dependencies
    void d.value;

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      // No read - just notification propagation
    }
  });

  bench('Lattice - diamond notify only', () => {
    const a = latticeSignal(0);
    const b = latticeComputed(() => a.value * 2);
    const c = latticeComputed(() => a.value * 3);
    const d = latticeComputed(() => b.value + c.value);
    
    // Establish dependencies
    void d.value;

    for (let i = 0; i < ITERATIONS; i++) {
      a.value = i;
      // No read - just notification propagation
    }
  });
});