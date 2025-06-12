/**
 * @fileoverview Main benchmark suite for Lattice framework
 * 
 * Benchmarks cover:
 * 1. Adapter overhead (raw vs with Lattice)
 * 2. Library comparisons (store-react vs zustand)
 * 3. Adapter performance rankings
 * 4. Real-world scenarios
 */

import { describe, bench } from 'vitest';

// Import benchmarks
import './suites/overhead.bench';
import './suites/head-to-head.bench';
import './suites/adapter-rankings.bench';
import './suites/real-world.bench';
import './suites/memory.bench';

describe('Lattice Benchmarks', () => {
  bench('warmup', () => {
    // Warmup to ensure JIT optimization
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += i;
    }
  });
});