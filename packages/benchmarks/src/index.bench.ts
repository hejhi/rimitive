import { describe, bench } from 'vitest';

describe('Lattice Benchmarks', () => {
  bench('warmup', () => {
    // Warmup to ensure JIT optimization
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += i;
    }
  });
});
