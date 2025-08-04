import { describe, it, expect } from 'vitest';
import { createSignalFactory, createComputedFactory, createEffectFactory, createSignalAPI } from '../index';

describe('Optimization Impact Benchmarks', () => {
  it('should handle large dependency sets efficiently', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    });

    // Create a computed with many dependencies (triggers Map optimization at >10)
    const sources = Array.from({ length: 20 }, (_, i) => signal(i));
    
    const sum = computed(() => {
      return sources.reduce((acc, s) => acc + s.value, 0);
    });

    // Warm up
    expect(sum.value).toBe(190); // sum of 0-19

    // Measure repeated access (tests cache optimization)
    const iterations = 10000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      sources[i % 20]!.value = i;
      void sum.value;
    }
    
    const duration = performance.now() - start;
    const perIteration = (duration / iterations) * 1000; // microseconds
    
    console.log(`Large dependency set: ${perIteration.toFixed(2)}µs per update`);
    expect(perIteration).toBeLessThan(10); // Should be fast with Map optimization
  });

  it('should skip traversal for signals with no targets', () => {
    const { signal } = createSignalAPI({
      signal: createSignalFactory,
    });

    // Create many unobserved signals
    const signals = Array.from({ length: 1000 }, () => signal(0));
    
    const start = performance.now();
    
    // Update all signals - should be very fast since no targets
    for (let i = 0; i < 10000; i++) {
      signals[i % 1000]!.value = i;
    }
    
    const duration = performance.now() - start;
    const perUpdate = (duration / 10000) * 1000;
    
    console.log(`No-target updates: ${perUpdate.toFixed(2)}µs per update`);
    expect(perUpdate).toBeLessThan(1); // Should be <1µs with optimization
  });

  it('should benefit from global version fast path', () => {
    const { signal, computed, effect } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
    });

    // Create a deep chain
    const source = signal(0);
    let current = computed(() => source.value);
    
    for (let i = 0; i < 10; i++) {
      const prev = current;
      current = computed(() => prev.value + 1);
    }

    let effectRuns = 0;
    effect(() => {
      void current.value;
      effectRuns++;
    });

    // Reset counter
    effectRuns = 0;

    // Many reads without changes - tests global version optimization
    const start = performance.now();
    
    for (let i = 0; i < 10000; i++) {
      void current.value; // Should be fast with global version check
    }
    
    const duration = performance.now() - start;
    const perRead = (duration / 10000) * 1000;
    
    console.log(`Stable chain reads: ${perRead.toFixed(2)}µs per read`);
    expect(effectRuns).toBe(0); // No changes, no effect runs
    expect(perRead).toBeLessThan(1); // Should be very fast
  });

  it('should handle mixed workload efficiently', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    });

    // Realistic UI-like scenario
    const firstName = signal('John');
    const lastName = signal('Doe');
    const age = signal(30);
    const showDetails = signal(true);
    
    // Multiple computed layers
    const fullName = computed(() => `${firstName.value} ${lastName.value}`);
    const displayAge = computed(() => age.value.toString());
    
    const display = computed(() => {
      if (showDetails.value) {
        return `${fullName.value}, age ${displayAge.value}`;
      }
      return fullName.value;
    });

    // Simulate realistic usage pattern
    const operations = 10000;
    const start = performance.now();
    
    for (let i = 0; i < operations; i++) {
      // Mix of reads and writes
      if (i % 10 === 0) {
        firstName.value = `John${i}`;
      } else if (i % 20 === 0) {
        showDetails.value = !showDetails.value;
      } else {
        void display.value; // Mostly reads
      }
    }
    
    const duration = performance.now() - start;
    const perOp = (duration / operations) * 1000;
    
    console.log(`Mixed workload: ${perOp.toFixed(2)}µs per operation`);
    expect(perOp).toBeLessThan(5); // Should handle mixed load well
  });
});